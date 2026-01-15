
import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { loadUserProgress, saveUserProgress, getGlobalConfig, saveGlobalConfig } from './services/supabaseService';
import { UserRole, UserBrain, StoreItem, Notification, GlobalGameConfig } from './types';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import ExerciseSession from './components/ExerciseSession';
import BossFightSession from './components/BossFightSession';
import StoryModeSession from './components/StoryModeSession'; 
import MilestoneSession from './components/MilestoneSession';
import DetectiveSession from './components/DetectiveSession';
import IlMercato from './components/IlMercato';
import { LogIn, Activity, LayoutDashboard, BrainCircuit, UserPlus, ShieldAlert, Loader2, Lock, WifiOff, RefreshCcw, Cloud, CloudOff, CheckCircle, Mail, User, Key, AlertCircle, ArrowRight } from 'lucide-react';
import { STORE_CATALOG } from './data/storeItems';

// CRITICAL FIX: Changed from constant object to a Factory Function.
// This ensures every new session gets a FRESH object in memory, preventing data leaks between users.
const getInitialBrain = (): UserBrain => ({
  currentLevel: 'A1',
  levelStats: {
    'A1': { score: 0, exercisesCount: 0, lastPlayed: Date.now() },
    'A2': { score: 0, exercisesCount: 0, lastPlayed: 0 },
    'B1': { score: 0, exercisesCount: 0, lastPlayed: 0 },
    'B2': { score: 0, exercisesCount: 0, lastPlayed: 0 },
    'C1': { score: 0, exercisesCount: 0, lastPlayed: 0 }
  },
  verbHistory: {},
  sessionStreak: 0,
  consecutiveErrors: 0,
  safetyNetActive: 0,
  introducedTopics: ['Presente Indicativo'],
  verbsSinceLastStory: 0, 
  storyHistory: [],
  milestoneHistory: [],
  lastMilestoneFail: 0,
  inventory: [],
  activeTheme: 'default',
  activeTitle: null,
  streakFreeze: 0,
  notifications: [],
  detectiveStats: { casesSolved: 0, lastCaseDate: 0, cluesFound: [] },
  usageStats: { textQueries: 0, audioPlays: 0, imageGenerations: 0 }
});

// --- DEFAULT GOD MODE CONFIG ---
const DEFAULT_GAME_CONFIG: GlobalGameConfig = {
    economy: {
        xpPresentation: 5,
        xpDrill: 10,
        xpPractice: 5, 
        xpVoiceBonus: 5,
        xpPerfectRun: 10,
        xpGameFlashcard: 20,
        xpGameStandard: 10,
        xpMaxPerSession: 55
    },
    probabilities: {
        levelA2: { a1: 15, a2: 85 },
        levelB1: { a1: 15, a2: 15, b1: 70 },
        levelB2: { a1: 10, a2: 15, b1: 15, b2: 60 },
        levelC1: { a1: 10, a2: 10, b1: 15, b2: 15, c1: 50 },
        spiralLearningChance: 0.6,
        spiralTriggerProgress: 40
    },
    rules: {
        drillMaskA1: 3,
        drillMaskA2: 4,
        drillMaskB1: 5,
        drillMaskHigh: 6,
        storyUnlockCount: 5,
        bossUnlockXP: 1000,
        bossCooldownHours: 72,
        bossPassScore: 20,
        milestoneInterval: 10,
        milestoneCooldownHours: 1,
        milestonePassScore: 8,
        voiceThreshold: 10,
        audioCacheLimit: 50,
        bossFallbackVerbs: "Essere, Avere, Andare, Fare, Mangiare"
    },
    games: {
        weightMatch: 20,
        weightBinary: 20,
        weightIntruder: 20,
        weightFlashcard: 20,
        weightDictation: 20
    }
};

type AuthMode = 'LOGIN' | 'REGISTER';
type SaveStatus = 'IDLE' | 'SAVING' | 'SUCCESS' | 'ERROR';

const App: React.FC = () => {
  // Session State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('IDLE');
  
  // App State
  const [userName, setUserName] = useState<string>('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'SESSION' | 'BOSS_FIGHT' | 'STORY_MODE' | 'MILESTONE' | 'MERCATO' | 'DETECTIVE'>('DASHBOARD');
  const [activeMilestoneTier, setActiveMilestoneTier] = useState<number>(0);
  
  // PERSISTENT BRAIN STATE - Initialize with factory function
  const [brain, setBrain] = useState<UserBrain>(getInitialBrain());
  const [storeCatalog, setStoreCatalog] = useState<StoreItem[]>(STORE_CATALOG);
  const [gameConfig, setGameConfig] = useState<GlobalGameConfig>(DEFAULT_GAME_CONFIG);

  // Auth Form
  const [authMode, setAuthMode] = useState<AuthMode>('LOGIN'); // Default to login
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [authMessage, setAuthMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  // --- INIT: CHECK SESSION ---
  useEffect(() => {
    // Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserData(session.user.id);
    });

    // Listen for Auth Changes (Login/Logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         loadUserData(session.user.id);
      } else {
         // CRITICAL FIX: Wipe state on logout to prevent data leaks
         // We call getInitialBrain() to ensure a completely fresh object reference
         setBrain(getInitialBrain());
         setRole(null);
         setUserName('');
         setView('DASHBOARD');
         setFormData({ name: '', email: '', password: '' }); // Clear form
         setLoadError(null);
         setSaveStatus('IDLE');
         setAuthMessage(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATA LOADING ---
  const loadUserData = async (userId: string) => {
      setDataLoading(true);
      setLoadError(null);
      
      try {
          // 1. Get current user email directly from auth to verify identity for Master Access
          const { data: { user } } = await supabase.auth.getUser();
          const userEmail = user?.email;

          // 2. Load Profile (Role, Name) from DB
          const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
          
          // 3. Determine Role (Force Admin for specific email, otherwise use DB)
          if (userEmail === 'rafaelvollpilates@gmail.com') {
              // MASTER OVERRIDE: Force Admin for this specific email
              setRole(UserRole.ADMIN);
              setUserName(profile?.full_name || 'Master Admin');
          } else {
              // Standard Logic for everyone else
              if (profile) {
                  setUserName(profile.full_name || 'Estudante');
                  setRole(profile.role === 'ADMIN' ? UserRole.ADMIN : UserRole.STUDENT);
              } else {
                  setRole(UserRole.STUDENT);
              }
          }

          // 4. Load Brain (Progress)
          // IMPORTANT: If this throws an error, it goes to catch block.
          const savedBrain = await loadUserProgress(userId);
          
          if (savedBrain) {
              // Merge with initial to ensure new structure fields exist
              setBrain({ ...getInitialBrain(), ...savedBrain });
          } else {
              // If null returned (no row), it's a new user. 
              // We use initial brain (already set in state, but safe to set again).
              setBrain(getInitialBrain()); 
          }

          // 5. Load Global Config (Only 1 round trip)
          const savedConfig = await getGlobalConfig();
          if (savedConfig) {
              setGameConfig(savedConfig);
          }

      } catch (error: any) {
          console.error("FATAL LOAD ERROR:", error);
          setLoadError("Falha na sincronização com a nuvem. Verifique sua conexão.");
      } finally {
          setDataLoading(false);
      }
  };

  // --- BRAIN UPDATE WRAPPER ---
  const handleUpdateBrain = async (newBrain: UserBrain) => {
      setBrain(newBrain);
      if (session?.user?.id && !loadError) {
          // Auto-save to Supabase with Status Indicator
          setSaveStatus('SAVING');
          const success = await saveUserProgress(session.user.id, newBrain);
          
          if (success) {
              setSaveStatus('SUCCESS');
              setTimeout(() => setSaveStatus('IDLE'), 2000);
          } else {
              setSaveStatus('ERROR');
          }
      } else {
          console.warn("Skipping cloud save: Not logged in or Load Error present.");
      }
  };

  const handleUpdateConfig = (newConfig: GlobalGameConfig) => {
      setGameConfig(newConfig);
      saveGlobalConfig(newConfig);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
        if (authMode === 'REGISTER') {
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: { full_name: formData.name } // Passed to profile via DB Trigger
                }
            });
            if (error) throw error;
            
            if (!data.session) {
                setAuthMessage({ type: 'success', text: "Cadastro realizado! Verifique seu e-mail para confirmar." });
                setAuthMode('LOGIN');
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });
            if (error) throw error;
        }
    } catch (error: any) {
        if (error.message.includes("Invalid login credentials")) {
            setAuthMessage({ type: 'error', text: "E-mail ou senha incorretos." });
        } else {
            setAuthMessage({ type: 'error', text: error.message || "Erro na autenticação." });
        }
    } finally {
        setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Logic handled by onAuthStateChange listener
  };

  const startMilestone = (tier: number) => {
      setActiveMilestoneTier(tier);
      setView('MILESTONE');
  };

  const getThemeClass = () => {
      if (!brain.activeTheme || brain.activeTheme === 'default') return 'bg-slate-50 text-slate-900';
      const themeItem = storeCatalog.find(i => i.id === brain.activeTheme);
      return themeItem?.themeSkin || 'bg-slate-50 text-slate-900';
  };
  const themeClass = getThemeClass();
  const isDark = themeClass.includes('slate-900');

  // --- RENDER: LOADING SCREEN ---
  if (session && dataLoading) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
              <Loader2 className="animate-spin text-emerald-500" size={48} />
              <p className="animate-pulse font-serif text-slate-400">Sincronizando banco de dados neural...</p>
          </div>
      );
  }

  // --- RENDER: ERROR SCREEN (DATA PROTECTION) ---
  if (session && loadError) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8 text-center">
              <div className="bg-red-500/10 p-6 rounded-full mb-6">
                  <WifiOff className="text-red-500" size={48} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Erro de Sincronização</h2>
              <p className="text-slate-400 mb-8 max-w-md">
                  Não foi possível baixar seu progresso da nuvem. 
                  Para proteger seus dados, o aplicativo foi pausado.
              </p>
              <button 
                  onClick={() => loadUserData(session.user.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
              >
                  <RefreshCcw size={20} /> Tentar Novamente
              </button>
              <button 
                  onClick={handleLogout}
                  className="mt-4 text-slate-500 hover:text-white text-sm underline"
              >
                  Sair da Conta
              </button>
          </div>
      );
  }

  // --- RENDER: AUTH SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none"></div>
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        
        <div className="w-full max-w-sm z-10 animate-in fade-in zoom-in duration-500">
          
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-xl mb-4">
               <BrainCircuit size={32} className="text-emerald-500" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-white tracking-tight">VerboVivo</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium tracking-widest uppercase">Automação Cognitiva</p>
          </div>
          
          {/* Main Card */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            
            {/* Tabs */}
            <div className="flex border-b border-slate-800">
                <button 
                    onClick={() => { setAuthMode('LOGIN'); setAuthMessage(null); }}
                    className={`flex-1 py-4 text-sm font-bold transition-colors relative
                        ${authMode === 'LOGIN' ? 'text-white bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}
                    `}
                >
                    Entrar
                    {authMode === 'LOGIN' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></div>}
                </button>
                <button 
                    onClick={() => { setAuthMode('REGISTER'); setAuthMessage(null); }}
                    className={`flex-1 py-4 text-sm font-bold transition-colors relative
                        ${authMode === 'REGISTER' ? 'text-white bg-slate-800/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'}
                    `}
                >
                    Criar Conta
                    {authMode === 'REGISTER' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></div>}
                </button>
            </div>

            <div className="p-6">
                {/* Feedback Messages */}
                {authMessage && (
                    <div className={`mb-6 p-3 rounded-lg text-xs font-bold flex items-start gap-2 ${authMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        {authMessage.text}
                    </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {authMode === 'REGISTER' && (
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors">
                                <User size={18} />
                            </div>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="Seu Nome"
                                required
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                            />
                        </div>
                    )}

                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors">
                            <Mail size={18} />
                        </div>
                        <input 
                            type="email" 
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            placeholder="seu@email.com"
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                        />
                    </div>

                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors">
                            <Key size={18} />
                        </div>
                        <input 
                            type="password" 
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            placeholder="Senha"
                            required
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all transform active:scale-95 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 mt-2"
                    >
                        {authLoading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                {authMode === 'LOGIN' ? 'Entrar' : 'Cadastrar'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            </div>
          </div>

          {/* Admin / Footer */}
          <div className="mt-8 text-center">
             <button
               onClick={() => {
                   setAuthMode('LOGIN'); 
                   setFormData({ name: 'Admin', email: 'rafaelvollpilates@gmail.com', password: '123456' });
               }}
               className="text-[10px] text-slate-700 hover:text-emerald-600 transition-colors uppercase tracking-widest font-bold flex items-center justify-center gap-1 mx-auto opacity-50 hover:opacity-100"
             >
               <Lock size={10} /> Developer Access
             </button>
          </div>

        </div>
      </div>
    );
  }

  // --- RENDER: MAIN APP ---
  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${themeClass}`}>
      <header className={`relative ${isDark ? 'bg-slate-900 border-b border-slate-800 text-white' : 'bg-white border-b border-slate-200 text-slate-900'} sticky top-0 z-50 transition-colors duration-700`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('DASHBOARD')}>
            <div className="relative">
                <BrainCircuit className="text-emerald-600 group-hover:scale-110 transition-transform" />
            </div>
            <span className="font-serif font-bold text-xl tracking-tight flex items-baseline">
              VerboVivo
              <span className="ml-0.5 text-[10px] font-sans font-black tracking-tight flex items-center -translate-y-1 opacity-90">
                  <span className="text-emerald-600">I</span>
                  <span className="text-red-600">T</span>
              </span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* --- CLOUD SYNC INDICATOR --- */}
            <div className="hidden sm:flex items-center gap-2 px-2" title={saveStatus === 'ERROR' ? "Erro ao salvar. Verifique se as tabelas foram criadas no Supabase." : "Status da Nuvem"}>
                {saveStatus === 'SAVING' && <RefreshCcw size={16} className="text-amber-500 animate-spin" />}
                {saveStatus === 'SUCCESS' && <CheckCircle size={16} className="text-emerald-500" />}
                {saveStatus === 'ERROR' && <CloudOff size={16} className="text-red-500 animate-pulse" />}
                {saveStatus === 'IDLE' && <Cloud size={16} className="text-slate-400 opacity-50" />}
            </div>

            {role === UserRole.STUDENT && (
               <button 
                onClick={() => setView(view === 'DASHBOARD' ? 'SESSION' : 'DASHBOARD')}
                className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors 
                    ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}
                `}
              >
                {view === 'DASHBOARD' ? <Activity size={16}/> : <LayoutDashboard size={16}/>}
                {view === 'DASHBOARD' ? 'Aprender Verbos' : 'Dashboard'}
              </button>
            )}
            
            <div className={`flex items-center gap-3 pl-4 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium flex items-center gap-1 justify-end">
                    {userName} {role === UserRole.ADMIN && <ShieldAlert size={12} className="text-red-500"/>}
                </div>
                <div className="text-xs opacity-60">{session.user.email}</div>
              </div>
              <button onClick={handleLogout} className="opacity-60 hover:opacity-100 hover:text-red-500 transition-all" title="Sair">
                <LogIn size={20} className="rotate-180" />
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-600 via-slate-100 to-red-600 opacity-80"></div>
      </header>

      <main className="flex-1 overflow-hidden">
        {role === UserRole.ADMIN ? (
          <AdminDashboard 
            storeCatalog={storeCatalog} 
            onUpdateCatalog={setStoreCatalog} 
            onBroadcastNotification={(n) => handleUpdateBrain({...brain, notifications: [...(brain.notifications || []), n]})}
            config={gameConfig}
            onUpdateConfig={handleUpdateConfig}
          />
        ) : (
          <>
            {view === 'DASHBOARD' && (
               <StudentDashboard 
                  userName={userName} 
                  onStartTraining={() => setView('SESSION')} 
                  onStartBoss={() => setView('BOSS_FIGHT')}
                  onStartStory={() => setView('STORY_MODE')}
                  onStartMilestone={startMilestone}
                  onOpenMercato={() => setView('MERCATO')}
                  onStartDetective={() => setView('DETECTIVE')}
                  brain={brain}
                  catalog={storeCatalog} 
                  config={gameConfig}
               />
            )}
            {view === 'MERCATO' && (
               <IlMercato 
                  onExit={() => setView('DASHBOARD')} 
                  brain={brain} 
                  onUpdateBrain={handleUpdateBrain} 
                  catalog={storeCatalog} 
                  config={gameConfig}
               />
            )}
            {view === 'SESSION' && (
               <ExerciseSession 
                  onExit={() => setView('DASHBOARD')} 
                  brain={brain} 
                  onUpdateBrain={handleUpdateBrain} 
                  config={gameConfig}
               />
            )}
            {view === 'BOSS_FIGHT' && (
               <BossFightSession 
                  onExit={() => setView('DASHBOARD')} 
                  brain={brain} 
                  onUpdateBrain={handleUpdateBrain} 
                  config={gameConfig}
               />
            )}
            {view === 'STORY_MODE' && (
               <StoryModeSession 
                  onExit={() => setView('DASHBOARD')} 
                  brain={brain} 
                  onUpdateBrain={handleUpdateBrain} 
                  config={gameConfig}
               />
            )}
            {view === 'MILESTONE' && (
               <MilestoneSession 
                  onExit={() => setView('DASHBOARD')} 
                  brain={brain} 
                  onUpdateBrain={handleUpdateBrain} 
                  targetTier={activeMilestoneTier}
                  config={gameConfig}
               />
            )}
            {view === 'DETECTIVE' && (
               <DetectiveSession
                  onExit={() => setView('DASHBOARD')} 
                  brain={brain} 
                  onUpdateBrain={handleUpdateBrain} 
                  config={gameConfig}
               />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
