'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface Milestone {
  id: number;
  title: string;
  transcript: string;
  imageUrls: string[];
  audioTimestamps: { time: number; action: string }[];
}

interface Lesson {
  id: string;
  topic: string;
  milestones: Milestone[];
}

// Helper to format time in MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function LessonPage() {
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [currentMilestone, setCurrentMilestone] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [highlightedText, setHighlightedText] = useState<string[]>([]);
  const [showIntro, setShowIntro] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch lesson data
  useEffect(() => {
    if (lessonId) {
      fetch(`/api/generate-lesson?id=${lessonId}`)
        .then(res => res.json())
        .then(data => setLesson(data));
    }
  }, [lessonId]);

  // Fetch audio when milestone changes
  useEffect(() => {
    if (!lesson) return;

    const milestone = lesson.milestones[currentMilestone];
    setLoadingAudio(true);
    setAudioUrl('');
    setIsPlaying(false);

    // Generate audio for current milestone
    fetch('/api/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneId: `${lessonId}-${currentMilestone}`,
        transcript: milestone.transcript,
      }),
    })
      .then(res => res.json())
      .then(data => {
        setAudioUrl(data.audioUrl || '');
        setLoadingAudio(false);
      })
      .catch(err => {
        console.error('Failed to load audio:', err);
        setLoadingAudio(false);
      });
  }, [currentMilestone, lesson, lessonId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!lesson) return;

      switch(e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'c':
          setShowChat(!showChat);
          break;
        case 'f':
          document.documentElement.requestFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lesson, currentMilestone, showChat]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Update current time as audio plays
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Highlight text based on audio progress
      if (lesson && duration > 0) {
        const progress = audio.currentTime / duration;
        const transcript = lesson.milestones[currentMilestone].transcript;
        const words = transcript.split(' ');
        const wordsToHighlight = Math.floor(words.length * progress);
        setHighlightedText(words.slice(0, wordsToHighlight));
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setHighlightedText([]);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef.current, duration, lesson, currentMilestone]);

  const handleMilestoneClick = (index: number) => {
    if (index === currentMilestone) return;
    
    setIsTransitioning(true);
    setIsPlaying(false);
    setHighlightedText([]);
    setCurrentTime(0);
    setCurrentImageIndex(0);
    
    setTimeout(() => {
      setCurrentMilestone(index);
      setTimeout(() => setIsTransitioning(false), 100);
    }, 500);
  };

  const handleNext = () => {
    if (currentMilestone < (lesson?.milestones.length || 0) - 1) {
      handleMilestoneClick(currentMilestone + 1);
    }
  };

  const handlePrevious = () => {
    if (currentMilestone > 0) {
      handleMilestoneClick(currentMilestone - 1);
    }
  };

  // Auto-hide controls
  const resetControlsTimer = () => {
    if (controlsTimeout) clearTimeout(controlsTimeout);
    setShowControls(true);
    const timeout = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
    setControlsTimeout(timeout);
  };

  useEffect(() => {
    resetControlsTimer();
  }, [isPlaying]);

  // Skip intro after 3 seconds or on click
  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => setShowIntro(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !lesson) return;

    const newHistory = [...chatHistory, { role: 'user', content: chatMessage }];
    setChatHistory(newHistory);
    setChatMessage('');

    // Send to chatbot API (we'll create this next)
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: chatMessage,
        context: {
          topic: lesson.topic,
          milestones: lesson.milestones,
          currentMilestone,
        },
      }),
    });

    const { reply } = await response.json();
    setChatHistory([...newHistory, { role: 'assistant', content: reply }]);
  };

  if (!lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Generating your lesson...</p>
        </div>
      </div>
    );
  }

  const milestone = lesson.milestones[currentMilestone];

  // Intro screen
  if (showIntro) {
    return (
      <div 
        className="fixed inset-0 bg-black flex items-center justify-center cursor-pointer z-50"
        onClick={() => setShowIntro(false)}
      >
        <div className="text-center animate-fadeIn">
          <h1 className="text-6xl font-bold text-white mb-4 animate-slideIn">
            {lesson.topic}
          </h1>
          <p className="text-xl text-gray-400 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            {lesson.milestones.length} Milestones
          </p>
          <p className="text-sm text-gray-500 mt-8 animate-fadeIn" style={{ animationDelay: '0.6s' }}>
            Click anywhere to begin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black overflow-hidden"
      onMouseMove={resetControlsTimer}
    >
      {/* Full-screen background image - properly sized */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {milestone.imageUrls[currentImageIndex] && (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img
              src={milestone.imageUrls[currentImageIndex]}
              alt={milestone.title}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Content overlay */}
      <div className={`relative h-full flex flex-col transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        
        {/* Top bar - Title & Exit */}
        <div className={`p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {lesson.topic}
              </h2>
              <p className="text-sm text-gray-300">
                Milestone {currentMilestone + 1} of {lesson.milestones.length}
              </p>
            </div>
            <div className="flex gap-2">
              {isFullscreen && (
                <button
                  onClick={() => {
                    document.exitFullscreen();
                    setIsFullscreen(false);
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all"
                >
                  Exit Fullscreen
                </button>
              )}
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all"
              >
                Exit
              </button>
            </div>
          </div>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-1" />

        {/* Image navigation (if multiple images) */}
        {milestone.imageUrls.length > 1 && (
          <div className={`absolute top-1/2 left-0 right-0 flex justify-between px-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            <button
              onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
              disabled={currentImageIndex === 0}
              className="p-3 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full backdrop-blur-sm transition-all"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentImageIndex(Math.min(milestone.imageUrls.length - 1, currentImageIndex + 1))}
              disabled={currentImageIndex === milestone.imageUrls.length - 1}
              className="p-3 bg-black/50 hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full backdrop-blur-sm transition-all"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Bottom - Subtitles area - FIXED HEIGHT */}
        <div className="bg-gradient-to-t from-black via-black/95 to-transparent pb-8 pt-12">
          <div className="max-w-5xl mx-auto px-8">
            {/* Title */}
            <h1 className="text-4xl font-bold text-white mb-4 text-center drop-shadow-2xl">
              {milestone.title}
            </h1>
            
            {/* Subtitle/Transcript - NO HIGHLIGHTING */}
            <div className="text-center mb-6 max-h-32 overflow-y-auto">
              <p className="text-xl text-white/90 leading-relaxed font-normal drop-shadow-lg">
                {milestone.transcript}
              </p>
            </div>

            {/* Controls */}
            <div className={`transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              {/* Progress bar */}
              <div className="mb-4">
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ 
                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
                    }}
                  />
                </div>
                {duration > 0 && (
                  <div className="flex justify-between text-xs text-white/70 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                )}
              </div>

              {/* Control buttons */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handlePrevious}
                  disabled={currentMilestone === 0}
                  className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full backdrop-blur-sm transition-all transform hover:scale-110 active:scale-95"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                  </svg>
                </button>

                <button
                  onClick={handlePlayPause}
                  disabled={!audioUrl || loadingAudio}
                  className="p-4 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-full transition-all transform hover:scale-110 active:scale-95 shadow-2xl"
                >
                  {loadingAudio ? (
                    <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : isPlaying ? (
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentMilestone === lesson.milestones.length - 1}
                  className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full backdrop-blur-sm transition-all transform hover:scale-110 active:scale-95"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowChat(!showChat)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all transform hover:scale-110 active:scale-95"
                >
                  💬
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />}

      {/* Chat overlay */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-50 animate-slideIn">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-white">Ask Questions</h3>
            <button
              onClick={() => setShowChat(false)}
              className="text-white/70 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 ? (
              <p className="text-white/50 text-sm text-center mt-8">
                Ask me anything about {lesson.topic}!
              </p>
            ) : (
              chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-indigo-600/80 ml-8'
                      : 'bg-white/10 mr-8'
                  }`}
                >
                  <p className="text-sm text-white">{msg.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your question..."
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
