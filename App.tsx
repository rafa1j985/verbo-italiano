
import React, { useState, useEffect } from 'react';
import { UserRole, UserBrain, StoreItem, Notification } from './types';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';
import ExerciseSession from './components/ExerciseSession';
import BossFightSession from './components/BossFightSession';
import StoryModeSession from './components/StoryModeSession'; 
import MilestoneSession from './components/MilestoneSession';
import IlMercato from './components/IlMercato';
import { LogIn, Activity, LayoutDashboard, BrainCircuit, UserPlus, ShieldAlert, ArrowRight, RefreshCw } from 'lucide-react';
import { STORE_CATALOG } from './data/storeItems';
import { loadUserProgress, saveUserProgress } from './services/supabaseClient';

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [brain, setBrain] = useState<UserBrain>(INITIAL_BRAIN);
  const [storeCatalog, setStoreCatalog] = useState<StoreItem[]>(STORE_CATALOG);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'ADMIN'>('REGISTER');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });

  // AUTO-SAVE: Sempre que o cérebro mudar, salva no Supabase
  useEffect(() => {
    if (userEmail && role === UserRole.STUDENT) {
      saveUserProgress(userEmail, brain);
    }
  }, [brain, userEmail, role]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = formData.email.toLowerCase().trim();
    setIsSyncing(true);

    if (authMode === 'ADMIN') {
      if (email === ADMIN_EMAIL.toLowerCase()) {
        setUserEmail(email);
        setUserName('Admin');
        setRole(UserRole.ADMIN);
      } else {
        alert("Acesso negado.");
      }
    } else {
      // Tenta carregar progresso existente
      const existingProgress = await loadUserProgress(email);
      if (existingProgress) {
        setBrain(existingProgress);
      } else {
        setBrain(INITIAL_BRAIN);
      }
      setUserEmail(email);
      setUserName(formData.name || email.split('@')[0]);
      setRole(UserRole.STUDENT);
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
          <div className="flex flex-col items-center mb-8">
            <BrainCircuit size={48} className="text-emerald-400 mb-4" />
            <h1 className="text-3xl font-serif text-white">VerboVivo</h1>
            <p className="text-slate-400 text-sm uppercase tracking-widest mt-2">
              {isSyncing ? 'Sincronizando...' : 'Automação Cognitiva'}
            </p>
          </div>
          
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode !== 'ADMIN' && (
              <input name="name" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Seu Nome" className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600 outline-none" />
            )}
            <input name="email" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Seu E-mail" className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600 outline-none" />
            <button type="submit" disabled={isSyncing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
              {isSyncing ? <RefreshCw className="animate-spin"/> : <LogIn size={20}/>}
              {authMode === 'REGISTER' ? 'Começar Jornada' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
             <button onClick={() => setAuthMode(authMode === 'REGISTER' ? 'LOGIN' : 'REGISTER')} className="text-slate-400 text-sm underline">
               {authMode === 'REGISTER' ? 'Já tenho conta' : 'Novo por aqui? Criar conta'}
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-700 ${getThemeClass()}`}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('DASHBOARD')}>
            <BrainCircuit className="text-emerald-600" />
            <span className="font-serif font-bold text-xl">VerboVivo</span>
          </div>
          <button onClick={() => setUserEmail(null)} className="text-slate-400 hover:text-red-500"><LogIn size={20} className="rotate-180" /></button>
      </header>

      <main className="flex-1 overflow-hidden">
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
