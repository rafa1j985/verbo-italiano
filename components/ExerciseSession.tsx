
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateLesson, generateBatchLessons, analyzeSubmission, enrichPracticeSentences, playTextToSpeech, prefetchAudio } from '../services/geminiService';
import { Feedback, UserBrain, VerbLessonSession, GlobalGameConfig } from '../types';
import { ArrowRight, Check, X, RefreshCw, BookOpen, GraduationCap, ChevronRight, HelpCircle, Link2, Zap, AlertTriangle, Timer, Info, Eye, Trophy, Sparkles, Volume2, Repeat, Languages, Mic, MicOff, Activity, Lightbulb, Quote, Brain } from 'lucide-react';
import { VERB_DATABASE } from '../data/verbs';
import { CULTURAL_QUOTES } from '../data/sentenceTemplates';

interface ExerciseSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  config: GlobalGameConfig;
}

type Stage = 'PRESENTATION' | 'DRILL' | 'PRACTICE_1' | 'PRACTICE_2' | 'CONNECTION';
type GameType = 'MATCH_PAIRS' | 'BINARY' | 'INTRUDER' | 'FLASHCARD' | 'DICTATION';

// Helper interfaces for games
interface MatchCard { id: string; text: string; type: 'PRONOUN' | 'VERB'; state: 'DEFAULT' | 'SELECTED' | 'MATCHED' | 'ERROR'; }
interface BinaryCard { pronoun: string; verb: string; isCorrect: boolean; }
interface IntruderOption { id: number; pronoun: string; verb: string; isCorrect: boolean; state: 'DEFAULT' | 'SELECTED_WRONG' | 'SELECTED_RIGHT'; }
interface FlashcardRound { question: string; answer: string; acceptedAnswers: string[]; direction: 'IT_PT' | 'PT_IT'; }
interface DictationRound { 
    verbInfinitive: string;
    pronoun: string; 
    conjugation: string; 
    fullItalian: string; 
    ptTranslation: string; // Meaning (e.g. "Comer")
}

// --- VOICE ENERGY COMPONENT (Decibel Trigger) ---
const VoiceEnergyMonitor: React.FC<{ onEnergyFull: () => void, threshold: number }> = ({ onEnergyFull, threshold }) => {
    const [isListening, setIsListening] = useState(false);
    const [energy, setEnergy] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const requestRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const toggleMic = async () => {
        if (completed) return;
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const startListening = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            // Handle legacy webkitAudioContext that might not support options
            let audioCtx: AudioContext;
            try {
                audioCtx = new AudioContextClass({ sampleRate: 16000 });
            } catch (e) {
                audioCtx = new AudioContextClass();
            }
            audioContextRef.current = audioCtx;

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            sourceRef.current = source;

            setIsListening(true);
            analyze();
        } catch (err) {
            console.error("Mic Error:", err);
            setError("Permissão negada");
        }
    };

    const stopListening = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        setIsListening(false);
        // Note: We do NOT reset energy here so visuals persist
    };

    const analyze = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Use dynamic threshold from config
        if (average > threshold) {
            setEnergy(prev => {
                const newVal = Math.min(prev + 1.2, 100); 
                if (newVal >= 100) {
                    setCompleted(true);
                    onEnergyFull();
                }
                return newVal;
            });
        } else {
            // Decay slowly only if not complete
            setEnergy(prev => {
                if (prev >= 100) return 100;
                return Math.max(prev - 0.5, 0);
            });
        }

        requestRef.current = requestAnimationFrame(analyze);
    };

    // Auto-stop when completed
    useEffect(() => {
        if (completed && isListening) {
            stopListening();
        }
    }, [completed, isListening]);

    useEffect(() => {
        return () => stopListening();
    }, []);

    return (
        <div className="flex flex-col items-center gap-2">
            <div className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-colors duration-500 ${completed ? 'bg-amber-50 border-amber-200' : 'bg-slate-100 border-slate-200'}`}>
                <button 
                    onClick={toggleMic}
                    disabled={completed}
                    className={`p-2 rounded-full transition-all ${
                        completed ? 'bg-amber-100 text-amber-600 scale-110' :
                        isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                    }`}
                    title={isListening ? "Desativar Microfone" : "Ativar Microfone para Treino de Fala"}
                >
                    {completed ? <Check size={18} strokeWidth={3} /> : (isListening ? <MicOff size={18} /> : <Mic size={18} />)}
                </button>
                
                <div className="flex flex-col w-32 md:w-48">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <span className={completed ? "text-amber-600 font-extrabold tracking-widest animate-pulse" : ""}>
                            {completed ? "BÔNUS LIBERADO!" : (isListening ? "Detectando Voz..." : "Toque no mic")}
                        </span>
                        <span className="text-xs">{Math.round(energy)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                        <div 
                            className={`h-full transition-all duration-300 ${completed ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${energy}%` }}
                        ></div>
                        {/* Threshold Marker */}
                        {isListening && !completed && <div className="absolute top-0 bottom-0 w-0.5 bg-white/50 left-[20%]"></div>}
                    </div>
                </div>
            </div>
            {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>
    );
};


const ExerciseSession: React.FC<ExerciseSessionProps> = ({ onExit, brain, onUpdateBrain, config }) => {
  const [sessionData, setSessionData] = useState<VerbLessonSession | null>(null);
  const [stage, setStage] = useState<Stage>('PRESENTATION');
  const [isEnriching, setIsEnriching] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  
  // Loading & Cultural Quote State
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState(CULTURAL_QUOTES[0]);
  const [loadingProgress, setLoadingProgress] = useState(0); // 0 to 100
  
  // Session Metrics
  const [sessionErrors, setSessionErrors] = useState(0);
  const [perfectBonusAwarded, setPerfectBonusAwarded] = useState(false);
  
  // Voice Bonus
  const [voiceBonusUnlocked, setVoiceBonusUnlocked] = useState(false);

  // Drill State
  const [drillInputs, setDrillInputs] = useState<string[]>(Array(6).fill(''));
  const [drillMask, setDrillMask] = useState<boolean[]>([]);
  const [drillFeedback, setDrillFeedback] = useState<boolean | null>(null);
  const [showCorrections, setShowCorrections] = useState(false); 
  
  // Practice State
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<Feedback | null>(null);

  // Gamification State
  const [gameType, setGameType] = useState<GameType>('MATCH_PAIRS');
  const [gameCompleted, setGameCompleted] = useState(false);
  
  // Game Data Holders
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  
  const [binaryQueue, setBinaryQueue] = useState<BinaryCard[]>([]);
  const [binaryIndex, setBinaryIndex] = useState(0);
  const [binaryFeedback, setBinaryFeedback] = useState<'HIT' | 'MISS' | null>(null);
  
  const [intruderOptions, setIntruderOptions] = useState<IntruderOption[]>([]);

  // Flashcard State
  const [flashcardQueue, setFlashcardQueue] = useState<FlashcardRound[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardInput, setFlashcardInput] = useState('');
  const [flashcardFeedback, setFlashcardFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);

  // Dictation State
  const [dictationQueue, setDictationQueue] = useState<DictationRound[]>([]);
  const [dictationIndex, setDictationIndex] = useState(0);
  const [dictationStep, setDictationStep] = useState<'LISTEN' | 'TRANSLATE'>('LISTEN');
  const [dictationInput, setDictationInput] = useState('');
  const [dictationFeedback, setDictationFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
  
  // General Session
  const [lessonBuffer, setLessonBuffer] = useState<VerbLessonSession[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const hasInitialized = useRef(false);
  const currentVerbRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashcardInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- HELPER: CALCULATE PROGRESS ---
  const getProgress = () => {
    const totalVerbsInLevel = VERB_DATABASE.filter(v => v.level === brain.currentLevel).length;
    const masteredInLevel = Object.keys(brain.verbHistory).filter(v => {
        const verbData = VERB_DATABASE.find(dbV => dbV.infinitive.toLowerCase() === v.toLowerCase());
        return verbData && verbData.level === brain.currentLevel;
    }).length;
    return totalVerbsInLevel > 0 ? (masteredInLevel / totalVerbsInLevel) * 100 : 0;
  };

  // --- HELPER: CLEAN PRONOUNS ---
  const cleanString = (str: string): string => {
      if (!str) return "";
      return str.replace(/^(io|tu|lui\/lei|lui|lei|noi|voi|loro)\s+/i, '').trim();
  };

  const handlePlayAudio = async (text: string, id: string) => {
      // Allow re-playing even if 'playingAudio' is set, just debounce slightly
      if (playingAudio === id) return; 
      
      setPlayingAudio(id);
      await playTextToSpeech(text);
      
      // Update Cost Stats
      const newStats = { ...brain.usageStats };
      newStats.audioPlays = (newStats.audioPlays || 0) + 1;
      onUpdateBrain({ ...brain, usageStats: newStats });

      setPlayingAudio(null);
  };

  // --- INIT & BUFFER ---
  useEffect(() => {
    if (!hasInitialized.current) {
        hasInitialized.current = true;
        initializeSession();
    }
  }, []);

  useEffect(() => {
      if (lessonBuffer.length < 2) fillBuffer();
  }, [lessonBuffer.length]);

  useEffect(() => {
      if ((stage === 'PRACTICE_1' || stage === 'PRACTICE_2') && !practiceFeedback && inputRef.current) {
          inputRef.current.focus();
      }
      if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
      }
  }, [stage, practiceFeedback]);

  // Focus effect for Flashcards
  useEffect(() => {
      if (stage === 'CONNECTION' && gameType === 'FLASHCARD' && !flashcardFeedback && flashcardInputRef.current) {
          setTimeout(() => flashcardInputRef.current?.focus(), 50);
      }
  }, [stage, gameType, flashcardIndex, flashcardFeedback]);

  // Auto-play audio for Dictation when index or step changes
  useEffect(() => {
      if (stage === 'CONNECTION' && gameType === 'DICTATION' && dictationQueue.length > 0 && dictationStep === 'LISTEN' && !dictationFeedback) {
          const current = dictationQueue[dictationIndex];
          // Small delay to ensure UI is ready
          const timer = setTimeout(() => {
              handlePlayAudio(current.fullItalian, `dict-${dictationIndex}`);
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [stage, gameType, dictationIndex, dictationStep, dictationFeedback, dictationQueue]);


  // --- GLOBAL ENTER KEY LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      if (stage === 'PRESENTATION') {
        handlePresentationComplete();
        return;
      }

      if (stage === 'DRILL') {
        checkDrill();
        return;
      }

      if (stage === 'PRACTICE_1' || stage === 'PRACTICE_2') {
        if (practiceFeedback) {
          // "Continue" logic
          setPracticeInput('');
          setPracticeFeedback(null);
          if (stage === 'PRACTICE_1') setStage('PRACTICE_2');
          else setStage('CONNECTION');
        } else {
          // "Verify" logic
          if (practiceInput.trim().length > 0) {
            checkPractice(stage === 'PRACTICE_1' ? 0 : 1);
          }
        }
        return;
      }

      if (stage === 'CONNECTION' && !gameCompleted) {
          if (gameType === 'FLASHCARD') {
             if (flashcardFeedback) return;
             if (flashcardInput.trim().length > 0) handleFlashcardSubmit();
          }
          if (gameType === 'DICTATION') {
             if (dictationFeedback) return;
             if (dictationInput.trim().length > 0) handleDictationSubmit();
          }
          return;
      }

      if (stage === 'CONNECTION' && gameCompleted) {
        nextLesson();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, drillInputs, practiceFeedback, practiceInput, gameCompleted, drillMask, showCorrections, gameType, flashcardInput, flashcardFeedback, dictationInput, dictationFeedback, voiceBonusUnlocked]); 


  const fillBuffer = async () => {
      try {
          const progress = getProgress();
          // PASS BRAIN HISTORY TO BATCH GENERATOR FOR SPIRAL LEARNING
          const newBatch = await generateBatchLessons(brain.currentLevel, 2, progress, brain.verbHistory, config);
          if (newBatch.length > 0) setLessonBuffer(prev => [...prev, ...newBatch]);
      } catch (e) { console.error(e); }
  };

  // --- WAIT & ENTERTAINMENT LOGIC ---
  const waitForThinking = async (duration: number) => {
      return new Promise<void>(resolve => {
          const startTime = Date.now();
          setLoadingProgress(0);
          
          // Cycle quotes every 5 seconds (duration / 3)
          const quoteInterval = setInterval(() => {
              setQuote(CULTURAL_QUOTES[Math.floor(Math.random() * CULTURAL_QUOTES.length)]);
          }, duration / 3);

          const progressInterval = setInterval(() => {
              const elapsed = Date.now() - startTime;
              const pct = Math.min((elapsed / duration) * 100, 100);
              setLoadingProgress(pct);
              if (elapsed >= duration) {
                  clearInterval(progressInterval);
                  clearInterval(quoteInterval);
                  resolve();
              }
          }, 100);
      });
  };

  const initializeSession = async () => {
      setLoading(true);
      // Pick initial random quote
      setQuote(CULTURAL_QUOTES[Math.floor(Math.random() * CULTURAL_QUOTES.length)]);
      
      const progress = getProgress();
      
      // LOGIC: ANTI-REPETITION
      const recentVerbs = Object.keys(brain.verbHistory)
          .filter(v => (Date.now() - brain.verbHistory[v].lastSeen) < 24 * 60 * 60 * 1000); 
          
      // MANDATORY 15 SECONDS WAIT FOR AI TO THINK
      const minWaitTime = waitForThinking(15000);
      
      // GENERATE CONTENT
      const contentPromise = generateLesson(brain.currentLevel, progress, recentVerbs, brain.verbHistory, config);
      
      // WAIT FOR BOTH
      const [_, firstLesson] = await Promise.all([minWaitTime, contentPromise]);
      
      // Track Text Generation Cost
      const newStats = { ...brain.usageStats };
      newStats.textQueries = (newStats.textQueries || 0) + 1;
      onUpdateBrain({ ...brain, usageStats: newStats });

      loadLesson(firstLesson);
      setLoading(false);
      fillBuffer();
  };

  const loadLesson = (data: VerbLessonSession) => {
      setSessionData(data);
      currentVerbRef.current = data.verb;
      setStage('PRESENTATION');
      setSessionErrors(0);
      setPerfectBonusAwarded(false);
      setVoiceBonusUnlocked(false);
      
      // No more "enriching" loading state here, we rely on the strong prompt from get go
      setIsEnriching(false); 
      
      // Setup Drill with Dynamic Difficulty based on Level (Using Config)
      let blanksToHide = config.rules.drillMaskA1;
      if (brain.currentLevel === 'A2') blanksToHide = config.rules.drillMaskA2;
      else if (brain.currentLevel === 'B1') blanksToHide = config.rules.drillMaskB1;
      else if (['B2', 'C1'].includes(brain.currentLevel)) blanksToHide = config.rules.drillMaskHigh;

      const mask = Array(6).fill(false);
      
      if (blanksToHide >= 6) {
          mask.fill(true);
      } else {
          let hiddenCount = 0;
          while (hiddenCount < blanksToHide) {
              const idx = Math.floor(Math.random() * 6);
              if (!mask[idx]) { mask[idx] = true; hiddenCount++; }
          }
      }
      setDrillMask(mask);
      
      const cleanConjugations = data.lesson.fullConjugation.map(cleanString);
      setDrillInputs(cleanConjugations.map((conj, idx) => mask[idx] ? '' : conj));
      setDrillFeedback(null);
      setShowCorrections(false);
      
      setPracticeInput('');
      setPracticeFeedback(null);

      randomizeGame(data);
  };

  const randomizeGame = (data: VerbLessonSession) => {
      setGameCompleted(false);
      
      // Weighted Random Selection based on config
      const weights = config.games;
      const totalWeight = weights.weightMatch + weights.weightBinary + weights.weightIntruder + weights.weightFlashcard + weights.weightDictation;
      const rand = Math.random() * totalWeight;
      
      let cursor = 0;
      if (rand < (cursor += weights.weightMatch)) {
          setGameType('MATCH_PAIRS'); setupMatchGame(data);
      } else if (rand < (cursor += weights.weightBinary)) {
          setGameType('BINARY'); setupBinaryGame(data);
      } else if (rand < (cursor += weights.weightIntruder)) {
          setGameType('INTRUDER'); setupIntruderGame(data);
      } else if (rand < (cursor += weights.weightFlashcard)) {
          setGameType('FLASHCARD'); setupFlashcardGame(data);
      } else {
          setGameType('DICTATION'); setupDictationGame(data);
      }
  };

  const awardXP = (amount: number) => {
      const newBrain = { ...brain };
      const currentStats = newBrain.levelStats[brain.currentLevel];
      currentStats.score += amount;
      onUpdateBrain(newBrain);
  };

  const recordVerbError = (verbInfinitive: string) => {
      const newBrain = { ...brain };
      newBrain.sessionStreak = 0;
      newBrain.consecutiveErrors += 1;
      const verbKey = verbInfinitive.charAt(0).toUpperCase() + verbInfinitive.slice(1).toLowerCase();
      if (!newBrain.verbHistory[verbKey]) {
         newBrain.verbHistory[verbKey] = { lastSeen: Date.now(), consecutiveCorrect: 0, consecutiveErrors: 1, weight: 3, history: [false] };
      } else {
         newBrain.verbHistory[verbKey].consecutiveErrors += 1;
         newBrain.verbHistory[verbKey].consecutiveCorrect = 0;
         newBrain.verbHistory[verbKey].weight += 2;
         newBrain.verbHistory[verbKey].lastSeen = Date.now();
      }
      onUpdateBrain(newBrain);
  };

  const handlePresentationComplete = () => {
      let totalXP = config.economy.xpPresentation;
      if (voiceBonusUnlocked) {
          totalXP += config.economy.xpVoiceBonus;
      }
      awardXP(totalXP);
      setStage('DRILL');
  };

  const completeGame = () => {
      setGameCompleted(true);
      
      let xpEarned = gameType === 'FLASHCARD' ? config.economy.xpGameFlashcard : config.economy.xpGameStandard;
      
      if (sessionErrors === 0) {
          setPerfectBonusAwarded(true);
          xpEarned += config.economy.xpPerfectRun;
      }
      
      // Update Brain with XP and Exercise Count
      const newBrain = { ...brain };
      newBrain.levelStats[brain.currentLevel].score += xpEarned;
      newBrain.levelStats[brain.currentLevel].exercisesCount += 1;
      onUpdateBrain(newBrain);
  };

  const nextLesson = async () => {
      setLoading(true);
      setQuote(CULTURAL_QUOTES[Math.floor(Math.random() * CULTURAL_QUOTES.length)]);
      
      // MANDATORY 15 SECONDS WAIT (Even between lessons, per request)
      const minWait = waitForThinking(15000);
      
      let nextData: VerbLessonSession;
      let fetchPromise: Promise<void>;

      if (lessonBuffer.length > 0) {
          nextData = lessonBuffer[0];
          fetchPromise = Promise.resolve(); // Instant
          setLessonBuffer(prev => prev.slice(1));
      } else {
          const progress = getProgress();
          const recentVerbs = Object.keys(brain.verbHistory)
            .filter(v => (Date.now() - brain.verbHistory[v].lastSeen) < 24 * 60 * 60 * 1000);
          const fresh = await generateLesson(brain.currentLevel, progress, recentVerbs, brain.verbHistory, config);
          
          // Track Text Generation Cost (Lazy load)
          const newStats = { ...brain.usageStats };
          newStats.textQueries = (newStats.textQueries || 0) + 1;
          onUpdateBrain({ ...brain, usageStats: newStats });

          nextData = fresh;
          fetchPromise = Promise.resolve();
      }

      await Promise.all([minWait, fetchPromise]);
      loadLesson(nextData!);
      setLoading(false);
  };
  
  const checkDrill = () => {
      if (!sessionData) return;
      if (showCorrections) { setStage('PRACTICE_1'); return; }
      const correct = sessionData.lesson.fullConjugation;
      let allCorrect = true;
      drillInputs.forEach((inp, idx) => {
         if (drillMask[idx]) {
             if (cleanString(inp).toLowerCase() !== cleanString(correct[idx]).toLowerCase()) allCorrect = false;
         }
      });
      setDrillFeedback(allCorrect);
      if (allCorrect) {
          awardXP(config.economy.xpDrill);
          setTimeout(() => setStage('PRACTICE_1'), 1200);
      } else {
          setSessionErrors(prev => prev + 1);
          recordVerbError(sessionData.verb);
          setShowCorrections(true);
      }
  };

  const checkPractice = async (sentenceIdx: number) => {
      if (!sessionData || submitting) return;
      setSubmitting(true);
      const target = sessionData.practiceSentences[sentenceIdx];
      
      // Track AI Cost for Analysis
      const newBrain = { ...brain };
      newBrain.usageStats.textQueries = (newBrain.usageStats.textQueries || 0) + 1;

      const feedback = await analyzeSubmission(target.context, sessionData.verb, target.correctAnswer, practiceInput);
      setPracticeFeedback(feedback);
      
      if (feedback.isCorrect) {
          awardXP(config.economy.xpPractice);
          newBrain.sessionStreak += 1;
          newBrain.consecutiveErrors = 0;
          const isNewVerb = !newBrain.verbHistory[sessionData.verb];
          if (isNewVerb || (!isNewVerb && newBrain.verbHistory[sessionData.verb].history.every(h => h === false))) {
             newBrain.verbsSinceLastStory = (newBrain.verbsSinceLastStory || 0) + 1;
          }
          if (isNewVerb) {
             newBrain.verbHistory[sessionData.verb] = { lastSeen: Date.now(), consecutiveCorrect: 1, consecutiveErrors: 0, weight: 1, history: [true] };
             newBrain.levelStats[brain.currentLevel].exercisesCount += 1; 
          } else {
             newBrain.verbHistory[sessionData.verb].consecutiveCorrect += 1;
             newBrain.verbHistory[sessionData.verb].lastSeen = Date.now();
             newBrain.verbHistory[sessionData.verb].weight = Math.max(1, newBrain.verbHistory[sessionData.verb].weight - 1);
             newBrain.verbHistory[sessionData.verb].history.push(true);
             if (newBrain.verbHistory[sessionData.verb].history.length > 5) newBrain.verbHistory[sessionData.verb].history.shift();
          }
      } else {
          setSessionErrors(prev => prev + 1);
          newBrain.sessionStreak = 0;
          newBrain.consecutiveErrors += 1;
          if (!newBrain.verbHistory[sessionData.verb]) {
              newBrain.verbHistory[sessionData.verb] = { lastSeen: Date.now(), consecutiveCorrect: 0, consecutiveErrors: 1, weight: 3, history: [false] };
          } else {
              newBrain.verbHistory[sessionData.verb].consecutiveErrors += 1;
              newBrain.verbHistory[sessionData.verb].history.push(false);
              if (newBrain.verbHistory[sessionData.verb].history.length > 5) newBrain.verbHistory[sessionData.verb].history.shift();
          }
      }
      onUpdateBrain(newBrain);
      setSubmitting(false);
  };

  // ... (Game setup functions - unchanged) ...
  const setupMatchGame = (data: VerbLessonSession) => {
      const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
      const cards: MatchCard[] = [];
      const cleanConjugations = data.lesson.fullConjugation.map(cleanString);
      pronouns.forEach((p, idx) => {
          cards.push({ id: p, text: p, type: 'PRONOUN', state: 'DEFAULT' });
          cards.push({ id: p, text: cleanConjugations[idx], type: 'VERB', state: 'DEFAULT' });
      });
      setMatchCards(cards); 
      setSelectedCardIdx(null);
  };
  const setupBinaryGame = (data: VerbLessonSession) => {
      const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
      const conjugation = data.lesson.fullConjugation.map(cleanString);
      const queue: BinaryCard[] = [];
      for (let i = 0; i < 5; i++) {
          const isCorrect = Math.random() > 0.4;
          const pIdx = Math.floor(Math.random() * 6);
          if (isCorrect) queue.push({ pronoun: pronouns[pIdx], verb: conjugation[pIdx], isCorrect: true });
          else {
              let wrongIdx = Math.floor(Math.random() * 6);
              while (wrongIdx === pIdx) wrongIdx = Math.floor(Math.random() * 6);
              queue.push({ pronoun: pronouns[pIdx], verb: conjugation[wrongIdx], isCorrect: false });
          }
      }
      setBinaryQueue(queue); setBinaryIndex(0); setBinaryFeedback(null);
  };
  const setupIntruderGame = (data: VerbLessonSession) => {
      const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
      const conjugation = data.lesson.fullConjugation.map(cleanString);
      const indices = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 4);
      const options: IntruderOption[] = [];
      const intruderIndex = Math.floor(Math.random() * 4);
      indices.forEach((realIdx, arrayPos) => {
          if (arrayPos === intruderIndex) {
              let wrongVerbIdx = (realIdx + 1) % 6;
              options.push({ id: arrayPos, pronoun: pronouns[realIdx], verb: conjugation[wrongVerbIdx], isCorrect: false, state: 'DEFAULT' });
          } else {
              options.push({ id: arrayPos, pronoun: pronouns[realIdx], verb: conjugation[realIdx], isCorrect: true, state: 'DEFAULT' });
          }
      });
      setIntruderOptions(options);
  };
  const setupFlashcardGame = (data: VerbLessonSession) => {
      const currentVerbEntry = VERB_DATABASE.find(v => v.infinitive.toLowerCase() === data.verb.toLowerCase());
      const historyKeys = Object.keys(brain.verbHistory).filter(v => v.toLowerCase() !== data.verb.toLowerCase());
      const historyEntries = historyKeys.sort(() => Math.random() - 0.5).slice(0, 4).map(k => VERB_DATABASE.find(v => v.infinitive.toLowerCase() === k.toLowerCase())).filter(v => v !== undefined) as typeof VERB_DATABASE;
      while (historyEntries.length < 4) {
          const random = VERB_DATABASE[Math.floor(Math.random() * VERB_DATABASE.length)];
          if (random.infinitive.toLowerCase() !== data.verb.toLowerCase() && !historyEntries.includes(random)) historyEntries.push(random);
      }
      const roundVerbs = [currentVerbEntry, ...historyEntries];
      if (!roundVerbs[0] && historyEntries.length > 0) roundVerbs[0] = historyEntries[0];
      const queue: FlashcardRound[] = roundVerbs.filter(v => !!v).map(v => {
          const isItToPt = Math.random() > 0.5;
          const rawSplits = v!.translation.split(/[\/,]/).map(s => s.trim().toLowerCase());
          const cleanVariants = rawSplits.map(s => s.replace(/\(.*\)/, '').trim());
          const accepted = Array.from(new Set([...rawSplits, ...cleanVariants])).filter(s => s.length > 0);
          if (isItToPt) return { question: v!.infinitive, answer: v!.translation, acceptedAnswers: accepted, direction: 'IT_PT' };
          else {
              const question = cleanVariants[Math.floor(Math.random() * cleanVariants.length)];
              return { question: question.charAt(0).toUpperCase() + question.slice(1), answer: v!.infinitive, acceptedAnswers: [v!.infinitive.toLowerCase()], direction: 'PT_IT' };
          }
      });
      setFlashcardQueue(queue); setFlashcardIndex(0); setFlashcardInput(''); setFlashcardFeedback(null);
  };
  const setupDictationGame = (data: VerbLessonSession) => {
      const currentVerbEntry = VERB_DATABASE.find(v => v.infinitive.toLowerCase() === data.verb.toLowerCase());
      const historyKeys = Object.keys(brain.verbHistory).filter(v => v.toLowerCase() !== data.verb.toLowerCase());
      const historyEntries = historyKeys.sort(() => Math.random() - 0.5).slice(0, 2).map(k => VERB_DATABASE.find(v => v.infinitive.toLowerCase() === k.toLowerCase())).filter(v => v !== undefined) as typeof VERB_DATABASE;
      while (historyEntries.length < 2) {
          const random = VERB_DATABASE[Math.floor(Math.random() * VERB_DATABASE.length)];
          if (random.infinitive.toLowerCase() !== data.verb.toLowerCase() && !historyEntries.includes(random)) historyEntries.push(random);
      }
      const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
      const indices = [0,1,2,3,4,5].sort(() => Math.random() - 0.5).slice(0, 3);
      const robustQueue: DictationRound[] = indices.map(idx => {
          let pronounLabel = pronouns[idx];
          if (pronounLabel === 'Lui/Lei') pronounLabel = Math.random() > 0.5 ? 'Lui' : 'Lei';
          const conjugations = data.lesson.fullConjugation.map(cleanString);
          const conj = conjugations[idx];
          const fullPhrase = `${pronounLabel} ${conj}`;
          
          return { verbInfinitive: data.verb, pronoun: pronounLabel, conjugation: conj, fullItalian: fullPhrase, ptTranslation: data.lesson.definition };
      });
      setDictationQueue(robustQueue); setDictationIndex(0); setDictationStep('LISTEN'); setDictationInput(''); setDictationFeedback(null);
  };

  // ... (Game interaction handlers - unchanged) ...
  const handleFlashcardSubmit = () => {
      const current = flashcardQueue[flashcardIndex];
      const input = flashcardInput.trim().toLowerCase();
      const isCorrect = current.acceptedAnswers.some(ans => input === ans);
      setFlashcardFeedback(isCorrect ? 'CORRECT' : 'WRONG');
      if (!isCorrect) { setSessionErrors(prev => prev + 1); }
      setTimeout(() => {
          setFlashcardFeedback(null); setFlashcardInput('');
          if (flashcardIndex < 4) setFlashcardIndex(prev => prev + 1); else completeGame();
      }, 1500); 
  };

  const handleDictationSubmit = () => {
      const current = dictationQueue[dictationIndex];
      const input = dictationInput.trim();
      if (dictationStep === 'LISTEN') {
          const cleanInput = input.toLowerCase().replace(/[.,!?;:]/g, '').trim();
          const cleanTarget = current.fullItalian.toLowerCase().replace(/[.,!?;:]/g, '').trim();
          const isCorrect = cleanInput === cleanTarget;
          if (isCorrect) { setDictationInput(''); setDictationStep('TRANSLATE'); }
          else {
              setDictationFeedback('WRONG'); setSessionErrors(prev => prev + 1); recordVerbError(current.verbInfinitive);
              setTimeout(() => {
                  setDictationFeedback(null); setDictationInput(''); setDictationStep('LISTEN');
                  if (dictationIndex < 2) setDictationIndex(prev => prev + 1); else completeGame();
              }, 2500);
          }
      } else {
          // STEP 2: CHECK MEANING (TRANSLATION)
          const cleanInput = input.toLowerCase();
          const targets = current.ptTranslation.toLowerCase().split(/[\/,]/).map(s => s.trim());
          
          // Fuzzy match logic:
          const isCorrect = targets.some(t => {
              if (cleanInput === t) return true;
              const tClean = t.replace(/\(.*\)/, '').trim();
              if (cleanInput === tClean) return true;
              if (cleanInput.length > 3 && cleanInput.includes(tClean)) return true;
              return false;
          });
          
          setDictationFeedback(isCorrect ? 'CORRECT' : 'WRONG');
          if (!isCorrect) { setSessionErrors(prev => prev + 1); recordVerbError(current.verbInfinitive); }
          setTimeout(() => {
              setDictationFeedback(null); setDictationInput(''); setDictationStep('LISTEN');
              if (dictationIndex < 2) setDictationIndex(prev => prev + 1); else completeGame();
          }, 2000);
      }
  };

  const handleCardClick = (idx: number) => {
      const card = matchCards[idx];
      if (card.state === 'MATCHED') return;
      if (selectedCardIdx === null) {
          const newCards = [...matchCards]; newCards[idx].state = 'SELECTED'; setMatchCards(newCards); setSelectedCardIdx(idx);
      } else {
          if (selectedCardIdx === idx) return; 
          const first = matchCards[selectedCardIdx]; const second = matchCards[idx];
          if (first.type === second.type) {
              const newCards = [...matchCards]; newCards[selectedCardIdx].state = 'DEFAULT'; newCards[idx].state = 'SELECTED'; setMatchCards(newCards); setSelectedCardIdx(idx); return;
          }
          const pronounCard = first.type === 'PRONOUN' ? first : second;
          const verbCard = first.type === 'VERB' ? first : second;
          const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
          const pronounIndex = pronouns.indexOf(pronounCard.text);
          const correctConjugation = cleanString(sessionData!.lesson.fullConjugation[pronounIndex]);
          const isMatch = verbCard.text.toLowerCase() === correctConjugation.toLowerCase();
          if (isMatch) {
              const newCards = [...matchCards]; newCards[selectedCardIdx].state = 'MATCHED'; newCards[idx].state = 'MATCHED'; setMatchCards(newCards); setSelectedCardIdx(null); if (newCards.every(c => c.state === 'MATCHED')) completeGame();
          } else {
              const newCards = [...matchCards]; newCards[selectedCardIdx].state = 'ERROR'; newCards[idx].state = 'ERROR'; setMatchCards(newCards); setSessionErrors(prev => prev + 1);
              setTimeout(() => { const resetCards = [...matchCards]; if (resetCards[selectedCardIdx]) resetCards[selectedCardIdx].state = 'DEFAULT'; if (resetCards[idx]) resetCards[idx].state = 'DEFAULT'; setMatchCards(resetCards); setSelectedCardIdx(null); }, 800);
          }
      }
  };

  const handleBinaryChoice = (choice: boolean) => {
      const current = binaryQueue[binaryIndex];
      const isCorrect = choice === current.isCorrect;
      setBinaryFeedback(isCorrect ? 'HIT' : 'MISS');
      if (!isCorrect) setSessionErrors(prev => prev + 1);
      setTimeout(() => { setBinaryFeedback(null); if (binaryIndex < 4) setBinaryIndex(prev => prev + 1); else completeGame(); }, 800);
  };

  const handleIntruderChoice = (id: number) => {
      const opt = intruderOptions.find(o => o.id === id); if (!opt) return;
      const newOpts = [...intruderOptions]; const idx = newOpts.findIndex(o => o.id === id);
      if (!opt.isCorrect) { newOpts[idx].state = 'SELECTED_RIGHT'; setIntruderOptions(newOpts); setTimeout(() => completeGame(), 1000); }
      else { setSessionErrors(prev => prev + 1); newOpts[idx].state = 'SELECTED_WRONG'; setIntruderOptions(newOpts); }
  };

  if (loading) {
      return (
          <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in relative overflow-hidden">
              {/* Background Ambient Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900 opacity-50"></div>
              
              <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
                  <div className="mb-8 relative">
                      <RefreshCw className="animate-spin-slow text-emerald-500" size={48} />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                          {Math.round(loadingProgress)}%
                      </div>
                  </div>
                  
                  <div className="mb-8 space-y-4 min-h-[160px] flex flex-col justify-center animate-fade-in key-{quote.it}">
                      <Quote className="text-slate-600 mx-auto transform -scale-x-100" size={32} />
                      <h3 className="text-2xl font-serif font-bold text-white leading-relaxed italic">
                          "{quote.it}"
                      </h3>
                      <p className="text-emerald-400 font-medium">
                          {quote.pt}
                      </p>
                      <p className="text-slate-500 text-xs uppercase tracking-widest mt-4">
                          — {quote.author}
                      </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full max-w-xs h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
                      <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${loadingProgress}%`}}></div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 text-xs animate-pulse">
                      <Brain className="text-emerald-600" size={14} />
                      <span>O Oráculo está forjando frases contextualizadas...</span>
                  </div>
              </div>
          </div>
      );
  }

  if (!sessionData) return null;

  const isIndirectVerb = VERB_DATABASE.find(v => v.infinitive === sessionData.verb)?.tags?.includes('indirect');
  const getIndirectLabel = (pronoun: string, index: number) => {
      if (!isIndirectVerb) return pronoun;
      const indirectMap = ["(A me)", "(A te)", "(A lui/lei)", "(A noi)", "(A voi)", "(A loro)"];
      return `${pronoun} ${indirectMap[index]}`;
  };

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col p-4 md:p-6" ref={scrollContainerRef}>
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                 <X size={20} />
             </button>
             <div className="flex flex-col">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     {brain.currentLevel} • {sessionData.tense}
                     {isEnriching && <RefreshCw size={10} className="animate-spin text-emerald-500"/>}
                 </span>
                 <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
                     {sessionData.verb} 
                     <span className="text-emerald-500 text-sm bg-emerald-50 px-2 py-1 rounded-md font-sans font-medium">{sessionData.lesson.definition}</span>
                 </h2>
             </div>
          </div>
          <div className="flex items-center gap-2">
              {/* Voice Bonus Indicator */}
              {voiceBonusUnlocked && stage === 'PRESENTATION' && (
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full animate-bounce">
                      <Mic size={12} /> Voz Ativada! +{config.economy.xpVoiceBonus} XP
                  </div>
              )}
              {/* Perfect Run Indicator */}
              {sessionErrors === 0 && stage !== 'PRESENTATION' && (
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full animate-pulse">
                      <Sparkles size={12} /> Perfect Run
                  </div>
              )}
              <div className="flex gap-1">
                 {['PRESENTATION', 'DRILL', 'PRACTICE_1', 'PRACTICE_2', 'CONNECTION'].map((s, i) => {
                     const activeIdx = ['PRESENTATION', 'DRILL', 'PRACTICE_1', 'PRACTICE_2', 'CONNECTION'].indexOf(stage);
                     return (
                         <div key={s} className={`h-1.5 w-6 rounded-full transition-all ${i <= activeIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                     );
                 })}
              </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col">
          
          {/* STAGE 1: PRESENTATION (0 XP) */}
          {stage === 'PRESENTATION' && (
              <div className="flex-1 flex flex-col space-y-6 animate-fade-in">
                  
                  {/* Top Card: Definition & Usage Tip */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
                      <div className="flex flex-col items-center">
                          <div className="inline-block p-3 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                              <BookOpen size={24} />
                          </div>
                          <h3 className="text-3xl font-serif font-bold text-slate-800 mb-2">{sessionData.verb}</h3>
                          <p className="text-lg text-slate-600 font-medium mb-6">{sessionData.lesson.definition}</p>
                          
                          {/* USAGE TIP (NEW) */}
                          {sessionData.lesson.usageTip && (
                              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3 items-start text-left mb-6 w-full max-w-lg">
                                  <Lightbulb className="text-indigo-500 shrink-0 mt-1" size={20} />
                                  <div>
                                      <h4 className="font-bold text-indigo-700 text-xs uppercase mb-1">Dica de Uso</h4>
                                      <p className="text-indigo-900 text-sm leading-relaxed">{sessionData.lesson.usageTip}</p>
                                  </div>
                              </div>
                          )}

                          {/* NEW: Voice Energy Monitor */}
                          <div className="w-full border-t border-slate-100 pt-4">
                              <p className="text-xs text-slate-400 mb-3 font-medium">OPCIONAL: LEIA EM VOZ ALTA PARA ATIVAR O BÔNUS</p>
                              <VoiceEnergyMonitor onEnergyFull={() => setVoiceBonusUnlocked(true)} threshold={config.rules.voiceThreshold} />
                          </div>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                       <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                               <RefreshCw size={16} className="text-slate-400" />
                               <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Conjugação Essencial</span>
                           </div>
                           <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Leitura e Áudio</span>
                       </div>
                       <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'].map((pronoun, idx) => {
                               const conjugation = cleanString(sessionData.lesson.fullConjugation[idx]);
                               const fullPhrase = `${pronoun} ${conjugation}`;
                               return (
                                   <div key={pronoun} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group">
                                       <span className="text-slate-400 font-bold text-sm uppercase">{pronoun}</span>
                                       <span className="text-lg font-serif font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                                           {conjugation}
                                       </span>
                                       <button 
                                           onClick={() => handlePlayAudio(fullPhrase, `conj-${idx}`)}
                                           disabled={!!playingAudio}
                                           className={`ml-2 p-2 rounded-full ${playingAudio === `conj-${idx}` ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-200 text-slate-400'}`}
                                       >
                                           <Volume2 size={18} className={playingAudio === `conj-${idx}` ? 'animate-pulse' : ''} />
                                       </button>
                                   </div>
                               );
                           })}
                       </div>
                  </div>

                  <div className="pt-4">
                      <button 
                        onClick={handlePresentationComplete}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
                            ${voiceBonusUnlocked ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-900/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}
                        `}
                      >
                          {voiceBonusUnlocked ? <><Sparkles size={20}/> Memorizado (Bônus Ativo)</> : <><Check size={20}/> Memorizei</>}
                      </button>
                      <p className="text-center text-xs text-slate-400 mt-2">Pressione ENTER para continuar</p>
                  </div>
              </div>
          )}

          {/* STAGE 2: DRILL (Unchanged from original logic, just context) */}
          {stage === 'DRILL' && (
               <div className="flex-1 flex flex-col animate-fade-in">
                  <div className="text-center mb-6">
                      <div className="flex justify-center items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-slate-800">Preencha as lacunas</h3>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">+{config.economy.xpDrill} XP</span>
                      </div>
                      <p className="text-slate-500">Complete a conjugação para fixar a memória.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                       {['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'].map((pronoun, idx) => {
                           const userClean = cleanString(drillInputs[idx]);
                           const targetClean = cleanString(sessionData.lesson.fullConjugation[idx]);
                           const isUserCorrect = userClean.toLowerCase() === targetClean.toLowerCase();
                           const isMasked = drillMask[idx];
                           const isErrorState = showCorrections && isMasked && !isUserCorrect;
                           const isCorrectState = (drillFeedback === true) || (showCorrections && isMasked && isUserCorrect);
                           
                           return (
                               <div key={pronoun} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all
                                   ${isErrorState ? 'border-red-100 bg-red-50' : ''}
                                   ${isCorrectState ? 'border-emerald-200 bg-emerald-50' : ''}
                                   ${!isErrorState && !isCorrectState ? 'border-slate-100 bg-white' : ''}
                               `}>
                                   <span className={`text-slate-400 font-bold text-sm uppercase w-20 ${isIndirectVerb ? 'text-[10px]' : ''}`}>{getIndirectLabel(pronoun, idx)}</span>
                                   {isMasked ? (
                                       <div className="flex-1 relative">
                                           <input 
                                              type="text"
                                              value={drillInputs[idx]}
                                              onChange={(e) => {
                                                  const newInputs = [...drillInputs];
                                                  newInputs[idx] = e.target.value;
                                                  setDrillInputs(newInputs);
                                              }}
                                              placeholder="..."
                                              className={`w-full bg-transparent text-right font-serif font-bold text-lg outline-none placeholder:text-slate-300
                                                  ${isErrorState ? 'text-red-500 line-through' : ''}
                                                  ${isCorrectState ? 'text-emerald-600' : 'text-slate-800'}
                                              `}
                                              readOnly={drillFeedback === true || showCorrections}
                                           />
                                           {isErrorState && (
                                               <div className="absolute top-full right-0 text-sm text-emerald-600 font-bold animate-pulse">
                                                   {targetClean}
                                               </div>
                                           )}
                                       </div>
                                   ) : (
                                       <span className="text-lg font-serif font-bold text-slate-600">{cleanString(sessionData.lesson.fullConjugation[idx])}</span>
                                   )}
                               </div>
                           );
                       })}
                  </div>

                  <div className="mt-auto pt-4">
                      {drillFeedback !== true ? (
                          <button 
                            onClick={checkDrill}
                            className={`w-full text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
                                ${showCorrections ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-800 hover:bg-slate-700'}
                            `}
                          >
                            {showCorrections ? 'Entendi, Continuar' : 'Verificar'} 
                            {showCorrections ? <ArrowRight size={20} /> : <Check size={20} />}
                          </button>
                      ) : (
                          <div className="text-center text-emerald-600 font-bold animate-bounce">
                              +{config.economy.xpDrill} XP! Muito bem!
                          </div>
                      )}
                  </div>
               </div>
          )}

          {/* STAGE 3: PRACTICE */}
          {(stage === 'PRACTICE_1' || stage === 'PRACTICE_2') && (
              <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full animate-fade-in">
                  
                  {!practiceFeedback ? (
                      <>
                        <div className="mb-4 text-center">
                             <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                                Contexto: {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].context}
                            </span>
                            <span className="block text-xs font-bold text-emerald-600 mt-1">+{config.economy.xpPractice} XP</span>
                        </div>

                        {/* INLINE SENTENCE INPUT AREA */}
                        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                            
                            <div className="text-2xl md:text-4xl font-serif text-slate-800 leading-loose flex flex-col items-center gap-4">
                                <button 
                                   onClick={() => {
                                       const s = sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1];
                                       // Reading with blank: "Io ... la pasta"
                                       const blankRead = `${s.sentenceStart} ... ${s.sentenceEnd}`;
                                       handlePlayAudio(blankRead, 'practice-q');
                                   }}
                                   disabled={!!playingAudio}
                                   className={`p-3 rounded-full ${playingAudio === 'practice-q' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                                >
                                   <Volume2 size={24} className={playingAudio === 'practice-q' ? 'animate-pulse' : ''} />
                                </button>
                                
                                <div>
                                    {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceStart}
                                    
                                    <span className="inline-block relative mx-2">
                                        <input 
                                            ref={inputRef}
                                            type="text" 
                                            value={practiceInput}
                                            onChange={(e) => setPracticeInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && checkPractice(stage === 'PRACTICE_1' ? 0 : 1)}
                                            className="bg-transparent border-b-4 border-slate-300 focus:border-emerald-500 outline-none text-emerald-600 font-bold text-center w-[180px] placeholder:text-slate-200 transition-colors"
                                            placeholder="_____"
                                            autoFocus
                                        />
                                    </span>

                                    {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceEnd}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button 
                                onClick={() => checkPractice(stage === 'PRACTICE_1' ? 0 : 1)}
                                disabled={!practiceInput}
                                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                            >
                                {submitting ? <RefreshCw className="animate-spin mx-auto"/> : 'Confirmar'}
                            </button>
                        </div>
                      </>
                  ) : (
                      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center animate-pop-in">
                          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${practiceFeedback.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                              {practiceFeedback.isCorrect ? <Check size={32} /> : <X size={32} />}
                          </div>
                          
                          <h3 className="text-xl font-bold text-slate-800 mb-2">
                              {practiceFeedback.isCorrect ? `+${config.economy.xpPractice} XP! Correto!` : 'Ops, quase lá.'}
                          </h3>
                          
                          <div className="text-lg mb-6 flex flex-col items-center">
                              {!practiceFeedback.isCorrect && (
                                  <div className="mb-2 text-slate-400 line-through text-sm">{practiceFeedback.userAnswer}</div>
                              )}
                              <div className="flex items-center gap-3">
                                  <span className="text-emerald-600 font-serif font-bold text-2xl">
                                      {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceStart} {cleanString(practiceFeedback.correctAnswer)} {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceEnd}
                                  </span>
                                  <button 
                                     onClick={() => {
                                         const s = sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1];
                                         const full = `${s.sentenceStart} ${cleanString(practiceFeedback.correctAnswer)} ${s.sentenceEnd}`;
                                         handlePlayAudio(full, 'practice-a');
                                     }}
                                     disabled={!!playingAudio}
                                     className={`p-2 rounded-full ${playingAudio === 'practice-a' ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-400'}`}
                                  >
                                      <Volume2 size={20} className={playingAudio === 'practice-a' ? 'animate-pulse' : ''} />
                                  </button>
                              </div>
                          </div>

                          {!practiceFeedback.isCorrect && practiceFeedback.explanation && (
                              <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 mb-6 text-left border-l-4 border-amber-400">
                                  <strong>Análise da IA:</strong> {practiceFeedback.explanation}
                              </div>
                          )}

                          <button 
                             onClick={() => {
                                 setPracticeInput('');
                                 setPracticeFeedback(null);
                                 if (stage === 'PRACTICE_1') setStage('PRACTICE_2');
                                 else setStage('CONNECTION');
                             }}
                             className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${practiceFeedback.isCorrect ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-800 hover:bg-slate-700'}`}
                          >
                              Continuar (Enter)
                          </button>
                      </div>
                  )}
              </div>
          )}

          {/* STAGE 4: NEURAL GAME (Unchanged) */}
          {stage === 'CONNECTION' && (
              <div className="flex-1 flex flex-col animate-fade-in">
                   <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-1 text-purple-600 bg-purple-50 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2">
                          <Zap size={14} /> Desafio Neural
                      </div>
                      <div className="flex justify-center gap-2">
                          <h3 className="text-xl font-bold text-slate-800">
                              {gameType === 'MATCH_PAIRS' && 'Conecte os Pares'}
                              {gameType === 'BINARY' && 'Verdadeiro ou Falso?'}
                              {gameType === 'INTRUDER' && 'Encontre o Intruso'}
                              {gameType === 'FLASHCARD' && 'Ping-Pong Mental'}
                              {gameType === 'DICTATION' && 'Ditado Auditivo'}
                          </h3>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded h-fit">
                              +{gameType === 'FLASHCARD' ? `${config.economy.xpGameFlashcard} XP` : `${config.economy.xpGameStandard} XP`}
                          </span>
                      </div>
                   </div>

                   {/* GAME: MATCH PAIRS (2 Columns) */}
                   {gameType === 'MATCH_PAIRS' && (
                       <div className="flex flex-row justify-between gap-4 h-full">
                           {/* Left Column: Pronouns */}
                           <div className="flex flex-col gap-3 w-1/2">
                               {matchCards.filter(c => c.type === 'PRONOUN').map((card) => {
                                   const originalIdx = matchCards.indexOf(card);
                                   return (
                                       <button
                                          key={originalIdx}
                                          onClick={() => handleCardClick(originalIdx)}
                                          className={`flex-1 p-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center
                                              ${card.state === 'DEFAULT' ? 'bg-white border-slate-200 text-slate-700 hover:border-purple-300' : ''}
                                              ${card.state === 'SELECTED' ? 'bg-purple-50 border-purple-500 text-purple-700 scale-105 shadow-lg' : ''}
                                              ${card.state === 'MATCHED' ? 'bg-emerald-50 border-emerald-400 text-emerald-600 opacity-50' : ''}
                                              ${card.state === 'ERROR' ? 'bg-red-50 border-red-400 text-red-600 animate-shake' : ''}
                                          `}
                                       >
                                           {card.state === 'MATCHED' ? <Check size={20} /> : card.text}
                                       </button>
                                   );
                               })}
                           </div>
                           
                           {/* Right Column: Verbs */}
                           <div className="flex flex-col gap-3 w-1/2">
                               {matchCards.filter(c => c.type === 'VERB').sort((a,b) => a.text.localeCompare(b.text)).map((card) => { 
                                   const originalIdx = matchCards.indexOf(card);
                                   return (
                                       <button
                                          key={originalIdx}
                                          onClick={() => handleCardClick(originalIdx)}
                                          className={`flex-1 p-3 rounded-xl border-2 font-bold text-lg font-serif transition-all flex items-center justify-center
                                              ${card.state === 'DEFAULT' ? 'bg-white border-slate-200 text-slate-700 hover:border-purple-300' : ''}
                                              ${card.state === 'SELECTED' ? 'bg-purple-50 border-purple-500 text-purple-700 scale-105 shadow-lg' : ''}
                                              ${card.state === 'MATCHED' ? 'bg-emerald-50 border-emerald-400 text-emerald-600 opacity-50' : ''}
                                              ${card.state === 'ERROR' ? 'bg-red-50 border-red-400 text-red-600 animate-shake' : ''}
                                          `}
                                       >
                                           {card.state === 'MATCHED' ? <Check size={20} /> : card.text}
                                       </button>
                                   );
                               })}
                           </div>
                       </div>
                   )}

                   {/* GAME: BINARY */}
                   {gameType === 'BINARY' && binaryQueue.length > 0 && (
                       <div className="flex flex-col items-center justify-center flex-1">
                           <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 text-center w-full max-w-sm relative overflow-hidden">
                               {binaryFeedback && (
                                   <div className={`absolute inset-0 flex items-center justify-center z-10 ${binaryFeedback === 'HIT' ? 'bg-emerald-500/90' : 'bg-red-500/90'}`}>
                                       {binaryFeedback === 'HIT' ? <Check size={64} className="text-white"/> : <X size={64} className="text-white"/>}
                                   </div>
                               )}
                               <div className="text-slate-400 text-sm font-bold uppercase mb-4">Está correto?</div>
                               <div className="text-3xl font-serif text-slate-800 mb-8">
                                   <span className="font-bold">{binaryQueue[binaryIndex]?.pronoun}</span>
                                   <br />
                                   <span className="text-purple-600">{cleanString(binaryQueue[binaryIndex]?.verb)}</span>
                               </div>
                               <div className="flex gap-4">
                                   <button onClick={() => handleBinaryChoice(false)} className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200">Não</button>
                                   <button onClick={() => handleBinaryChoice(true)} className="flex-1 py-3 bg-emerald-100 text-emerald-600 rounded-xl font-bold hover:bg-emerald-200">Sim</button>
                               </div>
                           </div>
                       </div>
                   )}

                   {/* GAME: INTRUDER */}
                   {gameType === 'INTRUDER' && (
                       <div className="space-y-4">
                           <p className="text-center text-slate-500 text-sm">Qual conjugação está ERRADA?</p>
                           {intruderOptions.map(opt => (
                               <button 
                                 key={opt.id}
                                 onClick={() => handleIntruderChoice(opt.id)}
                                 className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all
                                    ${opt.state === 'DEFAULT' ? 'bg-white border-slate-200 hover:border-purple-300' : ''}
                                    ${opt.state === 'SELECTED_WRONG' ? 'bg-red-50 border-red-500 text-red-700' : ''}
                                    ${opt.state === 'SELECTED_RIGHT' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : ''}
                                 `}
                               >
                                   <span className="text-slate-500 font-bold w-12">{opt.pronoun}</span>
                                   <span className="text-lg font-serif">{cleanString(opt.verb)}</span>
                                   {opt.state === 'SELECTED_RIGHT' && <Check size={20} />}
                                   {opt.state === 'SELECTED_WRONG' && <X size={20} />}
                               </button>
                           ))}
                       </div>
                   )}

                   {/* GAME: FLASHCARD (PING-PONG) */}
                   {gameType === 'FLASHCARD' && flashcardQueue.length > 0 && (
                       <div className="flex flex-col items-center justify-center flex-1 animate-pop-in">
                           <div className="flex gap-1 mb-6">
                               {flashcardQueue.map((_, i) => (
                                   <div key={i} className={`h-2 w-8 rounded-full transition-all ${i < flashcardIndex ? 'bg-purple-500' : i === flashcardIndex ? 'bg-purple-200 animate-pulse' : 'bg-slate-200'}`} />
                               ))}
                           </div>

                           <div className={`bg-white p-8 md:p-12 rounded-3xl shadow-xl border-2 text-center w-full max-w-md relative overflow-hidden transition-all duration-300
                               ${flashcardFeedback === 'CORRECT' ? 'border-emerald-400 bg-emerald-50 scale-105' : 
                                 flashcardFeedback === 'WRONG' ? 'border-red-400 bg-red-50' : 'border-slate-100'}
                           `}>
                               <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                                   <div className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                                       {flashcardQueue[flashcardIndex].direction === 'IT_PT' 
                                          ? <>🇮🇹 <ArrowRight size={10} /> 🇧🇷</>
                                          : <>🇧🇷 <ArrowRight size={10} /> 🇮🇹</>
                                       }
                                   </div>
                               </div>

                               <div className="mt-6 mb-8">
                                   <h3 className="text-3xl font-serif font-bold text-slate-800">
                                       {flashcardQueue[flashcardIndex].question}
                                   </h3>
                               </div>

                               <div className="relative">
                                   <input 
                                       ref={flashcardInputRef}
                                       autoFocus
                                       value={flashcardInput}
                                       onChange={(e) => setFlashcardInput(e.target.value)}
                                       onKeyDown={(e) => e.key === 'Enter' && !flashcardFeedback && handleFlashcardSubmit()}
                                       placeholder="Tradução..."
                                       className={`w-full bg-transparent border-b-2 text-center text-xl font-bold p-2 outline-none placeholder:text-slate-300 transition-colors
                                           ${flashcardFeedback === 'CORRECT' ? 'border-emerald-500 text-emerald-600' : 
                                             flashcardFeedback === 'WRONG' ? 'border-red-500 text-red-500 line-through' : 'border-slate-300 text-slate-700 focus:border-purple-500'}
                                       `}
                                       disabled={!!flashcardFeedback}
                                   />
                                   {flashcardFeedback === 'WRONG' && (
                                       <div className="absolute top-full left-0 right-0 mt-2 text-emerald-600 font-bold animate-fade-in">
                                           {flashcardQueue[flashcardIndex].answer}
                                       </div>
                                   )}
                                   {flashcardFeedback === 'CORRECT' && (
                                       <div className="absolute top-1/2 right-4 transform -translate-y-1/2 text-emerald-500">
                                           <Check size={24} />
                                       </div>
                                   )}
                               </div>
                           </div>
                           <p className="text-slate-400 text-xs mt-6 font-medium">
                               {flashcardFeedback ? "Carregando..." : "Digite e pressione ENTER"}
                           </p>
                       </div>
                   )}

                   {/* GAME: DICTATION (NEW) */}
                   {gameType === 'DICTATION' && dictationQueue.length > 0 && (
                       <div className="flex flex-col items-center justify-center flex-1 animate-pop-in">
                           <div className="flex gap-1 mb-6">
                               {[0,1,2].map(i => (
                                   <div key={i} className={`h-2 w-8 rounded-full transition-all ${i < dictationIndex ? 'bg-purple-500' : i === dictationIndex ? 'bg-purple-200 animate-pulse' : 'bg-slate-200'}`} />
                               ))}
                           </div>

                           <div className={`bg-white p-8 rounded-3xl shadow-xl border-2 text-center w-full max-w-md relative overflow-hidden transition-all duration-300
                               ${dictationFeedback === 'CORRECT' ? 'border-emerald-400 bg-emerald-50' : 
                                 dictationFeedback === 'WRONG' ? 'border-red-400 bg-red-50' : 'border-slate-100'}
                           `}>
                               {/* AUDIO BUTTON */}
                               <div className="flex justify-center mb-6">
                                   <button 
                                      onClick={() => handlePlayAudio(dictationQueue[dictationIndex].fullItalian, `dict-${dictationIndex}`)}
                                      disabled={!!playingAudio}
                                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-lg
                                          ${playingAudio === `dict-${dictationIndex}` ? 'bg-purple-100 text-purple-600 scale-105' : 'bg-slate-900 text-white hover:bg-slate-800'}
                                      `}
                                   >
                                       <Volume2 size={40} className={playingAudio === `dict-${dictationIndex}` ? 'animate-pulse' : ''} />
                                   </button>
                               </div>

                               <div className="mb-6">
                                   <div className="text-xs font-bold uppercase text-slate-400 mb-2">
                                       {dictationStep === 'LISTEN' ? '1. Escute e escreva em Italiano' : '2. Escreva o significado do verbo (Infinitivo)'}
                                   </div>
                                   
                                   {dictationStep === 'TRANSLATE' && (
                                       <div className="text-xl font-serif text-slate-800 mb-4 animate-fade-in">
                                           {dictationQueue[dictationIndex].fullItalian}
                                       </div>
                                   )}

                                   <div className="relative">
                                       <input 
                                           autoFocus
                                           value={dictationInput}
                                           onChange={(e) => setDictationInput(e.target.value)}
                                           onKeyDown={(e) => e.key === 'Enter' && !dictationFeedback && handleDictationSubmit()}
                                           placeholder={dictationStep === 'LISTEN' ? "Escreva o que ouviu..." : "Significado (ex: Comer)"}
                                           className={`w-full bg-transparent border-b-2 text-center text-xl font-bold p-2 outline-none placeholder:text-slate-300 transition-colors
                                               ${dictationFeedback === 'CORRECT' ? 'border-emerald-500 text-emerald-600' : 
                                                 dictationFeedback === 'WRONG' ? 'border-red-500 text-red-500 line-through' : 'border-slate-300 text-slate-700 focus:border-purple-500'}
                                           `}
                                           disabled={!!dictationFeedback}
                                       />
                                       
                                       {/* Error Feedback Overlay */}
                                       {dictationFeedback === 'WRONG' && (
                                           <div className="absolute top-full left-0 right-0 mt-2 text-red-500 font-bold animate-fade-in text-sm bg-red-100 p-2 rounded-lg">
                                               {dictationStep === 'LISTEN' 
                                                  ? `Correto: ${dictationQueue[dictationIndex].fullItalian}` 
                                                  : `Significado: ${dictationQueue[dictationIndex].ptTranslation}`
                                               }
                                           </div>
                                       )}
                                   </div>
                               </div>
                           </div>
                           <p className="text-slate-400 text-xs mt-6 font-medium">
                               {dictationFeedback ? "Processando..." : "Digite e pressione ENTER"}
                           </p>
                       </div>
                   )}

                   {/* Game Complete Overlay */}
                   {gameCompleted && (
                       <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transform scale-105">
                               
                               {/* PERFECT SCORE BONUS UI */}
                               {perfectBonusAwarded && (
                                   <div className="mb-6 animate-bounce">
                                       <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-600 rounded-full font-bold border border-amber-200 shadow-sm">
                                           <Sparkles size={16} /> PERFECT SESSION! +{config.economy.xpPerfectRun} BONUS
                                       </div>
                                   </div>
                               )}

                               <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                   <Zap size={40} fill="currentColor" />
                               </div>
                               <h2 className="text-2xl font-bold text-slate-800 mb-2">
                                   {/* Calculate total visually for user */}
                                   +{ (gameType === 'FLASHCARD' ? config.economy.xpGameFlashcard : config.economy.xpGameStandard) + (perfectBonusAwarded ? config.economy.xpPerfectRun : 0) } XP
                               </h2>
                               <p className="text-slate-500 mb-8">Neuroplasticidade reforçada para o verbo <strong>{sessionData.verb}</strong>.</p>
                               <button 
                                 onClick={nextLesson}
                                 className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                               >
                                   Próximo Verbo (Enter) <ArrowRight size={20} />
                               </button>
                           </div>
                       </div>
                   )}
              </div>
          )}

      </div>
    </div>
  );
};

export default ExerciseSession;
