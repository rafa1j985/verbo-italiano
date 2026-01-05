
import React, { useState, useEffect } from 'react';
import { Play, Zap, Target, BookOpen, Brain, TrendingUp, Award, Star, Swords, Skull, Clock, ShieldCheck, Trophy, Library, ShoppingBag, LayoutGrid, Bell, Image as ImageIcon, Sparkles, LockKeyhole, ArrowRight, Activity } from 'lucide-react';
import { UserBrain, LevelStats, StoreItem } from '../types';
import { VERB_DATABASE } from '../data/verbs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface StudentDashboardProps {
  userName: string;
  onStartTraining: () => void;
  onStartBoss: () => void;
  onStartStory: () => void;
  onStartMilestone: (tier: number) => void;
  onOpenMercato: () => void;
  brain: UserBrain;
  catalog: StoreItem[]; 
}

const MILESTONE_TIERS = [10, 20, 30, 40, 50, 100, 150, 180, 200, 230, 260, 280, 300, 320, 340];

const StudentDashboard: React.FC<StudentDashboardProps> = ({ userName, onStartTraining, onStartBoss, onStartStory, onStartMilestone, onOpenMercato, brain, catalog }) => {
  const currentLevel = brain.currentLevel;
  const currentStats = brain.levelStats[currentLevel];
  const totalXP = (Object.values(brain.levelStats) as LevelStats[]).reduce((acc, curr) => acc + curr.score, 0);

  const totalVerbsInLevel = VERB_DATABASE.filter(v => v.level === currentLevel).length;
  const masteredInLevel = Object.keys(brain.verbHistory).filter(v => {
      const verbData = VERB_DATABASE.find(dbV => dbV.infinitive.toLowerCase() === v.toLowerCase());
      return verbData && verbData.level === currentLevel;
  }).length;

  const levelProgress = totalVerbsInLevel > 0 
    ? Math.min((masteredInLevel / totalVerbsInLevel) * 100, 100)
    : 0;

  const verbsDiscoveredCount = Object.keys(brain.verbHistory).length;
  
  // Data for the activity chart
  const activityData = [
    { day: 'Seg', xp: totalXP > 100 ? 45 : 0 },
    { day: 'Ter', xp: totalXP > 200 ? 80 : 0 },
    { day: 'Qua', xp: totalXP > 300 ? 120 : 10 },
    { day: 'Qui', xp: totalXP > 400 ? 150 : 20 },
    { day: 'Sex', xp: totalXP > 500 ? 200 : 40 },
    { day: 'Sáb', xp: totalXP > 600 ? 250 : 35 },
    { day: 'Dom', xp: totalXP % 100 },
  ];

  // Story Logic
  const verbsSinceStory = brain.verbsSinceLastStory || 0;
  const storyProgress = Math.min((verbsSinceStory / 5) * 100, 100);
  const isStoryReady = verbsSinceStory >= 5;

  // Milestone Logic
  const achievedTiers = brain.milestoneHistory?.map(m => m.tier) || [];
  const nextTier = MILESTONE_TIERS.find(t => !achievedTiers.includes(t));
  const isMilestoneUnlocked = nextTier ? verbsDiscoveredCount >= nextTier : false;

  const activeTitleObj = brain.activeTitle ? catalog.find(i => i.id === brain.activeTitle) : null;
  const [selectedStory, setSelectedStory] = useState<any | null>(null);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in pb-24">
      
      {/* HEADER: SALDO & NOTIFICAÇÕES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg border border-slate-700">
                  <Brain className="text-emerald-400" size={32} />
              </div>
              <div>
                  <h1 className="text-3xl font-serif font-bold text-slate-900 leading-tight">
                      {userName || 'Studente'}
                      {activeTitleObj && <span className="block text-sm font-sans font-bold text-emerald-600 uppercase tracking-widest">{activeTitleObj.asset} {activeTitleObj.name}</span>}
                  </h1>
              </div>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                      <Star fill="currentColor" size={18} />
                  </div>
                  <div className="font-mono text-xl font-bold text-slate-800">{totalXP} XP</div>
              </div>
              <button onClick={onOpenMercato} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20 active:scale-95">
                  <ShoppingBag size={20} /> Il Mercato
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: GRÁFICO E PROGRESSO */}
          <div className="lg:col-span-2 space-y-8">
              
              {/* CARD PRINCIPAL DE TREINAMENTO */}
              <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                  <div className="relative z-10 space-y-6">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                          <Activity size={14} className="animate-pulse" /> Neuroplasticidade em Alta
                      </div>
                      <h2 className="text-4xl md:text-5xl font-serif font-bold max-w-md">Pronto para a automação cognitiva?</h2>
                      <p className="text-slate-400 text-lg max-w-lg">O nível <strong>{currentLevel}</strong> exige foco total no <strong>Presente Indicativo</strong>. Treine agora para liberar novas histórias.</p>
                      
                      <div className="pt-4 flex flex-wrap gap-4">
                          <button onClick={onStartTraining} className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-xl shadow-emerald-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3">
                              <Play fill="currentColor" size={24} /> Iniciar Treino
                          </button>
                          <button onClick={onStartBoss} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-8 py-5 rounded-2xl font-bold text-lg border border-slate-700 flex items-center gap-3 transition-all">
                              <Swords size={20} /> Coliseu Boss
                          </button>
                      </div>
                  </div>
                  
                  {/* Gráfico de Fundo Sutil */}
                  <div className="absolute bottom-0 right-0 w-full md:w-2/3 h-48 opacity-30 pointer-events-none">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={activityData}>
                              <defs>
                                  <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="xp" stroke="#10b981" fillOpacity={1} fill="url(#colorXp)" strokeWidth={3} />
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* GRID DE MODOS SECUNDÁRIOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className={`p-8 rounded-[2rem] border transition-all ${isStoryReady ? 'bg-indigo-600 border-indigo-400 text-white cursor-pointer hover:shadow-2xl hover:scale-[1.02]' : 'bg-white border-slate-200'}`} onClick={() => isStoryReady && onStartStory()}>
                      <div className="flex justify-between items-start mb-8">
                          <div className={`p-4 rounded-2xl ${isStoryReady ? 'bg-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
                              <Sparkles size={28} />
                          </div>
                          {!isStoryReady && <LockKeyhole className="text-slate-300" size={20} />}
                      </div>
                      <h3 className="text-2xl font-serif font-bold mb-2">Story Mode</h3>
                      <p className={`${isStoryReady ? 'text-indigo-100' : 'text-slate-500'} text-sm mb-6`}>Transforme os verbos aprendidos em uma narrativa visual gerada por IA.</p>
                      
                      <div className="space-y-3">
                          <div className="flex justify-between text-xs font-bold uppercase opacity-60">
                              <span>Sincronia Neural</span>
                              <span>{verbsSinceStory}/5 Verbos</span>
                          </div>
                          <div className={`h-2.5 rounded-full overflow-hidden ${isStoryReady ? 'bg-indigo-800' : 'bg-slate-100'}`}>
                              <div className={`h-full transition-all duration-1000 ${isStoryReady ? 'bg-white' : 'bg-indigo-400'}`} style={{ width: `${storyProgress}%` }}></div>
                          </div>
                      </div>
                  </div>

                  <div className={`p-8 rounded-[2rem] border transition-all ${isMilestoneUnlocked ? 'bg-amber-100 border-amber-300 cursor-pointer hover:shadow-xl hover:scale-[1.02]' : 'bg-white border-slate-200'}`} onClick={() => isMilestoneUnlocked && onStartMilestone(nextTier!)}>
                       <div className="flex justify-between items-start mb-8">
                          <div className={`p-4 rounded-2xl ${isMilestoneUnlocked ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                              <Award size={28} />
                          </div>
                          {!isMilestoneUnlocked && <LockKeyhole className="text-slate-300" size={20} />}
                      </div>
                      <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">Pietra Miliare</h3>
                      <p className="text-slate-500 text-sm mb-6">Desafios de marco que garantem medalhas exclusivas na sua estante.</p>
                      
                      <div className="flex items-center gap-2">
                          <div className="text-2xl font-mono font-bold text-slate-800">{verbsDiscoveredCount}</div>
                          <div className="text-slate-400 text-xs font-bold uppercase">/ {nextTier || '--'} Verbos</div>
                      </div>
                  </div>
              </div>
          </div>

          {/* COLUNA DIREITA: STATS & GALLERIA */}
          <div className="space-y-8">
              
              {/* CARD DE NÍVEL */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl border border-emerald-100">
                          {currentLevel}
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-800">Fluência no Nível</h4>
                          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Automação Cognitiva</p>
                      </div>
                  </div>
                  
                  <div className="space-y-3">
                      <div className="flex justify-between text-xs font-bold text-slate-400">
                          <span>Progresso Total</span>
                          <span>{Math.round(levelProgress)}%</span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-50">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${levelProgress}%` }}></div>
                      </div>
                  </div>
              </div>

              {/* GALLERIA PREVIEW */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                      <h4 className="font-serif font-bold text-xl flex items-center gap-2 text-slate-800">
                          <ImageIcon size={20} className="text-purple-500" /> Galleria
                      </h4>
                      <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase">
                          {brain.storyHistory?.length || 0} Itens
                      </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      {brain.storyHistory && brain.storyHistory.length > 0 ? (
                          brain.storyHistory.slice(-4).reverse().map(story => (
                              <div key={story.id} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden relative group cursor-pointer" onClick={() => setSelectedStory(story)}>
                                  {story.imageUrl ? (
                                      <img src={story.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                  ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={24}/></div>}
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Sparkles size={16} className="text-white" />
                                  </div>
                              </div>
                          ))
                      ) : (
                          [...Array(4)].map((_, i) => (
                              <div key={i} className="aspect-square bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-200">
                                  <LockKeyhole size={20} />
                              </div>
                          ))
                      )}
                  </div>
                  
                  {(!brain.storyHistory || brain.storyHistory.length === 0) && (
                      <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
                          Desbloqueie o <strong>Story Mode</strong> para ver suas memórias visuais aqui.
                      </p>
                  )}
              </div>

              {/* TROPHY SHELF SMALL */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h4 className="font-serif font-bold text-xl mb-6 flex items-center gap-2 text-slate-800">
                      <Trophy size={20} className="text-amber-500" /> Sala dei Trofei
                  </h4>
                  <div className="flex flex-wrap gap-3">
                      {brain.inventory && brain.inventory.length > 0 ? (
                          brain.inventory.map(id => {
                              const item = catalog.find(i => i.id === id);
                              if (!item) return null;
                              return (
                                  <div key={id} title={item.name} className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl border border-slate-100 hover:scale-110 transition-transform cursor-help">
                                      {item.asset}
                                  </div>
                              );
                          })
                      ) : (
                          <div className="text-center w-full py-4 text-slate-300 text-sm italic">Sua estante aguarda...</div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* STORY DETAIL MODAL */}
      {selectedStory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in" onClick={() => setSelectedStory(null)}>
              <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="relative h-72 bg-slate-200">
                      {selectedStory.imageUrl && (
                          <img src={selectedStory.imageUrl} className="w-full h-full object-cover" alt="Story" />
                      )}
                      <button onClick={() => setSelectedStory(null)} className="absolute top-6 right-6 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 backdrop-blur-md transition-colors">
                          <LayoutGrid size={24} />
                      </button>
                  </div>
                  <div className="p-10">
                      <div className="text-xs font-bold text-purple-600 mb-2 uppercase tracking-widest">Memória Neural</div>
                      <h2 className="text-4xl font-serif font-bold text-slate-900 mb-6">{selectedStory.storyTitle}</h2>
                      <div className="prose prose-slate mb-8 leading-relaxed text-lg text-slate-700">
                          <p dangerouslySetInnerHTML={{ __html: selectedStory.storyText }}></p>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-6 border-t border-slate-100">
                          {selectedStory.targetVerbs.map((v: string) => (
                              <span key={v} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">#{v}</span>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default StudentDashboard;
