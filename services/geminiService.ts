
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Exercise, Feedback, ErrorCategory, VerbLessonSession, ExerciseType, BossExam, MilestoneExam, VerbState, StoreItem } from "../types";
import { VERB_DATABASE, VerbEntry } from "../data/verbs";
import { generateLocalLesson } from "./localExerciseService";
import { conjugateRegular, FULL_PASSATO_PROSSIMO_DB } from "../data/conjugationRules"; // Import local conjugator

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = "gemini-3-flash-preview"; 
const ttsModelName = "gemini-2.5-flash-preview-tts";
const imageModelName = "imagen-4.0-generate-001"; // High quality image generation

const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), ms));

// --- WEIGHTED LEVEL SELECTION LOGIC ---
const selectTargetLevel = (userCurrentLevel: string): string => {
    const rand = Math.random() * 100;

    switch (userCurrentLevel) {
        case 'A1':
            return 'A1'; // 100% A1
        
        case 'A2':
            // 15% A1, 85% A2
            if (rand < 15) return 'A1';
            return 'A2';

        case 'B1':
            // 15% A1, 15% A2, 70% B1
            if (rand < 15) return 'A1';
            if (rand < 30) return 'A2';
            return 'B1';

        case 'B2':
            // 10% A1, 15% A2, 15% B1, 60% B2
            if (rand < 10) return 'A1';
            if (rand < 25) return 'A2';
            if (rand < 40) return 'B1';
            return 'B2';

        case 'C1':
            // 10% A1, 10% A2, 15% B1, 15% B2, 50% C1
            if (rand < 10) return 'A1';
            if (rand < 20) return 'A2';
            if (rand < 35) return 'B1';
            if (rand < 50) return 'B2';
            return 'C1';

        default:
            return 'A1';
    }
};

const getRandomVerb = (userLevel: string = 'A1', excludeList: string[] = []): VerbEntry => {
  // 1. Determine which bucket (level) to pull from based on the percentages
  const targetBucket = selectTargetLevel(userLevel);

  // 2. Filter verbs belonging to that specific bucket
  let eligibleVerbs = VERB_DATABASE.filter(v => v.level === targetBucket);
  
  // 3. Filter out excluded verbs (recently seen)
  // Normalization ensures case insensitivity for comparison
  const normalize = (s: string) => s.trim().toLowerCase();
  const excludedSet = new Set(excludeList.map(normalize));
  
  const nonExcluded = eligibleVerbs.filter(v => !excludedSet.has(normalize(v.infinitive)));
  
  // If we filtered everything out (unlikely but possible), reset filter
  if (nonExcluded.length > 0) {
      eligibleVerbs = nonExcluded;
  } else {
      console.warn(`All verbs for bucket ${targetBucket} were excluded. Resetting pool.`);
  }

  // Fallback if database is empty for a specific level (safety net)
  if (eligibleVerbs.length === 0) {
      console.warn(`No verbs found for bucket ${targetBucket}, falling back to ${userLevel}`);
      const backupVerbs = VERB_DATABASE.filter(v => v.level === userLevel);
      if (backupVerbs.length === 0) return VERB_DATABASE[0];
      return backupVerbs[Math.floor(Math.random() * backupVerbs.length)];
  }

  const randomIndex = Math.floor(Math.random() * eligibleVerbs.length);
  return eligibleVerbs[randomIndex];
};

// Helper to strip pronouns from conjugation strings
const cleanConjugationString = (str: string): string => {
    // Removes "Io ", "Tu ", "Lui/Lei ", etc. case insensitive
    return str.replace(/^(io|tu|lui\/lei|lui|lei|noi|voi|loro)\s+/i, '').trim();
};

// --- AUDIO / TTS LOGIC ---
let audioContext: AudioContext | null = null;
const AUDIO_CACHE: Record<string, string> = {}; // Cache for Base64 strings

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// New: Function to pre-load audio silently
export const prefetchAudio = async (text: string) => {
    if (AUDIO_CACHE[text]) return; // Already cached

    try {
        console.log("Prefetching audio for:", text);
        const response = await ai.models.generateContent({
            model: ttsModelName,
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            AUDIO_CACHE[text] = base64Audio;
        }
    } catch (error) {
        console.warn("Audio prefetch failed", error);
    }
};

export const playTextToSpeech = async (text: string) => {
    try {
        const ctx = getAudioContext();
        let base64Audio = AUDIO_CACHE[text];

        // If not in cache, fetch it now
        if (!base64Audio) {
            const response = await ai.models.generateContent({
                model: ttsModelName,
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });
            base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) AUDIO_CACHE[text] = base64Audio; // Store for repeat
        }
        
        if (base64Audio) {
            const audioBytes = decodeBase64(base64Audio);
            const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
            
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();
        }
    } catch (error) {
        console.error("TTS Error:", error);
    }
};


// --- CACHE SYSTEM (The "Brain" Storage) ---
const CACHE_KEY = "VERBOVIVO_SENTENCE_BANK_V1";
const MIN_CACHE_SIZE_BEFORE_SKIP_AI = 50; // RULE: Only skip AI if we have > 50 sentences

interface CachedSentence {
    context: string;
    sentenceStart: string;
    sentenceEnd: string;
    correctAnswer: string;
}
interface SentenceBank {
    [verb: string]: CachedSentence[];
}

// Load Cache from LocalStorage
const loadSentenceBank = (): SentenceBank => {
    try {
        const stored = localStorage.getItem(CACHE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
};

// Save Sentence to Bank
const saveToBank = (verb: string, sentences: CachedSentence[]) => {
    try {
        const bank = loadSentenceBank();
        const existing = bank[verb] || [];
        
        // Avoid duplicates (simple check based on sentenceStart)
        const newUnique = sentences.filter(s => 
            !existing.some(e => e.sentenceStart === s.sentenceStart)
        );

        if (newUnique.length > 0) {
            bank[verb] = [...existing, ...newUnique];
            localStorage.setItem(CACHE_KEY, JSON.stringify(bank));
            console.log(`[Cache] Saved ${newUnique.length} new sentences for ${verb}. Total: ${bank[verb].length}`);
        }
    } catch (e) {
        console.warn("Failed to save to cache", e);
    }
};

// Get Random Sentences from Bank
const getFromBank = (verb: string, count: number): CachedSentence[] | null => {
    const bank = loadSentenceBank();
    const sentences = bank[verb];
    
    // STRICT RULE: Only use cache if we have more than 50 items
    if (sentences && sentences.length > MIN_CACHE_SIZE_BEFORE_SKIP_AI) {
        // Shuffle and pick 'count'
        const shuffled = [...sentences].sort(() => 0.5 - Math.random());
        console.log(`[Cache] HIT for ${verb}. Using local memory (>50 items).`);
        return shuffled.slice(0, count);
    }
    console.log(`[Cache] MISS for ${verb}. Cache size: ${sentences?.length || 0}/50. Forcing AI generation.`);
    return null;
};


// --- NEW: Background Enrichment Service ---
// This is called immediately when a lesson loads to replace generic templates with AI sentences
export const enrichPracticeSentences = async (
    verb: string,
    level: string
): Promise<Array<{context: string, sentenceStart: string, sentenceEnd: string, correctAnswer: string}> | null> => {
    
    // 1. CHECK CACHE FIRST (Respecting the > 50 rule)
    const cached = getFromBank(verb, 2);
    if (cached) {
        return cached;
    }

    // 2. IF CACHE MISS (OR < 50 items), CALL AI
    const prompt = `
      Create 4 natural, idiomatic, and conversational Italian sentences using the verb "${verb}" in Present Indicative.
      Level: ${level} (Keep it simple but real).
      
      Constraint 1: Do NOT use robotic structures. Use real life contexts (e.g., "Non rido perché la battuta non è divertente").
      Constraint 2: The sentences must be gap-fills where the verb "${verb}" is the missing part.
      Constraint 3: The "context" field MUST be descriptive in Portuguese (e.g., "No restaurante", "Expressando dúvida", "Planejando viagem"). Do not use "Complete a frase".
      
      SPECIAL RULE FOR INDIRECT VERBS (e.g., Piacere, Mancare, Servire):
      - If the verb is "Piacere" or similar, DO NOT generate "Io piaccio...".
      - Generate sentences with Indirect Object Pronouns (Mi, Ti, Gli, Le, Ci, Vi) or "A me...".
      - Example Correct: "Mi piace la musica" (Subject is musica).
      - Example Incorrect: "Io piaccio la musica".
      
      Output JSON Array of objects:
      - context: Descriptive context in Portuguese.
      - sentenceStart: Text before verb.
      - sentenceEnd: Text after verb.
      - correctAnswer: The conjugated verb (ONLY the verb, no pronouns).
    `;

    try {
        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            context: { type: Type.STRING },
                            sentenceStart: { type: Type.STRING },
                            sentenceEnd: { type: Type.STRING },
                            correctAnswer: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        const response: any = await Promise.race([fetchPromise, timeoutPromise(10000)]);
        const data = JSON.parse(response.text);
        
        // Validation check
        if (Array.isArray(data) && data.length >= 2) {
            const cleanData = data.map(item => ({
                ...item,
                correctAnswer: cleanConjugationString(item.correctAnswer)
            }));

            // 3. SAVE TO CACHE FOR NEXT TIME
            saveToBank(verb, cleanData);

            return cleanData.slice(0, 2); // Return requested amount
        }
        return null;

    } catch (error) {
        console.warn("Background enrichment failed, keeping local sentences.", error);
        return null;
    }
};

// --- HELPER TO SANITIZE AI HALLUCINATIONS (DOUBLE I BUG) ---
const sanitizeConjugation = (verb: string, conjugation: string[]): string[] => {
    if (!conjugation || conjugation.length !== 6) return conjugation;

    return conjugation.map(c => {
        let s = c.trim();
        const vLower = verb.toLowerCase();

        // Rule 1: Fix 'iiamo' -> 'iamo' (e.g. Mangiiamo -> Mangiamo)
        // This is extremely common in AI hallucinations for -iare verbs.
        if (s.endsWith('iiamo')) {
            s = s.replace(/iiamo$/, 'iamo');
        }

        // Rule 2: Fix 'iiate' -> 'iate' (e.g. Mangiiate -> Mangiate)
        if (s.endsWith('iiate')) {
            s = s.replace(/iiate$/, 'iate');
        }

        // Rule 3: Fix 'ii' at the end for -ciare and -giare verbs (Tu form)
        // e.g. Tu mangii -> Tu mangi. Tu comincii -> Tu cominci.
        // Note: We skip 'sciare' (Tu scii is correct) and 'inviare' (Tu invii is correct).
        if ((vLower.endsWith('ciare') || vLower.endsWith('giare')) && !vLower.endsWith('sciare')) {
            if (s.endsWith('ii')) {
                s = s.slice(0, -1);
            }
        }

        return s;
    });
};

// --- NEW GENERATOR: Full Lesson Session (3 Stages) ---
export const generateBatchLessons = async (
  level: string,
  count: number = 2,
  progress: number = 0,
  verbHistory: Record<string, VerbState> = {}
): Promise<VerbLessonSession[]> => {
  
  // SPIRAL LEARNING LOGIC FOR BATCH
  // Even in batch, we try to apply the logic:
  // 1. Identify "Mastered" verbs (consecutiveCorrect >= 2)
  // 2. Identify "New" verbs.
  
  const masteredVerbs = Object.keys(verbHistory).filter(v => {
      // Find verb object to check level match
      const dbEntry = VERB_DATABASE.find(db => db.infinitive.toLowerCase() === v.toLowerCase());
      return dbEntry && dbEntry.level === level && verbHistory[v].consecutiveCorrect >= 2;
  });

  const usePassatoProssimo = progress > 40 && masteredVerbs.length > 0 && Math.random() > 0.4;
  
  let targetVerbForPrompt = "";
  let targetTense = "Presente Indicativo";

  if (usePassatoProssimo) {
      targetTense = "Passato Prossimo";
      // Pick a mastered verb to deepen knowledge
      targetVerbForPrompt = masteredVerbs[Math.floor(Math.random() * masteredVerbs.length)];
  }

  // If we selected a specific verb for Past Tense, we hint it in the prompt.
  // Otherwise we let AI pick based on level.
  const verbHint = targetVerbForPrompt ? `MUST use the verb: "${targetVerbForPrompt}"` : "Pick random verbs suitable for the level.";

  const prompt = `
    Generate ${count} detailed Italian Verb Lessons for level ${level}.
    Target Tense: ${targetTense}.
    ${verbHint}
    Target audience: Portuguese speakers.
    
    Structure the "lesson" object with these exact 5 blocks:
    1. Verb: Infinitive.
    2. Meaning: Primary translation + Secondary translations (synonyms/nuances).
    3. Type: e.g., "Verbo regular (-ARE)" or "Verbo irregular".
    4. Conjugation: ${targetTense} (Io...Loro). 
       ${usePassatoProssimo ? 'Important: Include auxiliary verb (e.g. "ho mangiato" or "sono andato"). Use masculine singular for correct answer drills if ambiguous.' : 'Just the verbs, NO pronouns.'}
    5. Usage Tip (Dica de Uso): A short, educational nuance explanation in Portuguese.
       - IF the verb has a common confusion pair (e.g. Incontrare vs Trovare, Conoscere vs Sapere, Sentire vs Ascoltare), EXPLAIN THE DIFFERENCE explicitly.
       - Example: "Use Incontrare para pessoas e Trovare para objetos."
       - If no specific confusion, give a general tip about when to use it naturally.

    Also include "practiceSentences" (Array of 2 items):
    - Contextual gap-fill sentences where the user must type the verb in ${targetTense}.
    - context: Descriptive context in Portuguese (e.g. "No trabalho", "Rotina").
    - sentenceStart: Part before the verb.
    - sentenceEnd: Part after the verb.
    - correctAnswer: The conjugated verb (in ${targetTense}).
    
    CRITICAL RULE FOR INDIRECT VERBS (Piacere, Mancare, Servire):
    - Sentences MUST follow the structure: "Mi piace X", "Ti piace Y".
    - DO NOT generate "Io piaccio...".
    - Ensure 'correctAnswer' matches the object (Singular 'piace' or Plural 'piacciono').

    Output JSON Array.
  `;

  try {
    const fetchPromise = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              verb: { type: Type.STRING },
              lesson: {
                type: Type.OBJECT,
                properties: {
                  definition: { type: Type.STRING, description: "Primary translation (PT)" },
                  secondaryTranslations: { type: Type.ARRAY, items: { type: Type.STRING } },
                  verbType: { type: Type.STRING },
                  fullConjugation: { type: Type.ARRAY, items: { type: Type.STRING } },
                  usageTip: { type: Type.STRING, description: "Educational tip about usage nuances (e.g. Incontrare vs Trovare)" }
                }
              },
              practiceSentences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    context: { type: Type.STRING },
                    sentenceStart: { type: Type.STRING },
                    sentenceEnd: { type: Type.STRING },
                    correctAnswer: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      },
    });

    const response: any = await Promise.race([fetchPromise, timeoutPromise(15000)]);
    const rawLessons = JSON.parse(response.text);

    // Sanitize and Validate
    return rawLessons.map((l: any) => {
        const verbName = l.verb ? l.verb.charAt(0).toUpperCase() + l.verb.slice(1) : "Verbo";
        
        // FAILSAFE: If AI returns bad conjugation (empty or dashes), use local generator
        let cleanConjugation = l.lesson?.fullConjugation?.map(cleanConjugationString) || [];
        const isBadConjugation = cleanConjugation.length !== 6 || cleanConjugation.some((c: string) => c === '-' || c === '');
        
        if (isBadConjugation) {
            console.log(`Fixing bad conjugation for ${verbName} using local rules.`);
            const localFix = conjugateRegular(verbName, []);
            if (localFix) {
                cleanConjugation = localFix;
            } else {
                cleanConjugation = ["-", "-", "-", "-", "-", "-"];
            }
        } else {
            // APPLY SANITIZATION TO AI OUTPUT (Fix Double 'I')
            cleanConjugation = sanitizeConjugation(verbName, cleanConjugation);
        }

        // --- CACHE INTEGRATION FOR BATCH ---
        const cleanSentences = l.practiceSentences?.map((s: any) => {
            let safeContext = s.context;
            const cleanAnswer = cleanConjugationString(s.correctAnswer);
            // Ensure context is not generic
            if (!safeContext || safeContext.length < 3 || safeContext.includes("Complete")) {
                safeContext = "Situação Cotidiana";
            }
            return {
                context: safeContext,
                sentenceStart: s.sentenceStart,
                sentenceEnd: s.sentenceEnd,
                correctAnswer: cleanAnswer
            };
        }) || [];

        // Save generated sentences to bank
        if (cleanSentences.length > 0) {
            saveToBank(verbName, cleanSentences);
        }

        return {
            id: `ai-lesson-${Date.now()}-${Math.random()}`,
            level: level,
            tense: targetTense,
            verb: verbName,
            lesson: {
                definition: l.lesson?.definition || "Ação",
                secondaryTranslations: l.lesson?.secondaryTranslations || [],
                verbType: l.lesson?.verbType || "Verbo Italiano",
                fullConjugation: cleanConjugation,
                usageTip: l.lesson?.usageTip || `Dica: Use "${verbName}" naturalmente em conversas informais.`
            },
            practiceSentences: cleanSentences
        };
    });

  } catch (error) {
    console.warn("Lesson Batch failed, using local", error);
    return [];
  }
};

// Single Lesson Generator (Fallback wrapper)
export const generateLesson = async (
    level: string, 
    progress: number = 0,
    recentVerbs: string[] = [],
    verbHistory: Record<string, VerbState> = {}
): Promise<VerbLessonSession> => {
    
    // SPIRAL LEARNING LOGIC (Smart Tense Selection)
    // 1. Identify "Mastered" verbs in this level
    const masteredVerbs = Object.keys(verbHistory).filter(v => {
        const dbEntry = VERB_DATABASE.find(db => db.infinitive.toLowerCase() === v.toLowerCase());
        // Condition: Must be same level AND have at least 2 consecutive correct answers
        return dbEntry && dbEntry.level === level && verbHistory[v].consecutiveCorrect >= 2;
    });

    // 2. Decide Strategy
    let forcedVerb: VerbEntry | null = null;
    let targetTense = "Presente Indicativo";

    // If progress > 40% AND we have mastered verbs, chance to deepen knowledge (Passato Prossimo)
    // This ensures we only test Past tense on verbs the user ALREADY knows in Present.
    if (progress > 40 && masteredVerbs.length > 0 && Math.random() > 0.4) {
        const selectedInfinitive = masteredVerbs[Math.floor(Math.random() * masteredVerbs.length)];
        const dbEntry = VERB_DATABASE.find(db => db.infinitive.toLowerCase() === selectedInfinitive.toLowerCase());
        
        // Check if this verb HAS a Past Tense available in our DB (safety check)
        const canUsePP = Object.keys(FULL_PASSATO_PROSSIMO_DB).includes(selectedInfinitive) || true; // AI handles it if not in DB
        
        if (dbEntry && canUsePP) {
            forcedVerb = dbEntry;
            targetTense = "Passato Prossimo";
            console.log(`[Spiral Learning] Upgrading ${selectedInfinitive} to Passato Prossimo`);
        }
    }

    // 3. Select Verb (Forced or Random)
    const verb = forcedVerb || getRandomVerb(level, recentVerbs);
    
    // If we didn't force Past, ensure it's Present
    if (!forcedVerb) {
        targetTense = "Presente Indicativo";
    }

    const local = generateLocalLesson(verb, targetTense);
    if (local) return local;

    // Last resort fallback
    return {
        id: "emergency",
        verb: "Mangiare",
        level: "A1",
        tense: "Presente",
        lesson: {
            definition: "Comer",
            secondaryTranslations: ["Alimentar-se", "Ingerir"],
            verbType: "Verbo Regular (-ARE)",
            fullConjugation: ["mangio", "mangi", "mangia", "mangiamo", "mangiate", "mangiano"],
            usageTip: "Use 'Mangiare' para refeições gerais."
        },
        practiceSentences: [{
            context: "Rotina",
            sentenceStart: "Io ",
            sentenceEnd: "la pasta.",
            correctAnswer: "mangio"
        }]
    };
};

export const analyzeSubmission = async (
  context: string,
  verb: string,
  correct: string,
  userSubmission: string
): Promise<Feedback> => {
  const cleanUser = cleanConjugationString(userSubmission);
  const cleanCorrect = cleanConjugationString(correct);
  
  // Normalization helper (removes accents)
  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // 1. Strict Match
  if (cleanUser.toLowerCase() === cleanCorrect.toLowerCase()) {
     return {
        isCorrect: true,
        userAnswer: userSubmission,
        correctAnswer: cleanCorrect,
        errorCategory: ErrorCategory.NONE,
        explanation: "Perfetto!"
     };
  }

  // 2. Accent Forgiveness (Soft Match)
  if (normalize(cleanUser) === normalize(cleanCorrect)) {
      return {
          isCorrect: true,
          userAnswer: userSubmission,
          correctAnswer: cleanCorrect,
          errorCategory: ErrorCategory.NONE,
          explanation: `Atenção à acentuação! A forma correta é "${cleanCorrect}", mas considerei certo desta vez.`
      };
  }

  const prompt = `
    Analyze Italian error. 
    Verb: ${verb}. Correct: ${cleanCorrect}. User: ${userSubmission}.
    Context: ${context}.
    Return JSON explanation in Portuguese.
  `;

  try {
    const fetchPromise = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                explanation: { type: Type.STRING },
            }
        }
      },
    });

    const response: any = await Promise.race([fetchPromise, timeoutPromise(2500)]);
    const data = JSON.parse(response.text);
    return {
      isCorrect: false,
      userAnswer: userSubmission,
      correctAnswer: cleanCorrect,
      errorCategory: ErrorCategory.CONJUGATION,
      explanation: data.explanation
    };
  } catch (error) {
    return {
      isCorrect: false,
      userAnswer: userSubmission,
      correctAnswer: cleanCorrect,
      errorCategory: ErrorCategory.NONE,
      explanation: `Incorreto. A forma correta é "${cleanCorrect}".`,
    };
  }
};

export const generateExercise = async (
    level: string,
    topics: string[]
  ): Promise<Exercise | null> => {
    return null; // Mock return
};

// --- STORY MODE GENERATOR ---
export const generateStory = async (
    verbs: string[],
    level: string
): Promise<{ title: string; storyText: string; translation: string } | null> => {
    const verbList = verbs.join(", ");
    const prompt = `
      Create a SHORT, memorable, and creative Italian story (max 1 paragraph) using exactly these verbs: ${verbList}.
      Level: ${level}.
      Tone: Can be absurd, dramatic, or funny.
      
      Requirements:
      1. Use the verbs in the story.
      2. Highlight the used verbs in the Italian text by wrapping them in <b>...</b> tags (e.g., <b>mangio</b>).
      
      Output JSON:
      - title: Creative title in Italian.
      - storyText: The Italian story with <b> tags.
      - translation: Portuguese translation of the story.
    `;

    try {
        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        storyText: { type: Type.STRING },
                        translation: { type: Type.STRING }
                    }
                }
            }
        });

        const response: any = await Promise.race([fetchPromise, timeoutPromise(15000)]);
        return JSON.parse(response.text);

    } catch (error) {
        console.error("Story Gen Error:", error);
        return null;
    }
};

// --- STORY ILLUSTRATION GENERATOR ---
export const generateIllustration = async (
    storyText: string
): Promise<string | null> => {
    // ENFORCED STYLE PROMPT FOR CONSISTENCY & PREMIUM FEEL
    const prompt = `
      Create a high-quality digital art illustration for this Italian story segment.
      Style: Modern Italian Comic Book (Fumetti Style). 
      Aesthetic: Vibrant colors, clean lines, expressive characters, slightly whimsical but premium.
      
      Story Context: ${storyText.replace(/<[^>]*>/g, '')}
      
      Focus: Create a memorable scene that captures the essence of the story. No text in the image.
    `;

    try {
        const response = await ai.models.generateImages({
            model: imageModelName,
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '4:3',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64EncodeString: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64EncodeString}`;
        }
        return null;
    } catch (e) {
        console.error("Image Gen Error", e);
        return null;
    }
};

// --- BOSS EXAM GENERATOR ---
export const generateBossExam = async (
    knownVerbs: string[],
    level: string
): Promise<BossExam | null> => {
    // If user has no history, provide a starter pack
    const verbsToUse = knownVerbs.length >= 5 ? knownVerbs : ["Essere", "Avere", "Andare", "Fare", "Mangiare"];
    
    const prompt = `
      Create a "Super Test" (Boss Exam) for an Italian student.
      Level: ${level}.
      Constraint: ONLY use these verbs: ${verbsToUse.join(", ")}.
      
      Generate a JSON object with 3 parts:
      
      1. "phase1" (10 items): Speed Test.
         - pronoun: e.g. "Noi"
         - verb: Infinitive from the list.
         - tense: "Presente" (keep it simple for now).
         - correct: The conjugated form (just the verb).

      2. "phase2" (10 items): Precision Test (True/False).
         - sentence: A full Italian sentence.
         - isCorrect: boolean.
         - correction: If false, what is correct? If true, leave empty.
         - reason: Brief explanation in Portuguese (e.g. "O auxiliar correto é essere").
         * IMPORTANT: Create a mix of 5 correct and 5 incorrect sentences. Trap errors like wrong auxiliary or agreement.

      3. "phase3" (5 items): Reverse Translation.
         - ptSentence: A sentence in Portuguese.
         - itSentence: The correct Italian translation.
         - targetVerb: The main verb involved.
    `;

    try {
        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        phase1: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    pronoun: { type: Type.STRING },
                                    verb: { type: Type.STRING },
                                    tense: { type: Type.STRING },
                                    correct: { type: Type.STRING }
                                }
                            }
                        },
                        phase2: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sentence: { type: Type.STRING },
                                    isCorrect: { type: Type.BOOLEAN },
                                    correction: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                }
                            }
                        },
                        phase3: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    ptSentence: { type: Type.STRING },
                                    itSentence: { type: Type.STRING },
                                    targetVerb: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const response: any = await Promise.race([fetchPromise, timeoutPromise(20000)]);
        const data = JSON.parse(response.text);
        
        return {
            id: `boss-${Date.now()}`,
            ...data
        };

    } catch (e) {
        console.error("Failed to generate Boss Exam", e);
        return null;
    }
};

// --- MILESTONE EXAM GENERATOR (PIETRA MILIARE) ---
export const generateMilestoneExam = async (
    allVerbs: string[], // User's full history
    tier: number // 10, 20, 30...
): Promise<MilestoneExam | null> => {
    
    // Sort verbs by lastSeen to distinguish NEW vs OLD
    // We don't have the lastSeen here directly, assuming 'allVerbs' is passed ordered or we handle it in prompt.
    // For simplicity, let's assume the caller passes them in order of acquisition (or we just take the list).
    // Strategy: 
    // - Recent Verbs: Last 10 verbs added.
    // - Old Verbs: Random selection from the rest.
    
    // Safety check
    if (allVerbs.length < 10) {
        // Fallback for testing with few verbs
        allVerbs = [...allVerbs, "Essere", "Avere", "Mangiare", "Parlare", "Dormire", "Capire", "Finire", "Andare", "Venire", "Fare"];
    }

    const recent = allVerbs.slice(-10); // Last 10
    const older = allVerbs.slice(0, -10); // The rest
    
    // Pick 3 older verbs for cumulative review (if available)
    const reviewVerbs = older.sort(() => 0.5 - Math.random()).slice(0, 3);
    // Pick 7 recent verbs
    const targetVerbs = [...recent.sort(() => 0.5 - Math.random()).slice(0, 7), ...reviewVerbs];
    
    // Ensure we have 10 verbs total
    while (targetVerbs.length < 10) {
        targetVerbs.push(recent[Math.floor(Math.random() * recent.length)]);
    }

    const prompt = `
      Create a "Pietra Miliare" (Milestone) Test for Italian students.
      Tier: ${tier} verbs learned.
      
      Verbs to test (Mix of new and old): ${targetVerbs.join(", ")}.
      
      Generate exactly 10 questions. Mix these types:
      1. TRANSLATE_PT_IT: "Eu como" -> "Io mangio"
      2. CONJUGATE: "Noi + Andare" -> "Andiamo"
      3. GAP_FILL: "Tu ___ a casa (Andare)" -> "vai"
      
      Output JSON format:
      - type: One of the types above.
      - question: The prompt text (e.g. "Traduza: Eu sou").
      - context: Brief context if needed (optional).
      - correctAnswer: The exact Italian answer (verb only or short phrase).
      - verb: The verb being tested.
    `;

    try {
        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ['TRANSLATE_PT_IT', 'CONJUGATE', 'GAP_FILL'] },
                                    question: { type: Type.STRING },
                                    context: { type: Type.STRING },
                                    correctAnswer: { type: Type.STRING },
                                    verb: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const response: any = await Promise.race([fetchPromise, timeoutPromise(20000)]);
        const data = JSON.parse(response.text);
        
        return {
            id: `milestone-${tier}-${Date.now()}`,
            tier: tier,
            questions: data.questions
        };

    } catch (e) {
        console.error("Failed to generate Milestone Exam", e);
        return null;
    }
};

// --- STORE GENERATOR (ADMIN) ---
export const generateStoreItemIdea = async (
    category: string,
    priceRange: string = "Medium"
): Promise<{ name: string; description: string; emoji: string } | null> => {
    const prompt = `
      Create a creative Store Item for an Italian learning app gamification shop.
      Category: ${category}.
      Price Range implication: ${priceRange} (affects how premium it sounds).
      
      Examples:
      - Category "Food": Name "Pizza Margherita", Emoji "🍕", Desc "The queen of Napoli."
      - Category "Clothing": Name "Maglia Azzurra", Emoji "👕", Desc "Official team jersey."
      
      Output JSON:
      - name: Creative Italian name.
      - description: Short Portuguese description (fun, engaging).
      - emoji: A suitable emoji.
    `;

    try {
        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        emoji: { type: Type.STRING }
                    }
                }
            }
        });

        const response: any = await Promise.race([fetchPromise, timeoutPromise(10000)]);
        return JSON.parse(response.text);
    } catch (e) {
        console.error("Store Gen Error", e);
        return null;
    }
};

// --- EMOJI GENERATOR ---
export const generateEmoji = async (
    description: string
): Promise<string> => {
    const prompt = `
      Select the SINGLE best emoji to represent this item description for a store.
      Item: "${description}".
      
      Output JSON:
      - emoji: The single emoji character.
    `;

    try {
        const fetchPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        emoji: { type: Type.STRING }
                    }
                }
            }
        });

        const response: any = await Promise.race([fetchPromise, timeoutPromise(5000)]);
        const data = JSON.parse(response.text);
        return data.emoji || "🎁";
    } catch (e) {
        console.error("Emoji Gen Error", e);
        return "🎁";
    }
};
