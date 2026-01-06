import React, { useState, useEffect } from 'react';
import { UserRole, UserBrain, StoreItem, Notification } from './types';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import ExerciseSession from './components/ExerciseSession';
import BossFightSession from './components/BossFightSession';
import StoryModeSession from './components/StoryModeSession'; 
import MilestoneSession from './components/MilestoneSession';
import IlMercato from './components/IlMercato';
import { LogIn, Activity, LayoutDashboard, BrainCircuit, UserPlus, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { STORE_CATALOG } from './data/storeItems';
import { loadUserProgress, saveUserProgress } from './services/supabaseService';

const ADMIN_EMAIL = "rafaelvollpilates@gmail.com";

const INITIAL_BRAIN: UserBrain = {
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
};

const App: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'SESSION' | 'BOSS_FIGHT' | 'STORY_MODE' | 'MILESTONE' | 'MERCATO'>('DASHBOARD');
  const [activeMilestoneTier, setActiveMilestoneTier] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const [brain, setBrain] = useState<UserBrain>(INITIAL_BRAIN);
  const [storeCatalog, setStoreCatalog] = useState<StoreItem[]>(STORE_CATALOG);

  // Persistence Sync
  useEffect(() => {
    if (userEmail && role === UserRole.STUDENT) {
      saveUserProgress(userEmail, brain);
    }
  }, [brain, userEmail, role]);

  const getThemeClass = () => {
      if (!brain.activeTheme || brain.activeTheme === 'default') return 'bg-slate-50 text-slate-900';
      const themeItem = storeCatalog.find(i => i.id === brain.activeTheme);
      return themeItem?.themeSkin || 'bg-slate-50 text-slate-900';
  };

  const themeClass = getThemeClass();
  const isDark = themeClass.includes('slate-900');

  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'ADMIN'>('REGISTER');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (authMode === 'ADMIN') {
      if (formData.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setUserEmail(formData.email);
        setUserName('Admin');
        setRole(UserRole.ADMIN);
      } else {
        alert("Acesso negado.");
      }
    } else {
      if (formData.email) {
        const savedBrain = await loadUserProgress(formData.email);
        if (savedBrain) {
          setBrain(savedBrain);
        }
        setUserEmail(formData.email);
        setUserName(formData.name || formData.email.split('@')[0]);
        setRole(UserRole.STUDENT);
      }
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    setUserEmail(null);
    setUserName('');
    setRole(null);
    setView('DASHBOARD');
    setAuthMode('REGISTER');
    setBrain(INITIAL_BRAIN);
    setFormData({ name: '', email: '', password: '' });
  };

  const startMilestone = (tier: number) => {
      setActiveMilestoneTier(tier);
      setView('MILESTONE');
  };

  const handleBroadcast = (notif: Notification) => {
      setBrain(prev => ({
          ...prev,
          notifications: [...(prev.notifications || []), notif]
      }));
  };

  if (!userEmail) {
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
              {authMode === 'ADMIN' ? 'Painel Administrativo' : 'Automação Cognitiva'}
            </p>
          </div>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode !== 'ADMIN' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nome</label>
                <input type="text" name="name" required={authMode === 'REGISTER'} value={formData.name} onChange={handleInputChange} placeholder="Seu nome" className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none transition"/>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
              <input type="email" name="email" required value={formData.email} onChange={handleInputChange} placeholder="seu@email.com" className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none transition"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
              <input type="password" name="password" required value={formData.password} onChange={handleInputChange} placeholder="••••••••" className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 outline-none transition"/>
            </div>
            <button disabled={isLoading} type="submit" className={`w-full font-bold py-3.5 rounded-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-2 ${authMode === 'ADMIN' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
              {isLoading ? <Loader2 className="animate-spin" /> : (authMode === 'REGISTER' ? <><UserPlus size={20} /> Criar Conta</> : <><LogIn size={20} /> Entrar</>)}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3">
             {authMode !== 'ADMIN' && (
               <button onClick={() => setAuthMode(authMode === 'REGISTER' ? 'LOGIN' : 'REGISTER')} className="text-slate-400 text-sm hover:text-white transition-colors">
                 {authMode === 'REGISTER' ? 'Já tem uma conta? ' : 'Novo por aqui? '}
                 <span className="text-emerald-400 font-bold underline">
                   {authMode === 'REGISTER' ? 'Fazer Login' : 'Criar Cadastro'}
                 </span>
               </button>
             )}
          </div>
          {authMode !== 'ADMIN' && (
            <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
               <button onClick={() => setAuthMode('ADMIN')} className="text-[10px] uppercase tracking-widest text-slate-600 hover:text-red-400 transition-colors font-bold">Acesso Administrativo</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${themeClass}`}>
      <header className={`relative ${isDark ? 'bg-slate-900 border-b border-slate-800 text-white' : 'bg-white border-b border-slate-200 text-slate-900'} sticky top-0 z-50 transition-colors duration-700`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('DASHBOARD')}>
            <BrainCircuit className="text-emerald-600 group-hover:scale-110 transition-transform" />
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
               <button onClick={() => setView(view === 'DASHBOARD' ? 'SESSION' : 'DASHBOARD')} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                {view === 'DASHBOARD' ? <Activity size={16}/> : <LayoutDashboard size={16}/>}
                {view === 'DASHBOARD' ? 'Aprender Verbos' : 'Dashboard'}
              </button>
            )}
            <div className={`flex items-center gap-3 pl-4 border-l ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium">{role === UserRole.ADMIN ? 'Admin Master' : userName}</div>
                <div className="text-xs opacity-60">{userEmail}</div>
              </div>
              <button onClick={handleLogout} className="opacity-60 hover:opacity-100 hover:text-red-500 transition-all"><LogIn size={20} className="rotate-180" /></button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-600 via-slate-100 to-red-600 opacity-80"></div>
      </header>

      <main className="flex-1 overflow-hidden">
        {role === UserRole.ADMIN ? (
          <AdminDashboard storeCatalog={storeCatalog} onUpdateCatalog={setStoreCatalog} onBroadcastNotification={handleBroadcast} />
        ) : (
          <>
            {view === 'DASHBOARD' && (
               <StudentDashboard userName={userName} onStartTraining={() => setView('SESSION')} onStartBoss={() => setView('BOSS_FIGHT')} onStartStory={() => setView('STORY_MODE')} onStartMilestone={startMilestone} onOpenMercato={() => setView('MERCATO')} brain={brain} catalog={storeCatalog} />
            )}
            {view === 'MERCATO' && (
               <IlMercato onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} catalog={storeCatalog} />
            )}
            {view === 'SESSION' && (
               <ExerciseSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} />
            )}
            {view === 'BOSS_FIGHT' && (
               <BossFightSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} />
            )}
            {view === 'STORY_MODE' && (
               <StoryModeSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} />
            )}
            {view === 'MILESTONE' && (
               <MilestoneSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} targetTier={activeMilestoneTier} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;