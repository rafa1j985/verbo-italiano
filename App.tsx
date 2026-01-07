
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
import IlMercato from './components/IlMercato';
import { LogIn, Activity, LayoutDashboard, BrainCircuit, UserPlus, ShieldAlert, Loader2, Lock } from 'lucide-react';
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
  notifications: []
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

const App: React.FC = () => {
  // Session State
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  
  // App State
  const [userName, setUserName] = useState<string>('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'SESSION' | 'BOSS_FIGHT' | 'STORY_MODE' | 'MILESTONE' | 'MERCATO'>('DASHBOARD');
  const [activeMilestoneTier, setActiveMilestoneTier] = useState<number>(0);
  
  // PERSISTENT BRAIN STATE - Initialize with factory function
  const [brain, setBrain] = useState<UserBrain>(getInitialBrain());
  const [storeCatalog, setStoreCatalog] = useState<StoreItem[]>(STORE_CATALOG);
  const [gameConfig, setGameConfig] = useState<GlobalGameConfig>(DEFAULT_GAME_CONFIG);

  // Auth Form
  const [authMode, setAuthMode] = useState<AuthMode>('REGISTER');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

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
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- DATA LOADING ---
  const loadUserData = async (userId: string) => {
      setDataLoading(true);
      
      // 1. Load Profile (Role, Name)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) {
          setUserName(profile.full_name || 'Estudante');
          setRole(profile.role === 'ADMIN' ? UserRole.ADMIN : UserRole.STUDENT);
      } else {
          // If profile doesn't exist yet (latency), default to student
          setRole(UserRole.STUDENT);
      }

      // 2. Load Brain (Progress)
      const savedBrain = await loadUserProgress(userId);
      if (savedBrain) {
          // Merge with initial to ensure new structure fields exist
          // We spread getInitialBrain() first to ensure we have the base structure, then overwrite with saved data
          setBrain({ ...getInitialBrain(), ...savedBrain });
      } else {
          setBrain(getInitialBrain()); // Ensure clean slate if new user
      }

      // 3. Load Global Config (Only 1 round trip)
      const savedConfig = await getGlobalConfig();
      if (savedConfig) {
          setGameConfig(savedConfig);
      }

      setDataLoading(false);
  };

  // --- BRAIN UPDATE WRAPPER ---
  const handleUpdateBrain = (newBrain: UserBrain) => {
      setBrain(newBrain);
      if (session?.user?.id) {
          // Auto-save to Supabase
          saveUserProgress(session.user.id, newBrain);
      }
  };

  const handleUpdateConfig = (newConfig: GlobalGameConfig) => {
      setGameConfig(newConfig);
      saveGlobalConfig(newConfig);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

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
            
            // If email confirmation is disabled in Supabase, session is created immediately.
            // If enabled, session is null.
            if (!data.session) {
                alert("Cadastro realizado! Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada.");
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
            alert("Erro: Credenciais inválidas. Se este é seu primeiro acesso com este e-mail, certifique-se de criar a conta primeiro na aba 'Criar Cadastro'.");
        } else {
            alert(error.message || "Erro na autenticação");
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
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
              <Loader2 className="animate-spin text-emerald-500" size={48} />
              <p className="animate-pulse font-serif">Sincronizando banco de dados neural...</p>
          </div>
      );
  }

  // --- RENDER: AUTH SCREEN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
          
          <div className="flex flex-col items-center mb-8">
            <div className="bg-slate-700/50 p-4 rounded-full mb-4 relative group">
               <BrainCircuit size={48} className="text-emerald-400 relative z-10" />
               <div className="absolute -inset-2 bg-gradient-to-tr from-green-500/20 via-white/5 to-red-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
            </div>
            
            <h1 className="text-3xl font-serif text-white text-center mb-1 flex items-baseline justify-center">
                VerboVivo
                <span className="ml-1 text-xs font-sans font-black tracking-widest flex items-center opacity-80">
                    <span className="text-emerald-500">I</span>
                    <span className="text-red-500">T</span>
                </span>
            </h1>
            
            <div className="h-1 w-12 bg-gradient-to-r from-emerald-500 via-white to-red-500 rounded-full mt-2 opacity-80"></div>
            <p className="text-slate-400 text-center text-sm uppercase tracking-widest font-medium mt-2">
              Automação Cognitiva
            </p>
          </div>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            
            {/* NAME FIELD: ONLY SHOWN IF REGISTERING */}
            {authMode === 'REGISTER' && (
              <div className="space-y-1 animate-in slide-in-from-top-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Como quer ser chamado?"
                  required
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="seu@email.com"
                required
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
              <input 
                type="password" 
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                placeholder="••••••••"
                required
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none transition"
              />
            </div>

            <button 
              type="submit"
              disabled={authLoading}
              className={`w-full font-bold py-3.5 rounded-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-2
                ${authMode === 'REGISTER' 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                }`}
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (
                 authMode === 'REGISTER' ? <><UserPlus size={20} /> Criar Conta</> : <><LogIn size={20} /> Entrar</>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3">
             <button 
               onClick={() => {
                 setAuthMode(authMode === 'REGISTER' ? 'LOGIN' : 'REGISTER');
                 setFormData({ name: '', email: '', password: '' }); // Clear form on toggle
               }}
               className="text-slate-400 text-sm hover:text-white transition-colors"
             >
               {authMode === 'REGISTER' ? 'Já tem uma conta? ' : 'Novo por aqui? '}
               <span className="text-emerald-400 font-bold underline decoration-emerald-500/30 underline-offset-4">
                 {authMode === 'REGISTER' ? 'Fazer Login' : 'Criar Cadastro'}
               </span>
             </button>

             {/* ADMIN SHORTCUT LINK */}
             <button
               onClick={() => {
                   setAuthMode('REGISTER'); // Default to Register to solve "User not found" issue
                   setFormData({ name: 'Admin', email: 'rafaelvollpilates@gmail.com', password: '123456' });
                   alert("Atenção: Se for o primeiro acesso, certifique-se de estar na aba 'CRIAR CADASTRO' para registrar o admin.");
               }}
               className="text-[10px] text-slate-600 hover:text-emerald-500 transition-colors mt-4 uppercase tracking-widest opacity-50 hover:opacity-100 flex items-center gap-1"
             >
               <Lock size={10} /> Acesso Administrativo
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
          </>
        )}
      </main>
    </div>
  );
};

export default App;
