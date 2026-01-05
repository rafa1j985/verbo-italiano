
import React, { useState, useEffect } from 'react';
import { UserBrain, MilestoneExam } from '../types';
import { generateMilestoneExam } from '../services/geminiService';
import { Trophy, RefreshCw, Check, X, ArrowRight, Shield, Award, Clock } from 'lucide-react';

interface MilestoneSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  targetTier: number;
}

const MilestoneSession: React.FC<MilestoneSessionProps> = ({ onExit, brain, onUpdateBrain, targetTier }) => {
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<MilestoneExam | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Get all verbs from history
      const allVerbs = Object.keys(brain.verbHistory);
      const data = await generateMilestoneExam(allVerbs, targetTier);
      
      if (data) {
        setExam(data);
      } else {
        alert("O oráculo não pôde gerar o teste agora. Tente novamente.");
        onExit();
      }
      setLoading(false);
    };
    init();
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
    
    // Logic: Pass if >= 8 correct
    const passed = finalScore >= 8;
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
      <div className="h-full bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <RefreshCw className="animate-spin text-yellow-500 mb-6" size={48} />
        <h2 className="text-2xl font-serif font-bold text-yellow-500">Invocando a Pietra Miliare...</h2>
        <p className="text-slate-400 mt-2">Preparando o desafio do marco {targetTier}.</p>
      </div>
    );
  }

  if (completed) {
    const passed = score >= 8;
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
            : " O Guardião exige 80% de precisão. O portão se fechará por 1 hora."}
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
