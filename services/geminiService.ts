
import { GoogleGenAI, Type, Modality, Schema } from "@google/genai";
import { Exercise, Feedback, ErrorCategory, VerbLessonSession, ExerciseType, BossExam, MilestoneExam, VerbState, StoreItem, GlobalGameConfig } from "../types";
import { VERB_DATABASE, VerbEntry } from "../data/verbs";
import { generateLocalLesson } from "./localExerciseService";
import { conjugateRegular, FULL_PASSATO_PROSSIMO_DB } from "../data/conjugationRules"; 

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = "gemini-3-flash-preview"; 
const ttsModelName = "gemini-2.5-flash-preview-tts";
const imageModelName = "imagen-3.0-generate-001"; 

// --- HELPER: CLEAN JSON (BULLETPROOF) ---
const cleanJSON = (text: string): string => {
    if (!text) return "{}";
    // Regex matches ```json, ```JSON, ``` json, etc., and removes them
    let cleaned = text.replace(/```[\w\s]*\n?/g, "").replace(/```/g, "");
    
    // Find the first '{' and last '}' to strip any preamble/postscript
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned.trim();
};

// --- AUDIO / TTS LOGIC (HARDENED FOR VERCEL/PROD) ---
let audioContext: AudioContext | null = null;
const BASE64_CACHE: Record<string, string> = {}; // Cache raw strings to prevent re-fetching

// 1. Guaranteed Fallback (Native Browser Voice)
const playNativeFallback = (text: string) => {
    console.warn("Using Native TTS Fallback for:", text);
    try {
        window.speechSynthesis.cancel(); // Critical: Stop any pending speech
        
        // Short delay to allow cancellation to take effect
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT';
            utterance.rate = 0.9;
            utterance.volume = 1.0;
            
            // Try to force a good voice
            const voices = window.speechSynthesis.getVoices();
            const itVoice = voices.find(v => v.lang.includes('it') && !v.name.includes('Google')) || 
                            voices.find(v => v.lang.includes('it')); // Prefer native OS voices over Google sometimes on mobile
            if (itVoice) utterance.voice = itVoice;

            window.speechSynthesis.speak(utterance);
        }, 50);
    } catch (e) {
        console.error("Native TTS completely failed:", e);
    }
};

// 2. Audio Context Singleton with Resume Logic
async function getAudioContext(): Promise<AudioContext> {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    return audioContext;
}

// 3. Helper: Base64 -> ArrayBuffer (Padding Fix)
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    // 1. Remove whitespace
    let cleanBase64 = base64.replace(/\s/g, '');
    
    // 2. Add padding if missing (Critical for Vercel/Strict environments)
    while (cleanBase64.length % 4 !== 0) {
        cleanBase64 += '=';
    }

    const binaryString = window.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// 4. Prefetch (Stores in Cache)
export const prefetchAudio = async (text: string) => {
    if (BASE64_CACHE[text]) return;
    try {
        const response = await ai.models.generateContent({
            model: ttsModelName,
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            BASE64_CACHE[text] = base64Audio;
        }
    } catch (error) { 
        // Silent fail for prefetch
    }
};

// 5. Main Play Function
export const playTextToSpeech = async (text: string) => {
    try {
        const ctx = await getAudioContext();
        
        let base64Audio = BASE64_CACHE[text];

        // Fetch if not cached
        if (!base64Audio) {
            const response = await ai.models.generateContent({
                model: ttsModelName,
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                },
            });
            base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio) {
                BASE64_CACHE[text] = base64Audio;
            } else {
                throw new Error("No audio data from Gemini");
            }
        }

        // DECODE & PLAY
        const audioBuffer = await ctx.decodeAudioData(base64ToArrayBuffer(base64Audio));

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);

    } catch (error) {
        console.error("Gemini TTS Failed, switching to Fallback:", error);
        playNativeFallback(text);
    }
};

// ... (STANDARD GENERATORS BELOW) ...

export const generateLesson = async (
    level: string, 
    progress: number, 
    recentVerbs: string[], 
    history: Record<string, VerbState>,
    config: GlobalGameConfig
): Promise<VerbLessonSession> => {
    const verb = getRandomVerb(level, recentVerbs, config);
    
    // SPIRAL LEARNING
    const spiralChance = config.probabilities.spiralLearningChance || 0.6;
    const spiralTrigger = config.probabilities.spiralTriggerProgress || 40;
    const shouldSpiral = progress > spiralTrigger && Math.random() < spiralChance;
    
    const knownVerbs = Object.keys(history);
    let targetTense = "Presente Indicativo";
    let targetVerb = verb;

    if (shouldSpiral && knownVerbs.length > 3) {
        const randomKnown = knownVerbs[Math.floor(Math.random() * knownVerbs.length)];
        const knownEntry = VERB_DATABASE.find(v => v.infinitive.toLowerCase() === randomKnown.toLowerCase());
        if (knownEntry) {
            targetVerb = knownEntry;
            targetTense = "Passato Prossimo";
        }
    }

    // Try Local
    const localSession = generateLocalLesson(targetVerb, targetTense);
    if (localSession) return localSession;

    // Fallback AI
    return await generateLessonAI(targetVerb.infinitive, level, targetTense);
};

export const generateBatchLessons = async (level: string, count: number, progress: number, history: Record<string, VerbState>, config: GlobalGameConfig): Promise<VerbLessonSession[]> => {
    const lessons: VerbLessonSession[] = [];
    for (let i = 0; i < count; i++) {
        const l = await generateLesson(level, progress, [], history, config);
        lessons.push(l);
    }
    return lessons;
};

const generateLessonAI = async (verb: string, level: string, tense: string): Promise<VerbLessonSession> => {
    const prompt = `Create Italian lesson for "${verb}" in "${tense}". Level: ${level}. JSON: { "verb": "${verb}", "level": "${level}", "tense": "${tense}", "lesson": { "definition": "PT trans", "secondaryTranslations": ["a","b"], "verbType": "desc", "fullConjugation": ["io","tu","lui","noi","voi","loro"], "usageTip": "PT tip" }, "practiceSentences": [{ "context": "ctx", "sentenceStart": "...", "sentenceEnd": "...", "correctAnswer": "..." }] }`;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No text");
        return JSON.parse(cleanJSON(text));
    } catch (e) {
        return generateLocalLesson(VERB_DATABASE.find(v => v.infinitive === verb) || VERB_DATABASE[0])!;
    }
};

export const analyzeSubmission = async (context: string, verb: string, expected: string, user: string): Promise<Feedback> => {
    if (user.trim().toLowerCase() === expected.trim().toLowerCase()) {
        return { isCorrect: true, userAnswer: user, correctAnswer: expected, errorCategory: ErrorCategory.NONE, explanation: "Correto!" };
    }
    const prompt = `Context: ${context}. Verb: ${verb}. Correct: ${expected}. User: ${user}. Analyze error. JSON: { "isCorrect": boolean, "userAnswer": "${user}", "correctAnswer": "${expected}", "errorCategory": "CONJUGATION"|"SPELLING"|"TENSE"|"NONE", "explanation": "PT explanation" }`;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || "{}"));
    } catch (e) {
        return { isCorrect: false, userAnswer: user, correctAnswer: expected, errorCategory: ErrorCategory.CONJUGATION, explanation: "Resposta incorreta." };
    }
};

export const enrichPracticeSentences = async (verb: string, level: string, config: GlobalGameConfig) => { return null; };

// --- CONTENT GENERATORS (Boss, Story, Etc) ---
export const generateBossExam = async (knownVerbs: string[], level: string): Promise<BossExam | null> => {
    // Inject defaults if list is empty
    const verbsToUse = knownVerbs.length > 0 ? knownVerbs : ["Essere", "Avere", "Andare", "Fare", "Mangiare"];
    
    const prompt = `Generate Boss Fight Italian level ${level}. Known: ${verbsToUse.join(", ")}. JSON: { "id": "boss", "phase1": [{ "pronoun": "Io", "verb": "Essere", "tense": "Presente", "correct": "sono" }], "phase2": [{ "sentence": "...", "isCorrect": boolean, "reason": "...", "correction": "..." }], "phase3": [{ "ptSentence": "...", "itSentence": "...", "targetVerb": "..." }] }`;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || "null"));
    } catch (e) { return null; }
};

export const generateStory = async (targetVerbs: string[], level: string) => {
    // 1. INJECT DEFAULTS IF EMPTY (Critical Fix)
    const verbsToUse = targetVerbs.length > 0 ? targetVerbs : ["Essere", "Avere", "Andare", "Fare", "Mangiare"];

    // 2. DEFINE SCHEMA (Guarantees valid JSON structure)
    const storySchema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            storyText: { type: Type.STRING },
            translation: { type: Type.STRING }
        },
        required: ["title", "storyText", "translation"]
    };

    const prompt = `Write a short Italian story (Level ${level}) using these verbs: ${verbsToUse.join(", ")}.
    Provide a Portuguese translation.
    Important: Wrap the target verbs in <b> tags within the Italian text (e.g., <b>mangia</b>).`;
    
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: storySchema,
                temperature: 0.7 
            }
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if(!text) return null;
        
        // cleanJSON is still good practice even with Schema
        return JSON.parse(cleanJSON(text));
    } catch (e) { 
        console.error("Story Generation Failed:", e);
        return null; 
    }
};

export const generateMilestoneExam = async (allVerbs: string[], tier: number): Promise<MilestoneExam | null> => {
     const verbsToUse = allVerbs.length > 0 ? allVerbs : ["Essere", "Avere", "Andare", "Fare", "Mangiare"];
     const prompt = `Create Milestone Exam Tier ${tier}. Verbs: ${verbsToUse.slice(0, 15).join(", ")}. JSON: { "id": "ms", "tier": ${tier}, "questions": [{ "type": "TRANSLATE_PT_IT"|"CONJUGATE"|"GAP_FILL", "question": "...", "context": "...", "correctAnswer": "...", "verb": "..." }] }`;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || "null"));
    } catch (e) { return null; }
};

export const generateStoreItemIdea = async (category: string, priceRange: string) => {
    const prompt = `Store Item Idea. Category: ${category}. Price: ${priceRange}. JSON: { "name": "...", "description": "...", "emoji": "..." }`;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || "null"));
    } catch (e) { return null; }
};

export const generateEmoji = async (text: string) => {
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: `Single emoji for: ${text}` }] }]
        });
        return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "📦";
    } catch (e) { return "📦"; }
};

export const generateIllustration = async (storyText: string): Promise<string | null> => {
    try {
         const response = await ai.models.generateImages({
            model: imageModelName,
            prompt: `Artistic illustration: ${storyText.substring(0, 300)}`,
            config: { numberOfImages: 1, aspectRatio: "4:3", outputMimeType: "image/jpeg" }
        });
        return response.generatedImages?.[0]?.image?.imageBytes ? `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}` : null;
    } catch (e) { return null; }
};

// --- HELPERS ---
const selectTargetLevel = (userCurrentLevel: string, config?: GlobalGameConfig): string => {
    const rand = Math.random() * 100;
    const probs = config?.probabilities || { levelA2: { a1: 15, a2: 85 }, levelB1: { a1: 15, a2: 15, b1: 70 }, levelB2: { a1: 10, a2: 15, b1: 15, b2: 60 }, levelC1: { a1: 10, a2: 10, b1: 15, b2: 15, c1: 50 } };
    switch (userCurrentLevel) {
        case 'A1': return 'A1';
        case 'A2': return rand < probs.levelA2.a1 ? 'A1' : 'A2';
        case 'B1': if (rand < probs.levelB1.a1) return 'A1'; if (rand < probs.levelB1.a1 + probs.levelB1.a2) return 'A2'; return 'B1';
        case 'B2': if (rand < probs.levelB2.a1) return 'A1'; if (rand < probs.levelB2.a1 + probs.levelB2.a2) return 'A2'; if (rand < probs.levelB2.a1 + probs.levelB2.a2 + probs.levelB2.b1) return 'B1'; return 'B2';
        case 'C1': if (rand < probs.levelC1.a1) return 'A1'; if (rand < probs.levelC1.a1 + probs.levelC1.a2) return 'A2'; if (rand < probs.levelC1.a1 + probs.levelC1.a2 + probs.levelC1.b1) return 'B1'; if (rand < probs.levelC1.a1 + probs.levelC1.a2 + probs.levelC1.b1 + probs.levelC1.b2) return 'B2'; return 'C1';
        default: return 'A1';
    }
};

const getRandomVerb = (userLevel: string = 'A1', excludeList: string[] = [], config?: GlobalGameConfig): VerbEntry => {
  const targetBucket = selectTargetLevel(userLevel, config);
  let eligibleVerbs = VERB_DATABASE.filter(v => v.level === targetBucket);
  const normalize = (s: string) => s.trim().toLowerCase();
  const excludedSet = new Set(excludeList.map(normalize));
  const nonExcluded = eligibleVerbs.filter(v => !excludedSet.has(normalize(v.infinitive)));
  if (nonExcluded.length > 0) eligibleVerbs = nonExcluded;
  if (eligibleVerbs.length === 0) {
      const backupVerbs = VERB_DATABASE.filter(v => v.level === userLevel);
      if (backupVerbs.length === 0) return VERB_DATABASE[0];
      return backupVerbs[Math.floor(Math.random() * backupVerbs.length)];
  }
  return eligibleVerbs[Math.floor(Math.random() * eligibleVerbs.length)];
};
