
import React, { useState, useEffect } from 'react';
import { UserBrain, GlobalGameConfig, CharacterGender, CharacterArchetype } from '../types';
import { generateStoryChapter, playTextToSpeech } from '../services/geminiService';
import { BookOpen, Volume2, User, Briefcase, Feather, ChevronRight, Sparkles, Map, Loader2 } from 'lucide-react';

interface StoryModeSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  config: GlobalGameConfig;
}

type SessionPhase = 'LOADING' | 'SETUP_GENDER' | 'SETUP_ARCHETYPE' | 'READING' | 'CHOOSING';

const StoryModeSession: React.FC<StoryModeSessionProps> = ({ onExit, brain, onUpdateBrain, config }) => {
  // State
  const [phase, setPhase] = useState<SessionPhase>('LOADING');
  const [loadingMsg, setLoadingMsg] = useState("Preparando sua história...");
  
  // Setup Data
  const [gender, setGender] = useState<CharacterGender>('MALE');
  const [archetype, setArchetype] = useState<CharacterArchetype>('DETECTIVE');
  
  // Content Data
  const [chapterData, setChapterData] = useState<{ 
      title: string; 
      textIt: string; 
      textPt: string; 
      options: { text: string; action: string }[]; 
      summary: string;
      emoji: string;
  } | null>(null);
  
  const [targetVerbs, setTargetVerbs] = useState<string[]>([]);

  useEffect(() => {
      // 1. Check if user already has a novel started
      if (brain.novelData) {
          generateNextChapter(brain.novelData.gender, brain.novelData.archetype, brain.novelData.currentChapter, brain.novelData.plotSummary);
      } else {
          setPhase('SETUP_GENDER');
      }
  }, []);

  const generateNextChapter = async (g: CharacterGender, a: CharacterArchetype, chapterNum: number, summarySoFar: string) => {
      setPhase('LOADING');
      setLoadingMsg(chapterNum === 1 ? "Escrevendo o Capítulo 1..." : `Escrevendo Capítulo ${chapterNum}...`);
      
      try {
          // 1. Select Verbs (Recent & Strongest for reinforcement)
          const allVerbs = Object.keys(brain.verbHistory);
          const recentVerbs = allVerbs.sort((a, b) => brain.verbHistory[b].lastSeen - brain.verbHistory[a].lastSeen).slice(0, 5);
          setTargetVerbs(recentVerbs);

          // 2. Generate
          const data = await generateStoryChapter(g, a, chapterNum, summarySoFar, recentVerbs, brain.currentLevel);
          
          if (data) {
              setChapterData(data);
              setPhase('READING');
          } else {
              alert("O escritor teve um bloqueio criativo. Tente novamente.");
              onExit();
          }
      } catch (e) {
          console.error(e);
          onExit();
      }
  };

  const handleGenderSelect = (g: CharacterGender) => {
      setGender(g);
      setPhase('SETUP_ARCHETYPE');
  };

  const handleArchetypeSelect = (a: CharacterArchetype) => {
      setArchetype(a);
      // Start Chapter 1
      generateNextChapter(gender, a, 1, "Início da jornada.");
  };

  const handleChoice = (option: { text: string; action: string }) => {
      if (!chapterData) return;

      const newBrain = { ...brain };
      newBrain.verbsSinceLastStory = 0; // Reset counter

      // Init Novel Data if first time
      if (!newBrain.novelData) {
          newBrain.novelData = {
              gender: gender,
              archetype: archetype,
              currentChapter: 0,
              plotSummary: "",
              chapters: []
          };
      }

      // Add Chapter to History
      newBrain.novelData.chapters.push({
          chapterNumber: newBrain.novelData.currentChapter + 1,
          title: chapterData.title,
          emoji: chapterData.emoji,
          textIt: chapterData.textIt,
          textPt: chapterData.textPt,
          summary: chapterData.summary,
          userChoice: option.text,
          targetVerbs: targetVerbs,
          date: Date.now()
      });

      // Update State
      newBrain.novelData.currentChapter += 1;
      // Append new summary to plot summary
      newBrain.novelData.plotSummary += ` [Cap ${newBrain.novelData.currentChapter}]: ${chapterData.summary}. Decisão do usuário: ${option.action}.`;

      onUpdateBrain(newBrain);
      onExit();
  };

  // --- RENDER: LOADING ---
  if (phase === 'LOADING') {
      return (
          <div className="h-full bg-[#fdfbf7] flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-6 relative">
                  <Feather className="animate-bounce text-slate-400" size={48} />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-200 rounded-full opacity-50 blur-sm animate-pulse"></div>
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-800 animate-pulse">{loadingMsg}</h2>
              <p className="text-slate-500 text-sm mt-2 font-serif italic">Conectando os fios da trama...</p>
          </div>
      );
  }

  // --- RENDER: SETUP GENDER ---
  if (phase === 'SETUP_GENDER') {
      return (
          <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 animate-fade-in">
              <User size={64} className="text-emerald-400 mb-6" />
              <h2 className="text-3xl font-serif font-bold mb-2">Quem é você na história?</h2>
              <p className="text-slate-400 mb-8 text-center max-w-xs">Isso definirá como os personagens se referem a você (gênero gramatical).</p>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <button onClick={() => handleGenderSelect('MALE')} className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-blue-500 p-6 rounded-2xl transition-all group">
                      <div className="text-4xl mb-2">👨‍💼</div>
                      <div className="font-bold text-lg group-hover:text-blue-400">Uomo</div>
                  </button>
                  <button onClick={() => handleGenderSelect('FEMALE')} className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 hover:border-pink-500 p-6 rounded-2xl transition-all group">
                      <div className="text-4xl mb-2">👩‍💼</div>
                      <div className="font-bold text-lg group-hover:text-pink-400">Donna</div>
                  </button>
              </div>
          </div>
      );
  }

  // --- RENDER: SETUP ARCHETYPE ---
  if (phase === 'SETUP_ARCHETYPE') {
      const options = [
          { id: 'DETECTIVE', label: gender === 'MALE' ? 'Il Detective' : 'La Detective', desc: 'Mistério e crime em Roma.', icon: '🕵️' },
          { id: 'CHEF', label: gender === 'MALE' ? 'Lo Chef' : 'La Chef', desc: 'Segredos culinários na Toscana.', icon: '👨‍🍳' },
          { id: 'STUDENT', label: gender === 'MALE' ? 'Lo Studente' : 'La Studentessa', desc: 'Vida, festa e moda em Milão.', icon: '🎓' },
      ];

      return (
          <div className="h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 animate-fade-in">
              <Briefcase size={64} className="text-purple-400 mb-6" />
              <h2 className="text-3xl font-serif font-bold mb-2">Qual o seu papel?</h2>
              <p className="text-slate-400 mb-8 text-center">Isso define o tom de todos os 30 capítulos do seu livro.</p>
              
              <div className="flex flex-col gap-3 w-full max-w-md">
                  {options.map((opt) => (
                      <button 
                        key={opt.id}
                        onClick={() => handleArchetypeSelect(opt.id as CharacterArchetype)} 
                        className="flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500 p-4 rounded-xl transition-all text-left group"
                      >
                          <div className="text-3xl bg-slate-900 p-3 rounded-full">{opt.icon}</div>
                          <div>
                              <div className="font-bold text-lg text-white group-hover:text-purple-400">{opt.label}</div>
                              <div className="text-xs text-slate-400">{opt.desc}</div>
                          </div>
                          <ChevronRight className="ml-auto text-slate-600 group-hover:text-white" />
                      </button>
                  ))}
              </div>
          </div>
      );
  }

  // --- RENDER: READING / CHOICE ---
  if (chapterData && (phase === 'READING' || phase === 'CHOOSING')) {
      const chapterNum = (brain.novelData?.currentChapter || 0) + 1;
      
      return (
          <div className="h-full bg-[#fdfbf7] flex flex-col overflow-hidden text-slate-800 animate-in fade-in duration-700">
              {/* Header */}
              <div className="p-4 border-b border-[#e5e0d8] flex justify-between items-center bg-[#fdfbf7] z-10 shadow-sm">
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Capitolo {chapterNum}</span>
                  </div>
                  <button onClick={onExit} className="text-slate-400 hover:text-red-500 text-xs font-bold">SAIR</button>
              </div>

              {/* Book Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-2xl mx-auto w-full">
                  <div className="text-center mb-8">
                      <div className="text-6xl mb-4 animate-bounce-slow">{chapterData.emoji}</div>
                      <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 leading-tight mb-2">{chapterData.title}</h1>
                      <div className="w-16 h-1 bg-slate-800 mx-auto rounded-full opacity-20"></div>
                  </div>

                  <div className="prose prose-lg prose-slate font-serif text-slate-700 leading-loose mb-8 first-letter:text-5xl first-letter:font-bold first-letter:text-slate-900 first-letter:float-left first-letter:mr-2">
                      <p dangerouslySetInnerHTML={{ __html: chapterData.textIt }}></p>
                  </div>

                  {/* Audio & Verbs */}
                  <div className="flex justify-between items-center border-t border-[#e5e0d8] pt-6 mb-6">
                      <button 
                        onClick={() => playTextToSpeech(chapterData.textIt.replace(/<[^>]*>/g, ''))}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
                      >
                          <Volume2 size={20} /> <span className="text-xs font-bold uppercase">Ouvir</span>
                      </button>
                      <div className="flex gap-1">
                          {targetVerbs.map(v => <span key={v} className="px-2 py-1 bg-[#f0ede6] text-slate-500 text-[10px] uppercase font-bold rounded">{v}</span>)}
                      </div>
                  </div>

                  {/* Translation Accordion */}
                  <details className="group mb-12">
                      <summary className="list-none flex items-center gap-2 text-xs font-bold text-slate-400 uppercase cursor-pointer hover:text-slate-600 transition-colors select-none">
                          <Map size={14} /> Ver Tradução
                      </summary>
                      <div className="mt-4 p-4 bg-[#f0ede6] rounded-lg text-slate-600 italic text-sm border-l-4 border-slate-300">
                          {chapterData.textPt}
                      </div>
                  </details>

                  {/* DECISION POINT */}
                  <div className="space-y-4 pb-12">
                      <div className="flex items-center gap-2 mb-4">
                          <Sparkles size={18} className="text-purple-500" />
                          <h3 className="font-bold text-slate-900 uppercase text-sm tracking-widest">O que você faz agora?</h3>
                      </div>
                      
                      {chapterData.options.map((opt, idx) => (
                          <button
                              key={idx}
                              onClick={() => handleChoice(opt)}
                              className="w-full text-left p-5 rounded-xl border-2 border-[#e5e0d8] bg-white hover:border-purple-400 hover:shadow-lg transition-all group relative overflow-hidden"
                          >
                              <div className="absolute inset-0 bg-purple-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <div className="relative z-10 flex justify-between items-center">
                                  <span className="font-serif text-lg font-medium text-slate-800 group-hover:text-purple-800">
                                      {opt.text}
                                  </span>
                                  <ChevronRight className="text-slate-300 group-hover:text-purple-500" />
                              </div>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      );
  }

  return null;
};

export default StoryModeSession;
