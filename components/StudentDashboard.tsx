import React, { useState, useEffect } from 'react';
import { Play, Zap, Target, BookOpen, Brain, TrendingUp, Lock, Award, Star, Swords, Skull, Clock, ShieldCheck, Trophy, Library, ShoppingBag, LayoutGrid, Bell, Image as ImageIcon, Sparkles, LockKeyhole, ArrowRight, Network } from 'lucide-react';
import { UserBrain, LevelStats, StoreItem } from '../types';
import { VERB_DATABASE } from '../data/verbs';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  
  const XP_GOAL = 1000;
  const isXpReady = currentStats.score >= XP_GOAL;
  const COOLDOWN_MS = 72 * 60 * 60 * 1000;
  const lastAttempt = brain.bossStats?.lastAttempt || 0;
  const isCooldownActive = (Date.now() - lastAttempt) < COOLDOWN_MS;
  const isBossAvailable = isXpReady && !isCooldownActive;
  const hasMedal = brain.bossStats?.hasMedal;

  const verbsSinceStory = brain.verbsSinceLastStory || 0;
  const storyProgress = Math.min((verbsSinceStory / 5) * 100, 100);
  const isStoryReady = verbsSinceStory >= 5;
  const storiesUnlocked = brain.storyHistory?.length || 0;

  const achievedTiers = brain.milestoneHistory?.map(m => m.tier) || [];
  const nextTier = MILESTONE_TIERS.find(t => !achievedTiers.includes(t));
  const isMilestoneUnlocked = nextTier ? verbsDiscoveredCount >= nextTier : false;
  const MILESTONE_COOLDOWN = 60 * 60 * 1000;
  const msCooldownActive = (Date.now() - (brain.lastMilestoneFail || 0)) < MILESTONE_COOLDOWN;
  const msTimeLeft = Math.max(0, MILESTONE_COOLDOWN - (Date.now() - (brain.lastMilestoneFail || 0)));
  const msMinutesLeft = Math.ceil(msTimeLeft / 60000);

  const activeTitleObj = brain.activeTitle ? catalog.find(i => i.id === brain.activeTitle) : null;

  const collectionItems = (brain.inventory || []).map(id => catalog.find(i => i.id === id)).filter(item => 
      item && (item.type === 'FLAG' || item.type === 'COLLECTIBLE' || item.type === 'CLOTHING' || (!['THEME', 'TITLE', 'POWERUP'].includes(item.type)))
  ) as StoreItem[];

  const [bossTimeLeft, setBossTimeLeft] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = brain.notifications ? brain.notifications.filter(n => !n.read).length : 0;
  const [selectedStory, setSelectedStory] = useState<any | null>(null);

  // Neuro-Map Data Generation
  const neuroMapData = Object.entries(brain.verbHistory).map(([verb, state], index) => ({
    name: verb,
    x: Math.cos(index * 0.5) * (verbsDiscoveredCount / 10 + index),
    y: Math.sin(index * 0.5) * (verbsDiscoveredCount / 10 + index),
    z: state.consecutiveCorrect + 2,
    color: state.consecutiveCorrect >= 3 ? '#10b981' : '#6366f1'
  })).slice(-20); // Show last 20 active connections

  useEffect(() => {
    if (isCooldownActive) {
        const updateTimer = () => {
            const remaining = COOLDOWN_MS - (Date.now() - lastAttempt);
            if (remaining <= 0) setBossTimeLeft("");
            else {
                const h = Math.floor(remaining / (1000 * 60 * 60));
                const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                setBossTimeLeft(`${h}h ${m}m`);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 60000);
        return () => clearInterval(interval);
    }
  }, [isCooldownActive, lastAttempt]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-24">
      
      {/* 0. WALLET & NOTIFICATION HEADER */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
          <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                  <Star fill="currentColor" size={20} />
              </div>
              <div>
                  <div className="text-xs font-bold text-slate-400 uppercase">Saldo de XP</div>
                  <div className="text-2xl font-mono font-bold text-slate-800">{totalXP}</div>
              </div>
          </div>
          
          <div className="flex items-center gap-3">
              <div className="relative">
                  <button onClick={() => setShowNotifications(!showNotifications)} className="p-3 rounded-full hover:bg-slate-100 text-slate-600 relative">
                      <Bell size={20} />
                      {unreadCount > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border border-white">{unreadCount}</span>}
                  </button>
                  {showNotifications && (
                      <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">Notifiche</div>
                          <div className="max-h-64 overflow-y-auto">
                              {brain.notifications && brain.notifications.length > 0 ? (
                                  brain.notifications.slice().reverse().map(n => (
                                      <div key={n.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                          <div className="flex items-start gap-3">
                                              <div className="text-xl">{n.type === 'PROMO' ? '⚡' : n.type === 'NEW_ITEM' ? '🎁' : 'ℹ️'}</div>
                                              <div>
                                                  <h4 className="font-bold text-slate-800 text-sm">{n.title}</h4>
                                                  <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                                              </div>
                                          </div>
                                      </div>
                                  ))
                              ) : <div className="p-8 text-center text-slate-400 text-xs">Sem notificações.</div>}
                          </div>
                      </div>
                  )}
              </div>
              <button onClick={onOpenMercato} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-slate-900/20">
                  <ShoppingBag size={18} /> Il Mercato
              </button>
          </div>
      </div>

      {/* 1. HERO SECTION */}
      <div className={`relative overflow-hidden rounded-3xl p-8 md:p-12 text-white shadow-2xl transition-all duration-500 ${isBossAvailable ? 'bg-gradient-to-br from-red-900 via-slate-900 to-black' : 'bg-slate-900'}`}>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            {isBossAvailable ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider animate-pulse"><Skull size={12} fill="currentColor" /> Desafio Mortal Disponível</div>
            ) : hasMedal ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-wider"><Award size={12} fill="currentColor" /> Campeão do Coliseu</div>
            ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider"><Zap size={12} fill="currentColor" /> Neuroplasticidade Ativa</div>
            )}
            <h1 className="text-4xl md:text-5xl font-serif font-bold leading-tight flex flex-col gap-1">
              <span className="text-2xl md:text-3xl font-sans font-medium text-slate-400">Bentornato,</span>
              <span>{userName || 'Studente'}</span>
              {activeTitleObj && <span className="text-lg bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20 text-yellow-300 font-sans mt-2 flex items-center gap-2">{activeTitleObj.asset} {activeTitleObj.name}</span>}
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">Você ativou {verbsDiscoveredCount} conexões verbais. {nextTier && `O próximo marco é em ${nextTier} verbos.`}</p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              {isBossAvailable ? (
                  <button onClick={onStartBoss} className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 text-lg border border-red-400"><Swords fill="currentColor" size={24} /> ENFRENTAR DESAFIO FINAL</button>
              ) : (
                  <button onClick={onStartTraining} className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 text-lg"><Play fill="currentColor" size={20} /> Continuar Sessão</button>
              )}
            </div>
          </div>
          <div className="hidden lg:block w-80 h-64 bg-slate-800/50 rounded-2xl border border-slate-700 relative overflow-hidden backdrop-blur-sm">
             <div className="absolute inset-0 p-4">
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Network size={12} /> Mapa Neural Recente</div>
                 <ResponsiveContainer width="100%" height="90%">
                    <ScatterChart>
                        <XAxis type="number" dataKey="x" hide />
                        <YAxis type="number" dataKey="y" hide />
                        <ZAxis type="number" dataKey="z" range={[20, 200]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                            if (active && payload && payload.length) return <div className="bg-slate-900 border border-slate-700 p-2 rounded text-[10px] text-white"><b>{payload[0].payload.name}</b></div>;
                            return null;
                        }} />
                        <Scatter name="Verbs" data={neuroMapData} fill="#8884d8">
                            {neuroMapData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Scatter>
                    </ScatterChart>
                 </ResponsiveContainer>
             </div>
             <div className="absolute inset-0 pointer-events-none border-4 border-slate-900/50 rounded-2xl"></div>
          </div>
        </div>
      </div>

      {/* 2. PROGRESSO & META DIÁRIA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-slate-500 text-xs font-bold uppercase tracking-wide">Nível de Fluência</h2>
                    <div className="text-3xl font-serif font-bold text-slate-800 mt-1">{currentLevel}</div>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><Target size={24} /></div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500 font-medium"><span>Progresso</span><span>{Math.round(levelProgress)}%</span></div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${levelProgress}%` }}></div>
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-slate-500 text-xs font-bold uppercase tracking-wide">Automação</h2>
                    <div className="text-3xl font-serif font-bold text-slate-800 mt-1">{verbsDiscoveredCount}</div>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg text-slate-400"><Brain size={24} /></div>
            </div>
            <p className="text-[10px] text-slate-400">Verbos com trilhas neurais ativas.</p>
        </div>

        <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all ${isStoryReady ? 'bg-purple-600 border-purple-700 text-white cursor-pointer hover:scale-[1.02]' : 'bg-white border-slate-200 opacity-90'}`} onClick={() => isStoryReady && onStartStory()}>
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div><h2 className={`text-xs font-bold uppercase tracking-wide ${isStoryReady ? 'text-purple-100' : 'text-slate-500'}`}>Story Mode</h2><div className={`text-3xl font-serif font-bold mt-1 ${isStoryReady ? 'text-white' : 'text-slate-800'}`}>{isStoryReady ? 'PRONTO' : `${verbsSinceStory}/5`}</div></div>
                <div className={`p-2 rounded-lg ${isStoryReady ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{isStoryReady ? <Sparkles size={24} /> : <LockKeyhole size={24} />}</div>
            </div>
            {isStoryReady && <button onClick={(e) => { e.stopPropagation(); onStartStory(); }} className="w-full bg-white text-purple-700 font-bold py-2 rounded-lg shadow-sm flex items-center justify-center gap-2"><Play size={16} fill="currentColor"/> Iniciar</button>}
        </div>

        {nextTier && (
            <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all ${isMilestoneUnlocked && !msCooldownActive ? 'bg-amber-100 border-amber-300 cursor-pointer' : 'bg-white border-slate-200'}`} onClick={() => isMilestoneUnlocked && !msCooldownActive && onStartMilestone(nextTier)}>
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div><h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Milestone</h2><div className="text-3xl font-serif font-bold mt-1 text-slate-800">{nextTier}</div></div>
                    <div className={`p-2 rounded-lg ${isMilestoneUnlocked && !msCooldownActive ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{isMilestoneUnlocked ? <Award size={24} /> : <Lock size={24} />}</div>
                </div>
                {isMilestoneUnlocked && !msCooldownActive && <button className="w-full bg-amber-500 text-white font-bold py-2 rounded-lg animate-pulse">Reivindicar</button>}
            </div>
        )}
      </div>

      {/* 3. GALLERIA DELLE STORIE */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-50 rounded-full text-purple-600"><ImageIcon size={24} /></div>
              <div><h2 className="text-2xl font-serif font-bold text-slate-800">Galleria delle Storie</h2><p className="text-slate-500 text-sm">Visualizações cognitivas da IA.</p></div>
          </div>
          {brain.storyHistory && brain.storyHistory.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {brain.storyHistory.slice().reverse().map((story) => (
                      <div key={story.id} className="group bg-slate-50 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100" onClick={() => setSelectedStory(story)}>
                          <div className="aspect-[4/3] bg-slate-200 relative overflow-hidden">
                              {story.imageUrl ? <img src={story.imageUrl} alt={story.storyTitle} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-100"><ImageIcon size={32} /></div>}
                          </div>
                          <div className="p-4"><h3 className="font-bold text-slate-800 text-sm line-clamp-1">{story.storyTitle}</h3></div>
                      </div>
                  ))}
              </div>
          ) : <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">Nenhuma história desbloqueada ainda.</div>}
      </div>

      {/* STORY DETAIL MODAL */}
      {selectedStory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setSelectedStory(null)}>
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="relative h-64 bg-slate-900">
                      {selectedStory.imageUrl && <img src={selectedStory.imageUrl} className="w-full h-full object-cover" alt="Story" />}
                      <button onClick={() => setSelectedStory(null)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full"><X size={20} /></button>
                  </div>
                  <div className="p-8">
                      <h2 className="text-3xl font-serif font-bold text-slate-800 mb-4">{selectedStory.storyTitle}</h2>
                      <div className="prose prose-slate mb-6"><p dangerouslySetInnerHTML={{ __html: selectedStory.storyText }}></p></div>
                      <div className="flex gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>Verbos: {selectedStory.targetVerbs.join(", ")}</span></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const X = ({size}: {size: number}) => <div style={{width: size, height: size}} className="relative"><span className="absolute top-1/2 left-0 w-full h-1 bg-white rotate-45"></span><span className="absolute top-1/2 left-0 w-full h-1 bg-white -rotate-45"></span></div>;

export default StudentDashboard;