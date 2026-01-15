
import React, { useState, useEffect } from 'react';
import { UserBrain, MilestoneExam, GlobalGameConfig } from '../types';
import { generateMilestoneExam } from '../services/geminiService';
import { CULTURAL_QUOTES } from '../data/sentenceTemplates';
import { Trophy, RefreshCw, Check, X, ArrowRight, Shield, Award, Clock, Sparkles, Quote, Brain } from 'lucide-react';

interface MilestoneSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  targetTier: number;
  config: GlobalGameConfig;
}

const MilestoneSession: React.FC<MilestoneSessionProps> = ({ onExit, brain, onUpdateBrain, targetTier, config }) => {
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<MilestoneExam | null>(null);
  
  // Loading State Aesthetics (15s Wait)
  const [quote, setQuote] = useState(CULTURAL_QUOTES[0]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [completed, setCompleted] = useState(false);

  // --- WAIT & ENTERTAINMENT LOGIC ---
  const waitForThinking = async (duration: number) => {
      return new Promise<void>(resolve => {
          const startTime = Date.now();
          setLoadingProgress(0);
          
          // Cycle quotes every 5 seconds
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

  useEffect(() => {
    const initSession = async () => {
        setLoading(true);
        // Pick initial random quote
        setQuote(CULTURAL_QUOTES[Math.floor(Math.random() * CULTURAL_QUOTES.length)]);

        // 1. Mandatory 15s Wait
        const minWait = waitForThinking(15000);

        // 2. Generate Exam
        const allVerbs = Object.keys(brain.verbHistory);
        const generationPromise = generateMilestoneExam(allVerbs, targetTier);

        // 3. Wait for both
        const [_, data] = await Promise.all([minWait, generationPromise]);
        
        setExam(data);
        setLoading(false);
    };

    initSession();
  }, []);

  const handleSubmit = () => {
    if (!exam) return;
    const currentQ = exam.questions[currentIndex];
    const cleanInput = input.trim().toLowerCase();
    const cleanAnswer = currentQ.correctAnswer.trim().toLowerCase();

    // Simple validation (can be enhanced)
    const isCorrect = cleanInput === cleanAnswer;

    setFeedback(isCorrect ? 'CORRECT' : 'WRONG');
    if (isCorrect) setScore(s => s + 1);

    setTimeout(() => {
      setFeedback(null);
      setInput('');
      if (currentIndex < 9) {
        setCurrentIndex(i => i + 1);
      } else {
        finishExam(score + (isCorrect ? 1 : 0));
      }
    }, 2000);
  };

  const finishExam = (finalScore: number) => {
    setCompleted(true);
    setScore(finalScore);
    
    // Logic: Pass if >= 8 correct (or based on config)
    const passed = finalScore >= config.rules.milestonePassScore;
    const newBrain = { ...brain };

    if (passed) {
      if (!newBrain.milestoneHistory) newBrain.milestoneHistory = [];
      newBrain.milestoneHistory.push({
        tier: targetTier,
        date: Date.now(),
        score: finalScore
      });
    } else {
      // Set Cooldown
      newBrain.lastMilestoneFail = Date.now();
    }
    
    onUpdateBrain(newBrain);
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-fade-in relative overflow-hidden">
          {/* Background Ambient Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/40 via-slate-950 to-black animate-pulse"></div>
          
          <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
              <div className="mb-8 relative">
                  <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20 animate-pulse"></div>
                  <Sparkles className="animate-spin-slow text-amber-400" size={64} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                      {Math.round(loadingProgress)}%
                  </div>
              </div>
              
              <h2 className="text-2xl font-serif font-bold text-amber-100 mb-6 tracking-wide">
                  Forjando a Pietra Miliare...
              </h2>

              <div className="mb-8 space-y-4 min-h-[140px] flex flex-col justify-center animate-fade-in key-{quote.it}">
                  <Quote className="text-slate-600 mx-auto transform -scale-x-100" size={24} />
                  <h3 className="text-xl font-serif font-bold text-white leading-relaxed italic">
                      "{quote.it}"
                  </h3>
                  <p className="text-amber-400 font-medium text-sm">
                      {quote.pt}
                  </p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-2">
                      — {quote.author}
                  </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-xs h-1 bg-slate-800 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-amber-500 transition-all duration-300" style={{width: `${loadingProgress}%`}}></div>
              </div>

              <div className="flex items-center gap-2 text-slate-500 text-xs animate-pulse">
                  <Brain className="text-amber-600" size={14} />
                  <span>Selecionando seus verbos mais desafiadores...</span>
              </div>
          </div>
      </div>
    );
  }

  if (completed) {
    const passed = score >= config.rules.milestonePassScore;
    return (
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center text-white p-6 animate-fade-in text-center">
        <div className={`p-6 rounded-full mb-6 ${passed ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>
           {passed ? <Trophy size={64} /> : <Shield size={64} />}
        </div>
        
        <h2 className="text-4xl font-serif font-bold mb-2">{passed ? 'Gloria Eterna!' : 'Sconfitta...'}</h2>
        <p className="text-xl text-slate-300 mb-8">
          Você acertou <span className="font-bold text-white">{score}/10</span>.
          {passed 
            ? " A medalha foi adicionada à sua coleção." 
            : ` O Guardião exige ${config.rules.milestonePassScore}0% de precisão. O portão se fechará por 1 hora.`}
        </p>

        <button 
          onClick={onExit}
          className={`px-8 py-4 rounded-xl font-bold text-lg transition-transform active:scale-95 flex items-center gap-2
            ${passed ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-slate-700 text-white hover:bg-slate-600'}
          `}
        >
          {passed ? 'Receber Medalha' : 'Aceitar e Treinar'} <ArrowRight size={20} />
        </button>
      </div>
    );
  }

  const currentQ = exam?.questions[currentIndex];

  return (
    <div className="h-full bg-slate-900 text-white flex flex-col">
      {/* Header Progress */}
      <div className="p-6 flex items-center justify-between border-b border-slate-800">
         <div className="flex items-center gap-2 text-yellow-500 font-serif font-bold">
            <Award size={20} />
            <span>Pietra Miliare {targetTier}</span>
         </div>
         <div className="text-sm font-bold text-slate-500">
            {currentIndex + 1} / 10
         </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
         
         {/* Feedback Overlay */}
         {feedback && (
             <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in zoom-in">
                 {feedback === 'CORRECT' ? (
                     <>
                        <Check size={80} className="text-emerald-500 mb-4" />
                        <span className="text-2xl font-serif font-bold text-emerald-500">Corretto</span>
                     </>
                 ) : (
                     <>
                        <X size={80} className="text-red-500 mb-4" />
                        <span className="text-xl font-serif font-bold text-red-500 mb-2">Sbagliato</span>
                        <div className="text-slate-300">Resposta: <span className="text-white font-bold">{currentQ?.correctAnswer}</span></div>
                     </>
                 )}
             </div>
         )}

         <div className="w-full max-w-md">
             <div className="text-center mb-12">
                 <span className="inline-block bg-slate-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                    {currentQ?.type === 'TRANSLATE_PT_IT' && 'Traduza para Italiano'}
                    {currentQ?.type === 'CONJUGATE' && 'Conjugação'}
                    {currentQ?.type === 'GAP_FILL' && 'Complete a Lacuna'}
                 </span>
                 <h3 className="text-3xl md:text-4xl font-serif font-bold leading-tight">
                    {currentQ?.question}
                 </h3>
                 {currentQ?.context && (
                    <p className="text-slate-400 mt-4 italic">"{currentQ.context}"</p>
                 )}
             </div>

             <div className="relative">
                 <input 
                    autoFocus
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !feedback && handleSubmit()}
                    placeholder="Sua resposta..."
                    className="w-full bg-transparent border-b-2 border-slate-700 text-center text-2xl p-4 outline-none focus:border-yellow-500 transition-colors placeholder:text-slate-700 font-serif"
                    disabled={!!feedback}
                 />
                 <button 
                    onClick={handleSubmit}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-yellow-500 transition-colors"
                    disabled={!!feedback}
                 >
                    <ArrowRight size={24} />
                 </button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default MilestoneSession;
