
import React, { useState, useEffect } from 'react';
import { UserBrain, DetectiveCase, GlobalGameConfig } from '../types';
import { generateDetectiveCase } from '../services/geminiService';
import { Search, Fingerprint, FolderOpen, FileText, Check, X, Clock, HelpCircle, Siren } from 'lucide-react';

interface DetectiveSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  config: GlobalGameConfig;
}

type Phase = 'LOADING' | 'BRIEFING' | 'SOLVED' | 'FAILED';

const DetectiveSession: React.FC<DetectiveSessionProps> = ({ onExit, brain, onUpdateBrain, config }) => {
    const [phase, setPhase] = useState<Phase>('LOADING');
    const [caseData, setCaseData] = useState<DetectiveCase | null>(null);
    const [loadingText, setLoadingText] = useState("");
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    
    // --- LOADING SEQUENCE (5-8 Seconds) ---
    useEffect(() => {
        const texts = [
            "Conectando à base da Interpol...",
            "Baixando arquivos criptografados...",
            "Analisando álibis suspeitos...",
            "Detectando contradições verbais...",
            "Dossier pronto. Acesso autorizado."
        ];
        let i = 0;
        
        const textInterval = setInterval(() => {
            if (i < texts.length) {
                setLoadingText(texts[i]);
                i++;
            }
        }, 1200); // Updates every 1.2s * 5 = 6 seconds total

        const loadCase = async () => {
            const newCase = await generateDetectiveCase(brain.currentLevel);
            if (newCase) {
                // Wait for animation to finish minimum time
                setTimeout(() => {
                    setCaseData(newCase);
                    setPhase('BRIEFING');
                }, 6000); 
            } else {
                alert("Falha ao contatar a agência. Tente mais tarde.");
                onExit();
            }
        };

        loadCase();

        return () => clearInterval(textInterval);
    }, []);

    const handleChoice = (idx: number) => {
        if (!caseData) return;
        setSelectedOption(idx);
        const isCorrect = caseData.options[idx].isCorrect;
        
        // Update Stats
        const newBrain = { ...brain };
        if (!newBrain.detectiveStats) {
            newBrain.detectiveStats = { casesSolved: 0, lastCaseDate: 0, cluesFound: [] };
        }
        
        // Always update date to limit frequency
        newBrain.detectiveStats.lastCaseDate = Date.now();

        // UPDATE COSTS (1 Text Generation per case)
        if (!newBrain.usageStats) newBrain.usageStats = { textQueries: 0, audioPlays: 0, imageGenerations: 0 };
        newBrain.usageStats.textQueries += 1;

        if (isCorrect) {
            newBrain.detectiveStats.casesSolved += 1;
            if (!newBrain.detectiveStats.cluesFound.includes(caseData.rewardClue)) {
                newBrain.detectiveStats.cluesFound.push(caseData.rewardClue);
            }
            // Reward XP (High amount)
            newBrain.levelStats[brain.currentLevel].score += 150; 
            setTimeout(() => setPhase('SOLVED'), 1000);
        } else {
            setTimeout(() => setPhase('FAILED'), 1000);
        }
        
        onUpdateBrain(newBrain);
    };

    // --- RENDER: LOADING ---
    if (phase === 'LOADING') {
        return (
            <div className="h-full bg-slate-950 flex flex-col items-center justify-center p-8 font-mono text-green-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none"></div>
                <Siren className="animate-pulse text-red-600 mb-8" size={64} />
                <div className="text-xl md:text-2xl font-bold animate-pulse mb-4 tracking-widest uppercase">
                    AGENZIA INVESTIGATIVA
                </div>
                <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mb-4 border border-slate-700">
                    <div className="h-full bg-green-600 animate-[progress_6s_ease-in-out_forwards]"></div>
                </div>
                <p className="text-sm opacity-80">{loadingText}</p>
            </div>
        );
    }

    if (!caseData) return null;

    // --- RENDER: BRIEFING ---
    if (phase === 'BRIEFING') {
        return (
            <div className="h-full bg-[#e8e4d9] text-slate-800 p-4 md:p-8 flex flex-col items-center font-serif relative overflow-y-auto">
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper.png')]"></div>
                
                <div className="max-w-2xl w-full bg-white shadow-2xl p-8 md:p-12 rotate-1 relative border border-slate-300">
                    {/* Stamp */}
                    <div className="absolute top-4 right-4 border-4 border-red-800 text-red-800 font-bold px-4 py-2 text-xl opacity-70 rotate-12 uppercase tracking-widest">
                        Top Secret
                    </div>

                    <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-800 pb-4">
                        <Fingerprint size={40} className="text-slate-800" />
                        <div>
                            <h2 className="text-2xl font-bold uppercase tracking-widest">Dossier: {caseData.difficulty}</h2>
                            <p className="text-xs font-sans text-slate-500">ID: {caseData.id.slice(-6)}</p>
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900">{caseData.title}</h1>

                    <div className="bg-[#f4f1ea] p-6 border-l-4 border-slate-800 mb-8 font-medium italic text-lg leading-relaxed relative">
                        <span className="absolute -left-3 -top-3 bg-slate-800 text-white px-2 py-1 text-xs font-sans uppercase">Suspeito</span>
                        <p dangerouslySetInnerHTML={{ __html: `"${caseData.suspectStatement}"` }}></p>
                    </div>

                    <div className="flex items-center gap-2 mb-4 font-bold text-slate-700">
                        <Search size={20} />
                        <span>{caseData.question}</span>
                    </div>

                    <div className="space-y-3 font-sans">
                        {caseData.options.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleChoice(idx)}
                                className="w-full text-left p-4 border-2 border-slate-200 hover:border-slate-800 hover:bg-slate-50 transition-all rounded-lg flex items-center gap-3 group"
                            >
                                <div className="w-6 h-6 rounded-full border-2 border-slate-400 group-hover:border-slate-800 flex items-center justify-center text-xs">
                                    {String.fromCharCode(65 + idx)}
                                </div>
                                <span className="text-slate-700 group-hover:text-black">{opt.text}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER: SOLVED ---
    if (phase === 'SOLVED') {
        return (
            <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-white animate-fade-in">
                <div className="bg-emerald-500/20 p-6 rounded-full mb-6 ring-4 ring-emerald-500/50">
                    <Check size={64} className="text-emerald-400" />
                </div>
                <h2 className="text-4xl font-serif font-bold text-emerald-400 mb-2">CASO CHIUSO</h2>
                <p className="text-slate-300 max-w-md mb-8">
                    Excelente trabalho, detetive. Sua lógica gramatical foi impecável.
                </p>
                
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 flex items-center gap-4">
                    <div className="bg-slate-700 p-3 rounded-lg">
                        <FolderOpen size={32} className="text-yellow-500" />
                    </div>
                    <div className="text-left">
                        <div className="text-xs uppercase text-slate-500 font-bold">Pista Coletada</div>
                        <div className="text-xl font-bold text-white">{caseData.rewardClue}</div>
                    </div>
                </div>

                <button onClick={onExit} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-lg font-bold transition-colors">
                    Voltar ao QG
                </button>
            </div>
        );
    }

    // --- RENDER: FAILED ---
    if (phase === 'FAILED') {
        const correctOpt = caseData.options.find(o => o.isCorrect);
        return (
            <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-8 text-center text-white animate-fade-in">
                <div className="bg-red-500/20 p-6 rounded-full mb-6 ring-4 ring-red-500/50">
                    <X size={64} className="text-red-400" />
                </div>
                <h2 className="text-4xl font-serif font-bold text-red-400 mb-2">O SUSPEITO FUGIU</h2>
                <p className="text-slate-300 max-w-md mb-8">
                    Sua dedução estava incorreta.
                </p>
                
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8 text-left max-w-md">
                    <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2 uppercase text-xs tracking-widest">
                        <HelpCircle size={16} /> Relatório Forense
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                        {correctOpt?.explanation}
                    </p>
                </div>

                <button onClick={onExit} className="bg-slate-700 hover:bg-slate-600 px-8 py-3 rounded-lg font-bold transition-colors">
                    Arquivar Caso
                </button>
            </div>
        );
    }

    return null;
};

export default DetectiveSession;
