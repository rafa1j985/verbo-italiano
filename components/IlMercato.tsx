
import React, { useState } from 'react';
import { UserBrain, StoreItem, StoreItemType, LevelStats } from '../types';
import { ShoppingBag, Star, Layout, Zap, Award, Image, ArrowLeft, Shirt, Coffee, Tag, Sparkles } from 'lucide-react';

interface IlMercatoProps {
    onExit: () => void;
    brain: UserBrain;
    onUpdateBrain: (newBrain: UserBrain) => void;
    catalog: StoreItem[]; 
}

const IlMercato: React.FC<IlMercatoProps> = ({ onExit, brain, onUpdateBrain, catalog }) => {
    const [activeTab, setActiveTab] = useState<string>('THEME');
    const totalXP = (Object.values(brain.levelStats) as LevelStats[]).reduce((acc, curr) => acc + curr.score, 0);

    const getPrice = (item: StoreItem) => {
        if (item.promotion && item.promotion.endsAt > Date.now()) {
            return Math.floor(item.price * (1 - item.promotion.discountPercent / 100));
        }
        return item.price;
    };

    const handleBuy = (item: StoreItem) => {
        const finalPrice = getPrice(item);
        if (totalXP < finalPrice) return;

        const newBrain = { ...brain };
        
        let costRemaining = finalPrice;
        const levels = ['C1', 'B2', 'B1', 'A2', 'A1'] as const; 
        
        for (const lvl of levels) {
            if (costRemaining <= 0) break;
            const available = newBrain.levelStats[lvl].score;
            if (available > 0) {
                const take = Math.min(available, costRemaining);
                newBrain.levelStats[lvl].score -= take;
                costRemaining -= take;
            }
        }

        if (costRemaining > 0) {
            alert("Erro: XP insuficiente (distribuído).");
            return;
        }

        // Add to inventory
        if (item.type === 'POWERUP' && item.id === 'powerup_freeze') {
            newBrain.streakFreeze = (newBrain.streakFreeze || 0) + 1;
        } else {
            if (!newBrain.inventory) newBrain.inventory = [];
            newBrain.inventory.push(item.id);
        }

        onUpdateBrain(newBrain);
    };

    const handleEquip = (item: StoreItem) => {
        const newBrain = { ...brain };
        
        if (item.type === 'THEME') {
            newBrain.activeTheme = item.id;
        } else if (item.type === 'TITLE') {
            newBrain.activeTitle = item.id;
        }
        
        onUpdateBrain(newBrain);
    };

    // --- VISUAL RENDERER HELPER ---
    const renderVisualAsset = (item: StoreItem) => {
        // Special Case: Flags (Shape of a flag with icon inside)
        if (item.type === 'FLAG') {
            return (
                <div className="relative group-hover:scale-110 transition-transform">
                    {/* Pole */}
                    <div className="absolute left-0 top-0 bottom-[-10px] w-1 bg-slate-400 rounded-full h-24"></div>
                    {/* Flag Body */}
                    <div className="relative ml-1 w-20 h-14 bg-gradient-to-r from-green-500 via-white to-red-500 shadow-md flex items-center justify-center rounded-sm wave-clip">
                        {/* Overlay texture for 'fabric' look */}
                        <div className="absolute inset-0 bg-white opacity-20 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:4px_4px]"></div>
                        <div className="text-3xl drop-shadow-md z-10">{item.asset}</div>
                    </div>
                </div>
            );
        }

        // Special Case: Clothing (Colored Jerseys)
        if (item.type === 'CLOTHING') {
            let bgClass = "bg-blue-600"; // Default Azzurra
            if (item.id.includes('milano')) bgClass = "bg-red-600"; // Milan
            if (item.id.includes('inter')) bgClass = "bg-blue-800"; // Inter
            
            return (
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner ${bgClass} border-4 border-white group-hover:scale-110 transition-transform`}>
                    <div className="text-4xl filter drop-shadow-lg grayscale-[0.2] brightness-125">
                        {item.asset}
                    </div>
                </div>
            );
        }

        // Special Case: Themes (Mini Landscape Window)
        if (item.type === 'THEME') {
            return (
                <div className="w-24 h-24 bg-white p-2 shadow-md rotate-[-2deg] group-hover:rotate-0 transition-transform duration-300 border border-slate-200">
                    <div className="w-full h-full bg-slate-100 overflow-hidden flex items-center justify-center relative">
                        {/* Simulated Sky */}
                        <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-sky-50 opacity-50"></div>
                        <span className="text-5xl relative z-10">{item.asset}</span>
                    </div>
                </div>
            );
        }

        // Default: Circle Container
        return (
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 transition-transform group-hover:scale-110 shadow-inner bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200`}>
                {item.asset}
            </div>
        );
    };

    const renderItem = (item: StoreItem) => {
        const isOwned = brain.inventory?.includes(item.id);
        const isActive = brain.activeTheme === item.id || brain.activeTitle === item.id;
        const finalPrice = getPrice(item);
        const canAfford = totalXP >= finalPrice;
        const isPromo = item.promotion && item.promotion.endsAt > Date.now();

        // Powerups are consumable
        const isConsumable = item.type === 'POWERUP';
        const quantity = isConsumable && item.id === 'powerup_freeze' ? (brain.streakFreeze || 0) : 0;

        return (
            <div key={item.id} className={`group bg-white rounded-2xl shadow-sm hover:shadow-xl border transition-all duration-300 relative overflow-hidden flex flex-col
                ${isPromo ? 'border-red-300 shadow-red-100' : 'border-slate-100'}
            `}>
                {isPromo && (
                    <div className="absolute top-3 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-l-full z-10 shadow-sm animate-pulse">
                        -{item.promotion!.discountPercent}% SALDI
                    </div>
                )}
                
                <div className="p-6 flex-1 flex flex-col items-center text-center justify-center min-h-[180px]">
                    <div className="mb-4">
                        {renderVisualAsset(item)}
                    </div>
                    
                    <h3 className="font-bold text-slate-800 leading-tight mb-2 font-serif text-lg">{item.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed px-2">{item.description}</p>
                    
                    {isConsumable && quantity > 0 && (
                        <div className="mt-3 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">Posseduti: {quantity}</div>
                    )}
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                    {!isOwned && !isConsumable ? (
                        <button 
                            onClick={() => handleBuy(item)}
                            disabled={!canAfford}
                            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                                ${canAfford 
                                    ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-200' 
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                            `}
                        >
                            <span className="flex flex-col items-start leading-none">
                                <span className="text-[10px] opacity-70 uppercase tracking-wider">Acquista</span>
                                <span className="flex items-center gap-1">
                                    {isPromo && <span className="line-through opacity-50 text-[10px] mr-1">{item.price}</span>}
                                    {finalPrice} XP
                                </span>
                            </span>
                            <ShoppingBag size={18} />
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            {isConsumable ? (
                                 <button 
                                    onClick={() => handleBuy(item)}
                                    disabled={!canAfford}
                                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95
                                        ${canAfford 
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md' 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                                    `}
                                >
                                    <span>+1 ({finalPrice} XP)</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleEquip(item)}
                                    disabled={isActive}
                                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                                        ${isActive 
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default' 
                                            : 'bg-slate-800 text-white hover:bg-slate-700 shadow-md'}
                                    `}
                                >
                                    {isActive ? 'Equipaggiato' : 'Usa Ora'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Extract unique categories and filter ONLY ACTIVE items
    const activeItems = catalog.filter(i => i.isActive);
    const dynamicCategories = Array.from(new Set(activeItems.map(i => i.type))) as string[];
    
    // Map internal types to Italian Display Names
    const getCategoryLabel = (type: string) => {
        switch(type) {
            case 'THEME': return 'Temi';
            case 'TITLE': return 'Titoli';
            case 'POWERUP': return 'Potenziamenti';
            case 'FLAG': return 'Bandiere';
            case 'COLLECTIBLE': return 'Collezione';
            case 'CLOTHING': return 'Abbigliamento';
            default: return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        }
    };

    const getCategoryIcon = (type: string) => {
        switch(type) {
            case 'THEME': return <Layout size={16}/>;
            case 'TITLE': return <Award size={16}/>;
            case 'POWERUP': return <Zap size={16}/>;
            case 'FLAG': return <Image size={16}/>;
            case 'COLLECTIBLE': return <Star size={16}/>;
            case 'CLOTHING': return <Shirt size={16}/>;
            default: return <Tag size={16}/>;
        }
    };

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col p-4 md:p-8 animate-fade-in bg-slate-50/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="p-3 bg-white hover:bg-slate-100 rounded-full text-slate-500 transition-colors shadow-sm border border-slate-200">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-slate-800 flex items-center gap-2">
                            Il Mercato <Sparkles size={24} className="text-yellow-500 fill-yellow-500" />
                        </h1>
                        <p className="text-slate-500 font-medium">Investi nella tua conoscenza.</p>
                    </div>
                </div>
                <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 text-amber-800 px-6 py-3 rounded-2xl font-bold font-mono flex items-center gap-3 shadow-sm">
                    <div className="p-1 bg-white rounded-full"><Star size={16} fill="currentColor" className="text-amber-500"/></div>
                    <span className="text-xl">{totalXP} XP</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 overflow-x-auto pb-6 mb-2 no-scrollbar px-1">
                {dynamicCategories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-all
                            ${activeTab === cat 
                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105' 
                                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}
                        `}
                    >
                        {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto pb-20 px-1">
                {activeItems.filter(i => i.type === activeTab).map(renderItem)}
                {activeItems.filter(i => i.type === activeTab).length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                        <ShoppingBag size={48} className="mb-4 opacity-20" />
                        <p className="italic">Nessun articolo disponibile in questa categoria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IlMercato;
