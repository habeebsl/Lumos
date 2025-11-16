'use client';

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh, faTrophy } from '@fortawesome/free-solid-svg-icons';

interface Message {
  role: 'kid' | 'teacher';
  content: string;
  reaction?: 'confused' | 'surprised' | 'skeptical' | 'understanding';
}

interface Props {
  topic: string;
  lessonContent: string;
  onComplete: () => void;
  onExit: () => void;
}

export default function TeachingChallenge({ topic, lessonContent, onComplete, onExit }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [understanding, setUnderstanding] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const maxUnderstanding = 7;
  const MAX_RETRIES = 3;

  // Initialize with kid's first question
  useEffect(() => {
    startChallenge();
  }, []);

  const startChallenge = async () => {
    // Reset all state
    setMessages([]);
    setUnderstanding(0);
    setIsComplete(false);
    setCurrentInput('');
    setError(null);
    setRetryCount(0);
    setIsThinking(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch('/api/teaching-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          topic,
          lessonContent,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to start challenge');
      }

      const data = await response.json();
      
      if (!data.question) {
        throw new Error('Invalid response from server');
      }
      
      setMessages([{
        role: 'kid',
        content: data.question,
        reaction: 'confused',
      }]);

      // Generate audio for first question
      if (data.question) {
        generateAudio(data.question);
      }
    } catch (error: any) {
      console.error('Failed to start challenge:', error);
      
      if (error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(error.message || 'Failed to start challenge. Please try again.');
      }
      
      // Fallback to a default question
      setMessages([{
        role: 'kid',
        content: `What is ${topic}? Can you explain it to me?`,
        reaction: 'confused',
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const generateAudio = async (text: string) => {
    try {
      const response = await fetch('/api/generate-kid-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        // Audio will auto-play via useEffect
      }
    } catch (error) {
      console.error('Failed to generate audio:', error);
    }
  };

  // Auto-play audio when URL changes
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
    }
  }, [audioUrl]);

  const handleSubmit = async () => {
    if (!currentInput.trim() || isThinking) return;

    const trimmedInput = currentInput.trim();
    if (trimmedInput.length < 5) {
      setError('Please provide a more detailed explanation');
      return;
    }

    // Add teacher's explanation
    const newMessages: Message[] = [
      ...messages,
      { role: 'teacher', content: trimmedInput },
    ];
    setMessages(newMessages);
    setCurrentInput('');
    setError(null);
    setIsThinking(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/teaching-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          topic,
          lessonContent,
          conversation: newMessages,
          explanation: trimmedInput,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      if (!data.response) {
        throw new Error('Invalid response from server');
      }

      // Accumulate understanding: each response adds points (capped at max)
      const pointsEarned = Math.floor((data.understanding || 0) / 2); // 0-10 becomes 0-5 points
      const newUnderstanding = Math.min(understanding + pointsEarned, maxUnderstanding);
      setUnderstanding(newUnderstanding);

      // Check if complete
      if (newUnderstanding >= maxUnderstanding) {
        setIsComplete(true);
        setMessages([
          ...newMessages,
          {
            role: 'kid',
            content: data.response,
            reaction: 'understanding',
          },
        ]);
        generateAudio(data.response);
      } else {
        setMessages([
          ...newMessages,
          {
            role: 'kid',
            content: data.response,
            reaction: data.reaction || 'confused',
          },
        ]);
        generateAudio(data.response);
      }
      
      setRetryCount(0); // Reset retry count on success
    } catch (error: any) {
      console.error('Failed to get response:', error);
      
      if (error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(error.message || 'Failed to get response. Please try again.');
      }
      
      // Retry logic with exponential backoff
      if (retryCount < MAX_RETRIES) {
        setRetryCount(retryCount + 1);
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        setTimeout(() => {
          setError(null);
          // Keep the teacher's message but allow retry
        }, delay);
      } else {
        // Fallback response after max retries
        setMessages([
          ...newMessages,
          {
            role: 'kid',
            content: "Hmm, I'm having trouble thinking right now. Can you try explaining again?",
            reaction: 'confused',
          },
        ]);
        setRetryCount(0);
      }
    } finally {
      setIsThinking(false);
    }
  };

  const replayAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getReactionEmoji = (reaction?: string) => {
    switch (reaction) {
      case 'confused': return '🤔';
      case 'surprised': return '😮';
      case 'skeptical': return '🤨';
      case 'understanding': return '😊';
      default: return '🤔';
    }
  };

  const getAnimationClass = (reaction?: string) => {
    switch (reaction) {
      case 'surprised': return 'animate-bounce';
      case 'understanding': return 'animate-pulse';
      default: return '';
    }
  };

  const currentKidMessage = messages.filter(m => m.role === 'kid').pop();

  if (isComplete) {
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-black border border-white/10 rounded-3xl p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4 text-purple-400">
            <FontAwesomeIcon icon={faTrophy} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            You're an Amazing Teacher!
          </h2>
          <p className="text-lg text-white/70 mb-6">
            "WOW! I totally get {topic} now! You explained it so well!"
          </p>
          
          <div className="flex gap-3 justify-center">
            <button
              onClick={onComplete}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all shadow-lg"
            >
              Back to Lesson
            </button>
            <button
              onClick={startChallenge}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all border border-white/20"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-4">
      <div className="max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white">Teaching Challenge</h2>
            <p className="text-sm text-white/60">Explain {topic} to a curious 5-year-old</p>
          </div>
          <button
            onClick={onExit}
            className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/70 hover:text-white"
            aria-label="Exit"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white/60">Understanding Progress</span>
            <span className="text-sm font-bold text-purple-400">{understanding}/{maxUnderstanding}</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-600 transition-all duration-500 rounded-full"
              style={{ width: `${(understanding / maxUnderstanding) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-start p-6 relative overflow-y-auto min-h-0">
          {/* Kid Avatar */}
          <div className="mb-6 flex-shrink-0">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center text-6xl">
              {getReactionEmoji(currentKidMessage?.reaction)}
            </div>
          </div>

          {/* Kid's Question */}
          {currentKidMessage && (
            <div className="max-w-2xl w-full mb-6 flex-shrink-0">
              <div 
                className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 relative cursor-pointer hover:bg-white/10 transition-all"
                onClick={replayAudio}
                title="Click to replay audio"
              >
                <div className="absolute -top-2 -right-2 bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={faVolumeHigh} className="text-sm" />
                </div>
                <p className="text-lg text-white leading-relaxed">
                  "{currentKidMessage.content}"
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="max-w-2xl w-full mb-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 text-white/60">
              <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
              <span className="text-sm">Thinking...</span>
            </div>
          )}

          {/* History Toggle */}
          {messages.length > 2 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="absolute top-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm border border-white/20 transition-all"
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          )}
        </div>

        {/* Conversation History Sidebar */}
        {showHistory && (
          <div className="absolute top-20 right-4 bottom-32 w-80 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="font-semibold text-white">Conversation</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg text-sm ${
                    msg.role === 'kid'
                      ? 'bg-purple-600/20 text-white ml-0 mr-4 border border-purple-500/30'
                      : 'bg-white/10 text-white ml-4 mr-0 border border-white/10'
                  }`}
                >
                  <div className="font-semibold mb-1 text-xs text-white/60">
                    {msg.role === 'kid' ? '👧 Kid' : '👨‍🏫 You'}
                  </div>
                  {msg.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          <div className="max-w-2xl mx-auto relative">
            <textarea
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => {
                // Stop propagation to prevent parent page keyboard shortcuts
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Type your explanation here... (Enter to send, Shift+Enter for new line)"
              disabled={isThinking}
              className="w-full pl-4 pr-28 py-3 pb-12 bg-white/5 border border-white/20 rounded-xl focus:border-purple-400 focus:bg-white/10 focus:outline-none resize-none text-white placeholder-white/40 disabled:bg-white/5 disabled:text-white/30"
              rows={3}
            />
            <button
              onClick={handleSubmit}
              disabled={!currentInput.trim() || isThinking}
              className="absolute right-3 bottom-5 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:from-white/10 disabled:to-white/10 text-white rounded-lg font-semibold text-sm transition-all disabled:cursor-not-allowed"
            >
              Explain
            </button>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}
    </div>
  );
}
