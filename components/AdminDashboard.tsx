
import React, { useState } from 'react';
import { generateExercise, generateStoreItemIdea, generateEmoji } from '../services/geminiService';
import { Exercise, StoreItem, Notification } from '../types';
import { Users, Database, PlusCircle, RefreshCw, BarChart2, Shield, ShoppingBag, Sparkles, Trash2, Edit2, ToggleLeft, ToggleRight, Tag, Save, X, Bell } from 'lucide-react';

// --- MOCK DATA FOR ADMIN DEMO (KPIs) ---
const MOCK_USERS = [
    {
        id: '1', name: 'Giulia Rossi', email: 'giulia.r@example.com', level: 'A2', xp: 2450, verbsMastered: 42, streak: 12, status: 'ACTIVE', lastLogin: '2 horas atrás',
        topGame: 'Conecte os Pares',
        gameDistribution: [{ name: 'Pares', value: 60 }, { name: 'Binário', value: 30 }, { name: 'Intruso', value: 10 }],
        weaknesses: ['Passato Prossimo (Auxiliares)', 'Verbos Reflexivos'],
        strengths: ['Presente Regular', 'Vocabulário Casa']
    },
];

// Props updated to receive notification handler
interface AdminDashboardProps {
    storeCatalog?: StoreItem[];
    onUpdateCatalog?: (newCatalog: StoreItem[]) => void;
    onBroadcastNotification?: (notification: Notification) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ storeCatalog = [], onUpdateCatalog, onBroadcastNotification }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'CONTENT' | 'USERS' | 'STORE'>('STORE');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  
  // Store Management State
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [promoId, setPromoId] = useState<string | null>(null);
  const [promoPercent, setPromoPercent] = useState<number>(20);

  // Form State
  const [itemForm, setItemForm] = useState<{name: string, description: string, price: string, type: string, asset: string, categoryInput: string}>({
      name: '', description: '', price: '1000', type: 'COLLECTIBLE', asset: '', categoryInput: ''
  });
  
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isEmojiGenerating, setIsEmojiGenerating] = useState(false);

  // Content Gen State
  const [generatedPreview, setGeneratedPreview] = useState<Exercise | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  // --- HELPER: RESET FORM ---
  const resetForm = () => {
      setItemForm({ name: '', description: '', price: '1000', type: 'COLLECTIBLE', asset: '', categoryInput: '' });
      setEditingId(null);
      setShowEditor(false);
  };

  // --- STORE HANDLERS ---
  
  // 1. Generate Full Idea
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

  // 2. Generate Only Emoji
  const handleAiGenerateEmoji = async () => {
      if (!itemForm.name && !itemForm.description) return alert("Preencha o nome ou descrição primeiro.");
      setIsEmojiGenerating(true);
      const emoji = await generateEmoji(`${itemForm.name} - ${itemForm.description}`);
      setItemForm(prev => ({ ...prev, asset: emoji }));
      setIsEmojiGenerating(false);
  };

  // 3. Save Item (Create or Update)
  const handleSaveItem = () => {
      if (!onUpdateCatalog) return;
      const type = itemForm.type === 'CUSTOM' ? itemForm.categoryInput.toUpperCase() : itemForm.type;
      
      let updatedCatalog = [...storeCatalog];
      let notifTitle = "";
      let notifMsg = "";

      if (editingId) {
          // Update existing
          updatedCatalog = updatedCatalog.map(i => i.id === editingId ? {
              ...i,
              name: itemForm.name,
              description: itemForm.description,
              price: parseInt(itemForm.price),
              type: type,
              asset: itemForm.asset
          } : i);
      } else {
          // Create new
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
          
          // Notify Users
          notifTitle = "Nuovo Arrivo! 🛍️";
          notifMsg = `Chegou "${newItem.name}" no Mercado!`;
          if (onBroadcastNotification) {
              onBroadcastNotification({
                  id: `notif-${Date.now()}`,
                  title: notifTitle,
                  message: notifMsg,
                  type: 'NEW_ITEM',
                  timestamp: Date.now(),
                  read: false
              });
          }
      }

      onUpdateCatalog(updatedCatalog);
      resetForm();
  };

  // 4. Delete
  const handleDeleteItem = (id: string) => {
      if (!onUpdateCatalog) return;
      if (confirm("Tem certeza que deseja excluir este item?")) {
          onUpdateCatalog(storeCatalog.filter(i => i.id !== id));
      }
  };

  // 5. Toggle Active
  const handleToggleActive = (id: string) => {
      if (!onUpdateCatalog) return;
      onUpdateCatalog(storeCatalog.map(i => i.id === id ? { ...i, isActive: !i.isActive } : i));
  };

  // 6. Start Edit
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

  // 7. Toggle Promotion Logic
  const handlePromoClick = (item: StoreItem) => {
      if (item.promotion && item.promotion.endsAt > Date.now()) {
          // Cancel Promo
          if (!onUpdateCatalog) return;
          onUpdateCatalog(storeCatalog.map(i => i.id === item.id ? { ...i, promotion: undefined } : i));
      } else {
          // Open Promo Dialog
          setPromoId(item.id);
          setPromoPercent(20); // Default
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
                      endsAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
                  }
              };
          }
          return i;
      });
      
      onUpdateCatalog(updated);
      
      // Notify Users
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
                <button onClick={() => setActiveTab('USERS')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'USERS' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><Users size={18} /> Alunos</button>
                <button onClick={() => setActiveTab('CONTENT')} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'CONTENT' ? 'bg-emerald-900 text-emerald-400 font-medium' : 'hover:bg-slate-800'}`}><Database size={18} /> Conteúdo</button>
            </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        
        {/* --- TAB: STORE MANAGEMENT --- */}
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
