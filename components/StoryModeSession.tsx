
import React, { useState, useEffect } from 'react';
import { UserBrain, GlobalGameConfig, CharacterGender, CharacterArchetype } from '../types';
import { generateStoryChapter, playTextToSpeech } from '../services/geminiService';
import { BookOpen, Volume2, User, Briefcase, Feather, ChevronRight, Sparkles, Map, Loader2, ArrowDown, Edit3 } from 'lucide-react';

interface StoryModeSessionProps {
  onExit: () => void;
  brain: UserBrain;
  onUpdateBrain: (newBrain: UserBrain) => void;
  config: GlobalGameConfig;
}

type SessionPhase = 'LOADING' | 'SETUP_GENDER' | 'SETUP_ARCHETYPE' | 'READING_ACT1' | 'READING_ACT2_CHALLENGE' | 'READING_ACT2_SOLVED' | 'READING_ACT3' | 'CHOOSING';

const StoryModeSession: React.FC<StoryModeSessionProps> = ({ onExit, brain, onUpdateBrain, config }) => {
  // State
  const [phase, setPhase] = useState<SessionPhase>('LOADING');
  const [loadingMsg, setLoadingMsg] = useState("Preparando sua história...");
  
  // Setup Data
  const [gender, setGender] = useState<CharacterGender>('MALE');
  const [archetype, setArchetype] = useState<CharacterArchetype>('DETECTIVE');
  
  // Content Data (New Structure)
  const [chapterData, setChapterData] = useState<{ 
      title: string; 
      emoji: string;
      summary: string;
      acts: {
          act1: { textIt: string; textPt: string };
          act2: { 
              textPreGap: string; 
              correctVerb: string; 
              distractors: string[]; 
              textPostGap: string; 
              textPt: string 
          };
          act3: { textIt: string; textPt: string };
      };
      options: { text: string; action: string }[]; 
  } | null>(null);
  
  // Act 2 Challenge State
  const [challengeOptions, setChallengeOptions] = useState<string[]>([]);
  const [challengeError, setChallengeError] = useState(false);

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

          // 2. Generate (Uses new AI function)
          const data = await generateStoryChapter(g, a, chapterNum, summarySoFar, recentVerbs, brain.currentLevel);
          
          if (data && data.acts) {
              setChapterData(data);
              
              // Prepare Challenge Options (Shuffle)
              const options = [data.acts.act2.correctVerb, ...data.acts.act2.distractors];
              setChallengeOptions(options.sort(() => Math.random() - 0.5));
              
              // 3. Track Usage Cost (Text)
              // NOTE: This updates state locally, but will be overwritten if user exits before saving?
              // Ideally update happens on handleChoice to save everything at once, but tracking usage immediately is safer.
              // Since we don't save immediately here, we'll bundle it into the final save or do a silent update if architecture allowed.
              // For now, we add the stat update to the handleChoice flow to save DB writes.
              
              setPhase('READING_ACT1');
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

  const handleChallengeSubmit = (option: string) => {
      if (!chapterData) return;
      if (option === chapterData.acts.act2.correctVerb) {
          setPhase('READING_ACT2_SOLVED');
          setChallengeError(false);
          // Auto-advance to Act 3 after short delay to let user see filled gap
          setTimeout(() => setPhase('READING_ACT3'), 1500);
      } else {
          setChallengeError(true);
          setTimeout(() => setChallengeError(false), 800);
      }
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

      // Add Chapter to History (Mapping new structure to storage format)
      // Note: We're storing the FULL text concatenated for legacy compatibility if needed
      // But preserving the structure in 'acts' is better. For now we follow the type definition.
      newBrain.novelData.chapters.push({
          chapterNumber: newBrain.novelData.currentChapter + 1,
          title: chapterData.title,
          emoji: chapterData.emoji,
          textIt: `${chapterData.acts.act1.textIt} ${chapterData.acts.act2.textPreGap} ${chapterData.acts.act2.correctVerb} ${chapterData.acts.act2.textPostGap} ${chapterData.acts.act3.textIt}`,
          textPt: `${chapterData.acts.act1.textPt} ... ${chapterData.acts.act3.textPt}`,
          summary: chapterData.summary,
          userChoice: option.text,
          targetVerbs: targetVerbs,
          date: Date.now(),
          acts: chapterData.acts
      });

      // Update State
      newBrain.novelData.currentChapter += 1;
      // Append new summary to plot summary
      newBrain.novelData.plotSummary += ` [Cap ${newBrain.novelData.currentChapter}]: ${chapterData.summary}. Decisão do usuário: ${option.action}.`;

      // UPDATE COSTS
      if (!newBrain.usageStats) newBrain.usageStats = { textQueries: 0, audioPlays: 0, imageGenerations: 0 };
      newBrain.usageStats.textQueries += 1;

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

  // --- RENDER: MAIN STORY READER ---
  if (chapterData) {
      const chapterNum = (brain.novelData?.currentChapter || 0) + 1;
      const acts = chapterData.acts;
      
      // Calculate Progress (1 = Act1, 2 = Act2, 3 = Act3)
      let progress = 1;
      if (['READING_ACT2_CHALLENGE', 'READING_ACT2_SOLVED'].includes(phase)) progress = 2;
      if (['READING_ACT3', 'CHOOSING'].includes(phase)) progress = 3;

      return (
          <div className="h-full bg-[#fdfbf7] flex flex-col overflow-hidden text-slate-800 font-serif">
              {/* Header */}
              <div className="p-4 border-b border-[#e5e0d8] flex justify-between items-center bg-[#fdfbf7] z-10 shadow-sm font-sans">
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Capitolo {chapterNum}</span>
                  </div>
                  {/* Progress Indicators */}
                  <div className="flex gap-2">
                      {[1, 2, 3].map(i => (
                          <div key={i} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${i <= progress ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                      ))}
                  </div>
                  <button onClick={onExit} className="text-slate-400 hover:text-red-500 text-xs font-bold">SAIR</button>
              </div>

              {/* Book Content - Scrollable Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-2xl mx-auto w-full relative">
                  
                  {/* TITLE (Always Visible) */}
                  <div className="text-center mb-8">
                      <div className="text-6xl mb-4">{chapterData.emoji}</div>
                      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-2">{chapterData.title}</h1>
                      <div className="w-16 h-1 bg-slate-800 mx-auto rounded-full opacity-20"></div>
                  </div>

                  {/* ACT 1: SETTING */}
                  <div className="mb-8 animate-in fade-in duration-700">
                      <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-400">Atto I</span>
                          <button onClick={() => playTextToSpeech(acts.act1.textIt)} className="text-slate-400 hover:text-purple-600 transition-colors"><Volume2 size={16}/></button>
                      </div>
                      <p className="text-lg leading-loose text-slate-700 text-justify" dangerouslySetInnerHTML={{ __html: acts.act1.textIt }}></p>
                  </div>

                  {/* BUTTON TO ADVANCE TO ACT 2 */}
                  {phase === 'READING_ACT1' && (
                      <div className="text-center py-8">
                          <button 
                            onClick={() => setPhase('READING_ACT2_CHALLENGE')}
                            className="bg-slate-900 text-white px-8 py-3 rounded-full font-sans font-bold hover:bg-slate-700 transition-all flex items-center gap-2 mx-auto animate-pulse"
                          >
                              Continuar <ArrowDown size={18} />
                          </button>
                      </div>
                  )}

                  {/* ACT 2: CHALLENGE */}
                  {(['READING_ACT2_CHALLENGE', 'READING_ACT2_SOLVED', 'READING_ACT3', 'CHOOSING'].includes(phase)) && (
                      <div className="mb-8 animate-in slide-in-from-bottom-10 fade-in duration-700">
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-400">Atto II: La Sfida</span>
                          </div>
                          
                          <div className={`bg-white border-l-4 ${phase === 'READING_ACT2_CHALLENGE' ? 'border-amber-400' : 'border-emerald-500'} p-6 rounded-r-xl shadow-sm transition-all`}>
                              <p className="text-lg leading-loose text-slate-800">
                                  {acts.act2.textPreGap} 
                                  
                                  {/* THE GAP */}
                                  <span className={`inline-block mx-2 px-3 py-1 rounded font-bold border-b-2 transition-all
                                      ${phase === 'READING_ACT2_SOLVED' || phase === 'READING_ACT3' || phase === 'CHOOSING'
                                          ? 'text-emerald-700 bg-emerald-50 border-emerald-300' 
                                          : 'text-amber-700 bg-amber-50 border-amber-300 min-w-[100px] text-center'}
                                  `}>
                                      {phase === 'READING_ACT2_CHALLENGE' ? '_______' : acts.act2.correctVerb}
                                  </span>

                                  {(phase === 'READING_ACT2_SOLVED' || phase === 'READING_ACT3' || phase === 'CHOOSING') && (
                                      <span className="animate-in fade-in">{acts.act2.textPostGap}</span>
                                  )}
                              </p>

                              {/* OPTIONS */}
                              {phase === 'READING_ACT2_CHALLENGE' && (
                                  <div className="mt-6">
                                      <p className="text-xs font-sans font-bold text-slate-400 uppercase mb-3 flex items-center gap-1">
                                          <Edit3 size={12} /> Complete a frase:
                                      </p>
                                      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${challengeError ? 'animate-shake' : ''}`}>
                                          {challengeOptions.map((opt, idx) => (
                                              <button 
                                                  key={idx}
                                                  onClick={() => handleChallengeSubmit(opt)}
                                                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-sans font-bold py-3 rounded-lg transition-colors hover:border-amber-400"
                                              >
                                                  {opt}
                                              </button>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}

                  {/* ACT 3: RESOLUTION */}
                  {(['READING_ACT3', 'CHOOSING'].includes(phase)) && (
                      <div className="mb-12 animate-in slide-in-from-bottom-10 fade-in duration-700">
                          <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-400">Atto III</span>
                              <button onClick={() => playTextToSpeech(acts.act3.textIt)} className="text-slate-400 hover:text-purple-600 transition-colors"><Volume2 size={16}/></button>
                          </div>
                          <p className="text-lg leading-loose text-slate-700 text-justify" dangerouslySetInnerHTML={{ __html: acts.act3.textIt }}></p>
                          
                          {phase === 'READING_ACT3' && (
                              <div className="text-center mt-8">
                                  <button 
                                    onClick={() => setPhase('CHOOSING')}
                                    className="bg-slate-900 text-white px-8 py-3 rounded-full font-sans font-bold hover:bg-slate-700 transition-all flex items-center gap-2 mx-auto animate-pulse"
                                  >
                                      Tomar Decisão <ChevronRight size={18} />
                                  </button>
                              </div>
                          )}
                      </div>
                  )}

                  {/* DECISION POINT */}
                  {phase === 'CHOOSING' && (
                      <div className="space-y-4 pb-20 animate-in slide-in-from-bottom-10 fade-in duration-500">
                          <div className="flex items-center gap-2 mb-4 justify-center">
                              <Sparkles size={18} className="text-purple-500" />
                              <h3 className="font-sans font-bold text-slate-900 uppercase text-sm tracking-widest">O que você faz agora?</h3>
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
                  )}
              </div>
          </div>
      );
  }

  return null;
};

export default StoryModeSession;
