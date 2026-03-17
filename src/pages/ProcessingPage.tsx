import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectState } from '../App';
import { Scissors, FileText, MessageSquare, Download, Loader2, CheckCircle2, AlertCircle, Copy, FileDown, ArrowLeft, RotateCcw } from 'lucide-react';
import axios from 'axios';

export default function ProcessingPage({ project, setProject, apiKey }: { project: ProjectState, setProject: any, apiKey: string }) {
  const navigate = useNavigate();
  const [isSplitting, setIsSplitting] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingQA, setIsGeneratingQA] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [qaStyle, setQaStyle] = useState('simple');
  const [qaCount, setQaCount] = useState(10);
  const [qaLanguage, setQaLanguage] = useState('english');
  const [copiedQA, setCopiedQA] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const handleSplit = async () => {
    if (!project.id || !project.audioFileName) return;
    setIsSplitting(true);
    setError(null);
    try {
      const baseUrl = (import.meta.env.VITE_APP_URL || '').replace(/\/$/, '');
      const response = await axios.post(`${baseUrl}/api/split-audio`, {
        id: project.id,
        audioFileName: project.audioFileName
      });
      if (response.data.status === 'success') {
        const partsWithUrl = response.data.parts.map((p: any) => ({
          ...p,
          url: baseUrl + p.url
        }));
        setProject({ ...project, splits: partsWithUrl });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to split audio');
    } finally {
      setIsSplitting(false);
    }
  };

  const handleTranscribe = async () => {
    if (!project.splits.length) return;
    setIsTranscribing(true);
    setError(null);
    
    try {
      let fullText = '';
      const updatedSplits = [...project.splits];
      
      for (let i = 0; i < project.splits.length; i++) {
        const split = project.splits[i];
        if (!split.transcript) {
          const baseUrl = (import.meta.env.VITE_APP_URL || '').replace(/\/$/, '');
          const response = await axios.post(`${baseUrl}/api/transcribe`, {
            fileName: split.fileName,
            apiKey
          });
          if (response.data.status === 'success') {
            updatedSplits[i].transcript = response.data.transcript;
            fullText += `\n\n--- Part ${i + 1} ---\n\n${response.data.transcript}`;
          }
        } else {
          fullText += `\n\n--- Part ${i + 1} ---\n\n${split.transcript}`;
        }
      }
      
      setProject({ ...project, splits: updatedSplits, fullTranscript: fullText.trim() });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to transcribe audio parts');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleGenerateQA = async () => {
    if (!project.fullTranscript) return;
    setIsGeneratingQA(true);
    setError(null);
    try {
      const baseUrl = (import.meta.env.VITE_APP_URL || '').replace(/\/$/, '');
      const response = await axios.post(`${baseUrl}/api/generate-qa`, {
        transcript: project.fullTranscript,
        style: qaStyle,
        count: qaCount,
        language: qaLanguage,
        apiKey
      });
      if (response.data.status === 'success') {
        setProject({ ...project, qaList: response.data.qaList });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate Q&A');
    } finally {
      setIsGeneratingQA(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const copyQAToClipboard = () => {
    if (!project.qaList.length) return;
    const text = project.qaList.map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n');
    copyToClipboard(text);
    setCopiedQA(true);
    setTimeout(() => setCopiedQA(false), 2000);
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (!project.qaList.length) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Question,Answer\n"
      + project.qaList.map(qa => `"${qa.question.replace(/"/g, '""')}","${qa.answer.replace(/"/g, '""')}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encodedUri;
    a.download = `${project.originalName}_QA.csv`;
    a.click();
  };

  if (!project.id) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-700">No active project</h2>
        <p className="text-slate-500 mt-2">Please upload a video first to start processing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center">
        <button 
          onClick={() => navigate('/upload')} 
          className="mr-4 p-2 text-slate-500 hover:text-slate-700 bg-white rounded-full shadow-sm border border-slate-200 transition-colors"
          title="Back to Upload"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Processing: {project.originalName}</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 rounded-xl flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Audio Extracted */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
            <h2 className="text-lg font-semibold text-slate-900">Audio Extracted</h2>
          </div>
          {project.audioUrl && (
            <a href={project.audioUrl} download className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center">
              <Download className="w-4 h-4 mr-1" /> Download MP3
            </a>
          )}
        </div>
        
        {project.splits.length === 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-600 mb-4">Split the audio into smaller parts (under 20MB) for AI transcription.</p>
            <button
              onClick={handleSplit}
              disabled={isSplitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSplitting ? <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Splitting...</> : <><Scissors className="-ml-1 mr-2 h-4 w-4" /> Split Audio</>}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Split Parts */}
      {project.splits.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
              <h2 className="text-lg font-semibold text-slate-900">Audio Split into {project.splits.length} parts</h2>
            </div>
            {!project.fullTranscript && (
              <button 
                onClick={() => setProject({ ...project, splits: [] })} 
                className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center transition-colors"
                title="Undo Split"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Undo
              </button>
            )}
          </div>
          
          <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-2">
            {project.splits.map((split, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-sm font-medium text-slate-700">{split.fileName}</span>
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-slate-500">{(split.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <a href={split.url} download className="text-indigo-600 hover:text-indigo-800">
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {!project.fullTranscript && (
            <div>
              <p className="text-sm text-slate-600 mb-4">Generate transcripts for all parts and merge them.</p>
              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isTranscribing ? <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Transcribing...</> : <><FileText className="-ml-1 mr-2 h-4 w-4" /> Generate Transcript</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Transcript */}
      {project.fullTranscript && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
              <h2 className="text-lg font-semibold text-slate-900">Transcript Generated</h2>
            </div>
            <div className="flex space-x-2 items-center">
              {!project.qaList.length && (
                <button 
                  onClick={() => setProject({ ...project, fullTranscript: null })} 
                  className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center mr-4 transition-colors"
                  title="Undo Transcript"
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Undo
                </button>
              )}
              <button onClick={() => copyToClipboard(project.fullTranscript!)} className={`${copiedTranscript ? 'text-green-500' : 'text-slate-500 hover:text-slate-700'} p-1 transition-colors`} title="Copy Transcript">
                {copiedTranscript ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
              <button onClick={() => downloadText(project.fullTranscript!, `${project.originalName}_transcript.txt`)} className="text-slate-500 hover:text-slate-700 p-1" title="Download Transcript">
                <FileDown className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <textarea
            value={project.fullTranscript}
            onChange={(e) => setProject({ ...project, fullTranscript: e.target.value })}
            className="w-full h-64 p-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
          />

          {project.qaList.length === 0 && (
            <div className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="text-md font-medium text-slate-900 mb-4">Generate Q&A from Transcript</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Style</label>
                  <select 
                    value={qaStyle} 
                    onChange={(e) => setQaStyle(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border bg-white"
                  >
                    <option value="simple">Simple Q&A</option>
                    <option value="interview">Interview style</option>
                    <option value="teaching">Teaching / lesson style</option>
                    <option value="faq">FAQ style summary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                  <select 
                    value={qaLanguage} 
                    onChange={(e) => setQaLanguage(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border bg-white"
                  >
                    <option value="english">English</option>
                    <option value="sinhala">Sinhala (සිංහල)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Count</label>
                  <select 
                    value={qaCount} 
                    onChange={(e) => setQaCount(Number(e.target.value))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl border bg-white"
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={20}>20 Questions</option>
                    <option value={30}>30 Questions</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerateQA}
                disabled={isGeneratingQA}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isGeneratingQA ? <><Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Generating...</> : <><MessageSquare className="-ml-1 mr-2 h-4 w-4" /> Generate Q&A</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Q&A */}
      {project.qaList.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mr-3" />
              <h2 className="text-lg font-semibold text-slate-900">Q&A Generated ({project.qaList.length})</h2>
            </div>
            <div className="flex space-x-2 items-center">
              <button 
                onClick={() => setProject({ ...project, qaList: [] })} 
                className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center mr-4 transition-colors"
                title="Undo Q&A"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Undo
              </button>
              <button onClick={copyQAToClipboard} className={`${copiedQA ? 'text-green-500' : 'text-slate-500 hover:text-slate-700'} p-1 transition-colors`} title="Copy Q&A">
                {copiedQA ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
              <button onClick={() => downloadCSV()} className="text-slate-500 hover:text-slate-700 p-1" title="Download CSV">
                <FileDown className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="space-y-6">
            {project.qaList.map((qa, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="mb-2">
                  <span className="font-semibold text-indigo-600 mr-2">Q{idx + 1}:</span>
                  <input 
                    type="text" 
                    value={qa.question} 
                    onChange={(e) => {
                      const newList = [...project.qaList];
                      newList[idx].question = e.target.value;
                      setProject({ ...project, qaList: newList });
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 font-medium text-slate-900"
                  />
                </div>
                <div>
                  <span className="font-semibold text-emerald-600 mr-2">A:</span>
                  <textarea 
                    value={qa.answer} 
                    onChange={(e) => {
                      const newList = [...project.qaList];
                      newList[idx].answer = e.target.value;
                      setProject({ ...project, qaList: newList });
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-700 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
