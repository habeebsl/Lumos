'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

interface WordAlignment {
  text: string;
  start: number;
  end: number;
}

interface Milestone {
  id: number;
  title: string;
  transcript: string;
  imageUrls: string[];
  emphasisWords?: string[];
  imageTimings?: number[];
}

interface Lesson {
  id: string;
  topic: string;
  milestones: Milestone[];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Split transcript into sentences for one-liner display
function splitIntoSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()) || [text];
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
  const [wordAlignments, setWordAlignments] = useState<WordAlignment[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [showIntro, setShowIntro] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasAutoAdvanced = useRef(false);

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
    setCurrentImageIndex(0);
    setCurrentSentenceIndex(0);
    setShowFullText(false);
    hasAutoAdvanced.current = false;

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
        console.log('Audio alignment data:', data.words?.slice(0, 5));
        setAudioUrl(data.audioUrl || '');
        setWordAlignments(data.words || []);
        setLoadingAudio(false);
      })
      .catch(err => {
        console.error('Failed to load audio:', err);
        setLoadingAudio(false);
      });
  }, [currentMilestone, lesson, lessonId]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleImageChange = (index: number) => {
    if (index === currentImageIndex || !lesson) return;
    const milestone = lesson.milestones[currentMilestone];
    if (index >= milestone.imageUrls.length) return;
    
    setLoadingImage(true);
    
    // Preload image
    const img = new Image();
    img.onload = () => {
      setCurrentImageIndex(index);
      setLoadingImage(false);
    };
    img.onerror = () => setLoadingImage(false);
    img.src = milestone.imageUrls[index];
  };

  // Update highlighting based on word alignments
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !lesson) return;

    const milestone = lesson.milestones[currentMilestone];
    const sentences = splitIntoSentences(milestone.transcript);

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      // Find current word based on alignment data
      if (wordAlignments.length > 0) {
        const idx = wordAlignments.findIndex(
          w => audio.currentTime >= w.start && audio.currentTime < w.end
        );
        
        if (idx >= 0) {
          setCurrentWordIndex(idx);
          
          // Update sentence index based on character position
          if (!showFullText) {
            let charCount = 0;
            for (let i = 0; i < sentences.length; i++) {
              charCount += sentences[i].length;
              
              // Calculate character position of current word
              let wordCharPos = 0;
              for (let j = 0; j <= idx && j < wordAlignments.length; j++) {
                wordCharPos += wordAlignments[j].text.length + 1;
              }
              
              if (wordCharPos <= charCount) {
                if (currentSentenceIndex !== i) {
                  setCurrentSentenceIndex(i);
                }
                break;
              }
            }
          }
        }
        
        // Auto-switch images based on timing
        if (milestone.imageTimings && milestone.imageTimings.length > 0) {
          for (let i = milestone.imageTimings.length - 1; i >= 0; i--) {
            if (audio.currentTime >= milestone.imageTimings[i] && currentImageIndex !== i) {
              console.log(`Auto-switching to image ${i} at ${audio.currentTime}s`);
              handleImageChange(i);
              break;
            }
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentWordIndex(-1);
      
      // Only auto-advance once
      if (!hasAutoAdvanced.current && currentMilestone < lesson.milestones.length - 1) {
        hasAutoAdvanced.current = true;
        setTimeout(() => handleMilestoneChange(currentMilestone + 1), 1000);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef.current, wordAlignments, lesson, currentMilestone, currentImageIndex, showFullText, currentSentenceIndex]);

  const handleMilestoneChange = (index: number) => {
    if (index === currentMilestone || !lesson) return;
    if (index < 0 || index >= lesson.milestones.length) return;
    
    // Stop audio immediately
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setIsTransitioning(true);
    setIsPlaying(false);
    setCurrentWordIndex(-1);
    setCurrentTime(0);
    hasAutoAdvanced.current = false;
    
    setTimeout(() => {
      setCurrentMilestone(index);
      setTimeout(() => setIsTransitioning(false), 300);
    }, 300);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !lesson) return;

    const newHistory = [...chatHistory, { role: 'user', content: chatMessage }];
    setChatHistory(newHistory);
    setChatMessage('');

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!lesson || showChat) return;

      const milestone = lesson.milestones[currentMilestone];

      switch(e.key) {
        case 'ArrowLeft':
          if (currentMilestone > 0) handleMilestoneChange(currentMilestone - 1);
          break;
        case 'ArrowRight':
          if (currentMilestone < lesson.milestones.length - 1) handleMilestoneChange(currentMilestone + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentImageIndex > 0) handleImageChange(currentImageIndex - 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentImageIndex < milestone.imageUrls.length - 1) handleImageChange(currentImageIndex + 1);
          break;
        case ' ':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'Escape':
          if (showFullText) {
            setShowFullText(false);
          } else {
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lesson, currentMilestone, showChat, isFullscreen, currentImageIndex, showFullText]);

  // Skip intro
  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => setShowIntro(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  if (!lesson) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-white">Loading lesson...</p>
        </div>
      </div>
    );
  }

  const milestone = lesson.milestones[currentMilestone];
  const sentences = splitIntoSentences(milestone.transcript);

  // Intro screen
  if (showIntro) {
    return (
      <div 
        className="fixed inset-0 bg-black flex items-center justify-center cursor-pointer z-50"
        onClick={() => setShowIntro(false)}
      >
        <div className="text-center animate-fadeIn">
          <h1 className="text-6xl font-bold text-white mb-4">
            {lesson.topic}
          </h1>
          <p className="text-xl text-gray-400 mt-4">
            Click to begin
          </p>
        </div>
      </div>
    );
  }

  // Render current sentence with word highlighting
  const renderCurrentSentence = () => {
    if (sentences.length === 0 || wordAlignments.length === 0) {
      return <span className="text-gray-300">{sentences[currentSentenceIndex] || milestone.transcript}</span>;
    }

    const currentSentence = sentences[currentSentenceIndex] || sentences[0];
    const emphasisSet = new Set(milestone.emphasisWords?.map(w => w.toLowerCase()) || []);
    
    // Match sentence words to alignment data
    const sentenceWords = currentSentence.split(' ');
    
    return sentenceWords.map((word, idx) => {
      const cleanWord = word.replace(/[.,!?;:]/g, '').toLowerCase();
      const isEmphasized = emphasisSet.has(cleanWord);
      
      // Find if this word is currently playing
      const isCurrent = currentWordIndex >= 0 && 
        wordAlignments[currentWordIndex]?.text.toLowerCase().replace(/[.,!?;:]/g, '') === cleanWord;
      
      return (
        <span
          key={idx}
          className={`transition-all duration-100 ${
            isCurrent 
              ? 'text-white font-semibold' 
              : isEmphasized
              ? 'text-yellow-400 font-medium'
              : 'text-gray-300'
          }`}
        >
          {word}{' '}
        </span>
      );
    });
  };

  // Render full transcript with word highlighting
  const renderFullTranscript = () => {
    if (wordAlignments.length === 0) {
      return <span className="text-gray-300">{milestone.transcript}</span>;
    }

    const emphasisSet = new Set(milestone.emphasisWords?.map(w => w.toLowerCase()) || []);
    
    return wordAlignments.map((wordData, idx) => {
      const cleanWord = wordData.text.replace(/[.,!?;:]/g, '').toLowerCase();
      const isEmphasized = emphasisSet.has(cleanWord);
      const isCurrent = idx === currentWordIndex;
      
      return (
        <span
          key={idx}
          className={`transition-all duration-100 ${
            isCurrent 
              ? 'text-white font-semibold' 
              : isEmphasized
              ? 'text-yellow-400 font-medium'
              : 'text-gray-300'
          }`}
        >
          {wordData.text}{' '}
        </span>
      );
    });
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0' : 'min-h-screen'} bg-black flex flex-col overflow-hidden`}>
      {/* Exit fullscreen button */}
      {isFullscreen && (
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Title - Top left */}
      <div className="absolute top-4 left-4 z-40">
        <h2 className="text-lg font-semibold text-white/90">
          {milestone.title}
        </h2>
        <p className="text-xs text-white/50 mt-1">
          {currentMilestone + 1} / {lesson.milestones.length}
        </p>
      </div>

      {/* Main image area - 60-70% of screen */}
      <div className={`flex-1 flex items-center justify-center relative transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {milestone.imageUrls.length > 0 && (
          <>
            {loadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full"></div>
              </div>
            )}
            <img
              src={milestone.imageUrls[currentImageIndex] || milestone.imageUrls[0]}
              alt={milestone.title}
              className="max-h-[70vh] max-w-[90vw] object-contain"
              onLoad={() => setLoadingImage(false)}
            />
            
            {/* Image navigation dots */}
            {milestone.imageUrls.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                {milestone.imageUrls.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleImageChange(idx)}
                    className={`transition-all ${
                      idx === currentImageIndex 
                        ? 'bg-white w-8 h-2' 
                        : 'bg-white/30 w-2 h-2 hover:bg-white/50'
                    } rounded-full`}
                    aria-label={`Image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom subtitle area - clickable */}
      <div className="bg-gradient-to-t from-black via-black/95 to-transparent pb-8 pt-16">
        <div className="max-w-4xl mx-auto px-6">
          {/* Subtitle - one liner or full text */}
          <div 
            className="text-center mb-6 min-h-[60px] cursor-pointer"
            onClick={() => setShowFullText(!showFullText)}
          >
            <p className="text-2xl leading-relaxed">
              {showFullText ? renderFullTranscript() : renderCurrentSentence()}
            </p>
            {!showFullText && (
              <p className="text-xs text-white/40 mt-2">Click to see full text</p>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-200"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
            {duration > 0 && (
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => currentMilestone > 0 && handleMilestoneChange(currentMilestone - 1)}
              disabled={currentMilestone === 0}
              className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-full transition-all"
              aria-label="Previous milestone"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
            </button>

            <button
              onClick={handlePlayPause}
              disabled={!audioUrl || loadingAudio}
              className="p-4 bg-white hover:bg-gray-100 disabled:opacity-50 text-black rounded-full transition-all"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {loadingAudio ? (
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => currentMilestone < lesson.milestones.length - 1 && handleMilestoneChange(currentMilestone + 1)}
              disabled={currentMilestone === lesson.milestones.length - 1}
              className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-full transition-all"
              aria-label="Next milestone"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
              </svg>
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
              aria-label="Toggle chat"
            >
              💬
            </button>
          </div>
        </div>
      </div>

      {/* Audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Chat overlay */}
      {showChat && (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 flex flex-col z-50">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-white">Ask Questions</h3>
            <button
              onClick={() => setShowChat(false)}
              className="text-white/70 hover:text-white"
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
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg font-medium"
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
