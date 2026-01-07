
import React, { useState, useEffect } from 'react';
import { generateStoreItemIdea, generateEmoji } from '../services/geminiService';
import { getAllUsersAdmin } from '../services/supabaseService';
import { Exercise, StoreItem, Notification, GlobalGameConfig } from '../types';
import { VERB_DATABASE } from '../data/verbs'; 
import { Users, Database, PlusCircle, RefreshCw, BarChart2, Shield, ShoppingBag, Sparkles, Trash2, Edit2, ToggleLeft, ToggleRight, Tag, Save, X, Bell, Settings, Percent, Coins, Gamepad2, Lock, Search, Filter, Book, Clock, Terminal, Copy, Check, UserPlus } from 'lucide-react';

interface AdminDashboardProps {
    storeCatalog?: StoreItem[];
    onUpdateCatalog?: (newCatalog: StoreItem[]) => void;
    onBroadcastNotification?: (notification: Notification) => void;
    config?: GlobalGameConfig;
    onUpdateConfig?: (newConfig: GlobalGameConfig) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ storeCatalog = [], onUpdateCatalog, onBroadcastNotification, config, onUpdateConfig }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CONTENT' | 'USERS' | 'STORE' | 'GOD_MODE' | 'DATABASE'>('CONTENT');
  
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

  useEffect(() => {
      if (config && !localConfig) {
          setLocalConfig(config);
      }
  }, [config]);

  // Load Users when tab changes to USERS
  useEffect(() => {
      if (activeTab === 'USERS') {
          fetchUsers();
      }
  }, [activeTab]);

  const fetchUsers = async () => {
      setUsersLoading(true);
      const data = await getAllUsersAdmin();
      setRealUsers(data);
      setUsersLoading(false);
  };

  const resetForm = () => {
      setItemForm({ name: '', description: '', price: '1000', type: 'COLLECTIBLE', asset: '', categoryInput: '' });
      setEditingId(null);
      setShowEditor(false);
  };

  // --- STORE HANDLERS ---
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
      const isStandardType = ['THEME','POWERUP','FLAG','COLLECTIBLE','TITLE','CLOTHING'].includes(item.type);
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

  // --- GOD MODE HANDLERS ---
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
      const sql = `-- --- LIMPEZA TOTAL (Reset para corrigir conflito de colunas) ---
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

CREATE POLICY "Users manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = id);
CREATE POLICY "Admins see all progress" ON public.user_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Read config" ON public.global_config FOR SELECT USING (true);
CREATE POLICY "Admin update config" ON public.global_config FOR ALL USING (
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

  const handleCopySyncSQL = () => {
      const sql = `-- SINCRONIZAR USUÁRIOS FANTASMAS (Auth -> Profiles)
-- Executar caso existam usuários registrados que não aparecem na lista.

INSERT INTO public.profiles (id, full_name, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), 'STUDENT'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- Garantir que todos tenham entrada na tabela de progresso
INSERT INTO public.user_progress (id, brain_data)
SELECT id, '{}'::jsonb
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_progress);`;
      navigator.clipboard.writeText(sql);
      setCopiedSync(true);
      setTimeout(() => setCopiedSync(false), 2000);
  };

  const filteredVerbs = VERB_DATABASE.filter(v => {
      const matchesSearch = v.infinitive.toLowerCase().includes(contentSearch.toLowerCase()) || 
                            v.translation.toLowerCase().includes(contentSearch.toLowerCase());
      const matchesFilter = contentFilterLevel === 'ALL' || v.level === contentFilterLevel;
      return matchesSearch && matchesFilter;
  });

  const getVerbCountByLevel = (level: string) => VERB_DATABASE.filter(v => v.level === level).length;

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
        
        {/* --- TAB: DATABASE (SQL) --- */}
        {activeTab === 'DATABASE' && (
            <div className="space-y-6 animate-fade-in max-w-3xl">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Manutenção do Banco de Dados</h1>
                    <p className="text-slate-500">Ferramentas de SQL para reparo e sincronização de tabelas.</p>
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
                    
                    <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                         <button 
                            onClick={handleCopySyncSQL}
                            className="absolute top-4 right-4 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs flex items-center gap-2 font-bold"
                        >
                            {copiedSync ? <Check size={14}/> : <Copy size={14}/>}
                            {copiedSync ? "Copiado!" : "Copiar Script"}
                        </button>
<pre className="whitespace-pre-wrap leading-relaxed">{`-- SINCRONIZAR USUÁRIOS FANTASMAS (Auth -> Profiles)
-- Executar caso existam usuários registrados que não aparecem na lista.

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

                {/* --- FULL RESET BLOCK --- */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm opacity-90 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-4 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                        <Terminal size={24} />
                        <p><strong>Reset Completo:</strong> Recria todas as tabelas e triggers. Use apenas se o banco estiver corrompido ou na instalação inicial.</p>
                    </div>

                    <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
                        <button 
                            onClick={handleCopySQL}
                            className="absolute top-4 right-4 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs flex items-center gap-2"
                        >
                            {copied ? <Check size={14}/> : <Copy size={14}/>}
                            {copied ? "Copiado!" : "Copiar SQL de Reset"}
                        </button>
<pre className="whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{`-- --- LIMPEZA TOTAL (Reset para corrigir conflito de colunas) ---
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

CREATE POLICY "Users manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = id);
CREATE POLICY "Admins see all progress" ON public.user_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Read config" ON public.global_config FOR SELECT USING (true);
CREATE POLICY "Admin update config" ON public.global_config FOR ALL USING (
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
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();`}</pre>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Keep existing Tabs: USERS, CONTENT, GOD_MODE, STORE, OVERVIEW) ... */}
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
                                    <th className="py-4 px-6">Último Acesso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {realUsers.map((user) => {
                                    const brain = user.brain || {};
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
                                                {brain.verbHistory ? Object.keys(brain.verbHistory).length : 0}
                                            </td>
                                            <td className="py-4 px-6 text-slate-500 text-xs">
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
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
                        <p className="text-slate-400 text-sm mb-4">Se existem registros no Auth, eles podem estar "Fantasmas".</p>
                        <button 
                            onClick={() => setActiveTab('DATABASE')}
                            className="text-blue-600 hover:text-blue-800 font-bold text-sm underline"
                        >
                            Ir para Sincronização de Dados
                        </button>
                    </div>
                )}
             </div>
        )}

        {/* --- TAB: CONTENT (DATABASE VIEWER) --- */}
        {activeTab === 'CONTENT' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Base de Dados de Verbos</h1>
                        <p className="text-slate-500">Visualização do currículo estático (verbs.ts).</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                        <Database size={14} /> Total: {VERB_DATABASE.length}
                    </div>
                </div>

                {/* Level Stats Cards */}
                <div className="grid grid-cols-5 gap-4">
                    {['A1', 'A2', 'B1', 'B2', 'C1'].map(lvl => (
                        <div key={lvl} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full mb-2
                                ${lvl === 'A1' || lvl === 'A2' ? 'bg-emerald-100 text-emerald-700' : ''}
                                ${lvl === 'B1' || lvl === 'B2' ? 'bg-blue-100 text-blue-700' : ''}
                                ${lvl === 'C1' ? 'bg-purple-100 text-purple-700' : ''}
                            `}>
                                {lvl}
                            </span>
                            <span className="text-2xl font-bold text-slate-700">{getVerbCountByLevel(lvl)}</span>
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Verbos</span>
                        </div>
                    ))}
                </div>

                {/* Search & Filter Bar */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-center sticky top-0 z-20">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar verbo ou tradução..." 
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            value={contentSearch}
                            onChange={(e) => setContentSearch(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                            className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-600 font-medium appearance-none cursor-pointer"
                            value={contentFilterLevel}
                            onChange={(e) => setContentFilterLevel(e.target.value)}
                        >
                            <option value="ALL">Todos os Níveis</option>
                            <option value="A1">Nível A1</option>
                            <option value="A2">Nível A2</option>
                            <option value="B1">Nível B1</option>
                            <option value="B2">Nível B2</option>
                            <option value="C1">Nível C1</option>
                        </select>
                    </div>
                </div>

                {/* Verb List Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                            <tr>
                                <th className="py-4 px-6">Infinitivo</th>
                                <th className="py-4 px-6">Tradução (PT)</th>
                                <th className="py-4 px-6">Nível</th>
                                <th className="py-4 px-6">Tags & Propriedades</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredVerbs.length > 0 ? (
                                filteredVerbs.map((verb, idx) => (
                                    <tr key={`${verb.infinitive}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 font-serif text-lg text-slate-800 font-bold flex items-center gap-2">
                                            <Book size={16} className="text-slate-300" />
                                            {verb.infinitive}
                                        </td>
                                        <td className="py-4 px-6 text-slate-600 font-medium">
                                            {verb.translation}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold w-10 text-center
                                                ${verb.level.startsWith('A') ? 'bg-emerald-100 text-emerald-700' : ''}
                                                ${verb.level.startsWith('B') ? 'bg-blue-100 text-blue-700' : ''}
                                                ${verb.level.startsWith('C') ? 'bg-purple-100 text-purple-700' : ''}
                                            `}>
                                                {verb.level}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-wrap gap-2">
                                                {verb.tags && verb.tags.length > 0 ? (
                                                    verb.tags.map(tag => (
                                                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] uppercase font-bold tracking-wide">
                                                            <Tag size={10} /> {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-slate-300 text-xs italic">Sem tags</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-slate-400">
                                        Nenhum verbo encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- TAB: GOD MODE --- */}
        {activeTab === 'GOD_MODE' && localConfig && (
            <div className="space-y-8 animate-fade-in max-w-4xl">
                 <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Regras e Balanceamento</h1>
                        <p className="text-slate-500">Configure probabilidades, economia de XP e regras de desbloqueio.</p>
                    </div>
                    <button 
                        onClick={saveConfig}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
                    >
                        <Save size={20} /> Salvar Alterações
                    </button>
                </div>

                {/* SECTION 1: ECONOMY (XP) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-6 text-lg border-b pb-2">
                        <Coins size={20} className="text-amber-500"/> Economia de XP
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Apresentação</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpPresentation}
                                onChange={(e) => handleConfigChange('economy', 'xpPresentation', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Ganho ao completar a leitura inicial.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Drill (Lacunas)</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpDrill}
                                onChange={(e) => handleConfigChange('economy', 'xpDrill', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Ganho ao acertar conjugações.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Prática (Por Frase)</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpPractice}
                                onChange={(e) => handleConfigChange('economy', 'xpPractice', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Multiplicado pelo nº de frases na sessão.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Bônus de Voz</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpVoiceBonus}
                                onChange={(e) => handleConfigChange('economy', 'xpVoiceBonus', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Extra se usar o microfone.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Jogo Flashcard</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpGameFlashcard}
                                onChange={(e) => handleConfigChange('economy', 'xpGameFlashcard', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Jogo 'Ping Pong' vale mais.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Outros Jogos</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpGameStandard}
                                onChange={(e) => handleConfigChange('economy', 'xpGameStandard', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Pares, Binário, Intruso, etc.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">XP Perfect Run</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpPerfectRun}
                                onChange={(e) => handleConfigChange('economy', 'xpPerfectRun', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Bônus por zero erros na sessão.</p>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teto Máximo (Sessão)</label>
                            <input 
                                type="number" 
                                value={localConfig.economy.xpMaxPerSession}
                                onChange={(e) => handleConfigChange('economy', 'xpMaxPerSession', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Limite de segurança.</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: PROBABILITIES (Buckets) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-6 text-lg border-b pb-2">
                        <Percent size={20} className="text-purple-500"/> Probabilidades de Sorteio (Buckets)
                    </h3>
                    
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-4">
                            <span className="w-20 font-bold text-slate-600">Nível A2:</span>
                            <div className="flex gap-2 items-center flex-1">
                                <input type="number" value={localConfig.probabilities.levelA2.a1} onChange={(e) => handleConfigChange('probabilities', 'levelA2', {...localConfig.probabilities.levelA2, a1: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % A1
                                <input type="number" value={localConfig.probabilities.levelA2.a2} onChange={(e) => handleConfigChange('probabilities', 'levelA2', {...localConfig.probabilities.levelA2, a2: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % A2
                            </div>
                        </div>
                         <div className="flex items-center gap-4">
                            <span className="w-20 font-bold text-slate-600">Nível B1:</span>
                            <div className="flex gap-2 items-center flex-1">
                                <input type="number" value={localConfig.probabilities.levelB1.a1} onChange={(e) => handleConfigChange('probabilities', 'levelB1', {...localConfig.probabilities.levelB1, a1: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % A1
                                <input type="number" value={localConfig.probabilities.levelB1.a2} onChange={(e) => handleConfigChange('probabilities', 'levelB1', {...localConfig.probabilities.levelB1, a2: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % A2
                                <input type="number" value={localConfig.probabilities.levelB1.b1} onChange={(e) => handleConfigChange('probabilities', 'levelB1', {...localConfig.probabilities.levelB1, b1: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % B1
                            </div>
                        </div>
                         <div className="flex items-center gap-4">
                            <span className="w-20 font-bold text-slate-600">Nível B2:</span>
                            <div className="flex gap-2 items-center flex-1">
                                <input type="number" value={localConfig.probabilities.levelB2.a1} onChange={(e) => handleConfigChange('probabilities', 'levelB2', {...localConfig.probabilities.levelB2, a1: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % A1
                                <input type="number" value={localConfig.probabilities.levelB2.a2} onChange={(e) => handleConfigChange('probabilities', 'levelB2', {...localConfig.probabilities.levelB2, a2: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % A2
                                <input type="number" value={localConfig.probabilities.levelB2.b1} onChange={(e) => handleConfigChange('probabilities', 'levelB2', {...localConfig.probabilities.levelB2, b1: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % B1
                                <input type="number" value={localConfig.probabilities.levelB2.b2} onChange={(e) => handleConfigChange('probabilities', 'levelB2', {...localConfig.probabilities.levelB2, b2: parseInt(e.target.value)})} className="w-16 border p-1 rounded text-center"/> % B2
                            </div>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-700 text-sm uppercase mb-4">Spiral Learning</h4>
                    <div className="grid grid-cols-2 gap-6">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gatilho de Progresso (%)</label>
                            <input 
                                type="number" 
                                value={localConfig.probabilities.spiralTriggerProgress}
                                onChange={(e) => handleConfigChange('probabilities', 'spiralTriggerProgress', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Mínimo de progresso para ativar Passado.</p>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Chance de Ocorrência (0-1)</label>
                            <input 
                                type="number" step="0.1"
                                value={localConfig.probabilities.spiralLearningChance}
                                onChange={(e) => handleConfigChange('probabilities', 'spiralLearningChance', parseFloat(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Probabilidade de cair Passato Prossimo.</p>
                        </div>
                    </div>
                </div>

                {/* SECTION 3: RULES & UNLOCKS */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-6 text-lg border-b pb-2">
                        <Lock size={20} className="text-red-500"/> Regras de Desbloqueio e Cooldowns
                    </h3>
                    
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desbloqueio Boss (XP)</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.bossUnlockXP}
                                onChange={(e) => handleConfigChange('rules', 'bossUnlockXP', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cooldown Boss (Horas)</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.bossCooldownHours}
                                onChange={(e) => handleConfigChange('rules', 'bossCooldownHours', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Score para Vitória Boss</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.bossPassScore}
                                onChange={(e) => handleConfigChange('rules', 'bossPassScore', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Acertos mínimos de 25.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Story Mode (Verbos)</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.storyUnlockCount}
                                onChange={(e) => handleConfigChange('rules', 'storyUnlockCount', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Verbos novos para desbloquear.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Intervalo Milestone (Verbos)</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.milestoneInterval}
                                onChange={(e) => handleConfigChange('rules', 'milestoneInterval', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Ex: 10 (Gera marcos 10, 20, 30...)</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cooldown Milestone (Horas)</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.milestoneCooldownHours}
                                onChange={(e) => handleConfigChange('rules', 'milestoneCooldownHours', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Score Milestone</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.milestonePassScore}
                                onChange={(e) => handleConfigChange('rules', 'milestonePassScore', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Acertos mínimos de 10.</p>
                        </div>
                     </div>
                     
                     <div className="p-4 bg-slate-50 rounded-lg">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Verbos de Fallback (Boss)</label>
                        <input 
                            type="text"
                            value={localConfig.rules.bossFallbackVerbs}
                            onChange={(e) => handleConfigChange('rules', 'bossFallbackVerbs', e.target.value)}
                            className="w-full border p-2 rounded-lg text-sm"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Usados se a API falhar ou usuário tiver pouco histórico.</p>
                     </div>
                </div>

                {/* SECTION 4: GAMES & DRILLS */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-6 text-lg border-b pb-2">
                        <Gamepad2 size={20} className="text-blue-500"/> Balanceamento de Jogos
                    </h3>
                    
                    <h4 className="font-bold text-slate-700 text-sm uppercase mb-4">Máscaras de Drill (Lacunas)</h4>
                    <div className="flex gap-4 mb-6">
                        <div className="text-center">
                            <label className="text-xs font-bold text-slate-500">A1</label>
                            <input type="number" value={localConfig.rules.drillMaskA1} onChange={(e) => handleConfigChange('rules', 'drillMaskA1', parseInt(e.target.value))} className="w-12 border p-1 rounded text-center block mt-1"/>
                        </div>
                        <div className="text-center">
                            <label className="text-xs font-bold text-slate-500">A2</label>
                            <input type="number" value={localConfig.rules.drillMaskA2} onChange={(e) => handleConfigChange('rules', 'drillMaskA2', parseInt(e.target.value))} className="w-12 border p-1 rounded text-center block mt-1"/>
                        </div>
                        <div className="text-center">
                            <label className="text-xs font-bold text-slate-500">B1</label>
                            <input type="number" value={localConfig.rules.drillMaskB1} onChange={(e) => handleConfigChange('rules', 'drillMaskB1', parseInt(e.target.value))} className="w-12 border p-1 rounded text-center block mt-1"/>
                        </div>
                         <div className="text-center">
                            <label className="text-xs font-bold text-slate-500">High</label>
                            <input type="number" value={localConfig.rules.drillMaskHigh} onChange={(e) => handleConfigChange('rules', 'drillMaskHigh', parseInt(e.target.value))} className="w-12 border p-1 rounded text-center block mt-1"/>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-700 text-sm uppercase mb-4">Probabilidade de Minigames (Pesos)</h4>
                    <div className="grid grid-cols-5 gap-2">
                         <div className="text-center">
                            <label className="text-[10px] font-bold text-slate-500 block">Pares</label>
                            <input type="number" value={localConfig.games.weightMatch} onChange={(e) => handleConfigChange('games', 'weightMatch', parseInt(e.target.value))} className="w-full border p-1 rounded text-center"/>
                        </div>
                        <div className="text-center">
                            <label className="text-[10px] font-bold text-slate-500 block">Binário</label>
                            <input type="number" value={localConfig.games.weightBinary} onChange={(e) => handleConfigChange('games', 'weightBinary', parseInt(e.target.value))} className="w-full border p-1 rounded text-center"/>
                        </div>
                         <div className="text-center">
                            <label className="text-[10px] font-bold text-slate-500 block">Intruso</label>
                            <input type="number" value={localConfig.games.weightIntruder} onChange={(e) => handleConfigChange('games', 'weightIntruder', parseInt(e.target.value))} className="w-full border p-1 rounded text-center"/>
                        </div>
                         <div className="text-center">
                            <label className="text-[10px] font-bold text-slate-500 block">Flash</label>
                            <input type="number" value={localConfig.games.weightFlashcard} onChange={(e) => handleConfigChange('games', 'weightFlashcard', parseInt(e.target.value))} className="w-full border p-1 rounded text-center"/>
                        </div>
                         <div className="text-center">
                            <label className="text-[10px] font-bold text-slate-500 block">Ditado</label>
                            <input type="number" value={localConfig.games.weightDictation} onChange={(e) => handleConfigChange('games', 'weightDictation', parseInt(e.target.value))} className="w-full border p-1 rounded text-center"/>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                     <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-6 text-lg border-b pb-2">
                        <Settings size={20} className="text-slate-500"/> Configurações Técnicas
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limiar de Voz (0-100)</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.voiceThreshold}
                                onChange={(e) => handleConfigChange('rules', 'voiceThreshold', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Sensibilidade do microfone.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite Cache Áudio</label>
                            <input 
                                type="number" 
                                value={localConfig.rules.audioCacheLimit}
                                onChange={(e) => handleConfigChange('rules', 'audioCacheLimit', parseInt(e.target.value))}
                                className="w-full border p-2 rounded-lg font-mono font-bold"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Máximo de frases salvas antes de parar IA.</p>
                        </div>
                    </div>
                </div>

            </div>
        )}

        {/* --- TAB: STORE MANAGEMENT (Keep existing) --- */}
        {activeTab === 'STORE' && (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Gestão de Loja & Economia</h1>
                        <p className="text-slate-500">Controle total do catálogo, preços e broadcasting.</p>
                    </div>
                    {!showEditor && (
                        <button 
                            onClick={() => { resetForm(); setShowEditor(true); }}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-500 shadow-lg shadow-indigo-900/20"
                        >
                            <PlusCircle size={20} /> Novo Item
                        </button>
                    )}
                </div>

                {/* Editor Panel */}
                {showEditor && (
                    <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-lg mb-6">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-800">{editingId ? 'Editar Item' : 'Criar Novo Item'}</h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                                    <div className="flex gap-2">
                                        <select 
                                            value={itemForm.type}
                                            onChange={(e) => setItemForm({...itemForm, type: e.target.value})}
                                            className="flex-1 border p-2 rounded-lg"
                                        >
                                            <option value="COLLECTIBLE">Colecionável</option>
                                            <option value="CLOTHING">Vestuário</option>
                                            <option value="FLAG">Bandeira</option>
                                            <option value="THEME">Tema Visual</option>
                                            <option value="TITLE">Título</option>
                                            <option value="POWERUP">Power-up</option>
                                            <option value="CUSTOM">Nova Categoria...</option>
                                        </select>
                                        {itemForm.type === 'CUSTOM' && (
                                            <input 
                                                placeholder="Nome da Categoria" 
                                                className="flex-1 border p-2 rounded-lg"
                                                value={itemForm.categoryInput}
                                                onChange={e => setItemForm({...itemForm, categoryInput: e.target.value})}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Base (XP)</label>
                                    <input 
                                        type="number"
                                        value={itemForm.price}
                                        onChange={(e) => setItemForm({...itemForm, price: e.target.value})}
                                        className="w-full border p-2 rounded-lg"
                                    />
                                </div>
                                <button 
                                    onClick={handleAiGenerateItem}
                                    disabled={isAiGenerating}
                                    className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-purple-100"
                                >
                                    {isAiGenerating ? <RefreshCw className="animate-spin"/> : <Sparkles size={18}/>}
                                    Gerar Ideia Completa com IA
                                </button>
                            </div>
                            <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                                    <input 
                                        value={itemForm.name}
                                        onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                                        className="w-full border p-2 rounded-lg"
                                        placeholder="Ex: Pizza"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                                    <input 
                                        value={itemForm.description}
                                        onChange={(e) => setItemForm({...itemForm, description: e.target.value})}
                                        className="w-full border p-2 rounded-lg"
                                        placeholder="Descrição curta..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Emoji / Asset</label>
                                    <div className="flex gap-2">
                                        <input 
                                            value={itemForm.asset}
                                            onChange={(e) => setItemForm({...itemForm, asset: e.target.value})}
                                            className="w-20 border p-2 rounded-lg text-center text-xl"
                                            placeholder="🍕"
                                        />
                                        <button 
                                            onClick={handleAiGenerateEmoji}
                                            disabled={isEmojiGenerating}
                                            className="flex-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                                        >
                                            {isEmojiGenerating ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                            Gerar Emoji por IA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={resetForm} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                            <button onClick={handleSaveItem} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 flex items-center gap-2">
                                <Save size={18} /> Salvar {editingId ? 'Alterações' : 'Item'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Promo Modal Overlay */}
                {promoId && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-xl shadow-2xl w-80">
                            <h3 className="text-lg font-bold mb-4">Configurar Promoção Flash</h3>
                            <label className="block text-xs text-slate-500 font-bold uppercase mb-2">Porcentagem de Desconto</label>
                            <div className="flex items-center gap-2 mb-6">
                                <input 
                                    type="number" min="1" max="99" 
                                    value={promoPercent}
                                    onChange={(e) => setPromoPercent(parseInt(e.target.value))}
                                    className="border-b-2 border-indigo-500 text-2xl font-bold w-20 text-center outline-none"
                                />
                                <span className="text-xl font-bold">% OFF</span>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setPromoId(null)} className="px-4 py-2 text-slate-500">Cancelar</button>
                                <button onClick={confirmPromo} className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600">
                                    Ativar & Notificar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Catalog Grid */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs border-b border-slate-200">
                            <tr>
                                <th className="py-4 px-6">Item</th>
                                <th className="py-4 px-6">Categoria</th>
                                <th className="py-4 px-6">Preço (XP)</th>
                                <th className="py-4 px-6">Status</th>
                                <th className="py-4 px-6">Promoção</th>
                                <th className="py-4 px-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {storeCatalog.map(item => {
                                const isPromo = item.promotion && item.promotion.endsAt > Date.now();
                                return (
                                    <tr key={item.id} className={`transition-colors ${item.isActive ? 'hover:bg-slate-50' : 'bg-slate-50 opacity-60'}`}>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl border">
                                                    {item.type === 'THEME' ? '🎨' : item.asset}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">{item.name}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600 uppercase">
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 font-mono font-bold text-slate-700">
                                            {isPromo ? (
                                                <div className="flex flex-col">
                                                    <span className="line-through text-slate-400 text-xs">{item.price}</span>
                                                    <span className="text-red-500">{Math.floor(item.price * (1 - item.promotion!.discountPercent / 100))}</span>
                                                </div>
                                            ) : item.price}
                                        </td>
                                        <td className="py-4 px-6">
                                            <button onClick={() => handleToggleActive(item.id)} title={item.isActive ? "Desativar" : "Ativar"}>
                                                {item.isActive ? <ToggleRight size={24} className="text-emerald-500"/> : <ToggleLeft size={24} className="text-slate-400"/>}
                                            </button>
                                        </td>
                                        <td className="py-4 px-6">
                                            {isPromo ? (
                                                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse cursor-pointer" onClick={() => handlePromoClick(item)}>
                                                    -{item.promotion!.discountPercent}% (Click p/ cancelar)
                                                </span>
                                            ) : (
                                                <button onClick={() => handlePromoClick(item)} className="text-xs font-bold text-slate-400 border border-slate-300 px-2 py-1 rounded hover:bg-slate-100">
                                                    Criar Promo
                                                </button>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => startEdit(item)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- OTHER TABS --- */}
        {activeTab === 'OVERVIEW' && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <BarChart2 size={48} className="mb-4" />
                <p>Dashboard Analítico (Mock)</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
