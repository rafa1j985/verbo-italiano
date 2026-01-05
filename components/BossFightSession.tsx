
import React, { useState, useEffect } from 'react';
import { UserBrain, BossExam } from '../types';
import { generateBossExam } from '../services/geminiService';
import { Swords, Timer, Heart, Trophy, ArrowRight, Check, X, Skull, Award, BrainCircuit, RefreshCw, AlertTriangle } from 'lucide-react';

interface BossFightSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
}

type GameState = 
  | 'LOADING' 
  | 'INTRO_PHASE_1' | 'PHASE_1' 
  | 'INTRO_PHASE_2' | 'PHASE_2' 
  | 'INTRO_PHASE_3' | 'PHASE_3' 
  | 'VICTORY' | 'DEFEAT';

const BossFightSession: React.FC<BossFightSessionProps> = ({ onExit, brain, onUpdateBrain }) => {
    const [gameState, setGameState] = useState<GameState>('LOADING');
    const [examData, setExamData] = useState<BossExam | null>(null);
    
    // Phase 1 (Speed)
    const [p1Idx, setP1Idx] = useState(0);
    const [p1Lives, setP1Lives] = useState(3);
    const [p1Timer, setP1Timer] = useState(10);
    const [p1Input, setP1Input] = useState('');
    const [p1Score, setP1Score] = useState(0);

    // Phase 2 (Precision)
    const [p2Idx, setP2Idx] = useState(0);
    const [p2Lives, setP2Lives] = useState(2);
    const [p2Score, setP2Score] = useState(0);
    const [p2Feedback, setP2Feedback] = useState<{correct: boolean, explanation: string} | null>(null);

    // Phase 3 (Translation)
    const [p3Idx, setP3Idx] = useState(0);
    const [p3Input, setP3Input] = useState('');
    const [p3Score, setP3Score] = useState(0);
    const [p3Feedback, setP3Feedback] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            const knownVerbs = Object.keys(brain.verbHistory);
            const data = await generateBossExam(knownVerbs, brain.currentLevel);
            if (data) {
                setExamData(data);
                setGameState('INTRO_PHASE_1');
            } else {
                alert("Erro ao invocar o Guardião. Tente novamente.");
                onExit();
            }
        };
        load();
    }, []);

    // Phase 1 Timer
    useEffect(() => {
        if (gameState === 'PHASE_1' && p1Timer > 0) {
            const t = setInterval(() => setP1Timer(prev => prev - 1), 1000);
            return () => clearInterval(t);
        } else if (gameState === 'PHASE_1' && p1Timer === 0) {
            handleP1Submit(true); // Timeout
        }
    }, [gameState, p1Timer]);

    // --- PHASE 1 HANDLER (Speed) ---
    const handleP1Submit = (timeout = false) => {
        if (!examData) return;
        const current = examData.phase1[p1Idx];
        const isCorrect = !timeout && p1Input.trim().toLowerCase() === current.correct.toLowerCase();

        if (isCorrect) {
            setP1Score(s => s + 1);
        } else {
            setP1Lives(l => l - 1);
            if (p1Lives - 1 === 0) {
                setGameState('DEFEAT');
                return;
            }
        }

        if (p1Idx < 9) {
            setP1Idx(i => i + 1);
            setP1Input('');
            setP1Timer(10);
        } else {
            setGameState('INTRO_PHASE_2');
        }
    };

    // --- PHASE 2 HANDLER (Precision) ---
    const handleP2Submit = (choice: boolean) => {
        if (!examData) return;
        const current = examData.phase2[p2Idx];
        const isCorrect = choice === current.isCorrect;

        setP2Feedback({
            correct: isCorrect,
            explanation: isCorrect ? "Correto!" : (current.reason || "Erro de atenção.")
        });

        if (isCorrect) {
            setP2Score(s => s + 1);
        } else {
            setP2Lives(l => l - 1);
        }

        setTimeout(() => {
            setP2Feedback(null);
            if (!isCorrect && p2Lives - 1 === 0) {
                setGameState('DEFEAT');
                return;
            }

            if (p2Idx < 9) {
                setP2Idx(i => i + 1);
            } else {
                setGameState('INTRO_PHASE_3');
            }
        }, 1500);
    };

    // --- PHASE 3 HANDLER (Translation) ---
    const handleP3Submit = () => {
        if (!examData) return;
        const current = examData.phase3[p3Idx];
        
        // Simple validation: check if target verb is present and correct
        // In a real app, this would use fuzzy matching or AI validation
        const cleanInput = p3Input.toLowerCase().trim();
        const expectedVerb = current.targetVerb.toLowerCase();
        
        // We give points if the key verb is there, even if sentence structure is slightly off (MVP logic)
        // Or we check against the provided AI 'itSentence' with some leniency
        const dist = Math.abs(cleanInput.length - current.itSentence.length);
        const containsVerb = cleanInput.includes(expectedVerb) || current.itSentence.toLowerCase().includes(cleanInput);
        
        // Basic scoring for prototype
        if (containsVerb && dist < 10) {
             setP3Score(s => s + 1);
             setP3Feedback("Correto");
        } else {
             setP3Feedback(`Melhor: ${current.itSentence}`);
        }

        setTimeout(() => {
             setP3Feedback(null);
             setP3Input('');
             if (p3Idx < 4) {
                 setP3Idx(i => i + 1);
             } else {
                 checkVictory();
             }
        }, 2000);
    };

    const checkVictory = () => {
        // Total Questions: 10 (P1) + 10 (P2) + 5 (P3) = 25
        // Total Score: P1Score + P2Score + P3Score
        // Required: 80% of 25 = 20
        const totalScore = p1Score + p2Score + p3Score;
        if (totalScore >= 20) {
            setGameState('VICTORY');
        } else {
            setGameState('DEFEAT');
        }
    };

    // --- FINAL ACTIONS ---
    const handleVictory = () => {
        const newBrain = { ...brain };
        if (!newBrain.bossStats) {
             newBrain.bossStats = { lastAttempt: Date.now(), wins: 0, hasMedal: false };
        }
        newBrain.bossStats.lastAttempt = Date.now();
        newBrain.bossStats.wins += 1;
        newBrain.bossStats.hasMedal = true;
        
        // Keep XP, Keep Level (Decoupled)
        
        onUpdateBrain(newBrain);
        onExit();
    };

    const handleDefeat = () => {
        const newBrain = { ...brain };
        if (!newBrain.bossStats) {
             newBrain.bossStats = { lastAttempt: Date.now(), wins: 0, hasMedal: false };
        }
        newBrain.bossStats.lastAttempt = Date.now();
        onUpdateBrain(newBrain);
        onExit();
    };

    // --- RENDERERS ---

    if (gameState === 'LOADING') {
        return (
            <div className="h-full bg-slate-900 flex flex-col items-center justify-center text-white">
                <RefreshCw className="animate-spin mb-4 text-red-500" size={48} />
                <p className="font-serif text-xl animate-pulse">O Guardião está preparando o teste...</p>
                <p className="text-sm text-slate-500 mt-2">Invocando verbos estudados</p>
            </div>
        );
    }

    if (gameState === 'INTRO_PHASE_1') {
        return (
            <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <Timer size={64} className="text-yellow-400 mb-6" />
                <h2 className="text-3xl font-bold font-serif mb-4">Fase 1: Istinto Puro</h2>
                <p className="text-lg text-slate-300 mb-8 max-w-md">
                    Você terá <strong>10 segundos</strong> por verbo. <br/>
                    Digite a conjugação correta. Sem pensar.
                </p>
                <div className="flex gap-2 mb-8 justify-center">
                    <Heart className="text-red-500 fill-red-500" />
                    <Heart className="text-red-500 fill-red-500" />
                    <Heart className="text-red-500 fill-red-500" />
                </div>
                <button onClick={() => setGameState('PHASE_1')} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                    Estou Pronto
                </button>
            </div>
        );
    }

    if (gameState === 'PHASE_1') {
        const q = examData!.phase1[p1Idx];
        return (
            <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6">
                <div className="w-full max-w-md mb-8">
                    <div className="flex justify-between text-xs font-bold uppercase text-slate-500 mb-2">
                        <span>Questão {p1Idx + 1}/10</span>
                        <span className="text-red-500">{p1Timer}s</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 transition-all duration-1000 linear" style={{ width: `${(p1Timer/10)*100}%` }}></div>
                    </div>
                </div>

                <div className="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center w-full max-w-md">
                     <div className="text-2xl font-serif font-bold mb-6">
                         <span className="text-yellow-400">{q.pronoun}</span> + {q.verb}
                     </div>
                     <input 
                       autoFocus
                       value={p1Input}
                       onChange={e => setP1Input(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleP1Submit()}
                       className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-center text-xl outline-none focus:border-yellow-500"
                       placeholder="..."
                     />
                </div>
                <div className="mt-8 flex gap-2">
                    {[1,2,3].map(i => <Heart key={i} size={20} className={i <= p1Lives ? "text-red-500 fill-red-500" : "text-slate-700"} />)}
                </div>
            </div>
        );
    }

    if (gameState === 'INTRO_PHASE_2') {
         return (
            <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <AlertTriangle size={64} className="text-blue-400 mb-6" />
                <h2 className="text-3xl font-bold font-serif mb-4">Fase 2: Il Cecchino</h2>
                <p className="text-lg text-slate-300 mb-8 max-w-md">
                    Precisão cirúrgica. Leia a frase e decida: <br/>
                    <strong>Verdadeiro</strong> ou <strong>Falso</strong>?
                </p>
                <div className="flex gap-2 mb-8 justify-center">
                    <Heart className="text-red-500 fill-red-500" />
                    <Heart className="text-red-500 fill-red-500" />
                </div>
                <button onClick={() => setGameState('PHASE_2')} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                    Focar Mira
                </button>
            </div>
        );
    }

    if (gameState === 'PHASE_2') {
        const q = examData!.phase2[p2Idx];
        return (
             <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative">
                {p2Feedback && (
                    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in zoom-in`}>
                        {p2Feedback.correct ? <Check size={80} className="text-emerald-500 mb-4"/> : <X size={80} className="text-red-500 mb-4"/>}
                        <p className="text-xl font-bold">{p2Feedback.explanation}</p>
                    </div>
                )}
                
                <div className="w-full max-w-md mb-8 flex justify-between text-xs font-bold uppercase text-slate-500">
                     <span>Questão {p2Idx + 1}/10</span>
                     <div className="flex gap-1">{[1,2].map(i => <Heart key={i} size={16} className={i <= p2Lives ? "text-red-500 fill-red-500" : "text-slate-700"} />)}</div>
                </div>

                <div className="bg-slate-800 p-10 rounded-2xl border border-slate-700 text-center w-full max-w-md mb-8">
                     <p className="text-xl font-serif leading-relaxed">"{q.sentence}"</p>
                </div>

                <div className="flex gap-4 w-full max-w-md">
                    <button onClick={() => handleP2Submit(false)} className="flex-1 bg-red-900/50 hover:bg-red-900 border border-red-800 py-4 rounded-xl font-bold text-red-200 transition-colors">
                        FALSO
                    </button>
                    <button onClick={() => handleP2Submit(true)} className="flex-1 bg-emerald-900/50 hover:bg-emerald-900 border border-emerald-800 py-4 rounded-xl font-bold text-emerald-200 transition-colors">
                        VERO
                    </button>
                </div>
             </div>
        );
    }

    if (gameState === 'INTRO_PHASE_3') {
        return (
           <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
               <BrainCircuit size={64} className="text-purple-400 mb-6" />
               <h2 className="text-3xl font-bold font-serif mb-4">Fase 3: Traduzione</h2>
               <p className="text-lg text-slate-300 mb-8 max-w-md">
                   Pense em italiano. Traduza a frase do português. <br/>
                   Atenção ao tempo verbal.
               </p>
               <button onClick={() => setGameState('PHASE_3')} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                   Mente Ativa
               </button>
           </div>
       );
    }

    if (gameState === 'PHASE_3') {
        const q = examData!.phase3[p3Idx];
        return (
            <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 relative">
                 {p3Feedback && (
                    <div className="absolute top-10 left-0 right-0 text-center">
                        <div className="inline-block bg-slate-800 border border-slate-700 px-6 py-3 rounded-full text-sm font-bold text-yellow-400 shadow-lg">
                            {p3Feedback}
                        </div>
                    </div>
                 )}

                 <div className="w-full max-w-md mb-8 text-xs font-bold uppercase text-slate-500 text-center">
                     Questão {p3Idx + 1}/5
                 </div>

                 <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md mb-6">
                      <p className="text-slate-400 text-sm font-bold uppercase mb-2">Português</p>
                      <p className="text-xl font-serif mb-6">{q.ptSentence}</p>
                      
                      <div className="h-px bg-slate-700 w-full mb-6"></div>

                      <p className="text-slate-400 text-sm font-bold uppercase mb-2">Italiano</p>
                      <input 
                         autoFocus
                         value={p3Input}
                         onChange={e => setP3Input(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleP3Submit()}
                         className="w-full bg-slate-900 border border-slate-600 rounded-lg p-4 text-lg outline-none focus:border-purple-500"
                         placeholder="Digite em italiano..."
                      />
                 </div>
                 <button onClick={handleP3Submit} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold transition-colors">
                     Confirmar
                 </button>
            </div>
        );
    }

    if (gameState === 'VICTORY') {
        return (
            <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 animate-pop-in">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 rounded-full"></div>
                    <Award size={96} className="text-yellow-400 relative z-10" />
                </div>
                <h1 className="text-4xl font-serif font-bold text-yellow-400 mb-2">IMPERATORE!</h1>
                <p className="text-slate-300 text-lg mb-8 max-w-md text-center">
                    Você conquistou a <strong>Corona di Alloro</strong>. <br/>
                    Sua mente não traduz mais. Ela pensa.
                </p>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-sm mb-8">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-400 text-sm">Precisão Total</span>
                        <span className="text-emerald-400 font-bold text-xl">{Math.round(((p1Score + p2Score + p3Score) / 25) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${((p1Score + p2Score + p3Score) / 25) * 100}%` }}></div>
                    </div>
                </div>
                <button onClick={handleVictory} className="w-full max-w-sm bg-yellow-600 hover:bg-yellow-500 text-black py-4 rounded-xl font-bold text-xl shadow-lg transition-transform active:scale-95">
                    RECEBER COROA
                </button>
            </div>
        );
    }

    if (gameState === 'DEFEAT') {
        return (
            <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6">
                <Skull size={80} className="text-slate-600 mb-6" />
                <h1 className="text-4xl font-serif font-bold text-slate-500 mb-4">Sconfitta...</h1>
                <p className="text-slate-400 mb-8 text-lg text-center max-w-md">
                    O Guardião venceu desta vez. <br/>
                    O Coliseu se fechará por 72 horas para sua recuperação.
                </p>
                <div className="bg-slate-800 p-4 rounded-lg text-sm text-red-300 border border-red-900/50 mb-8">
                    Dica: Seu problema não são os verbos, é o tempo de reação.
                </div>
                <button onClick={handleDefeat} className="w-full max-w-sm bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold text-xl border border-slate-600">
                    Aceitar Destino
                </button>
            </div>
        );
    }

    return null;
};

export default BossFightSession;
