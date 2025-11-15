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
  imageCues?: string[];
  emphasisWords?: string[];
  imageTimings?: number[];
}

interface Lesson {
  id: string;
  topic: string;
  milestones: Milestone[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizState {
  questions: QuizQuestion[];
  currentQuestion: number;
  selectedAnswer: number | null;
  showExplanation: boolean;
  score: number;
  isComplete: boolean;
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
  const [imageTimings, setImageTimings] = useState<number[]>([]);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [manualImageOverride, setManualImageOverride] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [highestSection, setHighestSection] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasAutoAdvanced = useRef(false);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);

  // Fetch lesson data
  useEffect(() => {
    if (lessonId) {
      fetch(`/api/generate-lesson?id=${lessonId}`)
        .then(res => res.json())
        .then(data => setLesson(data));
    }
  }, [lessonId]);

  // Preload all images for current milestone
  useEffect(() => {
    if (!lesson) return;
    
    const milestone = lesson.milestones[currentMilestone];
    const newPreloaded = new Set(preloadedImages);
    
    milestone.imageUrls.forEach(url => {
      if (!newPreloaded.has(url)) {
        const img = new Image();
        img.onload = () => {
          newPreloaded.add(url);
          setPreloadedImages(new Set(newPreloaded));
        };
        img.src = url;
      }
    });
  }, [currentMilestone, lesson]);

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
    setManualImageOverride(false);
    hasAutoAdvanced.current = false;

    fetch('/api/generate-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneId: `${lessonId}-${currentMilestone}`,
        transcript: milestone.transcript,
        imageCues: milestone.imageCues || [],
      }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('Audio alignment data:', data.words?.slice(0, 5));
        console.log('Image cues:', milestone.imageCues);
        console.log('Calculated image timings:', data.imageTimings);
        console.log('Number of images:', milestone.imageUrls.length);
        setAudioUrl(data.audioUrl || '');
        setWordAlignments(data.words || []);
        setImageTimings(data.imageTimings || []);
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleImageChange = (index: number) => {
    if (index === currentImageIndex || !lesson) return;
    const milestone = lesson.milestones[currentMilestone];
    if (index >= milestone.imageUrls.length) return;
    
    setLoadingImage(true);
    setManualImageOverride(true);
    
    // Re-enable auto-switching after 5 seconds
    setTimeout(() => {
      setManualImageOverride(false);
    }, 5000);
    
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
        
        // Auto-switch images based on timing (only if user hasn't manually overridden)
        if (!manualImageOverride) {
          const timings = imageTimings.length > 0 ? imageTimings : (milestone.imageTimings || []);
          
          if (timings.length > 0 && milestone.imageUrls.length > 1) {
            // Find which image should be showing at current time
            // Each timing marks the START of that image's display period
            let targetImageIndex = 0;
            
            // Find the highest timing index where currentTime >= timing
            for (let i = 0; i < timings.length; i++) {
              if (audio.currentTime >= timings[i]) {
                targetImageIndex = i;
              } else {
                // Stop once we hit a future timing
                break;
              }
            }
            
            // Cap at max image index
            targetImageIndex = Math.min(targetImageIndex, milestone.imageUrls.length - 1);
            
            // Only switch if different from current
            if (targetImageIndex !== currentImageIndex) {
              console.log(`Auto-switching to image ${targetImageIndex} at ${audio.currentTime}s (timings: [${timings.join(', ')}])`);
              setCurrentImageIndex(targetImageIndex);
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
      
      // Show quiz after completing any section
      if (!hasAutoAdvanced.current) {
        hasAutoAdvanced.current = true;
        loadQuiz();
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

  // Quiz functions
  const loadQuiz = async () => {
    if (!lesson) return;
    
    setLoadingQuiz(true);
    setShowQuiz(true);
    
    try {
      const milestone = lesson.milestones[currentMilestone];
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: `${lessonId}-${currentMilestone}`,
          title: milestone.title,
          transcript: milestone.transcript,
        }),
      });
      
      const data = await response.json();
      
      setQuizState({
        questions: data.questions,
        currentQuestion: 0,
        selectedAnswer: null,
        showExplanation: false,
        score: 0,
        isComplete: false,
      });
    } catch (error) {
      console.error('Failed to load quiz:', error);
      // Skip quiz on error and advance anyway
      advanceToNextSection();
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleQuizAnswer = (answerIndex: number) => {
    if (!quizState || quizState.showExplanation) return;
    
    setQuizState({
      ...quizState,
      selectedAnswer: answerIndex,
      showExplanation: true,
      score: quizState.score + (answerIndex === quizState.questions[quizState.currentQuestion].correctIndex ? 1 : 0),
    });
  };

  const handleNextQuestion = () => {
    if (!quizState) return;
    
    const nextQuestion = quizState.currentQuestion + 1;
    
    if (nextQuestion >= quizState.questions.length) {
      // Quiz complete - show results
      setQuizState({
        ...quizState,
        isComplete: true,
      });
    } else {
      setQuizState({
        ...quizState,
        currentQuestion: nextQuestion,
        selectedAnswer: null,
        showExplanation: false,
      });
    }
  };

  const handleRetryQuiz = () => {
    if (!quizState) return;
    
    setQuizState({
      ...quizState,
      currentQuestion: 0,
      selectedAnswer: null,
      showExplanation: false,
      score: 0,
      isComplete: false,
    });
  };

  const completeQuizAndAdvance = () => {
    // Mark section as completed
    setCompletedSections(prev => new Set([...prev, currentMilestone]));
    if (currentMilestone > highestSection) {
      setHighestSection(currentMilestone);
    }
    
    advanceToNextSection();
  };

  const advanceToNextSection = () => {
    setShowQuiz(false);
    setQuizState(null);
    
    // Only advance if not the last section
    if (lesson && currentMilestone < lesson.milestones.length - 1) {
      setTimeout(() => handleMilestoneChange(currentMilestone + 1), 500);
    }
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
          } else if (showSidePanel) {
            setShowSidePanel(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lesson, currentMilestone, showChat, currentImageIndex, showFullText, showSidePanel]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordRef.current && textContainerRef.current) {
      const wordElement = currentWordRef.current;
      const container = textContainerRef.current;
      
      const wordTop = wordElement.offsetTop;
      const wordBottom = wordTop + wordElement.offsetHeight;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const containerVisibleBottom = containerScrollTop + containerHeight;
      
      // Scroll if word is not fully visible
      if (wordBottom > containerVisibleBottom - 100) {
        container.scrollTo({
          top: wordTop - containerHeight / 3,
          behavior: 'smooth'
        });
      } else if (wordTop < containerScrollTop + 100) {
        container.scrollTo({
          top: wordTop - containerHeight / 3,
          behavior: 'smooth'
        });
      }
    }
  }, [currentWordIndex]);
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
  
  // Calculate completion percentage based on highest section reached
  const completionPercentage = Math.round(((highestSection + 1) / lesson.milestones.length) * 100);

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

  // Render with all words visible from start - only opacity changes
  const renderTranscript = () => {
    if (wordAlignments.length === 0) {
      return (
        <p className="text-gray-400 text-3xl leading-loose text-center max-w-5xl">
          {milestone.transcript}
        </p>
      );
    }

    const emphasisSet = new Set(milestone.emphasisWords?.map(w => w.toLowerCase()) || []);
    
    return (
      <p className="text-3xl leading-loose text-center max-w-5xl">
        {wordAlignments.map((wordData, idx) => {
          const cleanWord = wordData.text.replace(/[.,!?;:]/g, '').toLowerCase();
          const isEmphasized = emphasisSet.has(cleanWord);
          const hasBeenSpoken = wordData.start <= currentTime;
          const isCurrent = idx === currentWordIndex;
          
          return (
            <span
              key={`word-${idx}`}
              ref={isCurrent ? currentWordRef : null}
              className={`
                ${hasBeenSpoken ? 'opacity-100' : 'opacity-20'}
                ${isCurrent 
                  ? 'text-yellow-400' 
                  : isEmphasized
                  ? 'text-cyan-400'
                  : 'text-gray-300'
                }
              `}
            >
              {wordData.text}{' '}
            </span>
          );
        })}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 bg-black flex overflow-hidden">
      {/* Hamburger menu button */}
      <button
        onClick={() => setShowSidePanel(!showSidePanel)}
        className="fixed top-6 left-6 z-30 p-3 bg-black/60 hover:bg-black/80 text-white/80 hover:text-white rounded-xl transition-all border border-white/20"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Side panel */}
      <div className={`fixed left-0 top-0 bottom-0 w-80 bg-black border-r border-white/10 flex flex-col z-40 transition-transform duration-300 ${showSidePanel ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">{lesson.topic}</h2>
            <button
              onClick={() => setShowSidePanel(false)}
              className="p-2 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Completion percentage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/60">Progress</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                {completionPercentage}%
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-xs text-white/40">
              {highestSection + 1} of {lesson.milestones.length} sections completed
            </p>
          </div>
        </div>

        {/* Sections list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {lesson.milestones.map((m, idx) => {
            const isCompleted = completedSections.has(idx);
            const isCurrent = idx === currentMilestone;
            const isLocked = idx > highestSection + 1;
            
            return (
              <button
                key={idx}
                onClick={() => !isLocked && handleMilestoneChange(idx)}
                disabled={isLocked}
                className={`w-full text-left p-4 rounded-xl transition-all border ${
                  isCurrent 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10' 
                    : isCompleted
                    ? 'bg-white/5 border-white/10 hover:bg-white/10'
                    : isLocked
                    ? 'bg-white/5 border-white/5 opacity-40 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500' 
                      : isCurrent
                      ? 'bg-white/20 border-2 border-cyan-400'
                      : isLocked
                      ? 'bg-white/10'
                      : 'bg-white/10'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : isLocked ? (
                      <svg className="w-3 h-3 text-white/40" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs text-white/60 font-medium">{idx + 1}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium mb-1 ${
                      isCurrent ? 'text-cyan-400' : isCompleted ? 'text-white' : 'text-white/70'
                    }`}>
                      {m.title}
                    </h3>
                    {isCurrent && (
                      <p className="text-xs text-cyan-400/80">Currently learning</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="text-center">
            <p className="text-xs text-white/40">
              Press <kbd className="px-2 py-1 bg-white/10 rounded text-white/60">ESC</kbd> to close
            </p>
          </div>
        </div>
      </div>

      {/* Left side - Player and text */}
      <div className="flex-1 flex flex-col justify-between p-8 pr-4">
        {/* Title - Top (centered to avoid hamburger) */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/90 mb-2">
            {milestone.title}
          </h2>
          <p className="text-sm text-white/50">
            Part {currentMilestone + 1} of {lesson.milestones.length}
          </p>
        </div>

        {/* Center - Subtitle area */}
        <div 
          ref={textContainerRef}
          className="flex-1 flex items-start justify-center px-8 py-12 overflow-y-auto scroll-smooth"
        >
          <div className="max-w-5xl w-full">
            {renderTranscript()}
          </div>
        </div>

        {/* Bottom - Controls */}
        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div 
              onClick={handleSeek}
              className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
            >
              <div 
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-200 pointer-events-none"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
            {duration > 0 && (
              <div className="flex justify-between text-xs text-white/40 mt-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => currentMilestone > 0 && handleMilestoneChange(currentMilestone - 1)}
              disabled={currentMilestone === 0}
              className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white rounded-xl transition-all border border-white/10"
              aria-label="Previous milestone"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
              </svg>
            </button>

            <button
              onClick={handlePlayPause}
              disabled={!audioUrl || loadingAudio}
              className="p-5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-30 text-white rounded-full transition-all shadow-lg shadow-cyan-500/30"
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
                <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => currentMilestone < lesson.milestones.length - 1 && handleMilestoneChange(currentMilestone + 1)}
              disabled={currentMilestone === lesson.milestones.length - 1}
              className="p-3 bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white rounded-xl transition-all border border-white/10"
              aria-label="Next milestone"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
              </svg>
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/10"
              aria-label="Toggle chat"
            >
              💬
            </button>
          </div>
        </div>
      </div>

      {/* Right side - Image stack */}
      <div className={`w-1/2 relative flex items-center justify-center bg-gradient-to-br from-gray-900 to-black border-l border-white/5 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {milestone.imageUrls.length > 0 && (
          <>
            {loadingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="animate-spin h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
              </div>
            )}
            
            <div className="relative w-full h-full flex items-center justify-center p-8">
              <img
                src={milestone.imageUrls[currentImageIndex] || milestone.imageUrls[0]}
                alt={milestone.title}
                className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
                onLoad={() => setLoadingImage(false)}
              />
            </div>
            
            {/* Image navigation - vertical on right side */}
            {milestone.imageUrls.length > 1 && (
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-3">
                {milestone.imageUrls.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleImageChange(idx)}
                    className={`transition-all ${
                      idx === currentImageIndex 
                        ? 'bg-cyan-500 h-12 w-2 shadow-lg shadow-cyan-500/50' 
                        : 'bg-white/20 h-8 w-2 hover:bg-white/40'
                    } rounded-full`}
                    aria-label={`Image ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Image counter */}
            <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
              <p className="text-white/70 text-sm font-medium">
                {currentImageIndex + 1} / {milestone.imageUrls.length}
              </p>
            </div>
          </>
        )}
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

      {/* Quiz modal */}
      {showQuiz && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {loadingQuiz ? (
            <div className="bg-black border border-white/10 rounded-2xl p-8 max-w-2xl w-full">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
                <p className="text-white/70">Generating quiz questions...</p>
              </div>
            </div>
          ) : quizState?.isComplete ? (
            // Quiz results
            <div className="bg-black border border-white/10 rounded-2xl p-8 max-w-2xl w-full">
              <div className="text-center space-y-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                  (quizState.score / quizState.questions.length) * 100 >= 75
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500'
                    : 'bg-red-500/20 border-2 border-red-500'
                }`}>
                  {(quizState.score / quizState.questions.length) * 100 >= 75 ? (
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {(quizState.score / quizState.questions.length) * 100 >= 75 ? 'Great Job!' : 'Keep Trying!'}
                  </h2>
                  <p className="text-xl text-white/70">
                    You scored {quizState.score} out of {quizState.questions.length}
                  </p>
                  <p className="text-lg text-white/50 mt-2">
                    {Math.round((quizState.score / quizState.questions.length) * 100)}%
                  </p>
                </div>

                <div className="flex gap-3 justify-center">
                  {(quizState.score / quizState.questions.length) * 100 >= 75 ? (
                    <button
                      onClick={completeQuizAndAdvance}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/30"
                    >
                      {lesson && currentMilestone === lesson.milestones.length - 1 ? 'Finish Lesson' : 'Continue to Next Section'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleRetryQuiz}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all border border-white/20"
                      >
                        Retry Quiz
                      </button>
                      <button
                        onClick={completeQuizAndAdvance}
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 rounded-xl font-medium transition-all border border-white/10"
                      >
                        {lesson && currentMilestone === lesson.milestones.length - 1 ? 'Finish Anyway' : 'Skip for Now'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : quizState ? (
            // Quiz questions
            <div className="bg-black border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] flex flex-col">
              {/* Progress */}
              <div className="mb-6 flex-shrink-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-white/60">
                    Question {quizState.currentQuestion + 1} of {quizState.questions.length}
                  </span>
                  <span className="text-sm text-white/60">
                    Score: {quizState.score}/{quizState.currentQuestion + (quizState.showExplanation ? 1 : 0)}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                    style={{ width: `${((quizState.currentQuestion + 1) / quizState.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {/* Question */}
                <h3 className="text-2xl font-bold text-white leading-relaxed">
                  {quizState.questions[quizState.currentQuestion].question}
                </h3>

                {/* Options */}
                <div className="space-y-3">
                  {quizState.questions[quizState.currentQuestion].options.map((option, idx) => {
                    const isSelected = quizState.selectedAnswer === idx;
                    const isCorrect = idx === quizState.questions[quizState.currentQuestion].correctIndex;
                    const showResult = quizState.showExplanation;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleQuizAnswer(idx)}
                        disabled={quizState.showExplanation}
                        className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                          showResult
                            ? isCorrect
                              ? 'bg-green-500/20 border-green-500 text-white'
                              : isSelected
                              ? 'bg-red-500/20 border-red-500 text-white'
                              : 'bg-white/5 border-white/10 text-white/50'
                            : isSelected
                            ? 'bg-cyan-500/20 border-cyan-500 text-white'
                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                            showResult && isCorrect
                              ? 'bg-green-500 text-white'
                              : showResult && isSelected
                              ? 'bg-red-500 text-white'
                              : 'bg-white/10 text-white/70'
                          }`}>
                            {showResult && isCorrect ? '✓' : showResult && isSelected ? '✗' : String.fromCharCode(65 + idx)}
                          </div>
                          <span className="flex-1">{option}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {quizState.showExplanation && (
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                    <p className="text-cyan-400 text-sm font-medium mb-2">Explanation</p>
                    <p className="text-white/80 leading-relaxed">
                      {quizState.questions[quizState.currentQuestion].explanation}
                    </p>
                  </div>
                )}
              </div>

              {/* Next button - fixed at bottom */}
              {quizState.showExplanation && (
                <div className="mt-6 flex-shrink-0">
                  <button
                    onClick={handleNextQuestion}
                    className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/30"
                  >
                    {quizState.currentQuestion < quizState.questions.length - 1 ? 'Next Question' : 'See Results'}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
