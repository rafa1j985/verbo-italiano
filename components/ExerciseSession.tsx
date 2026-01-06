
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateLesson, generateBatchLessons, analyzeSubmission, enrichPracticeSentences, playTextToSpeech, prefetchAudio } from '../services/geminiService';
import { Feedback, UserBrain, VerbLessonSession } from '../types';
import { ArrowRight, Check, X, RefreshCw, BookOpen, GraduationCap, ChevronRight, HelpCircle, Link2, Zap, AlertTriangle, Timer, Info, Eye, Trophy, Sparkles, Volume2, Repeat, Languages, Mic, MicOff, Activity, Lightbulb } from 'lucide-react';
import { VERB_DATABASE } from '../data/verbs';

interface ExerciseSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
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

// --- UTIL: NORMALIZE TEXT (No accents, lowercase, trimmed) ---
const normalizeText = (str: string) => {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
};

// --- VOICE ENERGY COMPONENT ---
const VoiceEnergyMonitor: React.FC<{ onEnergyFull: () => void }> = ({ onEnergyFull }) => {
    const [isListening, setIsListening] = useState(false);
    const [energy, setEnergy] = useState(0);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    // Fix: Provide an initial value to useRef to satisfy the expected 1 argument for the hook.
    const requestRef = useRef<number | undefined>(undefined);
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
            const audioCtx = new AudioContextClass();
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
    };

    const analyze = () => {
        if (!analyserRef.current) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
        const average = sum / bufferLength;

        if (average > 10) {
            setEnergy(prev => {
                const newVal = Math.min(prev + 1.2, 100); 
                if (newVal >= 100) {
                    setCompleted(true);
                    onEnergyFull();
                }
                return newVal;
            });
        } else {
            setEnergy(prev => (prev >= 100 ? 100 : Math.max(prev - 0.5, 0)));
        }
        requestRef.current = requestAnimationFrame(analyze);
    };

    useEffect(() => { return () => stopListening(); }, []);

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
                >
                    {completed ? <Check size={18} strokeWidth={3} /> : (isListening ? <MicOff size={18} /> : <Mic size={18} />)}
                </button>
                <div className="flex flex-col w-32 md:w-48">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <span className={completed ? "text-amber-600 font-extrabold tracking-widest animate-pulse" : ""}>
                            {completed ? "BÔNUS LIBERADO!" : (isListening ? "Detectando Voz..." : "Toque no mic")}
                        </span>
                        <span className={completed ? "text-amber-600" : ""}>{Math.round(energy)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                        <div className={`h-full transition-all duration-300 ${completed ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${energy}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExerciseSession: React.FC<ExerciseSessionProps> = ({ onExit, brain, onUpdateBrain }) => {
  const [sessionData, setSessionData] = useState<VerbLessonSession | null>(null);
  const [stage, setStage] = useState<Stage>('PRESENTATION');
  const [isEnriching, setIsEnriching] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  
  const [sessionErrors, setSessionErrors] = useState(0);
  const [perfectBonusAwarded, setPerfectBonusAwarded] = useState(false);
  const [voiceBonusUnlocked, setVoiceBonusUnlocked] = useState(false);

  const [drillInputs, setDrillInputs] = useState<string[]>(Array(6).fill(''));
  const [drillMask, setDrillMask] = useState<boolean[]>([]);
  const [drillFeedback, setDrillFeedback] = useState<boolean | null>(null);
  const [showCorrections, setShowCorrections] = useState(false); 
  
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<Feedback | null>(null);

  const [gameType, setGameType] = useState<GameType>('MATCH_PAIRS');
  const [gameCompleted, setGameCompleted] = useState(false);
  
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
  const [binaryQueue, setBinaryQueue] = useState<BinaryCard[]>([]);
  const [binaryIndex, setBinaryIndex] = useState(0);
  const [binaryFeedback, setBinaryFeedback] = useState<'HIT' | 'MISS' | null>(null);
  const [intruderOptions, setIntruderOptions] = useState<IntruderOption[]>([]);

  const [flashcardQueue, setFlashcardQueue] = useState<FlashcardRound[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardInput, setFlashcardInput] = useState('');
  const [flashcardFeedback, setFlashcardFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);

  const [dictationQueue, setDictationQueue] = useState<DictationRound[]>([]);
  const [dictationIndex, setDictationIndex] = useState(0);
  const [dictationStep, setDictationStep] = useState<'LISTEN' | 'TRANSLATE'>('LISTEN');
  const [dictationInput, setDictationInput] = useState('');
  const [dictationFeedback, setDictationFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
  
  const [lessonBuffer, setLessonBuffer] = useState<VerbLessonSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const hasInitialized = useRef(false);
  const currentVerbRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashcardInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getProgress = () => {
    const totalVerbsInLevel = VERB_DATABASE.filter(v => v.level === brain.currentLevel).length;
    const masteredInLevel = Object.keys(brain.verbHistory).filter(v => {
        const verbData = VERB_DATABASE.find(dbV => dbV.infinitive.toLowerCase() === v.toLowerCase());
        return verbData && verbData.level === brain.currentLevel;
    }).length;
    return totalVerbsInLevel > 0 ? (masteredInLevel / totalVerbsInLevel) * 100 : 0;
  };

  const cleanString = (str: string): string => {
      if (!str) return "";
      return str.replace(/^(io|tu|lui\/lei|lui|lei|noi|voi|loro)\s+/i, '').trim();
  };

  const handlePlayAudio = async (text: string, id: string) => {
      if (playingAudio === id) return; 
      setPlayingAudio(id);
      await playTextToSpeech(text);
      setPlayingAudio(null);
  };

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
  }, [stage, practiceFeedback]);

  useEffect(() => {
      if (stage === 'CONNECTION' && gameType === 'FLASHCARD' && !flashcardFeedback && flashcardInputRef.current) {
          setTimeout(() => flashcardInputRef.current?.focus(), 50);
      }
  }, [stage, gameType, flashcardIndex, flashcardFeedback]);

  useEffect(() => {
      if (stage === 'CONNECTION' && gameType === 'DICTATION' && dictationQueue.length > 0 && dictationStep === 'LISTEN' && !dictationFeedback) {
          const timer = setTimeout(() => {
              handlePlayAudio(dictationQueue[dictationIndex].fullItalian, `dict-${dictationIndex}`);
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [stage, gameType, dictationIndex, dictationStep, dictationFeedback, dictationQueue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (stage === 'PRESENTATION') { handlePresentationComplete(); return; }
      if (stage === 'DRILL') { checkDrill(); return; }
      if (stage === 'PRACTICE_1' || stage === 'PRACTICE_2') {
        if (practiceFeedback) {
          setPracticeInput('');
          setPracticeFeedback(null);
          if (stage === 'PRACTICE_1') setStage('PRACTICE_2');
          else setStage('CONNECTION');
        } else if (practiceInput.trim().length > 0) {
          checkPractice(stage === 'PRACTICE_1' ? 0 : 1);
        }
        return;
      }
      if (stage === 'CONNECTION' && !gameCompleted) {
          if (gameType === 'FLASHCARD' && !flashcardFeedback && flashcardInput.trim().length > 0) handleFlashcardSubmit();
          if (gameType === 'DICTATION' && !dictationFeedback && dictationInput.trim().length > 0) handleDictationSubmit();
          return;
      }
      if (stage === 'CONNECTION' && gameCompleted) { nextLesson(); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, drillInputs, practiceFeedback, practiceInput, gameCompleted, drillMask, showCorrections, gameType, flashcardInput, flashcardFeedback, dictationInput, dictationFeedback]); 

  const fillBuffer = async () => {
      try {
          const progress = getProgress();
          const newBatch = await generateBatchLessons(brain.currentLevel, 2, progress, brain.verbHistory);
          if (newBatch.length > 0) setLessonBuffer(prev => [...prev, ...newBatch]);
      } catch (e) { console.error(e); }
  };

  const initializeSession = async () => {
      setLoading(true);
      const progress = getProgress();
      const recentVerbs = Object.keys(brain.verbHistory).filter(v => (Date.now() - brain.verbHistory[v].lastSeen) < 24 * 60 * 60 * 1000); 
      const firstLesson = await generateLesson(brain.currentLevel, progress, recentVerbs, brain.verbHistory);
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
      setIsEnriching(true);

      enrichPracticeSentences(data.verb, brain.currentLevel)
        .then(betterSentences => {
            if (currentVerbRef.current !== data.verb) return;
            if (betterSentences && betterSentences.length === 2) {
                setSessionData(prev => (prev && prev.verb === data.verb ? { ...prev, practiceSentences: betterSentences } : prev));
            }
        })
        .finally(() => { if (currentVerbRef.current === data.verb) setIsEnriching(false); });
      
      let blanksToHide = 3;
      if (brain.currentLevel === 'A2') blanksToHide = 4;
      else if (brain.currentLevel === 'B1') blanksToHide = 5;
      else if (['B2', 'C1'].includes(brain.currentLevel)) blanksToHide = 6;
      const mask = Array(6).fill(false);
      if (blanksToHide === 6) { mask.fill(true); } else {
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
      const rand = Math.random();
      if (rand < 0.20) { setGameType('MATCH_PAIRS'); setupMatchGame(data); }
      else if (rand < 0.40) { setGameType('BINARY'); setupBinaryGame(data); }
      else if (rand < 0.60) { setGameType('INTRUDER'); setupIntruderGame(data); }
      else if (rand < 0.80) { setGameType('FLASHCARD'); setupFlashcardGame(data); }
      else { setGameType('DICTATION'); setupDictationGame(data); }
  };

  const awardXP = (amount: number) => {
      const newBrain = { ...brain };
      newBrain.levelStats[brain.currentLevel].score += amount;
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
      if (voiceBonusUnlocked) awardXP(5);
      setStage('DRILL');
  };

  const completeGame = () => {
      if (gameCompleted) return;
      let bonus = sessionErrors === 0 ? 10 : 0;
      if (bonus > 0) setPerfectBonusAwarded(true);
      awardXP((gameType === 'FLASHCARD' ? 20 : 10) + bonus); 
      setGameCompleted(true);
  };

  const nextLesson = async () => {
      setLoading(true);
      if (lessonBuffer.length > 0) {
          const next = lessonBuffer[0];
          setLessonBuffer(prev => prev.slice(1));
          loadLesson(next);
      } else {
          const progress = getProgress();
          const recentVerbs = Object.keys(brain.verbHistory).filter(v => (Date.now() - brain.verbHistory[v].lastSeen) < 24 * 60 * 60 * 1000);
          const fresh = await generateLesson(brain.currentLevel, progress, recentVerbs, brain.verbHistory);
          loadLesson(fresh);
      }
      setLoading(false);
  };

  const checkDrill = () => {
      if (!sessionData) return;
      if (showCorrections) { setStage('PRACTICE_1'); return; }
      const correct = sessionData.lesson.fullConjugation;
      let allCorrect = true;
      drillInputs.forEach((inp, idx) => {
         if (drillMask[idx]) {
             if (normalizeText(inp) !== normalizeText(cleanString(correct[idx]))) allCorrect = false;
         }
      });
      setDrillFeedback(allCorrect);
      if (allCorrect) { awardXP(10); setTimeout(() => setStage('PRACTICE_1'), 1200); }
      else { setSessionErrors(prev => prev + 1); recordVerbError(sessionData.verb); setShowCorrections(true); }
  };

  const checkPractice = async (sentenceIdx: number) => {
      if (!sessionData || submitting) return;
      setSubmitting(true);
      const target = sessionData.practiceSentences[sentenceIdx];
      const feedback = await analyzeSubmission(target.context, sessionData.verb, target.correctAnswer, practiceInput);
      setPracticeFeedback(feedback);
      const newBrain = { ...brain };
      if (feedback.isCorrect) {
          awardXP(5);
          newBrain.sessionStreak += 1;
          newBrain.consecutiveErrors = 0;
          const isNewVerb = !newBrain.verbHistory[sessionData.verb];
          const isFirstSuccess = !isNewVerb && newBrain.verbHistory[sessionData.verb].history.every(h => h === false);
          if (isNewVerb || isFirstSuccess) newBrain.verbsSinceLastStory = (newBrain.verbsSinceLastStory || 0) + 1;
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

  // --- GAME SETUP & HANDLERS ---
  const setupMatchGame = (data: VerbLessonSession) => {
      const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
      const cards: MatchCard[] = [];
      const cleanConjugations = data.lesson.fullConjugation.map(cleanString);
      pronouns.forEach((p, idx) => {
          cards.push({ id: p, text: p, type: 'PRONOUN', state: 'DEFAULT' });
          cards.push({ id: p, text: cleanConjugations[idx], type: 'VERB', state: 'DEFAULT' });
      });
      setMatchCards(cards); setSelectedCardIdx(null);
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
              let wrongIdx = (pIdx + 1) % 6;
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
      const historyEntries = historyKeys.sort(() => Math.random() - 0.5).slice(0, 4).map(k => VERB_DATABASE.find(v => v.infinitive.toLowerCase() === k.toLowerCase())).filter(v => !!v) as typeof VERB_DATABASE;
      while (historyEntries.length < 4) {
          const random = VERB_DATABASE[Math.floor(Math.random() * VERB_DATABASE.length)];
          if (random.infinitive.toLowerCase() !== data.verb.toLowerCase() && !historyEntries.includes(random)) historyEntries.push(random);
      }
      const roundVerbs = [currentVerbEntry, ...historyEntries].filter(v => !!v);
      const queue: FlashcardRound[] = roundVerbs.map(v => {
          const isItToPt = Math.random() > 0.5;
          const accepted = v.translation.split(/[/,]/).map(s => normalizeText(s));
          if (isItToPt) return { question: v.infinitive, answer: v.translation, acceptedAnswers: accepted, direction: 'IT_PT' };
          const question = accepted[Math.floor(Math.random() * accepted.length)];
          return { question: question.charAt(0).toUpperCase() + question.slice(1), answer: v.infinitive, acceptedAnswers: [normalizeText(v.infinitive)], direction: 'PT_IT' };
      });
      setFlashcardQueue(queue); setFlashcardIndex(0); setFlashcardInput(''); setFlashcardFeedback(null);
  };

  const setupDictationGame = (data: VerbLessonSession) => {
      const indices = [0,1,2,3,4,5].sort(() => Math.random() - 0.5).slice(0, 3);
      const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
      const robustQueue: DictationRound[] = indices.map(idx => {
          let pronounLabel = pronouns[idx];
          if (pronounLabel === 'Lui/Lei') pronounLabel = Math.random() > 0.5 ? 'Lui' : 'Lei';
          const conj = cleanString(data.lesson.fullConjugation[idx]);
          const fullPhrase = `${pronounLabel} ${conj}`;
          prefetchAudio(fullPhrase);
          return { verbInfinitive: data.verb, pronoun: pronounLabel, conjugation: conj, fullItalian: fullPhrase, ptTranslation: data.lesson.definition };
      });
      setDictationQueue(robustQueue); setDictationIndex(0); setDictationStep('LISTEN'); setDictationInput(''); setDictationFeedback(null);
  };

  const handleFlashcardSubmit = () => {
      const current = flashcardQueue[flashcardIndex];
      const isCorrect = current.acceptedAnswers.includes(normalizeText(flashcardInput));
      setFlashcardFeedback(isCorrect ? 'CORRECT' : 'WRONG');
      if (!isCorrect) setSessionErrors(prev => prev + 1);
      setTimeout(() => {
          setFlashcardFeedback(null); setFlashcardInput('');
          if (flashcardIndex < 4) setFlashcardIndex(prev => prev + 1);
          else completeGame();
      }, 1500); 
  };

  const handleDictationSubmit = () => {
      const current = dictationQueue[dictationIndex];
      if (dictationStep === 'LISTEN') {
          const isCorrect = normalizeText(dictationInput.replace(/[.,!?;:]/g, '')) === normalizeText(current.fullItalian.replace(/[.,!?;:]/g, ''));
          if (isCorrect) { setDictationInput(''); setDictationStep('TRANSLATE'); }
          else {
              setDictationFeedback('WRONG'); setSessionErrors(prev => prev + 1); recordVerbError(current.verbInfinitive);
              setTimeout(() => {
                  setDictationFeedback(null); setDictationInput(''); setDictationStep('LISTEN');
                  if (dictationIndex < 2) setDictationIndex(prev => prev + 1); else completeGame();
              }, 2500);
          }
      } else {
          // SPLIT AND CHECK ANY PART FOR THE TRANSLATION
          const acceptedParts = current.ptTranslation.split(/[/,]/).map(s => normalizeText(s));
          const inputNorm = normalizeText(dictationInput);
          const isCorrect = acceptedParts.some(part => inputNorm.includes(part) || part.includes(inputNorm));
          
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
          const newCards = [...matchCards]; newCards[idx].state = 'SELECTED';
          setMatchCards(newCards); setSelectedCardIdx(idx);
      } else {
          if (selectedCardIdx === idx) return; 
          const first = matchCards[selectedCardIdx];
          const second = matchCards[idx];
          if (first.type === second.type) {
              const newCards = [...matchCards];
              newCards[selectedCardIdx].state = 'DEFAULT'; newCards[idx].state = 'SELECTED';
              setMatchCards(newCards); setSelectedCardIdx(idx);
              return;
          }
          const pronounCard = first.type === 'PRONOUN' ? first : second;
          const verbCard = first.type === 'VERB' ? first : second;
          const pronouns = ['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'];
          const correctConjugation = cleanString(sessionData!.lesson.fullConjugation[pronouns.indexOf(pronounCard.text)]);
          if (normalizeText(verbCard.text) === normalizeText(correctConjugation)) {
              const newCards = [...matchCards];
              newCards[selectedCardIdx].state = 'MATCHED'; newCards[idx].state = 'MATCHED';
              setMatchCards(newCards); setSelectedCardIdx(null);
              if (newCards.every(c => c.state === 'MATCHED')) completeGame();
          } else {
              const newCards = [...matchCards];
              newCards[selectedCardIdx].state = 'ERROR'; newCards[idx].state = 'ERROR';
              setMatchCards(newCards); setSessionErrors(prev => prev + 1);
              setTimeout(() => {
                   const resetCards = [...matchCards];
                   if (resetCards[selectedCardIdx]) resetCards[selectedCardIdx].state = 'DEFAULT';
                   if (resetCards[idx]) resetCards[idx].state = 'DEFAULT';
                   setMatchCards(resetCards); setSelectedCardIdx(null);
              }, 800);
          }
      }
  };

  const handleBinaryChoice = (choice: boolean) => {
      const isCorrect = choice === binaryQueue[binaryIndex].isCorrect;
      setBinaryFeedback(isCorrect ? 'HIT' : 'MISS');
      if (!isCorrect) setSessionErrors(prev => prev + 1);
      setTimeout(() => {
          setBinaryFeedback(null);
          if (binaryIndex < 4) setBinaryIndex(prev => prev + 1); else completeGame();
      }, 800);
  };

  const handleIntruderChoice = (id: number) => {
      const opt = intruderOptions.find(o => o.id === id);
      if (!opt) return;
      const newOpts = [...intruderOptions];
      const idx = newOpts.findIndex(o => o.id === id);
      if (!opt.isCorrect) {
          newOpts[idx].state = 'SELECTED_RIGHT'; setIntruderOptions(newOpts);
          setTimeout(() => completeGame(), 1000);
      } else {
          setSessionErrors(prev => prev + 1); newOpts[idx].state = 'SELECTED_WRONG'; setIntruderOptions(newOpts);
      }
  };

  if (loading || !sessionData) {
      return (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="animate-spin text-emerald-500" size={48} />
              <p className="text-slate-500 font-medium animate-pulse">Sintonizando frequência neural...</p>
          </div>
      );
  }

  const isIndirectVerb = VERB_DATABASE.find(v => v.infinitive === sessionData.verb)?.tags?.includes('indirect');
  const getIndirectLabel = (pronoun: string, index: number) => {
      if (!isIndirectVerb) return pronoun;
      const indirectMap = ["(A me)", "(A te)", "(A lui/lei)", "(A noi)", "(A voi)", "(A loro)"];
      return `${pronoun} ${indirectMap[index]}`;
  };

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col p-4 md:p-6" ref={scrollContainerRef}>
      
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
              {voiceBonusUnlocked && stage === 'PRESENTATION' && (
                  <div className="flex items-center gap-1 text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full animate-bounce">
                      <Mic size={12} /> Voz Ativada! +5 XP
                  </div>
              )}
              {sessionErrors === 0 && stage !== 'PRESENTATION' && (
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full animate-pulse">
                      <Sparkles size={12} /> Perfect Run
                  </div>
              )}
              <div className="flex gap-1">
                 {['PRESENTATION', 'DRILL', 'PRACTICE_1', 'PRACTICE_2', 'CONNECTION'].map((s, i) => {
                     const activeIdx = ['PRESENTATION', 'DRILL', 'PRACTICE_1', 'PRACTICE_2', 'CONNECTION'].indexOf(stage);
                     return <div key={s} className={`h-1.5 w-6 rounded-full transition-all ${i <= activeIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />;
                 })}
              </div>
          </div>
      </div>

      <div className="flex-1 flex flex-col">
          {stage === 'PRESENTATION' && (
              <div className="flex-1 flex flex-col space-y-6 animate-fade-in">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
                      <div className="flex flex-col items-center">
                          <div className="inline-block p-3 bg-emerald-100 text-emerald-600 rounded-full mb-4"><BookOpen size={24} /></div>
                          <h3 className="text-3xl font-serif font-bold text-slate-800 mb-2">{sessionData.verb}</h3>
                          <p className="text-lg text-slate-600 font-medium mb-6">{sessionData.lesson.definition}</p>
                          {sessionData.lesson.usageTip && (
                              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex gap-3 items-start text-left mb-6 w-full max-w-lg">
                                  <Lightbulb className="text-indigo-500 shrink-0 mt-1" size={20} />
                                  <div>
                                      <h4 className="font-bold text-indigo-700 text-xs uppercase mb-1">Dica de Uso</h4>
                                      <p className="text-indigo-900 text-sm leading-relaxed">{sessionData.lesson.usageTip}</p>
                                  </div>
                              </div>
                          )}
                          <div className="w-full border-t border-slate-100 pt-4">
                              <p className="text-xs text-slate-400 mb-3 font-medium uppercase">Leia em voz alta para bônus</p>
                              <VoiceEnergyMonitor onEnergyFull={() => setVoiceBonusUnlocked(true)} />
                          </div>
                      </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
                       <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                           <div className="flex items-center gap-2"><RefreshCw size={16} className="text-slate-400" /><span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Conjugação</span></div>
                       </div>
                       <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto">
                           {['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'].map((pronoun, idx) => {
                               const conjugation = cleanString(sessionData.lesson.fullConjugation[idx]);
                               return (
                                   <div key={pronoun} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors group">
                                       <span className="text-slate-400 font-bold text-sm uppercase">{pronoun}</span>
                                       <span className="text-lg font-serif font-bold text-slate-800">{conjugation}</span>
                                       <button onClick={() => handlePlayAudio(`${pronoun} ${conjugation}`, `conj-${idx}`)} className={`ml-2 p-2 rounded-full ${playingAudio === `conj-${idx}` ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-200 text-slate-400'}`}><Volume2 size={18} /></button>
                                   </div>
                               );
                           })}
                       </div>
                  </div>
                  <div className="pt-4">
                      <button onClick={handlePresentationComplete} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform active:scale-95 ${voiceBonusUnlocked ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                          {voiceBonusUnlocked ? 'Memorizado (Bônus Ativo)' : 'Memorizei'}
                      </button>
                      <p className="text-center text-xs text-slate-400 mt-2">Pressione ENTER para continuar</p>
                  </div>
              </div>
          )}

          {stage === 'DRILL' && (
               <div className="flex-1 flex flex-col animate-fade-in">
                  <div className="text-center mb-6"><h3 className="text-xl font-bold text-slate-800">Preencha as lacunas <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded ml-2">+10 XP</span></h3></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                       {['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'].map((pronoun, idx) => {
                           const userNorm = normalizeText(drillInputs[idx]);
                           const targetNorm = normalizeText(cleanString(sessionData.lesson.fullConjugation[idx]));
                           const isErrorState = showCorrections && drillMask[idx] && userNorm !== targetNorm;
                           const isCorrectState = (drillFeedback === true) || (showCorrections && drillMask[idx] && userNorm === targetNorm);
                           return (
                               <div key={pronoun} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${isErrorState ? 'border-red-100 bg-red-50' : isCorrectState ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-white'}`}>
                                   <span className="text-slate-400 font-bold text-sm uppercase w-20">{getIndirectLabel(pronoun, idx)}</span>
                                   {drillMask[idx] ? (
                                       <div className="flex-1 relative">
                                           <input type="text" value={drillInputs[idx]} onChange={(e) => { const n = [...drillInputs]; n[idx] = e.target.value; setDrillInputs(n); }} className={`w-full bg-transparent text-right font-serif font-bold text-lg outline-none ${isErrorState ? 'text-red-500 line-through' : isCorrectState ? 'text-emerald-600' : 'text-slate-800'}`} readOnly={drillFeedback === true || showCorrections} />
                                           {isErrorState && <div className="absolute top-full right-0 text-sm text-emerald-600 font-bold">{cleanString(sessionData.lesson.fullConjugation[idx])}</div>}
                                       </div>
                                   ) : <span className="text-lg font-serif font-bold text-slate-600">{cleanString(sessionData.lesson.fullConjugation[idx])}</span>}
                               </div>
                           );
                       })}
                  </div>
                  <div className="mt-auto pt-4">
                      {drillFeedback !== true ? <button onClick={checkDrill} className={`w-full text-white py-4 rounded-xl font-bold text-lg transition-all ${showCorrections ? 'bg-indigo-600' : 'bg-slate-800'}`}>{showCorrections ? 'Entendi, Continuar' : 'Verificar'}</button> : <div className="text-center text-emerald-600 font-bold animate-bounce">+10 XP! Muito bem!</div>}
                  </div>
               </div>
          )}

          {(stage === 'PRACTICE_1' || stage === 'PRACTICE_2') && (
              <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full animate-fade-in">
                  {!practiceFeedback ? (
                      <>
                        <div className="mb-4 text-center"><span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-xs font-bold uppercase tracking-widest mb-4">Contexto: {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].context}</span></div>
                        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                            <div className="text-2xl md:text-3xl font-serif text-slate-800 leading-loose flex flex-col items-center gap-4">
                                <button onClick={() => handlePlayAudio(`${sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceStart} ... ${sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceEnd}`, 'practice-q')} className={`p-3 rounded-full ${playingAudio === 'practice-q' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}><Volume2 size={24}/></button>
                                <div>{sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceStart}<span className="inline-block relative mx-2"><input ref={inputRef} type="text" value={practiceInput} onChange={(e) => setPracticeInput(e.target.value)} className="bg-transparent border-b-4 border-slate-300 focus:border-emerald-500 outline-none text-emerald-600 font-bold text-center w-[180px]" placeholder="_____" autoFocus /></span>{sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceEnd}</div>
                            </div>
                        </div>
                        <div className="mt-8"><button onClick={() => checkPractice(stage === 'PRACTICE_1' ? 0 : 1)} disabled={!practiceInput} className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95">{submitting ? <RefreshCw className="animate-spin mx-auto"/> : 'Confirmar'}</button></div>
                      </>
                  ) : (
                      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 text-center animate-pop-in">
                          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${practiceFeedback.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>{practiceFeedback.isCorrect ? <Check size={32} /> : <X size={32} />}</div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">{practiceFeedback.isCorrect ? '+5 XP! Correto!' : 'Ops, quase lá.'}</h3>
                          <div className="text-lg mb-6 flex flex-col items-center">
                              {!practiceFeedback.isCorrect && <div className="mb-2 text-slate-400 line-through text-sm">{practiceFeedback.userAnswer}</div>}
                              <div className="flex items-center gap-3"><span className="text-emerald-600 font-serif font-bold text-2xl">{sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceStart} {cleanString(practiceFeedback.correctAnswer)} {sessionData.practiceSentences[stage === 'PRACTICE_1' ? 0 : 1].sentenceEnd}</span></div>
                          </div>
                          {!practiceFeedback.isCorrect && practiceFeedback.explanation && <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 mb-6 text-left border-l-4 border-amber-400"><strong>Análise:</strong> {practiceFeedback.explanation}</div>}
                          <button onClick={() => { setPracticeInput(''); setPracticeFeedback(null); if (stage === 'PRACTICE_1') setStage('PRACTICE_2'); else setStage('CONNECTION'); }} className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${practiceFeedback.isCorrect ? 'bg-emerald-600' : 'bg-slate-800'}`}>Continuar (Enter)</button>
                      </div>
                  )}
              </div>
          )}

          {stage === 'CONNECTION' && (
              <div className="flex-1 flex flex-col animate-fade-in overflow-y-auto">
                   <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-1 text-purple-600 bg-purple-50 px-3 py-1 rounded-full text-xs font-bold uppercase mb-2"><Zap size={14} /> Desafio Neural</div>
                      <div className="flex justify-center gap-2"><h3 className="text-xl font-bold text-slate-800">{gameType === 'MATCH_PAIRS' ? 'Conecte os Pares' : gameType === 'BINARY' ? 'Vero o Falso?' : gameType === 'INTRUDER' ? 'Intruso' : gameType === 'FLASHCARD' ? 'Ping-Pong Mental' : 'Ditado'}</h3><span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">+{gameType === 'FLASHCARD' ? '20' : '10'} XP</span></div>
                   </div>

                   {gameType === 'MATCH_PAIRS' && (
                       <div className="flex gap-4 h-full">
                           <div className="flex flex-col gap-3 w-1/2">{matchCards.filter(c => c.type === 'PRONOUN').map((card) => { const idx = matchCards.indexOf(card); return <button key={idx} onClick={() => handleCardClick(idx)} className={`flex-1 p-3 rounded-xl border-2 font-bold text-sm transition-all ${card.state === 'DEFAULT' ? 'bg-white' : card.state === 'SELECTED' ? 'bg-purple-50 border-purple-500' : card.state === 'MATCHED' ? 'bg-emerald-50 opacity-50' : 'bg-red-50 animate-shake'}`}>{card.state === 'MATCHED' ? <Check size={20} className="mx-auto" /> : card.text}</button>; })}</div>
                           <div className="flex flex-col gap-3 w-1/2">{matchCards.filter(c => c.type === 'VERB').sort((a,b) => a.text.localeCompare(b.text)).map((card) => { const idx = matchCards.indexOf(card); return <button key={idx} onClick={() => handleCardClick(idx)} className={`flex-1 p-3 rounded-xl border-2 font-bold text-lg font-serif transition-all ${card.state === 'DEFAULT' ? 'bg-white' : card.state === 'SELECTED' ? 'bg-purple-50 border-purple-500' : card.state === 'MATCHED' ? 'bg-emerald-50 opacity-50' : 'bg-red-50 animate-shake'}`}>{card.state === 'MATCHED' ? <Check size={20} className="mx-auto" /> : card.text}</button>; })}</div>
                       </div>
                   )}

                   {gameType === 'BINARY' && binaryQueue.length > 0 && (
                       <div className="flex flex-col items-center justify-center flex-1">
                           <div className="bg-white p-10 rounded-2xl shadow-xl border w-full max-w-sm relative overflow-hidden">
                               {binaryFeedback && <div className={`absolute inset-0 flex items-center justify-center z-10 ${binaryFeedback === 'HIT' ? 'bg-emerald-500/90' : 'bg-red-500/90'}`}>{binaryFeedback === 'HIT' ? <Check size={64} className="text-white"/> : <X size={64} className="text-white"/>}</div>}
                               <div className="text-3xl font-serif text-slate-800 mb-8"><span className="font-bold">{binaryQueue[binaryIndex]?.pronoun}</span><br /><span className="text-purple-600">{binaryQueue[binaryIndex]?.verb}</span></div>
                               <div className="flex gap-4"><button onClick={() => handleBinaryChoice(false)} className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl font-bold">Não</button><button onClick={() => handleBinaryChoice(true)} className="flex-1 py-3 bg-emerald-100 text-emerald-600 rounded-xl font-bold">Sim</button></div>
                           </div>
                       </div>
                   )}

                   {gameType === 'INTRUDER' && (
                       <div className="space-y-4">
                           {intruderOptions.map(opt => <button key={opt.id} onClick={() => handleIntruderChoice(opt.id)} className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all ${opt.state === 'DEFAULT' ? 'bg-white' : opt.state === 'SELECTED_WRONG' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700 font-bold'}`}><span className="text-slate-500 font-bold w-12">{opt.pronoun}</span><span className="text-lg font-serif">{opt.verb}</span>{opt.state === 'SELECTED_RIGHT' && <Check size={20} />}{opt.state === 'SELECTED_WRONG' && <X size={20} />}</button>)}
                       </div>
                   )}

                   {gameType === 'FLASHCARD' && flashcardQueue.length > 0 && (
                       <div className="flex flex-col items-center justify-center flex-1 animate-pop-in">
                           <div className="flex gap-1 mb-6">{flashcardQueue.map((_, i) => <div key={i} className={`h-2 w-8 rounded-full ${i < flashcardIndex ? 'bg-purple-500' : i === flashcardIndex ? 'bg-purple-200 animate-pulse' : 'bg-slate-200'}`} />)}</div>
                           <div className={`bg-white p-8 md:p-12 rounded-3xl shadow-xl border-2 text-center w-full max-w-md relative overflow-hidden ${flashcardFeedback === 'CORRECT' ? 'border-emerald-400 bg-emerald-50' : flashcardFeedback === 'WRONG' ? 'border-red-400 bg-red-50' : 'border-slate-100'}`}>
                               <div className="mt-6 mb-8"><h3 className="text-3xl font-serif font-bold text-slate-800">{flashcardQueue[flashcardIndex].question}</h3></div>
                               <div className="relative"><input ref={flashcardInputRef} value={flashcardInput} onChange={(e) => setFlashcardInput(e.target.value)} placeholder="Tradução..." className={`w-full bg-transparent border-b-2 text-center text-xl font-bold p-2 outline-none ${flashcardFeedback === 'CORRECT' ? 'border-emerald-500' : flashcardFeedback === 'WRONG' ? 'border-red-500 line-through' : 'border-slate-300'}`} disabled={!!flashcardFeedback} />
                               {flashcardFeedback === 'WRONG' && <div className="mt-2 text-emerald-600 font-bold">{flashcardQueue[flashcardIndex].answer}</div>}</div>
                           </div>
                       </div>
                   )}

                   {gameType === 'DICTATION' && dictationQueue.length > 0 && (
                       <div className="flex flex-col items-center justify-center flex-1 animate-pop-in">
                           <div className="flex gap-1 mb-6">{[0,1,2].map(i => <div key={i} className={`h-2 w-8 rounded-full ${i < dictationIndex ? 'bg-purple-500' : i === dictationIndex ? 'bg-purple-200 animate-pulse' : 'bg-slate-200'}`} />)}</div>
                           <div className={`bg-white p-8 rounded-3xl shadow-xl border-2 text-center w-full max-w-md relative overflow-hidden ${dictationFeedback === 'CORRECT' ? 'border-emerald-400 bg-emerald-50' : dictationFeedback === 'WRONG' ? 'border-red-400 bg-red-50' : 'border-slate-100'}`}>
                               <div className="flex justify-center mb-6"><button onClick={() => handlePlayAudio(dictationQueue[dictationIndex].fullItalian, `dict-${dictationIndex}`)} className="w-20 h-20 rounded-full flex items-center justify-center bg-slate-900 text-white shadow-lg"><Volume2 size={40}/></button></div>
                               <div className="mb-6"><div className="text-xs font-bold uppercase text-slate-400 mb-2">{dictationStep === 'LISTEN' ? 'Escreva em Italiano' : 'Traduza o Significado'}</div>
                               {dictationStep === 'TRANSLATE' && <div className="text-xl font-serif text-slate-800 mb-4">{dictationQueue[dictationIndex].fullItalian}</div>}
                               <div className="relative"><input value={dictationInput} onChange={(e) => setDictationInput(e.target.value)} placeholder={dictationStep === 'LISTEN' ? "Escute e escreva..." : "Ex: Comer"} className={`w-full bg-transparent border-b-2 text-center text-xl font-bold p-2 outline-none ${dictationFeedback === 'CORRECT' ? 'border-emerald-500' : dictationFeedback === 'WRONG' ? 'border-red-500 line-through' : 'border-slate-300'}`} disabled={!!dictationFeedback} />
                               {dictationFeedback === 'WRONG' && <div className="mt-2 text-red-500 font-bold bg-red-100 p-2 rounded-lg text-sm">{dictationStep === 'LISTEN' ? `Correto: ${dictationQueue[dictationIndex].fullItalian}` : `Significado: ${dictationQueue[dictationIndex].ptTranslation}`}</div>}</div></div>
                           </div>
                       </div>
                   )}

                   {gameCompleted && (
                       <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                           <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                               {perfectBonusAwarded && <div className="mb-6 animate-bounce"><div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-600 rounded-full font-bold border border-amber-200 shadow-sm"><Sparkles size={16} /> PERFECT SESSION! +10 BONUS</div></div>}
                               <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"><Zap size={40} fill="currentColor" /></div>
                               <h2 className="text-2xl font-bold text-slate-800 mb-2">{perfectBonusAwarded ? '+40 XP Total!' : '+30 XP Total'}</h2>
                               <p className="text-slate-500 mb-8">Neuroplasticidade reforçada para o verbo <strong>{sessionData.verb}</strong>.</p>
                               <button onClick={nextLesson} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2">Próximo Verbo (Enter) <ArrowRight size={20} /></button>
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
