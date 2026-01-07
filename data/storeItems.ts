
import { StoreItem } from '../types';

export const STORE_CATALOG: StoreItem[] = [
    // --- SPECIAL ITEMS ---
    {
        id: 'license_detective',
        name: 'Licenza Investigativa',
        description: 'Desbloqueia o modo "L\'Ispettore". Resolva crimes gramaticais diários.',
        price: 2000,
        type: 'SPECIAL',
        asset: '🕵️‍♂️',
        isActive: true
    },

    // --- THEMES (Visuals updated to Landscapes, Styles moved to themeSkin) ---
    {
        id: 'theme_toscana',
        name: 'Toscana',
        description: 'Tons de ocre e verde cipreste. Sinta o sol da tarde.',
        price: 750,
        type: 'THEME',
        asset: '🌻', // Visual
        themeSkin: 'bg-amber-50 text-amber-900', // Actual CSS
        isActive: true
    },
    {
        id: 'theme_roma_night',
        name: 'Notte Romana',
        description: 'Modo escuro elegante inspirado no Coliseu à noite.',
        price: 1200,
        type: 'THEME',
        asset: '🏛️',
        themeSkin: 'bg-slate-900 text-slate-100',
        isActive: true
    },
    {
        id: 'theme_firenze',
        name: 'Firenze Classica',
        description: 'Elegância renascentista com tons de mármore e terracota.',
        price: 1800,
        type: 'THEME',
        asset: '⚜️',
        themeSkin: 'bg-stone-100 text-stone-800',
        isActive: true
    },
    {
        id: 'theme_amalfi',
        name: 'Costa Amalfitana',
        description: 'Azul marinho e limão siciliano. Frescor mediterrâneo.',
        price: 2500,
        type: 'THEME',
        asset: '🌊',
        themeSkin: 'bg-sky-50 text-sky-900',
        isActive: true
    },

    // --- POWER UPS ---
    {
        id: 'powerup_freeze',
        name: 'Congela Streak',
        description: 'Protege sua ofensiva por 1 dia se você esquecer de treinar.',
        price: 450,
        type: 'POWERUP',
        asset: '❄️',
        isActive: true
    },

    // --- TITLES ---
    {
        id: 'title_coniugatore',
        name: 'Il Coniugatore',
        description: 'Título para quem conjuga até dormindo.',
        price: 300,
        type: 'TITLE',
        asset: '🎓',
        isActive: true
    },
    {
        id: 'title_maestro',
        name: 'Maestro dei Verbi',
        description: 'Mostre que você domina a arte.',
        price: 1500,
        type: 'TITLE',
        asset: '👑',
        isActive: true
    },
    {
        id: 'title_cavaliere',
        name: 'Cavaliere del Passato',
        description: 'Para quem venceu batalhas épicas no Passato Prossimo.',
        price: 2250,
        type: 'TITLE',
        asset: '⚔️',
        isActive: true
    },
    {
        id: 'title_poeta',
        name: 'Poeta Dannato',
        description: 'Para os dramáticos e fluentes.',
        price: 3000,
        type: 'TITLE',
        asset: '🥀',
        isActive: true
    },
    {
        id: 'title_imperatore',
        name: 'Imperatore',
        description: 'Domínio total do território linguístico.',
        price: 5000,
        type: 'TITLE',
        asset: '🏛️',
        isActive: true
    },

    // --- FLAGS (Assets are the symbol inside the flag) ---
    {
        id: 'flag_italia',
        name: 'Bandeira Itália',
        description: 'O clássico Tricolore.',
        price: 150,
        type: 'FLAG',
        asset: '🇮🇹', // Standard flag acts as symbol
        isActive: true
    },
    {
        id: 'flag_sicilia',
        name: 'Sicilia',
        description: 'A ilha do sol com a Trinacria.',
        price: 600,
        type: 'FLAG',
        asset: '🍋', // Lemon as symbol inside flag
        isActive: true
    },
    {
        id: 'flag_veneto',
        name: 'Veneto',
        description: 'O leão de São Marcos.',
        price: 600,
        type: 'FLAG',
        asset: '🦁', // Lion as symbol inside flag
        isActive: true
    },
    
    // --- COLLECTIBLES ---
    {
        id: 'col_pizza',
        name: 'Pizza Margherita',
        description: 'A rainha de Napoli.',
        price: 225,
        type: 'COLLECTIBLE',
        asset: '🍕',
        isActive: true
    },
    {
        id: 'col_colosseo',
        name: 'Mini Colosseo',
        description: 'Um pedaço da história na sua estante virtual.',
        price: 3750,
        type: 'COLLECTIBLE',
        asset: '🏟️', // Stadium emoji looks more like colosseum than generic bank
        isActive: true
    },
    {
        id: 'col_vespa',
        name: 'Vespa Vintage',
        description: 'Para passear pela costa amalfitana.',
        price: 4500,
        type: 'COLLECTIBLE',
        asset: '🛵',
        isActive: true
    },
    {
        id: 'col_cafe',
        name: 'Moka Express',
        description: 'O verdadeiro café italiano em casa.',
        price: 1200,
        type: 'COLLECTIBLE',
        asset: '☕',
        isActive: true
    },
    {
        id: 'col_mask',
        name: 'Maschera Veneziana',
        description: 'Misteriosa e elegante para o Carnevale.',
        price: 2800,
        type: 'COLLECTIBLE',
        asset: '🎭',
        isActive: true
    },

    // --- VESTUÁRIO (CLOTHING) ---
    {
        id: 'cloth_azzurra',
        name: 'Maglia Azzurra #10',
        description: 'A camisa clássica da seleção.',
        price: 3000,
        type: 'CLOTHING',
        asset: '👕',
        isActive: true
    },
    {
        id: 'cloth_milano',
        name: 'Camisa Rossonera',
        description: 'As cores de Milão.',
        price: 3000,
        type: 'CLOTHING',
        asset: '👕', // Will be styled Red/Black
        isActive: true
    },
    {
        id: 'cloth_inter',
        name: 'Camisa Nerazzurra',
        description: 'A outra face de Milão.',
        price: 3000,
        type: 'CLOTHING',
        asset: '👕', // Will be styled Blue/Black
        isActive: true
    }
];
