
import React, { useState, useEffect } from 'react';
import { Play, Zap, Target, BookOpen, Brain, TrendingUp, Lock, Award, Star, Swords, Skull, Clock, ShieldCheck, Trophy, Library, ShoppingBag, LayoutGrid, Bell, Image as ImageIcon } from 'lucide-react';
import { UserBrain, LevelStats, StoreItem, GlobalGameConfig } from '../types';
import { VERB_DATABASE } from '../data/verbs';

interface StudentDashboardProps {
  userName: string;
  onStartTraining: () => void;
  onStartBoss: () => void;
  onStartStory: () => void;
  onStartMilestone: (tier: number) => void;
  onOpenMercato: () => void;
  brain: UserBrain;
  catalog: StoreItem[]; 
  config: GlobalGameConfig;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ userName, onStartTraining, onStartBoss, onStartStory, onStartMilestone, onOpenMercato, brain, catalog, config }) => {
  
  // DYNAMIC CALCULATION OF STATS
  const currentLevel = brain.currentLevel;
  const currentStats = brain.levelStats[currentLevel];
  
  // Total XP across all levels
  const totalXP = (Object.values(brain.levelStats) as LevelStats[]).reduce((acc, curr) => acc + curr.score, 0);

  // Calculate Level Progress
  const totalVerbsInLevel = VERB_DATABASE.filter(v => v.level === currentLevel).length;
  const masteredInLevel = Object.keys(brain.verbHistory).filter(v => {
      const verbData = VERB_DATABASE.find(dbV => dbV.infinitive.toLowerCase() === v.toLowerCase());
      return verbData && verbData.level === currentLevel;
  }).length;

  const levelProgress = totalVerbsInLevel > 0 
    ? Math.min((masteredInLevel / totalVerbsInLevel) * 100, 100)
    : 0;

  const verbsDiscoveredCount = Object.keys(brain.verbHistory).length;
  
  // BOSS LOGIC (DYNAMIC CONFIG)
  const XP_GOAL = config.rules.bossUnlockXP;
  const isXpReady = currentStats.score >= XP_GOAL;
  const COOLDOWN_MS = config.rules.bossCooldownHours * 60 * 60 * 1000;
  const lastAttempt = brain.bossStats?.lastAttempt || 0;
  const isCooldownActive = (Date.now() - lastAttempt) < COOLDOWN_MS;
  const isBossAvailable = isXpReady && !isCooldownActive;
  const hasMedal = brain.bossStats?.hasMedal;

  // STORY MODE LOGIC (DYNAMIC CONFIG)
  const STORY_UNLOCK_COUNT = config.rules.storyUnlockCount;
  const verbsSinceStory = brain.verbsSinceLastStory || 0;
  const storyProgress = Math.min((verbsSinceStory / STORY_UNLOCK_COUNT) * 100, 100);
  const isStoryReady = verbsSinceStory >= STORY_UNLOCK_COUNT;
  const storiesUnlocked = brain.storyHistory?.length || 0;

  // MILESTONE LOGIC (DYNAMIC CONFIG)
  const achievedTiers = brain.milestoneHistory?.map(m => m.tier) || [];
  
  // Calculate next tier dynamically based on config interval (e.g., 10, 20, 30...)
  const interval = config.rules.milestoneInterval || 10;
  let nextTier = interval;
  while (achievedTiers.includes(nextTier)) {
      nextTier += interval;
  }
  
  const isMilestoneUnlocked = nextTier ? verbsDiscoveredCount >= nextTier : false;
  const MILESTONE_COOLDOWN = config.rules.milestoneCooldownHours * 60 * 60 * 1000;
  const msCooldownActive = (Date.now() - (brain.lastMilestoneFail || 0)) < MILESTONE_COOLDOWN;
  const msTimeLeft = Math.max(0, MILESTONE_COOLDOWN - (Date.now() - (brain.lastMilestoneFail || 0)));
  const msMinutesLeft = Math.ceil(msTimeLeft / 60000);

  // TITLE LOGIC
  const activeTitleObj = brain.activeTitle ? catalog.find(i => i.id === brain.activeTitle) : null;

  // TROPHY ROOM LOGIC
  // Filter inventory for visual items (Flags, Collectibles, Clothing, Custom)
  const collectionItems = (brain.inventory || []).map(id => catalog.find(i => i.id === id)).filter(item => 
      item && (item.type === 'FLAG' || item.type === 'COLLECTIBLE' || item.type === 'CLOTHING' || (!['THEME', 'TITLE', 'POWERUP'].includes(item.type)))
  ) as StoreItem[];

  // Boss Countdown timer
  const [bossTimeLeft, setBossTimeLeft] = useState("");
  
  // Notification State
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = brain.notifications ? brain.notifications.filter(n => !n.read).length : 0;

  // Gallery Preview State
  const [selectedStory, setSelectedStory] = useState<any | null>(null);

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
              {/* Notification Bell */}
              <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-3 rounded-full hover:bg-slate-100 text-slate-600 relative"
                  >
                      <Bell size={20} />
                      {unreadCount > 0 && (
                          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold border border-white">
                              {unreadCount}
                          </span>
                      )}
                  </button>

                  {/* Dropdown */}
                  {showNotifications && (
                      <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                              Notifiche
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                              {brain.notifications && brain.notifications.length > 0 ? (
                                  brain.notifications.slice().reverse().map(n => (
                                      <div key={n.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                          <div className="flex items-start gap-3">
                                              <div className="text-xl">
                                                  {n.type === 'PROMO' ? '⚡' : n.type === 'NEW_ITEM' ? '🎁' : 'ℹ️'}
                                              </div>
                                              <div>
                                                  <h4 className="font-bold text-slate-800 text-sm">{n.title}</h4>
                                                  <p className="text-xs text-slate-500 mt-1">{n.message}</p>
                                                  <span className="text-[10px] text-slate-400 mt-2 block">
                                                      {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="p-8 text-center text-slate-400 text-xs">Nenhuma notificação recente.</div>
                              )}
                          </div>
                      </div>
                  )}
              </div>

              <button 
                onClick={onOpenMercato}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold transition-all transform active:scale-95 shadow-lg shadow-slate-900/20"
              >
                  <ShoppingBag size={18} /> Il Mercato
              </button>
          </div>
      </div>

      {/* 1. HERO SECTION */}
      <div className={`relative overflow-hidden rounded-3xl p-8 md:p-12 text-white shadow-2xl transition-all duration-500 
          ${isBossAvailable ? 'bg-gradient-to-br from-red-900 via-slate-900 to-black' : 'bg-slate-900'}
      `}>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            {isBossAvailable ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider animate-pulse">
                    <Skull size={12} fill="currentColor" /> Desafio Mortal Disponível
                </div>
            ) : hasMedal ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase tracking-wider">
                    <Award size={12} fill="currentColor" /> Campeão do Coliseu
                </div>
            ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <Zap size={12} fill="currentColor" />
                    {currentStats.exercisesCount > 0 ? "Neuroplasticidade Ativa" : "Sua mente está pronta"}
                </div>
            )}
            
            <h1 className="text-4xl md:text-5xl font-serif font-bold leading-tight flex flex-col gap-1">
              <span className="text-2xl md:text-3xl font-sans font-medium text-slate-400">
                  {currentStats.exercisesCount > 0 ? 'Bentornato,' : 'Benvenuto,'}
              </span>
              <span>{userName || 'Studente'}</span>
              
              {/* Active Title Display */}
              {activeTitleObj && (
                  <span className="text-lg bg-white/10 w-fit px-3 py-1 rounded-full border border-white/20 text-yellow-300 font-sans mt-2 flex items-center gap-2">
                      {activeTitleObj.asset} {activeTitleObj.name}
                  </span>
              )}
            </h1>
            
            <p className="text-slate-400 text-lg leading-relaxed">
              {isBossAvailable 
                ? `Você atingiu o pico neural (${XP_GOAL} XP). Enfrente o Coliseu Gramatical para provar seu domínio e conquistar a Coroa de Louros.`
                : isCooldownActive
                    ? "O Guardião descansa. O Coliseu abrirá seus portões novamente em breve. Continue treinando."
                    : <>Você está no <strong>Nível {currentLevel}</strong>. {verbsDiscoveredCount > 0 ? ` Você já ativou ${verbsDiscoveredCount} conexões verbais.` : " Sua jornada começa com o primeiro verbo."}</>
              }
            </p>
            
            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              {isBossAvailable ? (
                  <button 
                    onClick={onStartBoss}
                    className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-red-900/50 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 text-lg border border-red-400"
                  >
                    <Swords fill="currentColor" size={24} />
                    ENFRENTAR DESAFIO FINAL
                  </button>
              ) : isCooldownActive ? (
                  <button 
                    disabled
                    className="bg-slate-800 text-slate-500 px-8 py-4 rounded-xl font-bold border border-slate-700 flex items-center justify-center gap-3 text-lg cursor-not-allowed"
                  >
                    <Clock size={20} />
                    Retorno em {bossTimeLeft}
                  </button>
              ) : (
                  <button 
                    onClick={onStartTraining}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-emerald-900/50 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 text-lg"
                  >
                    <Play fill="currentColor" size={20} />
                    {currentStats.exercisesCount > 0 ? "Continuar Sessão" : "Aprender Verbos"}
                  </button>
              )}
            </div>
          </div>

          <div className="hidden md:block opacity-20 transform rotate-12">
            {isBossAvailable ? <Skull size={200} strokeWidth={1} /> : hasMedal ? <Award size={200} strokeWidth={1} /> : <Brain size={200} strokeWidth={1} />}
          </div>
        </div>
        
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      </div>

      {/* 2. PROGRESSO & META DIÁRIA & STORY MODE & MILESTONE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card: Nível Atual */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-slate-500 text-xs font-bold uppercase tracking-wide">Nível de Fluência</h2>
                    <div className="text-3xl font-serif font-bold text-slate-800 mt-1">
                        {currentLevel}
                    </div>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                    <Target size={24} />
                </div>
            </div>
            
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Progresso do Nível</span>
                    <span>{Math.round(levelProgress)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-1000" 
                        style={{ width: `${levelProgress}%` }}
                    ></div>
                </div>
                <div className="text-[10px] text-slate-400 text-right">
                    {masteredInLevel} / {totalVerbsInLevel} verbos
                </div>
            </div>
        </div>

        {/* Card: Inventário de Verbos */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-slate-500 text-xs font-bold uppercase tracking-wide">Inventário Neural</h2>
                    <div className="text-3xl font-serif font-bold text-slate-800 mt-1">
                        {verbsDiscoveredCount} <span className="text-base text-slate-400 font-sans font-normal">Verbos</span>
                    </div>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                    <BookOpen size={24} />
                </div>
            </div>
            
            <div className="mt-auto">
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {Object.keys(brain.verbHistory).reverse().slice(0, 20).map(v => (
                        <span key={v} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 font-medium">
                            {v}
                        </span>
                    ))}
                    {verbsDiscoveredCount === 0 && <span className="text-xs text-slate-400">Nenhum verbo ainda.</span>}
                </div>
            </div>
        </div>

        {/* Card: STORY MODE */}
        <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all
            ${isStoryReady ? 'bg-purple-600 border-purple-700 text-white cursor-pointer hover:scale-[1.02]' : 'bg-white border-slate-200'}
        `}
        onClick={() => isStoryReady && onStartStory()}
        >
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h2 className={`text-xs font-bold uppercase tracking-wide ${isStoryReady ? 'text-purple-100' : 'text-slate-500'}`}>Story Mode</h2>
                    <div className={`text-3xl font-serif font-bold mt-1 ${isStoryReady ? 'text-white' : 'text-slate-800'}`}>
                        {isStoryReady ? 'DESBLOQUEADO' : `${verbsSinceStory} / ${STORY_UNLOCK_COUNT}`} 
                        {!isStoryReady && <span className="text-base text-slate-400 font-sans font-normal"> Verbos</span>}
                    </div>
                </div>
                <div className={`p-2 rounded-lg ${isStoryReady ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-400'}`}>
                    <BookOpen size={24} />
                </div>
            </div>
            
            <div className="relative z-10">
                 {isStoryReady ? (
                     <button 
                        onClick={(e) => { e.stopPropagation(); onStartStory(); }}
                        className="w-full bg-white text-purple-700 font-bold py-2 rounded-lg shadow-sm hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                     >
                         <Play size={16} fill="currentColor"/> Iniciar História
                     </button>
                 ) : (
                     <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400 font-medium">
                             <span>Próxima história em...</span>
                             <span>{STORY_UNLOCK_COUNT - verbsSinceStory} verbos *</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                             <div 
                                 className="h-full bg-purple-500 transition-all duration-1000" 
                                 style={{ width: `${storyProgress}%` }}
                             ></div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                            * Contabiliza apenas verbos distintos dominados.
                        </p>
                     </div>
                 )}
                 {/* Library Counter */}
                 {storiesUnlocked > 0 && (
                     <div className="mt-3 flex items-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-md w-fit">
                         <Library size={12} /> {storiesUnlocked}
                     </div>
                 )}
            </div>
        </div>

        {/* Card: PIETRA MILIARE (MILESTONE) */}
        {nextTier ? (
            <div className={`p-6 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden transition-all
                ${isMilestoneUnlocked && !msCooldownActive ? 'bg-amber-100 border-amber-300 cursor-pointer hover:shadow-lg hover:scale-[1.02]' : 'bg-white border-slate-200'}
            `}
            onClick={() => isMilestoneUnlocked && !msCooldownActive && onStartMilestone(nextTier)}
            >
                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Pietra Miliare</h2>
                        <div className="text-3xl font-serif font-bold mt-1 text-slate-800">
                            {nextTier} <span className="text-base text-slate-400 font-sans font-normal">Verbos</span>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg ${isMilestoneUnlocked && !msCooldownActive ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {isMilestoneUnlocked ? <Award size={24} /> : <Lock size={24} />}
                    </div>
                </div>
                
                <div className="relative z-10">
                    {msCooldownActive ? (
                        <div className="text-xs font-bold text-red-500 flex items-center gap-1 bg-red-50 p-2 rounded justify-center">
                            <Clock size={12} /> Recarga: {msMinutesLeft}m
                        </div>
                    ) : isMilestoneUnlocked ? (
                        <button className="w-full bg-amber-500 text-white font-bold py-2 rounded-lg shadow-sm hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 animate-pulse">
                            <ShieldCheck size={16} /> Reivindicar Medalha
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-400 font-medium">
                                <span>Progresso do Marco</span>
                                <span>{verbsDiscoveredCount} / {nextTier}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-amber-400 transition-all duration-1000" 
                                    style={{ width: `${Math.min((verbsDiscoveredCount / nextTier) * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        ) : (
            // Completed all milestones (unlikely with dynamic generation, but fallback)
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-center items-center text-center">
                <Trophy size={40} className="text-amber-500 mb-2" />
                <h3 className="font-bold text-amber-800">Lenda Viva</h3>
                <p className="text-xs text-amber-600">Todas as medalhas conquistadas.</p>
            </div>
        )}
      </div>

      {/* 3. GALLERIA DELLE STORIE (Visual Memory Gallery) */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-50 rounded-full text-purple-600">
                  <ImageIcon size={24} />
              </div>
              <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-800">Galleria delle Storie</h2>
                  <p className="text-slate-500 text-sm">Suas memórias visuais criadas pela IA.</p>
              </div>
          </div>

          {brain.storyHistory && brain.storyHistory.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {brain.storyHistory.slice().reverse().map((story, idx) => (
                      <div 
                        key={story.id} 
                        className="group bg-slate-50 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100"
                        onClick={() => setSelectedStory(story)}
                      >
                          <div className="aspect-[4/3] bg-slate-200 relative overflow-hidden">
                              {story.imageUrl ? (
                                  <img src={story.imageUrl} alt={story.storyTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                  <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-100">
                                      <ImageIcon size={32} className="mb-2 opacity-50" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest">Sem Imagem</span>
                                  </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                  <span className="text-white text-xs font-bold">Ver Detalhes</span>
                              </div>
                          </div>
                          <div className="p-4">
                              <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{story.storyTitle}</h3>
                              <div className="flex justify-between items-center mt-2">
                                  <span className="text-[10px] text-slate-400">{new Date(story.date).toLocaleDateString()}</span>
                                  <div className="flex gap-1">
                                      {[...Array(Math.round(story.ratingInterest/2))].map((_, i) => <Star key={i} size={10} className="text-amber-400 fill-amber-400"/>)}
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">Nenhuma história visual encontrada.</p>
                  
                  {isStoryReady ? (
                      <button 
                        onClick={onStartStory}
                        className="mt-4 bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-purple-900/20 transition-all animate-pulse flex items-center justify-center gap-2 mx-auto"
                      >
                          <Play size={16} fill="currentColor" /> Reivindicar História Disponível
                      </button>
                  ) : (
                      <div className="mt-4 flex flex-col items-center gap-2">
                           <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-200">
                                {verbsSinceStory}/{STORY_UNLOCK_COUNT} Verbos para desbloqueio
                           </div>
                           <p className="text-xs text-slate-400 max-w-xs">
                               Domine mais verbos para gerar sua primeira memória visual.
                           </p>
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* 4. SALA DEI TROFEI */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                  <LayoutGrid size={24} />
              </div>
              <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-800">Sala dei Trofei</h2>
                  <p className="text-slate-500 text-sm">Sua coleção de itens exclusivos.</p>
              </div>
          </div>

          {collectionItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {collectionItems.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="flex flex-col items-center p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all group relative">
                          <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
                              {item.asset}
                          </div>
                          <div className="text-xs font-bold text-slate-700 text-center uppercase tracking-wide">
                              {item.type}
                          </div>
                          <div className="text-xs text-slate-500 text-center font-serif leading-tight mt-1">
                              {item.name}
                          </div>
                          {/* Shine effect */}
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                      </div>
                  ))}
                  
                  {/* Empty Slot Placeholder */}
                  {[...Array(Math.max(0, 6 - collectionItems.length))].map((_, i) => (
                      <div key={`empty-${i}`} className="border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center h-32 text-slate-300">
                          <div className="w-8 h-8 rounded-full bg-slate-100"></div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <ShoppingBag size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500 font-medium">Sua estante está vazia.</p>
                  <button onClick={onOpenMercato} className="text-indigo-600 font-bold hover:underline mt-2 text-sm">
                      Ir ao Mercado
                  </button>
              </div>
          )}
      </div>

      {/* STORY DETAIL MODAL */}
      {selectedStory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setSelectedStory(null)}>
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="relative h-64 bg-slate-900">
                      {selectedStory.imageUrl && (
                          <img src={selectedStory.imageUrl} className="w-full h-full object-cover" alt="Story" />
                      )}
                      <button onClick={() => setSelectedStory(null)} className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70">
                          <LayoutGrid size={20} />
                      </button>
                  </div>
                  <div className="p-8">
                      <h2 className="text-3xl font-serif font-bold text-slate-800 mb-4">{selectedStory.storyTitle}</h2>
                      <div className="prose prose-slate mb-6">
                          <p dangerouslySetInnerHTML={{ __html: selectedStory.storyText }}></p>
                      </div>
                      <div className="flex gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          <span>Verbos: {selectedStory.targetVerbs.join(", ")}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default StudentDashboard;