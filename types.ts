
export enum UserRole {
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN'
}

export enum ExerciseType {
  VERB_FLOW = 'VERB_FLOW', 
  LESSON = 'LESSON',
  FILL_BLANK = 'FILL_BLANK',
  CORRECTION = 'CORRECTION', 
  SELECTION = 'SELECTION', 
  REORDER = 'REORDER' 
}

export enum ErrorCategory {
  NONE = 'NONE',
  CONJUGATION = 'CONJUGATION',
  AUXILIARY = 'AUXILIARY', 
  PREPOSITION = 'PREPOSITION',
  L1_INTERFERENCE = 'L1_INTERFERENCE', 
  PRONOUN_PLACEMENT = 'PRONOUN_PLACEMENT', 
  TENSE_MOOD = 'TENSE_MOOD' 
}

// Data structure for the full 3-stage flow
export interface VerbLessonSession {
  id: string;
  verb: string;
  level: string;
  tense: string;
  
  // Stage 1: Presentation (Simplified Structure)
  lesson: {
    definition: string; // Primary translation
    secondaryTranslations: string[]; // "Utilizar / Fazer uso de"
    verbType: string; // "Verbo regular (-ARE)"
    fullConjugation: string[]; // Ordered Io...Loro
    usageTip?: string; // New: Contextual nuance (e.g. Incontrare vs Trovare)
  };

  // Stage 3: Context Practice
  practiceSentences: Array<{
    context: string;
    sentenceStart: string;
    sentenceEnd: string;
    correctAnswer: string;
  }>;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  context: string; 
  sentenceStart: string;
  sentenceEnd: string;
  targetVerb: string; 
  tense: string; 
  correctAnswer: string;
  distractors?: string[];
  nuanceExplanation?: string;
  difficulty: number;
  lessonContent?: {
    ruleExplanation: string; 
    conjugationTable: string[]; 
    exampleSentence: string;
  };
}

export interface Feedback {
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  errorCategory: ErrorCategory;
  explanation: string; 
  cognitivePattern?: string; 
}

export type VerbLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface VerbState {
  lastSeen: number; // timestamp
  consecutiveCorrect: number;
  consecutiveErrors: number;
  weight: number; 
  history: boolean[]; 
}

export interface LevelStats {
  score: number; 
  exercisesCount: number;
  lastPlayed: number;
}

export interface BossStats {
  lastAttempt: number; // timestamp
  wins: number;
  hasMedal: boolean; // Corona di Alloro
}

// --- NOVEL / STORY MODE TYPES ---
export type CharacterGender = 'MALE' | 'FEMALE';
export type CharacterArchetype = 'DETECTIVE' | 'CHEF' | 'STUDENT';

export interface StoryChapter {
  chapterNumber: number;
  title: string;
  emoji: string; // Chapter Icon
  textIt: string; // HTML with <b>verbs</b>
  textPt: string;
  summary: string; // Hidden summary for AI context continuity
  userChoice?: string; // The choice user made at the end
  targetVerbs: string[];
  date: number;
}

export interface NovelProgress {
  gender: CharacterGender;
  archetype: CharacterArchetype;
  currentChapter: number;
  plotSummary: string; // Accumulated context of the whole book
  chapters: StoryChapter[];
}

// --- DETECTIVE MODE TYPES ---
export interface DetectiveCase {
  id: string;
  title: string; // "Il Caso del Gelato Scomparso"
  suspectStatement: string; // Italian text with grammar nuance
  question: string; // "Why is he lying?"
  difficulty: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  rewardClue: string; // "Impronta Digitale", "Lupa", etc.
}

export interface DetectiveStats {
  casesSolved: number;
  lastCaseDate: number; // Timestamp of last played case
  cluesFound: string[]; // List of collected clue names
}

// --- MILESTONE TYPES ---
export interface MilestoneEntry {
  tier: number; // e.g., 10, 20, 30...
  date: number;
  score: number; // x/10
}

export interface MilestoneQuestion {
  type: 'TRANSLATE_PT_IT' | 'CONJUGATE' | 'GAP_FILL';
  question: string; // The prompt text
  context?: string; // Additional context
  correctAnswer: string; // The expected string
  verb: string; // The verb being tested
}

export interface MilestoneExam {
  id: string;
  tier: number;
  questions: MilestoneQuestion[];
}

// --- STORE TYPES ---
export type StoreItemType = 'THEME' | 'POWERUP' | 'FLAG' | 'COLLECTIBLE' | 'TITLE' | 'CLOTHING' | 'SPECIAL' | string;

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  type: StoreItemType;
  asset?: string; // The visual emoji/icon
  themeSkin?: string; // The CSS class applied to the app (Only for THEME type)
  isActive: boolean; // Admin can toggle availability
  
  // Promotion Logic
  promotion?: {
      discountPercent: number; // e.g. 20 for 20% off
      endsAt: number; // Timestamp
  };
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'PROMO' | 'NEW_ITEM' | 'INFO';
    timestamp: number;
    read: boolean;
}

export interface UserBrain {
  currentLevel: VerbLevel;
  levelStats: Record<VerbLevel, LevelStats>;
  verbHistory: Record<string, VerbState>; 
  sessionStreak: number;
  consecutiveErrors: number; 
  safetyNetActive: number; 
  introducedTopics: string[];
  bossStats?: BossStats; 
  
  // Story Mode -> Now Novel Mode
  verbsSinceLastStory: number; 
  novelData?: NovelProgress; // NEW: Replaces storyHistory array
  storyHistory?: any[]; // Deprecated, kept for backward compat if needed
  
  // Detective Mode
  detectiveStats?: DetectiveStats;

  // Milestone Tracking
  milestoneHistory: MilestoneEntry[];
  lastMilestoneFail: number; // Timestamp for cooldown

  // Store & Inventory
  inventory: string[]; // List of Item IDs owned
  activeTheme: string; // ID of active theme (default: 'light')
  activeTitle: string | null; // ID of active title
  streakFreeze: number; // Quantity of freezes owned
  
  // Notifications
  notifications: Notification[];
}

export interface UserStats {
  totalExercises: number;
  masteryScore: number; 
  weakestVerbs: Array<{ verb: string; errorRate: number }>;
  strongestVerbs: Array<{ verb: string; successRate: number }>;
  recentActivity: number[]; 
  errorDistribution: Record<ErrorCategory, number>;
}

export interface GlobalStats {
  activeUsers: number;
  globalErrorHeatmap: Record<string, number>; 
  dropOffPoints: Array<{ concept: string; rate: number }>;
  averageSessionDuration: string;
}

// --- BOSS EXAM TYPES ---
export interface BossExam {
  id: string;
  phase1: Array<{ pronoun: string; verb: string; tense: string; correct: string }>; // Speed
  phase2: Array<{ sentence: string; isCorrect: boolean; correction?: string; reason: string }>; // Precision
  phase3: Array<{ ptSentence: string; itSentence: string; targetVerb: string }>; // Translation
}

// --- GOD MODE CONFIGURATION ---
export interface GlobalGameConfig {
  economy: {
    xpPresentation: number;
    xpDrill: number;
    xpPractice: number; // Per sentence
    xpVoiceBonus: number;
    xpPerfectRun: number;
    xpGameFlashcard: number;
    xpGameStandard: number;
    xpMaxPerSession: number;
  };
  probabilities: {
    // A1 is always 100%
    levelA2: { a1: number; a2: number };
    levelB1: { a1: number; a2: number; b1: number };
    levelB2: { a1: number; a2: number; b1: number; b2: number };
    levelC1: { a1: number; a2: number; b1: number; b2: number; c1: number };
    spiralLearningChance: number; // 0.0 to 1.0 (e.g. 0.6)
    spiralTriggerProgress: number; // % (e.g. 40)
  };
  rules: {
    drillMaskA1: number; // 3
    drillMaskA2: number; // 4
    drillMaskB1: number; // 5
    drillMaskHigh: number; // 6 (B2/C1)
    
    storyUnlockCount: number; // 5
    bossUnlockXP: number; // 1000
    bossCooldownHours: number; // 72
    bossPassScore: number; // 20
    
    milestoneInterval: number; // 10 (Dynamic Tiering)
    milestoneCooldownHours: number; // 1
    milestonePassScore: number; // 8
    
    voiceThreshold: number; // 10
    audioCacheLimit: number; // 50
    bossFallbackVerbs: string; // Comma separated
  };
  games: {
    weightMatch: number; // 20
    weightBinary: number; // 20
    weightIntruder: number; // 20
    weightFlashcard: number; // 20
    weightDictation: number; // 20
  };
}
