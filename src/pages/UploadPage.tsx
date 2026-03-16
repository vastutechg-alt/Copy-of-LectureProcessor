import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectState } from '../App';
import { Upload, FileVideo, AlertCircle, CheckCircle2, Loader2, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

import { v4 as uuidv4 } from 'uuid';

export default function UploadPage({ project, setProject }: { project: ProjectState, setProject: any }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const [videoUrl, setVideoUrl] = useState('');
  const [bitrate, setBitrate] = useState('128k');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    
    // Broad check: either MIME type starts with video/ OR file extension is a known video format
    const isVideoMime = selectedFile.type.startsWith('video/');
    const isVideoExt = selectedFile.name.match(/\.(mp4|avi|mov|mkv|webm|vob|flv|wmv|m4v|ts|mts|m2ts|3gp|rmvb|mpg|mpeg)$/i);
    
    if (!isVideoMime && !isVideoExt) {
      setError('Unsupported file format. Please upload a valid video file.');
      setFile(null);
      return;
    }
    
    if (selectedFile.size > 2 * 1024 * 1024 * 1024) {
      setError('File is too large. Maximum size is 2GB.');
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (uploadMethod === 'file' && !file) return;
    if (uploadMethod === 'url' && !videoUrl) return;
    
    setIsUploading(true);
    setProgress(0);
    setStatusMessage(uploadMethod === 'url' ? 'Starting download...' : 'Uploading...');
    setError(null);

    try {
      if (uploadMethod === 'url') {
        const response = await axios.post(`${import.meta.env.VITE_APP_URL || ''}/api/process-url`, {
          url: videoUrl,
          bitrate
        });
        
        const fileId = response.data.fileId;
        
        // Poll for status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`${import.meta.env.VITE_APP_URL || ''}/api/processing-status/${fileId}`);
            const { status, progress: procProgress, result, error: procError } = statusRes.data;

            if (status === 'error') {
              clearInterval(pollInterval);
              setError(procError || 'Failed to process video URL');
              setIsUploading(false);
            } else if (status === 'completed') {
              clearInterval(pollInterval);
              setProject({
                id: result.id,
                originalName: result.originalName,
                audioUrl: result.audioUrl,
                audioFileName: result.audioFileName,
                splits: [],
                fullTranscript: null,
                qaList: []
              });
              navigate('/process');
            } else {
              let msg = status === 'downloading' ? 'Downloading video...' : 'Extracting audio...';
              if (status === 'extracting' && procProgress === 0 && statusRes.data.timemark) {
                msg += ` (Processed: ${statusRes.data.timemark})`;
              }
              setStatusMessage(msg);
              setProgress(procProgress || 0);
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
          }
        }, 3000);
        
        return; // Exit early since polling handles the rest
      }

      // File upload logic
      const fileId = uuidv4();
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      const totalChunks = Math.ceil(file!.size / chunkSize);

      // 1. Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file!.size);
        const chunk = file!.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileId', fileId);
        formData.append('chunkIndex', String(i));
        formData.append('totalChunks', String(totalChunks));
        formData.append('originalName', file!.name);

        await axios.post(`${import.meta.env.VITE_APP_URL || ''}/api/upload-chunk`, formData);
        
        const percentCompleted = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(percentCompleted);
      }

      // 2. Start processing
      setStatusMessage('Merging and Extracting Audio...');
      setProgress(0);
      
      await axios.post(`${import.meta.env.VITE_APP_URL || ''}/api/start-processing`, {
        fileId,
        originalName: file!.name,
        totalChunks,
        bitrate
      });

      // 3. Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${import.meta.env.VITE_APP_URL || ''}/api/processing-status/${fileId}`);
          const { status, progress: procProgress, result, error: procError } = statusRes.data;

          if (status === 'error') {
            clearInterval(pollInterval);
            setError(procError || 'Failed to process video');
            setIsUploading(false);
          } else if (status === 'completed') {
            clearInterval(pollInterval);
            setProject({
              id: result.id,
              originalName: result.originalName,
              audioUrl: result.audioUrl,
              audioFileName: result.audioFileName,
              splits: [],
              fullTranscript: null,
              qaList: []
            });
            navigate('/process');
          } else {
            // merging or extracting
            let msg = status === 'merging' ? 'Merging chunks...' : 'Extracting audio...';
            if (status === 'extracting' && procProgress === 0 && statusRes.data.timemark) {
              msg += ` (Processed: ${statusRes.data.timemark})`;
            }
            setStatusMessage(msg);
            setProgress(procProgress || 0);
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
          // Don't stop polling on a single network error, but maybe after a few
        }
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'An error occurred during upload and processing.');
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Upload Video</h1>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        {/* Upload Method Toggle */}
        <div className="flex space-x-4 mb-8">
          <button
            onClick={() => setUploadMethod('file')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center transition-colors ${
              uploadMethod === 'file' 
                ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200' 
                : 'bg-slate-50 text-slate-600 border-2 border-transparent hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Local File
          </button>
          <button
            onClick={() => setUploadMethod('url')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center transition-colors ${
              uploadMethod === 'url' 
                ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-200' 
                : 'bg-slate-50 text-slate-600 border-2 border-transparent hover:bg-slate-100'
            }`}
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Paste Video Link
          </button>
        </div>

        {uploadMethod === 'file' ? (
          <div 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${file ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="video/*"
            />
            
            {file ? (
              <div className="flex flex-col items-center">
                <FileVideo className="w-16 h-16 text-indigo-500 mb-4" />
                <p className="text-lg font-medium text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                {!isUploading && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="mt-4 text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    Remove File
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center cursor-pointer">
                <Upload className="w-16 h-16 text-slate-400 mb-4" />
                <p className="text-lg font-medium text-slate-900">Click or drag video to upload</p>
                <p className="text-sm text-slate-500 mt-2">Any video format up to 2GB</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6">
            <label htmlFor="videoUrl" className="block text-sm font-medium text-slate-700 mb-2">
              Video URL (YouTube or direct link)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LinkIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="url"
                id="videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={isUploading}
                placeholder="https://www.youtube.com/watch?v=..."
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 rounded-xl flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!file && uploadMethod === 'file' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 mb-2">Or try the app with a sample project</p>
            <button
              onClick={() => {
                setProject({
                  id: 'sample-project',
                  originalName: 'Sample_Lecture_Video.mp4',
                  audioUrl: '#',
                  audioFileName: 'sample_audio.mp3',
                  splits: [
                    { fileName: 'sample_audio_part_001.mp3', url: '#', size: 1024 * 1024 * 5, transcript: 'Welcome to this lecture on modern architecture. Today we will discuss the principles of sustainable design and how they apply to urban environments. Sustainable architecture seeks to minimize the negative environmental impact of buildings by efficiency and moderation in the use of materials, energy, and development space. The core idea is to ensure that our actions and decisions today do not inhibit the opportunities of future generations. We must consider the lifecycle of materials, energy consumption, and the overall impact on the ecosystem.' }
                  ],
                  fullTranscript: 'Welcome to this lecture on modern architecture. Today we will discuss the principles of sustainable design and how they apply to urban environments. Sustainable architecture seeks to minimize the negative environmental impact of buildings by efficiency and moderation in the use of materials, energy, and development space. The core idea is to ensure that our actions and decisions today do not inhibit the opportunities of future generations. We must consider the lifecycle of materials, energy consumption, and the overall impact on the ecosystem.',
                  qaList: []
                });
                navigate('/process');
              }}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Load Sample Project
            </button>
          </div>
        )}

        {(file || uploadMethod === 'url') && (
          <div className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Audio Quality (Bitrate)</label>
              <div className="flex space-x-4">
                {['64k', '96k', '128k'].map((b) => (
                  <label key={b} className="flex items-center">
                    <input 
                      type="radio" 
                      name="bitrate" 
                      value={b} 
                      checked={bitrate === b} 
                      onChange={(e) => setBitrate(e.target.value)}
                      disabled={isUploading}
                      className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-slate-700">{b.replace('k', ' kbps')}</span>
                  </label>
                ))}
              </div>
              {file && (
                <p className="text-xs text-slate-500 mt-2">
                  Estimated MP3 size: ~{((file.size / (1024 * 1024)) * (parseInt(bitrate) / 1000)).toFixed(1)} MB (rough estimate)
                </p>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-slate-700">
                  <span>{statusMessage}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleUpload}
                disabled={isUploading || (uploadMethod === 'url' && !videoUrl)}
                className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white ${
                  isUploading || (uploadMethod === 'url' && !videoUrl) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    {uploadMethod === 'url' ? <LinkIcon className="-ml-1 mr-2 h-5 w-5" /> : <Upload className="-ml-1 mr-2 h-5 w-5" />}
                    {uploadMethod === 'url' ? 'Process Video Link' : 'Upload & Extract Audio'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
