'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    
    try {
      // Generate lesson - we'll create this API route next
      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate lesson: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        alert(`Error: ${data.error}`);
        setLoading(false);
        return;
      }

      router.push(`/lesson/${data.lessonId}`);
    } catch (error) {
      console.error('Error generating lesson:', error);
      alert('Failed to generate lesson. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-black dark:to-purple-950">
      <main className="w-full max-w-2xl px-6">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Lumos
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Learn any concept with interactive audio + visuals
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter any concept... (e.g., Quantum Mechanics, The French Revolution)"
              className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-indigo-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-purple-900 outline-none transition-all"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="w-full py-4 text-lg font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating your lesson...
              </span>
            ) : (
              'Start Learning'
            )}
          </button>
        </form>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div className="text-3xl mb-2">🎯</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Structured Milestones</div>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">🎙️</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Voice Teacher</div>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">💬</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask Questions Anytime</div>
          </div>
        </div>
      </main>
    </div>
  );
}
