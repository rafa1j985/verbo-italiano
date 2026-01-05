
import React, { useState, useEffect } from 'react';
import { UserBrain, VerbLessonSession, Feedback } from '../types';
import { generateBatchLessons, analyzeSubmission } from '../services/geminiService';
import { Brain, ArrowRight, Check, X, RefreshCw, Trophy, BookOpen } from 'lucide-react';

// Props for the ExerciseSession component
interface ExerciseSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
}

/**
 * ExerciseSession Component
 * Manages the study flow: Presentation of verbs followed by context practice.
 */
const ExerciseSession: React.FC<ExerciseSessionProps> = ({ onExit, brain, onUpdateBrain }) => {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<VerbLessonSession[]>([]);
  const [currentLessonIdx, setCurrentLessonIdx] = useState(0);
  const [stage, setStage] = useState<'PRESENTATION' | 'PRACTICE'>('PRESENTATION');
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionXP, setSessionXP] = useState(0);
  const [sessionErrors, setSessionErrors] = useState(0);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [perfectBonusAwarded, setPerfectBonusAwarded] = useState(false);

  // Load lessons on mount using the Gemini service
  useEffect(() => {
    const loadContent = async () => {
      try {
        const data = await generateBatchLessons(brain.currentLevel, 2, 0, brain.verbHistory);
        if (data && data.length > 0) {
          setLessons(data);
        } else {
          console.error("No lessons generated");
          onExit();
        }
      } catch (err) {
        console.error("Failed to load lessons:", err);
        onExit();
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [brain.currentLevel, brain.verbHistory, onExit]);

  // Handle transition between stages (Presentation -> Practice) and lessons
  const handleNextStage = () => {
    if (stage === 'PRESENTATION') {
      setStage('PRACTICE');
      setPracticeIdx(0);
    } else {
      const currentLesson = lessons[currentLessonIdx];
      if (practiceIdx < currentLesson.practiceSentences.length - 1) {
        setPracticeIdx(prev => prev + 1);
      } else if (currentLessonIdx < lessons.length - 1) {
        setCurrentLessonIdx(prev => prev + 1);
        setStage('PRESENTATION');
      } else {
        completeGame();
      }
    }
  };

  /**
   * Finalizes the session, awards XP and updates user progress in the brain state.
   */
  const completeGame = () => {
    if (gameCompleted) return;
    
    // Bonus for perfect session (no errors)
    let bonus = sessionErrors === 0 ? 10 : 0;
    if (bonus > 0) {
      setPerfectBonusAwarded(true);
      // Confetti effect for perfect score (requires canvas-confetti or similar global script)
      if (typeof (window as any).confetti === 'function') {
        (window as any).confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#3b82f6']
        });
      }
    }

    const totalXPGained = sessionXP + bonus;
    const newBrain = { ...brain };
    
    // Update mastery history for verbs encountered in this session
    lessons.forEach(l => {
      const v = l.verb.toLowerCase();
      if (!newBrain.verbHistory[v]) {
        newBrain.verbHistory[v] = {
          lastSeen: Date.now(),
          consecutiveCorrect: 0,
          consecutiveErrors: 0,
          weight: 1,
          history: []
        };
      }
      const vState = newBrain.verbHistory[v];
      vState.lastSeen = Date.now();
      
      // Simple tracking: if session was perfect, increment correct streak
      if (sessionErrors === 0) {
        vState.consecutiveCorrect += 1;
        vState.consecutiveErrors = 0;
      } else {
        vState.consecutiveErrors += 1;
        vState.consecutiveCorrect = 0;
      }
    });

    // Update level-specific statistics
    const stats = newBrain.levelStats[newBrain.currentLevel];
    stats.score += totalXPGained;
    stats.exercisesCount += lessons.length;
    stats.lastPlayed = Date.now();
    
    // Increment story progress counter to unlock new stories after learning enough verbs
    newBrain.verbsSinceLastStory += lessons.length;

    onUpdateBrain(newBrain);
    setGameCompleted(true);
  };

  // Submit and analyze practice answer using AI service
  const handlePracticeSubmit = async () => {
    if (isSubmitting || feedback || !userInput.trim()) return;
    setIsSubmitting(true);

    const currentLesson = lessons[currentLessonIdx];
    const currentPractice = currentLesson.practiceSentences[practiceIdx];

    try {
      const result = await analyzeSubmission(
        currentPractice.context,
        currentLesson.verb,
        currentPractice.correctAnswer,
        userInput
      );

      setFeedback(result);
      if (result.isCorrect) {
        setSessionXP(prev => prev + 10);
      } else {
        setSessionErrors(prev => prev + 1);
      }
    } catch (err) {
      console.error("Submission analysis failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state view
  if (loading) {
    return (
      <div className="h-full bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="animate-spin text-emerald-600" size={48} />
        <h2 className="text-xl font-bold text-slate-700">Caricamento Lezioni...</h2>
      </div>
    );
  }

  // Session completion summary view
  if (gameCompleted) {
    return (
      <div className="h-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="bg-emerald-100 p-8 rounded-full mb-6 text-emerald-600">
          <Trophy size={64} />
        </div>
        <h2 className="text-3xl font-serif font-bold text-slate-800 mb-2">Ottimo Lavoro!</h2>
        <p className="text-slate-500 mb-8 max-w-sm">Hai completato la sessione con successo e rafforzato la tua memoria linguistica.</p>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm mb-8 space-y-4">
          <div className="flex justify-between items-center text-slate-500">
            <span>XP Guadagnati</span>
            <span className="font-bold text-emerald-600">+{sessionXP}</span>
          </div>
          {perfectBonusAwarded && (
            <div className="flex justify-between items-center text-amber-600">
              <span className="text-sm font-bold italic">Bonus Perfezione</span>
              <span className="font-bold">+10</span>
            </div>
          )}
          <div className="h-px bg-slate-100"></div>
          <div className="flex justify-between items-center font-bold text-slate-800 text-lg">
            <span>Totale</span>
            <span>{sessionXP + (perfectBonusAwarded ? 10 : 0)} XP</span>
          </div>
        </div>

        <button onClick={onExit} className="w-full max-w-sm bg-slate-900 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-slate-800 transition-all active:scale-95">
          Torna al Dashboard
        </button>
      </div>
    );
  }

  const currentLesson = lessons[currentLessonIdx];

  return (
    <div className="max-w-4xl mx-auto h-full p-4 md:p-8 flex flex-col">
      {/* Session Progress Tracker */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">
          <span>Lezione {currentLessonIdx + 1} di {lessons.length}</span>
          <span>{stage === 'PRESENTATION' ? 'Apresentação' : 'Prática'}</span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-emerald-500 transition-all duration-700 ease-out" 
            style={{ width: `${((currentLessonIdx) / lessons.length) * 100 + (stage === 'PRACTICE' ? (1 / (lessons.length * 2)) * 100 : 0)}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto pr-2 no-scrollbar pb-10">
        {stage === 'PRESENTATION' ? (
          /* Stage 1: Verb Presentation & Conjugation Table */
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-fade-in flex flex-col">
            <div className="bg-slate-900 p-8 md:p-12 text-white">
              <div className="flex items-center gap-3 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                <BookOpen size={16} /> Verbo del Giorno
              </div>
              <h2 className="text-5xl md:text-6xl font-serif font-bold mb-3">{currentLesson.verb}</h2>
              <p className="text-slate-400 text-xl md:text-2xl">{currentLesson.lesson.definition}</p>
            </div>
            
            <div className="p-8 md:p-12 space-y-10">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {currentLesson.lesson.fullConjugation.map((conj, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                      {['Io', 'Tu', 'Lui/Lei', 'Noi', 'Voi', 'Loro'][idx]}
                    </div>
                    <div className="text-xl font-bold text-slate-800">{conj}</div>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl flex gap-5">
                <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600 h-fit">
                  <Brain size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-indigo-800 mb-1 uppercase text-xs tracking-widest">Dica de Uso</h4>
                  <p className="text-indigo-700 leading-relaxed text-lg">{currentLesson.lesson.usageTip}</p>
                </div>
              </div>
            </div>

            <div className="p-8 md:p-12 pt-0">
              <button 
                onClick={handleNextStage}
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold text-xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                Passare alla Pratica <ArrowRight size={24} />
              </button>
            </div>
          </div>
        ) : (
          /* Stage 3: Practice Gap-Fill Sentences */
          <div className="flex-1 flex flex-col animate-fade-in space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-serif font-bold text-slate-800">Usa "{currentLesson.verb}" nel contesto</h2>
              <p className="text-slate-500 text-sm font-medium">Coniuga correttamente per il soggetto indicato nella frase.</p>
            </div>

            <div className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-200 shadow-2xl space-y-12 relative overflow-hidden">
              {feedback && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-8 text-center bg-white/98 backdrop-blur-md animate-in fade-in zoom-in-95">
                  <div className={`p-8 rounded-full mb-6 ${feedback.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {feedback.isCorrect ? <Check size={80} /> : <X size={80} />}
                  </div>
                  <h3 className={`text-3xl font-serif font-bold mb-3 ${feedback.isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>
                    {feedback.isCorrect ? 'Fantastico!' : 'Non proprio...'}
                  </h3>
                  <p className="text-slate-600 mb-10 text-lg leading-relaxed max-w-md">{feedback.explanation}</p>
                  
                  <button 
                    onClick={() => {
                      setFeedback(null);
                      setUserInput('');
                      handleNextStage();
                    }}
                    className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-bold text-xl shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                  >
                    Avanti
                  </button>
                </div>
              )}

              <div className="flex flex-col items-center gap-8">
                <div className="px-5 py-2 bg-slate-100 rounded-full text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                  <Brain size={14} /> {currentLesson.practiceSentences[practiceIdx].context}
                </div>
                
                <div className="text-3xl md:text-4xl font-serif text-slate-800 text-center leading-[1.6]">
                  {currentLesson.practiceSentences[practiceIdx].sentenceStart}
                  <span className="mx-3 inline-block border-b-4 border-emerald-400 min-w-[140px] px-2 text-emerald-600 font-bold italic tracking-wide">
                    {userInput || '...'}
                  </span>
                  {currentLesson.practiceSentences[practiceIdx].sentenceEnd}
                </div>
              </div>

              <div className="flex gap-4 max-w-xl mx-auto w-full">
                <input 
                  autoFocus
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePracticeSubmit()}
                  disabled={!!feedback || isSubmitting}
                  className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 text-2xl outline-none focus:border-emerald-500 focus:bg-white transition-all text-center font-serif"
                  placeholder="Scrivi qui..."
                />
                <button 
                  onClick={handlePracticeSubmit}
                  disabled={!userInput.trim() || isSubmitting || !!feedback}
                  className="px-10 bg-slate-900 text-white rounded-2xl font-bold shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all active:scale-95"
                >
                  {isSubmitting ? <RefreshCw className="animate-spin" /> : <ArrowRight size={28} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseSession;
