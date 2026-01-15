
import React, { useState, useEffect } from 'react';
import { generateStoreItemIdea, generateEmoji } from '../services/geminiService';
import { getAllUsersAdmin } from '../services/supabaseService';
import { supabase } from '../services/supabaseClient';
import { Exercise, StoreItem, Notification, GlobalGameConfig, UsageStats } from '../types';
import { VERB_DATABASE } from '../data/verbs'; 
import { Users, Database, PlusCircle, RefreshCw, BarChart2, Shield, ShoppingBag, Sparkles, Trash2, Edit2, ToggleLeft, ToggleRight, Tag, Save, X, Bell, Settings, Percent, Coins, Gamepad2, Lock, Search, Filter, Book, Clock, Terminal, Copy, Check, UserPlus, DollarSign, Activity, Image, Zap, Key, Mic, Target, Signal, AlertTriangle, Skull, Trophy, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface AdminDashboardProps {
    storeCatalog?: StoreItem[];
    onUpdateCatalog?: (newCatalog: StoreItem[]) => void;
    onBroadcastNotification?: (notification: Notification) => void;
    config?: GlobalGameConfig;
    onUpdateConfig?: (newConfig: GlobalGameConfig) => void;
}

// --- CONFIGURATION DICTIONARY FOR UI ---
const CONFIG_DEFINITIONS: any = {
    economy: {
        xpPresentation: { label: "Leitura de Aula", desc: "XP ganho ao ler a teoria inicial.", icon: <Book size={18}/>, color: "bg-blue-100 text-blue-600" },
        xpDrill: { label: "Drill (Fixação)", desc: "XP por completar o preenchimento de lacunas.", icon: <Target size={18}/>, color: "bg-emerald-100 text-emerald-600" },
        xpPractice: { label: "Frase Prática", desc: "XP por cada frase escrita corretamente.", icon: <Edit2 size={18}/>, color: "bg-purple-100 text-purple-600" },
        xpVoiceBonus: { label: "Bônus de Voz", desc: "Extra por ler em voz alta.", icon: <Mic size={18}/>, color: "bg-amber-100 text-amber-600" },
        xpPerfectRun: { label: "Perfect Run", desc: "Bônus por zero erros na sessão.", icon: <Sparkles size={18}/>, color: "bg-yellow-100 text-yellow-600" },
        xpGameFlashcard: { label: "Flashcards", desc: "XP por vitória no jogo de memória.", icon: <Zap size={18}/>, color: "bg-indigo-100 text-indigo-600" },
        xpGameStandard: { label: "Jogos Padrão", desc: "XP por vitória em jogos de lógica.", icon: <Gamepad2 size={18}/>, color: "bg-pink-100 text-pink-600" },
        xpMaxPerSession: { label: "Teto por Sessão", desc: "Limite máximo de XP ganho de uma vez.", icon: <Lock size={18}/>, color: "bg-slate-100 text-slate-600" },
    },
    rules: {
        drillMaskA1: { label: "Dificuldade A1", desc: "Lacunas ocultas no nível básico (0-6).", icon: <Signal size={18}/>, color: "bg-green-100 text-green-600" },
        drillMaskA2: { label: "Dificuldade A2", desc: "Lacunas ocultas no nível A2.", icon: <Signal size={18}/>, color: "bg-teal-100 text-teal-600" },
        drillMaskB1: { label: "Dificuldade B1", desc: "Lacunas ocultas no nível B1.", icon: <Signal size={18}/>, color: "bg-orange-100 text-orange-600" },
        drillMaskHigh: { label: "Dificuldade B2/C1", desc: "Lacunas ocultas nos níveis avançados.", icon: <Signal size={18}/>, color: "bg-red-100 text-red-600" },
        
        storyUnlockCount: { label: "Ritmo da História", desc: "Verbos necessários para liberar capítulo.", icon: <Book size={18}/>, color: "bg-purple-100 text-purple-600" },
        
        bossUnlockXP: { label: "Invocação do Boss", desc: "XP necessário para liberar a luta.", icon: <Skull size={18}/>, color: "bg-slate-800 text-red-500" },
        bossCooldownHours: { label: "Recarga do Boss", desc: "Horas de espera após uma luta.", icon: <Clock size={18}/>, color: "bg-slate-200 text-slate-600" },
        bossPassScore: { label: "Critério de Vitória", desc: "Pontos mínimos para vencer o Boss.", icon: <Trophy size={18}/>, color: "bg-yellow-100 text-yellow-600" },
        
        milestoneInterval: { label: "Intervalo de Medalha", desc: "A cada X verbos ganha-se medalha.", icon: <Award size={18}/>, color: "bg-amber-100 text-amber-600" },
        milestonePassScore: { label: "Aprovação Medalha", desc: "Acertos necessários (x/10).", icon: <Check size={18}/>, color: "bg-emerald-100 text-emerald-600" },
        
        voiceThreshold: { label: "Sensibilidade Mic", desc: "Volume mínimo para detectar voz.", icon: <Mic size={18}/>, color: "bg-blue-100 text-blue-600" },
    },
    probabilities: {
        spiralLearningChance: { label: "Chance de Espiral", desc: "Probabilidade de rever verbos antigos.", icon: <RefreshCw size={18}/>, color: "bg-cyan-100 text-cyan-600", type: "percent" },
        spiralTriggerProgress: { label: "Gatilho Espiral", desc: "% do nível concluído para iniciar revisão.", icon: <Activity size={18}/>, color: "bg-rose-100 text-rose-600", type: "percent_int" }
    }
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ storeCatalog = [], onUpdateCatalog, onBroadcastNotification, config, onUpdateConfig }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CONTENT' | 'USERS' | 'STORE' | 'GOD_MODE' | 'DATABASE' | 'COSTS'>('OVERVIEW');
  
  // Real Users State
  const [realUsers, setRealUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Store Management State
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promoId, setPromoId] = useState<string | null>(null);
  const [promoPercent, setPromoPercent] = useState<number>(20);

  // Content Management State
  const [contentSearch, setContentSearch] = useState('');
  const [contentFilterLevel, setContentFilterLevel] = useState<string>('ALL');

  // Form State
  const [itemForm, setItemForm] = useState<{name: string, description: string, price: string, type: string, asset: string, categoryInput: string}>({
      name: '', description: '', price: '1000', type: 'COLLECTIBLE', asset: '', categoryInput: ''
  });
  
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isEmojiGenerating, setIsEmojiGenerating] = useState(false);

  // God Mode State
  const [localConfig, setLocalConfig] = useState<GlobalGameConfig | null>(null);

  // Copy State
  const [copied, setCopied] = useState(false);
  const [copiedSync, setCopiedSync] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);

  // COST ESTIMATES (USD)
  const COST_PER_TEXT = 0.0005; // Gemini Flash aprox
  const COST_PER_AUDIO = 0.001; // TTS aprox
  const COST_PER_IMAGE = 0.040; // Imagen aprox

  useEffect(() => {
      if (config && !localConfig) {
          setLocalConfig(config);
      }
  }, [config]);

  // Load Users when tab changes to USERS or COSTS or OVERVIEW
  useEffect(() => {
      if (activeTab === 'USERS' || activeTab === 'COSTS' || activeTab === 'OVERVIEW') {
          fetchUsers();
      }
  }, [activeTab]);

  const fetchUsers = async () => {
      setUsersLoading(true);
      const data = await getAllUsersAdmin();
      setRealUsers(data);
      setUsersLoading(false);
  };

  const calculateTotalPlatformCost = () => {
    let totalText = 0;
    let totalAudio = 0;
    let totalImage = 0;

    realUsers.forEach(user => {
        const stats = user.brain?.usageStats || { textQueries: 0, audioPlays: 0, imageGenerations: 0 };
        totalText += (stats.textQueries || 0);
        totalAudio += (stats.audioPlays || 0);
        totalImage += (stats.imageGenerations || 0);
    });

    const costText = totalText * COST_PER_TEXT;
    const costAudio = totalAudio * COST_PER_AUDIO;
    const costImage = totalImage * COST_PER_IMAGE;

    return {
        grandTotal: costText + costAudio + costImage,
        details: { text: costText, audio: costAudio, image: costImage },
        counts: { text: totalText, audio: totalAudio, image: totalImage }
    };
  };

  const resetForm = () => {
      setItemForm({ name: '', description: '', price: '1000', type: 'COLLECTIBLE', asset: '', categoryInput: '' });
      setEditingId(null);
      setShowEditor(false);
  };

  // --- REPAIR FUNCTION ---
  const handleSyncMissingProgress = async () => {
      if (!confirm("Isso irá criar dados vazios para usuários que possuem perfil mas não possuem progresso. Continuar?")) return;
      
      setUsersLoading(true);
      try {
          const { data: profiles } = await supabase.from('profiles').select('id');
          if (!profiles) throw new Error("No profiles found");

          const { data: progress } = await supabase.from('user_progress').select('id');
          const progressIds = new Set(progress?.map(p => p.id) || []);

          const missing = profiles.filter(p => !progressIds.has(p.id));

          if (missing.length === 0) {
              alert("Todos os usuários verificados já possuem dados sincronizados.");
          } else {
              const updates = missing.map(p => ({
                  id: p.id,
                  brain_data: {}, 
                  updated_at: new Date().toISOString()
              }));

              const { error } = await supabase.from('user_progress').insert(updates);
              if (error) throw error;
              
              alert(`Sucesso! ${missing.length} usuários foram reparados.`);
              fetchUsers(); 
          }
      } catch (e: any) {
          alert("Erro ao sincronizar: " + e.message + "\n\nO erro RLS persiste? Vá na aba 'Database SQL', copie o código de 'Corrigir Permissões Admin' e rode no Supabase.");
      } finally {
          setUsersLoading(false);
      }
  };

  const handleAiGenerateItem = async () => {
      setIsAiGenerating(true);
      const category = itemForm.type === 'CUSTOM' ? itemForm.categoryInput : itemForm.type;
      const result = await generateStoreItemIdea(category, itemForm.price);
      if (result) {
          setItemForm(prev => ({
              ...prev,
              name: result.name,
              description: result.description,
              asset: result.emoji
          }));
      }
      setIsAiGenerating(false);
  };

  const handleAiGenerateEmoji = async () => {
      if (!itemForm.name && !itemForm.description) return alert("Preencha o nome ou descrição primeiro.");
      setIsEmojiGenerating(true);
      const emoji = await generateEmoji(`${itemForm.name} - ${itemForm.description}`);
      setItemForm(prev => ({ ...prev, asset: emoji }));
      setIsEmojiGenerating(false);
  };

  const handleSaveItem = () => {
      if (!onUpdateCatalog) return;
      const type = itemForm.type === 'CUSTOM' ? itemForm.categoryInput.toUpperCase() : itemForm.type;
      
      let updatedCatalog = [...storeCatalog];

      if (editingId) {
          updatedCatalog = updatedCatalog.map(i => i.id === editingId ? {
              ...i,
              name: itemForm.name,
              description: itemForm.description,
              price: parseInt(itemForm.price),
              type: type,
              asset: itemForm.asset
          } : i);
      } else {
          const newItem: StoreItem = {
              id: `item_${Date.now()}`,
              name: itemForm.name,
              description: itemForm.description,
              price: parseInt(itemForm.price),
              type: type,
              asset: itemForm.asset,
              isActive: true
          };
          updatedCatalog.push(newItem);
          
          if (onBroadcastNotification) {
              onBroadcastNotification({
                  id: `notif-${Date.now()}`,
                  title: "Nuovo Arrivo! 🛍️",
                  message: `Chegou "${newItem.name}" no Mercado!`,
                  type: 'NEW_ITEM',
                  timestamp: Date.now(),
                  read: false
              });
          }
      }

      onUpdateCatalog(updatedCatalog);
      resetForm();
  };

  const handleDeleteItem = (id: string) => {
      if (!onUpdateCatalog) return;
      if (confirm("Tem certeza que deseja excluir este item?")) {
          onUpdateCatalog(storeCatalog.filter(i => i.id !== id));
      }
  };

  const handleToggleActive = (id: string) => {
      if (!onUpdateCatalog) return;
      onUpdateCatalog(storeCatalog.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i));
  };

  const startEdit = (item: StoreItem) => {
      const isStandardType = ['THEME','POWERUP','FLAG','COLLECTIBLE','TITLE','CLOTHING','MEDAL'].includes(item.type);
      setItemForm({
          name: item.name,
          description: item.description,
          price: item.price.toString(),
          type: isStandardType ? item.type : 'CUSTOM',
          asset: item.asset || '',
          categoryInput: isStandardType ? '' : item.type
      });
      setEditingId(item.id);
      setShowEditor(true);
  };

  const handlePromoClick = (item: StoreItem) => {
      if (item.promotion && item.promotion.endsAt > Date.now()) {
          if (!onUpdateCatalog) return;
          onUpdateCatalog(storeCatalog.map(i => i.id === item.id ? { ...i, promotion: undefined } : i));
      } else {
          setPromoId(item.id);
          setPromoPercent(20); 
      }
  };

  const confirmPromo = () => {
      if (!onUpdateCatalog || !promoId) return;
      const item = storeCatalog.find(i => i.id === promoId);
      if (!item) return;

      const updated = storeCatalog.map(i => {
          if (i.id === promoId) {
              return {
                  ...i,
                  promotion: {
                      discountPercent: promoPercent,
                      endsAt: Date.now() + 24 * 60 * 60 * 1000 
                  }
              };
          }
          return i;
      });
      
      onUpdateCatalog(updated);
      
      if (onBroadcastNotification) {
          onBroadcastNotification({
              id: `notif-promo-${Date.now()}`,
              title: "Saldi Flash! ⚡",
              message: `${item.name} está com ${promoPercent}% OFF por 24h!`,
              type: 'PROMO',
              timestamp: Date.now(),
              read: false
          });
      }

      setPromoId(null);
  };

  const handleConfigChange = (section: keyof GlobalGameConfig, key: string, value: any) => {
      if (!localConfig) return;
      setLocalConfig({
          ...localConfig,
          [section]: {
              ...localConfig[section],
              [key]: value
          }
      });
  };

  const saveConfig = () => {
      if (onUpdateConfig && localConfig) {
          onUpdateConfig(localConfig);
          alert("Configurações do sistema atualizadas com sucesso!");
      }
  };

  const handleCopySQL = () => {
      const sql = `-- --- LIMPEZA TOTAL + PERMISSÕES ---
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.user_progress CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.global_config CASCADE;

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'STUDENT',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.user_progress (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  brain_data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.global_config (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  config_data JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- IMPORTANT: Admin Permission for ALL operations (Insert/Update/Select)
CREATE POLICY "Admins manage all progress" ON public.user_progress
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Users manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = id);

CREATE POLICY "Read config" ON public.global_config FOR SELECT USING (true);
CREATE POLICY "Admin update config" ON public.global_config
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'STUDENT');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`;
      navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFixSQL = () => {
      const sql = `-- CORRIGIR PERMISSÃO ADMIN (INSERT/UPDATE para outros usuários)
DROP POLICY IF EXISTS "Admins see all progress" ON public.user_progress;
DROP POLICY IF EXISTS "Admins manage all progress" ON public.user_progress;

-- Esta política permite que ADMINS façam INSERT/UPDATE/DELETE/SELECT em QUALQUER linha
CREATE POLICY "Admins manage all progress" ON public.user_progress 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);`
      navigator.clipboard.writeText(sql);
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 2000);
  }

  const handleCopySyncSQL = () => {
      const sql = `-- SINCRONIZAR USUÁRIOS FANTASMAS (Auth -> Profiles)
INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), 'STUDENT'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Garantir que todos tenham entrada na tabela de progresso
INSERT INTO public.user_progress (id, brain_data)
SELECT id, '{}'::jsonb
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_progress);`
      navigator.clipboard.writeText(sql);
      setCopiedSync(true);
      setTimeout(() => setCopiedSync(false), 2000);
  };

  // --- RENDER COMPONENT FOR CONFIG ITEM ---
  const renderConfigInput = (section: keyof GlobalGameConfig, key: string, value: any) => {
      const def = CONFIG_DEFINITIONS[section]?.[key];
      // Skip items that are not in our definition map (keeps UI clean from internal junk)
      if (!def) return null;

      const isPercentage = def.type === 'percent' || def.type === 'percent_int';

      return (
          <div key={key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${def.color || 'bg-slate-100 text-slate-600'}`}>
                      {def.icon || <Settings size={18}/>}
                  </div>
                  <div>
                      <h4 className="font-bold text-slate-800 text-sm">{def.label}</h4>
                      <p className="text-xs text-slate-500 max-w-[200px] leading-snug mt-1">{def.desc}</p>
                  </div>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                  {isPercentage ? (
                      <div className="flex items-center gap-3">
                          <input 
                              type="range" 
                              min="0" 
                              max={def.type === 'percent' ? "1" : "100"} 
                              step={def.type === 'percent' ? "0.1" : "1"}
                              value={value}
                              onChange={e => handleConfigChange(section, key, def.type === 'percent' ? parseFloat(e.target.value) : parseInt(e.target.value))}
                              className="w-24 accent-slate-900"
                          />
                          <span className="font-mono font-bold text-slate-700 w-12 text-right">
                              {def.type === 'percent' ? Math.round(value * 100) : value}%
                          </span>
                      </div>
                  ) : (
                      <input 
                          type="number" 
                          className="w-20 border-2 border-slate-200 rounded-lg p-2 text-right font-mono font-bold text-slate-800 focus:border-slate-900 outline-none transition-colors"
                          value={value} 
                          onChange={e => handleConfigChange(section, key, parseInt(e.target.value))} 
                      />
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">{key}</span>
              </div>
          </div>
      );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col flex-shrink-0">
        <div className="p-6">
            <h2 className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-4 flex items-center gap-2">
                <Shield size={14} /> Modo Deus
            </h2>
            <nav className="space-y-2">
                <button onClick={() => setActiveTab('OVERVIEW')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'OVERVIEW' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><BarChart2 size={18} /> Visão Global</button>
                <button onClick={() => setActiveTab('COSTS')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'COSTS' ? 'bg-amber-900 text-amber-400 font-medium' : 'hover:bg-slate-800'}`}><DollarSign size={18} /> Custos & API</button>
                <button onClick={() => setActiveTab('STORE')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'STORE' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><ShoppingBag size={18} /> Gestão de Loja</button>
                <button onClick={() => setActiveTab('GOD_MODE')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'GOD_MODE' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><Settings size={18} /> Regras do Sistema</button>
                <button onClick={() => setActiveTab('USERS')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'USERS' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><Users size={18} /> Alunos</button>
                <button onClick={() => setActiveTab('CONTENT')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'CONTENT' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><Database size={18} /> Conteúdo</button>
                <button onClick={() => setActiveTab('DATABASE')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'DATABASE' ? 'bg-blue-900 text-blue-400 font-medium' : 'hover:bg-slate-800'}`}><Terminal size={18} /> Database SQL</button>
            </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        
        {/* --- OVERVIEW TAB --- */}
        {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Visão Geral do Sistema</h1>
                    <p className="text-slate-500">Métricas de engajamento e economia.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Users size={24} /></div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{realUsers.length}</div>
                                <div className="text-sm text-slate-500">Alunos Totais</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Activity size={24} /></div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                    {realUsers.reduce((acc, u) => acc + (u.brain?.sessionStreak > 0 ? 1 : 0), 0)}
                                </div>
                                <div className="text-sm text-slate-500">Alunos Ativos (Streak > 0)</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Database size={24} /></div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{VERB_DATABASE.length}</div>
                                <div className="text-sm text-slate-500">Verbos no Sistema</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- COSTS TAB --- */}
        {activeTab === 'COSTS' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Controle Financeiro de API</h1>
                        <p className="text-slate-500">Estimativa baseada no uso real dos alunos.</p>
                    </div>
                    <button onClick={fetchUsers} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded">
                        <RefreshCw size={14} className={usersLoading ? 'animate-spin' : ''}/> Atualizar Dados
                    </button>
                </div>
                
                {realUsers.length === 0 && !usersLoading && (
                    <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-amber-800 text-sm">
                        ⚠️ Atenção: A lista de usuários está vazia ou não pôde ser carregada. Verifique se você executou o script de permissões na aba <strong>Database SQL</strong> e rodou no Supabase.
                    </div>
                )}

                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Custo Total</span>
                        <span className="text-3xl font-mono font-bold text-slate-800">${calculateTotalPlatformCost().grandTotal.toFixed(4)}</span>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Texto (Gemini)</span>
                        <span className="text-xl font-mono font-bold text-slate-600">${calculateTotalPlatformCost().details.text.toFixed(4)}</span>
                        <span className="text-xs text-slate-400">{calculateTotalPlatformCost().counts.text} chamadas</span>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Áudio (TTS)</span>
                        <span className="text-xl font-mono font-bold text-slate-600">${calculateTotalPlatformCost().details.audio.toFixed(4)}</span>
                        <span className="text-xs text-slate-400">{calculateTotalPlatformCost().counts.audio} chamadas</span>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Imagens (Imagen)</span>
                        <span className="text-xl font-mono font-bold text-slate-600">${calculateTotalPlatformCost().details.image.toFixed(4)}</span>
                        <span className="text-xs text-slate-400">{calculateTotalPlatformCost().counts.image} gerações</span>
                    </div>
                </div>
            </div>
        )}

        {/* --- STORE TAB --- */}
        {activeTab === 'STORE' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Loja & Itens</h1>
                        <p className="text-slate-500">Gerencie o catálogo disponível para os alunos.</p>
                    </div>
                    <button 
                        onClick={() => setShowEditor(!showEditor)}
                        className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800"
                    >
                        {showEditor ? <X size={20} /> : <PlusCircle size={20} />}
                        {showEditor ? 'Cancelar' : 'Novo Item'}
                    </button>
                </div>

                {showEditor && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                                <input className="w-full border p-2 rounded" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} placeholder="Ex: Capa da Invisibilidade" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço (XP)</label>
                                <input type="number" className="w-full border p-2 rounded" value={itemForm.price} onChange={e => setItemForm({...itemForm, price: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                                <textarea className="w-full border p-2 rounded h-20" value={itemForm.description} onChange={e => setItemForm({...itemForm, description: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                <select className="w-full border p-2 rounded" value={itemForm.type} onChange={e => setItemForm({...itemForm, type: e.target.value})}>
                                    <option value="COLLECTIBLE">Colecionável</option>
                                    <option value="THEME">Tema (Skin)</option>
                                    <option value="TITLE">Título</option>
                                    <option value="POWERUP">Power-up</option>
                                    <option value="FLAG">Bandeira</option>
                                    <option value="CLOTHING">Roupa</option>
                                    <option value="MEDAL">Medalha (Sistema)</option>
                                    <option value="CUSTOM">Outro...</option>
                                </select>
                                {itemForm.type === 'CUSTOM' && (
                                    <input className="w-full border p-2 rounded mt-2" placeholder="Digite o tipo..." value={itemForm.categoryInput} onChange={e => setItemForm({...itemForm, categoryInput: e.target.value})} />
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Emoji / Asset</label>
                                <div className="flex gap-2">
                                    <input className="w-full border p-2 rounded" value={itemForm.asset} onChange={e => setItemForm({...itemForm, asset: e.target.value})} placeholder="🍕" />
                                    <button onClick={handleAiGenerateEmoji} className="bg-purple-100 text-purple-600 px-3 rounded hover:bg-purple-200">
                                        {isEmojiGenerating ? <RefreshCw className="animate-spin"/> : <Sparkles size={18}/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={handleAiGenerateItem} className="text-purple-600 hover:bg-purple-50 px-4 py-2 rounded flex items-center gap-2">
                                {isAiGenerating ? <RefreshCw className="animate-spin"/> : <Sparkles size={18}/>} Sugerir com IA
                            </button>
                            <button onClick={handleSaveItem} className="bg-emerald-600 text-white px-6 py-2 rounded font-bold hover:bg-emerald-500">
                                {editingId ? 'Atualizar Item' : 'Criar Item'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                            <tr>
                                <th className="py-4 px-6">Item</th>
                                <th className="py-4 px-6">Categoria</th>
                                <th className="py-4 px-6">Preço</th>
                                <th className="py-4 px-6">Status</th>
                                <th className="py-4 px-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {storeCatalog.map(item => (
                                <tr key={item.id}>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-xl">{item.asset}</div>
                                            <div>
                                                <div className="font-bold">{item.name}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{item.type}</span></td>
                                    <td className="py-4 px-6 font-mono font-bold text-slate-700">{item.price} XP</td>
                                    <td className="py-4 px-6">
                                        <button onClick={() => handleToggleActive(item.id)}>
                                            {item.isActive ? <ToggleRight className="text-emerald-500" size={24} /> : <ToggleLeft className="text-slate-400" size={24} />}
                                        </button>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <button onClick={() => startEdit(item)} className="p-2 text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- GOD MODE TAB --- */}
        {activeTab === 'GOD_MODE' && localConfig && (
            <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
                <div className="flex justify-between items-center sticky top-0 bg-slate-100 z-10 py-4 border-b border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Regras do Sistema</h1>
                        <p className="text-slate-500">Painel de Controle da Mecânica e Economia.</p>
                    </div>
                    <button onClick={saveConfig} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 flex items-center gap-2 shadow-lg shadow-slate-900/20 active:scale-95 transition-transform">
                        <Save size={18} /> Salvar Alterações
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* ECONOMY SECTION */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                <DollarSign size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Economia (XP)</h3>
                        </div>
                        <div className="grid gap-3">
                            {Object.entries(localConfig.economy).map(([key, val]) => renderConfigInput('economy', key, val))}
                        </div>
                    </div>

                    {/* RULES SECTION */}
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <Settings size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Regras de Jogo</h3>
                        </div>
                        <div className="grid gap-3">
                            {/* Probabilities integrated into rules visually */}
                            {Object.entries(localConfig.probabilities).map(([key, val]) => renderConfigInput('probabilities', key, val))}
                            {Object.entries(localConfig.rules).map(([key, val]) => renderConfigInput('rules', key, val))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- CONTENT TAB --- */}
        {activeTab === 'CONTENT' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Base de Verbos</h1>
                        <p className="text-slate-500">Visualização do currículo estático.</p>
                    </div>
                    <div className="bg-slate-200 px-3 py-1 rounded-full text-sm font-bold text-slate-600">Total: {VERB_DATABASE.length}</div>
                </div>
                
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex gap-4">
                        <input className="border rounded p-2 text-sm w-64" placeholder="Buscar verbo..." value={contentSearch} onChange={e => setContentSearch(e.target.value)} />
                        <select className="border rounded p-2 text-sm" value={contentFilterLevel} onChange={e => setContentFilterLevel(e.target.value)}>
                            <option value="ALL">Todos os Níveis</option>
                            <option value="A1">A1</option>
                            <option value="A2">A2</option>
                            <option value="B1">B1</option>
                            <option value="B2">B2</option>
                            <option value="C1">C1</option>
                        </select>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                <tr>
                                    <th className="py-3 px-6">Verbo</th>
                                    <th className="py-3 px-6">Tradução</th>
                                    <th className="py-3 px-6">Nível</th>
                                    <th className="py-3 px-6">Tags</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {VERB_DATABASE
                                    .filter(v => (contentFilterLevel === 'ALL' || v.level === contentFilterLevel) && v.infinitive.toLowerCase().includes(contentSearch.toLowerCase()))
                                    .map(v => (
                                    <tr key={v.infinitive} className="hover:bg-slate-50">
                                        <td className="py-3 px-6 font-bold">{v.infinitive}</td>
                                        <td className="py-3 px-6">{v.translation}</td>
                                        <td className="py-3 px-6"><span className={`px-2 py-1 rounded text-xs font-bold ${v.level === 'A1' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{v.level}</span></td>
                                        <td className="py-3 px-6 text-xs text-slate-500">{v.tags?.join(', ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- USERS TAB --- */}
        {activeTab === 'USERS' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Alunos</h1>
                        <p className="text-slate-500">Acompanhamento em tempo real.</p>
                    </div>
                    <button onClick={fetchUsers} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded">
                        <RefreshCw size={14} className={usersLoading ? 'animate-spin' : ''}/> Atualizar
                    </button>
                </div>

                {usersLoading ? (
                    <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-slate-400" size={32} /></div>
                ) : realUsers.length > 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                                <tr>
                                    <th className="py-4 px-6">Nome / Email</th>
                                    <th className="py-4 px-6">Função</th>
                                    <th className="py-4 px-6">Nível Atual</th>
                                    <th className="py-4 px-6">Verbos Descobertos</th>
                                    <th className="py-4 px-6">Total Exercícios</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {realUsers.map((user) => {
                                    const brain = user.brain || {};
                                    const verbsCount = brain.verbHistory ? Object.keys(brain.verbHistory).length : 0;
                                    const totalExercises = brain.levelStats 
                                        ? Object.values(brain.levelStats).reduce((acc: any, curr: any) => acc + (curr.exercisesCount || 0), 0)
                                        : 0;

                                    return (
                                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-800">{user.full_name || 'Sem nome'}</div>
                                                <div className="text-xs text-slate-500">{user.email}</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                                    ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}
                                                `}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 font-bold text-slate-700">
                                                {brain.currentLevel || 'A1'}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="font-mono font-bold text-purple-600">{verbsCount}</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="font-mono font-bold text-blue-600">{totalExercises}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
                        <Users size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-slate-500 font-bold">Nenhum aluno encontrado</h3>
                        <p className="text-slate-400 text-sm mb-4">Se existem registros no Auth, use a aba Database para sincronizar.</p>
                    </div>
                )}
             </div>
        )}

        {/* --- DATABASE TAB --- */}
        {activeTab === 'DATABASE' && (
            <div className="space-y-6 animate-fade-in max-w-3xl">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manutenção do Banco de Dados</h1>
                    <p className="text-slate-500">Ferramentas de SQL para reparo e sincronização de tabelas.</p>
                </div>

                {/* --- FIX ADMIN PERMISSIONS BLOCK --- */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                            <Key size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Corrigir Permissões Admin (RLS)</h3>
                            <p className="text-sm text-slate-500">Use se receber erro "violates row-level security" ao sincronizar ou salvar.</p>
                        </div>
                    </div>
                    
                    <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                         <div className="absolute top-4 right-4 flex items-center gap-2">
                             <button 
                                onClick={handleCopyFixSQL}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs flex items-center gap-2 font-bold"
                            >
                                {copiedFix ? <Check size={14}/> : <Copy size={14}/>}
                                {copiedFix ? "Copiado!" : "Copiar"}
                            </button>
                         </div>
<pre className="whitespace-pre-wrap leading-relaxed">{`-- CORRIGIR PERMISSÃO ADMIN (INSERT/UPDATE para outros usuários)
DROP POLICY IF EXISTS "Admins see all progress" ON public.user_progress;
DROP POLICY IF EXISTS "Admins manage all progress" ON public.user_progress;

-- Esta política permite que ADMINS façam INSERT/UPDATE/DELETE/SELECT em QUALQUER linha
CREATE POLICY "Admins manage all progress" ON public.user_progress 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);`}</pre>
                    </div>
                </div>

                {/* --- SYNC GHOST USERS BLOCK --- */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                            <UserPlus size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Sincronizar Usuários Fantasmas</h3>
                            <p className="text-sm text-slate-500">Use se existirem alunos registrados que não aparecem na lista.</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                        <button 
                            onClick={handleSyncMissingProgress}
                            disabled={usersLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            <Zap size={18} /> {usersLoading ? "Processando..." : "Executar Correção (Aplicação)"}
                        </button>
                    </div>

                    <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                         <div className="absolute top-4 right-4 flex items-center gap-2">
                             <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Fallback SQL</span>
                             <button 
                                onClick={handleCopySyncSQL}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs flex items-center gap-2 font-bold"
                            >
                                {copiedSync ? <Check size={14}/> : <Copy size={14}/>}
                                {copiedSync ? "Copiado!" : "Copiar"}
                            </button>
                         </div>
<pre className="whitespace-pre-wrap leading-relaxed">{`-- SINCRONIZAR USUÁRIOS FANTASMAS (Auth -> Profiles)
INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), 'STUDENT'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Garantir que todos tenham entrada na tabela de progresso
INSERT INTO public.user_progress (id, brain_data)
SELECT id, '{}'::jsonb
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_progress);`}</pre>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
