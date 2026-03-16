import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { 
  Home, Upload, Music, Scissors, FileText, MessageSquare, 
  Download, Settings as SettingsIcon, Menu, X, CheckCircle, AlertCircle
} from 'lucide-react';

import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import SettingsPage from './pages/SettingsPage';
import ProcessingPage from './pages/ProcessingPage';

export interface ProjectState {
  id: string | null;
  originalName: string | null;
  audioUrl: string | null;
  audioFileName: string | null;
  splits: { fileName: string; url: string; size: number; transcript?: string }[];
  fullTranscript: string | null;
  qaList: { question: string; answer: string }[];
}

export default function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [apiKey, setApiKey] = useState<string>('');
  
  const [project, setProject] = useState<ProjectState>({
    id: null,
    originalName: null,
    audioUrl: null,
    audioFileName: null,
    splits: [],
    fullTranscript: null,
    qaList: []
  });

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 shrink-0">
            <h1 className="text-lg font-bold text-indigo-600 truncate">LectureProcessor</h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
            <NavItem to="/" icon={<Home className="w-5 h-5" />} label="Home" />
            <NavItem to="/upload" icon={<Upload className="w-5 h-5" />} label="1. Upload Video" />
            <NavItem to="/process" icon={<Music className="w-5 h-5" />} label="2. Processing" />
            <NavItem to="/settings" icon={<SettingsIcon className="w-5 h-5" />} label="Settings" />
          </nav>
          <div className="p-4 border-t border-slate-200 shrink-0 text-xs text-slate-500 text-center">
            <p>Developed By J.Godakanda Arachchi</p>
            <a href="https://vaastu.lk" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium mt-1 inline-block">Vaastu.lk</a>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="flex items-center h-16 px-4 bg-white border-b border-slate-200 md:hidden">
            <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-700">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="ml-4 text-lg font-bold text-indigo-600 truncate">LectureProcessor</h1>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
              <Routes>
                <Route path="/" element={<HomePage project={project} />} />
                <Route path="/upload" element={<UploadPage project={project} setProject={setProject} />} />
                <Route path="/process" element={<ProcessingPage project={project} setProject={setProject} apiKey={apiKey} />} />
                <Route path="/settings" element={<SettingsPage apiKey={apiKey} saveApiKey={saveApiKey} />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        isActive 
          ? 'bg-indigo-50 text-indigo-700' 
          : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className={`mr-3 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
