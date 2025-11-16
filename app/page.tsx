'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullseye, faMicrophone, faComments, faGraduationCap } from '@fortawesome/free-solid-svg-icons';
import TeachingChallenge from '@/components/TeachingChallenge';

export default function Home() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTestChallenge, setShowTestChallenge] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError('Please enter a topic');
      return;
    }

    if (trimmedTopic.length > 200) {
      setError('Topic is too long. Please keep it under 200 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: trimmedTopic }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.lessonId) {
        throw new Error('Invalid response from server');
      }

      router.push(`/lesson/${data.lessonId}`);
    } catch (error: any) {
      console.error('Error generating lesson:', error);
      
      if (error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(error.message || 'Failed to generate lesson. Please try again.');
      }
    } finally {
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
              onChange={(e) => {
                setTopic(e.target.value);
                setError(null); // Clear error when user types
              }}
              placeholder="Enter any concept... (e.g., Quantum Mechanics, The French Revolution)"
              className="w-full px-6 py-4 text-lg rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-indigo-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-purple-900 outline-none transition-all"
              disabled={loading}
              maxLength={200}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
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
            <div className="text-3xl mb-2 text-indigo-600">
              <FontAwesomeIcon icon={faBullseye} />
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Structured Milestones</div>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2 text-purple-600">
              <FontAwesomeIcon icon={faMicrophone} />
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Voice Teacher</div>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2 text-indigo-600">
              <FontAwesomeIcon icon={faComments} />
            </div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Ask Questions Anytime</div>
          </div>
        </div>

        {/* Test Teaching Challenge Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowTestChallenge(true)}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl font-semibold transition-all shadow-lg inline-flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faGraduationCap} />
            Test Teaching Challenge
          </button>
        </div>
      </main>

      {/* Test Teaching Challenge */}
      {showTestChallenge && (
        <TeachingChallenge
          topic="Photosynthesis"
          lessonContent="Photosynthesis is the process by which plants make their own food using sunlight, water, and carbon dioxide. Plants have special parts called chloroplasts that contain chlorophyll, which captures light energy. This energy is used to convert water and CO2 into glucose (sugar) and oxygen. The oxygen is released into the air, which we breathe!"
          onComplete={() => setShowTestChallenge(false)}
          onExit={() => setShowTestChallenge(false)}
        />
      )}
    </div>
  );
}
