
import React, { useState, useEffect } from 'react';
import { UserRole, UserBrain, StoreItem, Notification } from './types';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import ExerciseSession from './components/ExerciseSession';
import BossFightSession from './components/BossFightSession';
import StoryModeSession from './components/StoryModeSession'; 
import MilestoneSession from './components/MilestoneSession';
import IlMercato from './components/IlMercato';
import { LogIn, Activity, LayoutDashboard, BrainCircuit, UserPlus, ShieldAlert, ArrowRight, RefreshCw, Eye, EyeOff, Lock, Mail, User as UserIcon } from 'lucide-react';
import { STORE_CATALOG } from './data/storeItems';
import { loadUserProgress, saveUserProgress } from './services/supabaseClient';

const ADMIN_EMAIL = "rafaelvollpilates@gmail.com";
const ADMIN_PASS = "123456";

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [brain, setBrain] = useState<UserBrain>(INITIAL_BRAIN);
  const [storeCatalog, setStoreCatalog] = useState<StoreItem[]>(STORE_CATALOG);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('REGISTER');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);

  // AUTO-SAVE: Sempre que o cérebro mudar, salva no Supabase
  useEffect(() => {
    if (userEmail && role === UserRole.STUDENT) {
      saveUserProgress(userEmail, brain);
    }
  }, [brain, userEmail, role]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = formData.email.toLowerCase().trim();
    const password = formData.password;
    setIsSyncing(true);

    // Lógica God Mode (Admin)
    if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASS) {
      setUserEmail(email);
      setUserName('Rafael God');
      setRole(UserRole.ADMIN);
      setIsSyncing(false);
      return;
    }

    if (authMode === 'LOGIN') {
      try {
        const existingProgress = await loadUserProgress(email);
        if (existingProgress) {
          setBrain(existingProgress);
          setUserEmail(email);
          setUserName(existingProgress.userName || email.split('@')[0]);
          setRole(UserRole.STUDENT);
        } else {
          setError("Usuário não encontrado. Verifique o e-mail ou crie uma conta.");
        }
      } catch (err) {
        setError("Falha na conexão. Tente novamente.");
      }
    } else {
      // REGISTER
      if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        setIsSyncing(false);
        return;
      }
      
      const existing = await loadUserProgress(email);
      if (existing) {
        setError("E-mail já cadastrado. Tente fazer login.");
      } else {
        const newBrain = { ...INITIAL_BRAIN };
        setBrain(newBrain);
        setUserEmail(email);
        setUserName(formData.name || email.split('@')[0]);
        setRole(UserRole.STUDENT);
      }
    }
    setIsSyncing(false);
  };

  const getThemeClass = () => {
      if (!brain.activeTheme || brain.activeTheme === 'default') return 'bg-slate-50 text-slate-900';
      const themeItem = storeCatalog.find(i => i.id === brain.activeTheme);
      return themeItem?.themeSkin || 'bg-slate-50 text-slate-900';
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 overflow-hidden relative">
        {/* Background Decorative Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>

        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500 relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-slate-900/50 rounded-3xl border border-slate-700/50 backdrop-blur-xl mb-4 shadow-2xl">
              <BrainCircuit size={48} className="text-emerald-400" />
            </div>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">VerboVivo</h1>
            <p className="text-emerald-400/60 text-xs font-bold uppercase tracking-[0.3em] mt-2">Neuroplasticidade</p>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="flex bg-slate-950/50 p-1 rounded-2xl mb-8 border border-white/5">
               <button 
                 onClick={() => setAuthMode('REGISTER')} 
                 className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMode === 'REGISTER' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
               >
                 Registrati
               </button>
               <button 
                 onClick={() => setAuthMode('LOGIN')} 
                 className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMode === 'LOGIN' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
               >
                 Accedi
               </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-5">
              {authMode === 'REGISTER' && (
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                  <input 
                    name="name" type="text" required
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="Nome Completo" 
                    className="w-full bg-slate-950/50 text-white pl-12 pr-4 py-4 rounded-2xl border border-white/5 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all" 
                  />
                </div>
              )}
              
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input 
                  name="email" type="email" required 
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  placeholder="E-mail" 
                  className="w-full bg-slate-950/50 text-white pl-12 pr-4 py-4 rounded-2xl border border-white/5 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all" 
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={20} />
                <input 
                  name="password" type={showPassword ? 'text' : 'password'} required 
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  placeholder="Senha" 
                  className="w-full bg-slate-950/50 text-white pl-12 pr-12 py-4 rounded-2xl border border-white/5 outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2 animate-shake">
                  <ShieldAlert size={16} /> {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSyncing} 
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 group active:scale-[0.98]"
              >
                {isSyncing ? <RefreshCw className="animate-spin" /> : (
                  <>
                    {authMode === 'REGISTER' ? 'Crea il tuo profilo' : 'Entra in VerboVivo'}
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
            
            <p className="text-center text-slate-500 text-[10px] mt-8 uppercase tracking-widest font-medium">
              Orgogliosamente Italiano 🇮🇹
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${getThemeClass()}`}>
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView('DASHBOARD')}>
            <div className="p-2 bg-slate-900 rounded-xl group-hover:scale-110 transition-transform">
               <BrainCircuit className="text-emerald-400" size={20} />
            </div>
            <span className="font-serif font-bold text-xl text-slate-900">VerboVivo</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{role === UserRole.ADMIN ? 'God Mode' : 'Studente'}</span>
              <span className="text-sm font-bold text-slate-900">{userName}</span>
            </div>
            <button onClick={() => { setUserEmail(null); setRole(null); }} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
              <LogIn size={20} className="rotate-180" />
            </button>
          </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {role === UserRole.ADMIN ? (
          <AdminDashboard storeCatalog={storeCatalog} onUpdateCatalog={setStoreCatalog} />
        ) : (
          <>
            {view === 'DASHBOARD' && <StudentDashboard userName={userName} onStartTraining={() => setView('SESSION')} onStartBoss={() => setView('BOSS_FIGHT')} onStartStory={() => setView('STORY_MODE')} onStartMilestone={(t) => setView('MILESTONE')} onOpenMercato={() => setView('MERCATO')} brain={brain} catalog={storeCatalog} />}
            {view === 'MERCATO' && <IlMercato onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} catalog={storeCatalog} />}
            {view === 'SESSION' && <ExerciseSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} />}
            {view === 'BOSS_FIGHT' && <BossFightSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} />}
            {view === 'STORY_MODE' && <StoryModeSession onExit={() => setView('DASHBOARD')} brain={brain} onUpdateBrain={setBrain} />}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
