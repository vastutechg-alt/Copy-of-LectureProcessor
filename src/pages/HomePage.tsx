import React from 'react';
import { Link } from 'react-router-dom';
import { ProjectState } from '../App';
import { Video, Music, Scissors, FileText, MessageSquare, ArrowRight } from 'lucide-react';

export default function HomePage({ project }: { project: ProjectState }) {
  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Welcome to LectureProcessor</h1>
        <p className="text-lg text-slate-600 mb-8 max-w-3xl">
          Upload your lecture videos, extract audio, split into manageable parts, generate transcripts, and automatically create study Q&A materials using AI.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <FeatureCard icon={<Video className="w-8 h-8 text-blue-500" />} title="1. Upload" description="Upload any video format up to 2GB." />
          <FeatureCard icon={<Music className="w-8 h-8 text-indigo-500" />} title="2. Extract & Split" description="Convert to MP3 and split into parts under 20MB." />
          <FeatureCard icon={<FileText className="w-8 h-8 text-emerald-500" />} title="3. Transcribe" description="Generate accurate transcripts in English and Sinhala." />
          <FeatureCard icon={<MessageSquare className="w-8 h-8 text-purple-500" />} title="4. Generate Q&A" description="Create study materials, FAQs, and interview questions." />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/upload" className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-xl shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Start New Project
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
          <Link to="/settings" className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-700 bg-white border border-slate-300 rounded-xl shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Configure API Key
          </Link>
        </div>
      </div>

      {project.id && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Current Project</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Video File</span>
              <span className="font-medium text-slate-900">{project.originalName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Audio Extracted</span>
              <span className="font-medium text-slate-900">{project.audioUrl ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Split Parts</span>
              <span className="font-medium text-slate-900">{project.splits.length} parts</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-slate-500">Transcript Generated</span>
              <span className="font-medium text-slate-900">{project.fullTranscript ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">Q&A Generated</span>
              <span className="font-medium text-slate-900">{project.qaList.length} items</span>
            </div>
          </div>
          <div className="mt-6">
            <Link to="/process" className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center">
              Continue Processing <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}
