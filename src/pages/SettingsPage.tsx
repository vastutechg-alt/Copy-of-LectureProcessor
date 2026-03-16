import { useState } from 'react';
import { Settings, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function SettingsPage({ apiKey, saveApiKey }: { apiKey: string, saveApiKey: (key: string) => void }) {
  const [inputKey, setInputKey] = useState(apiKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error', message: string } | null>(null);

  const handleSave = () => {
    saveApiKey(inputKey);
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await axios.post(`${import.meta.env.VITE_APP_URL || ''}/api/test-key`, { apiKey: inputKey });
      if (response.data.status === 'success') {
        setTestResult({ status: 'success', message: response.data.message });
      }
    } catch (err: any) {
      setTestResult({ status: 'error', message: err.response?.data?.error || 'Network error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center mb-6">
          <Settings className="w-6 h-6 text-indigo-500 mr-3" />
          <h2 className="text-xl font-semibold text-slate-900">API Configuration</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 mb-2">
              Gemini API Key
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                name="apiKey"
                id="apiKey"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-xl p-3 border"
                placeholder="AIzaSy..."
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Your API key is stored securely in your browser's local storage and is only sent to the backend for processing.
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleSave}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Save Key
            </button>
            <button
              onClick={handleTest}
              disabled={isTesting || !inputKey}
              className="inline-flex justify-center py-2 px-4 border border-slate-300 shadow-sm text-sm font-medium rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isTesting ? (
                <><Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-500" /> Testing...</>
              ) : (
                'Test API Key'
              )}
            </button>
          </div>

          {testResult && (
            <div className={`mt-4 p-4 rounded-xl flex items-start ${testResult.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
              {testResult.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              )}
              <div>
                <h3 className={`text-sm font-medium ${testResult.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.status === 'success' ? 'Success' : 'Error'}
                </h3>
                <p className={`mt-1 text-sm ${testResult.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
