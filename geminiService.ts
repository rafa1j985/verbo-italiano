
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Exercise, Feedback, ErrorCategory, VerbLessonSession, ExerciseType, BossExam, MilestoneExam, VerbState, StoreItem, GlobalGameConfig } from "../types";
import { VERB_DATABASE, VerbEntry } from "../data/verbs";
import { generateLocalLesson } from "./localExerciseService";
import { conjugateRegular, FULL_PASSATO_PROSSIMO_DB } from "../data/conjugationRules"; // Import local conjugator

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelName = "gemini-3-flash-preview"; 
const ttsModelName = "gemini-2.5-flash-preview-tts";
const imageModelName = "imagen-3.0-generate-001"; // High quality image generation

const timeoutPromise = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request Timed Out")), ms));

// ... (KEEP ALL EXISTING FUNCTIONS UNCHANGED: Audio Logic, enrichPracticeSentences, sanitizeConjugation, etc.) ...
// RE-IMPLEMENTING HELPERS TO ENSURE FULL FILE INTEGRITY

export const generateLesson = async (
    level: string, 
    progress: number, 
    recentVerbs: string[], 
    history: Record<string, VerbState>,
    config: GlobalGameConfig
): Promise<VerbLessonSession> => {
    // 1. Local Generation (Fast)
    // Select verb based on weighted logic
    const verb = getRandomVerb(level, recentVerbs, config);
    
    // SPIRAL LEARNING LOGIC
    // If progress is > 40%, chance to introduce Passato Prossimo for known verbs
    const spiralChance = config.probabilities.spiralLearningChance || 0.6;
    const spiralTrigger = config.probabilities.spiralTriggerProgress || 40;
    
    const shouldSpiral = progress > spiralTrigger && Math.random() < spiralChance;
    
    // Find a verb that is already known (in history) to practice in past tense
    const knownVerbs = Object.keys(history);
    let targetTense = "Presente Indicativo";
    let targetVerb = verb;

    if (shouldSpiral && knownVerbs.length > 3) {
        // Pick a random known verb
        const randomKnown = knownVerbs[Math.floor(Math.random() * knownVerbs.length)];
        const knownEntry = VERB_DATABASE.find(v => v.infinitive.toLowerCase() === randomKnown.toLowerCase());
        if (knownEntry) {
            targetVerb = knownEntry;
            targetTense = "Passato Prossimo";
        }
    }

    // Try Local Generator First
    const localSession = generateLocalLesson(targetVerb, targetTense);
    if (localSession) {
        // Enhance with AI in background if needed, but return local immediately for speed
        return localSession;
    }

    // Fallback to AI (Should rarely happen with good local coverage)
    return await generateLessonAI(targetVerb.infinitive, level, targetTense);
};

export const generateBatchLessons = async (level: string, count: number, progress: number, history: Record<string, VerbState>, config: GlobalGameConfig): Promise<VerbLessonSession[]> => {
    const lessons: VerbLessonSession[] = [];
    for (let i = 0; i < count; i++) {
        // Simple sequential generation
        // We pass empty exclusion list for batch to allow repeats in buffer if pool is small, 
        // but ideally we'd track batch-local exclusions.
        const l = await generateLesson(level, progress, [], history, config);
        lessons.push(l);
    }
    return lessons;
};

// --- AI GENERATORS ---

const generateLessonAI = async (verb: string, level: string, tense: string): Promise<VerbLessonSession> => {
    const prompt = `
    Create a structured Italian lesson for the verb "${verb}" in "${tense}".
    Level: ${level}.
    
    JSON Schema:
    {
      "verb": "${verb}",
      "level": "${level}",
      "tense": "${tense}",
      "lesson": {
        "definition": "Portuguese translation",
        "secondaryTranslations": ["alt1", "alt2"],
        "verbType": "regular/irregular description",
        "fullConjugation": ["io...", "tu...", "lui/lei...", "noi...", "voi...", "loro..."],
        "usageTip": "A short practical tip about when to use this verb (in Portuguese)"
      },
      "practiceSentences": [
        {
          "context": "Short context desc (e.g. 'No Restaurante')",
          "sentenceStart": "Part before verb",
          "sentenceEnd": "Part after verb",
          "correctAnswer": "Conjugated Verb"
        },
        {
           "context": "Another context",
           "sentenceStart": "...",
           "sentenceEnd": "...",
           "correctAnswer": "..."
        }
      ]
    }
    `;

    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No text");
        return JSON.parse(text);
    } catch (e) {
        console.error("AI Lesson Gen Error", e);
        // Emergency Fallback
        return generateLocalLesson(VERB_DATABASE.find(v => v.infinitive === verb) || VERB_DATABASE[0])!;
    }
};

export const analyzeSubmission = async (context: string, verb: string, expected: string, user: string): Promise<Feedback> => {
    // Local fast check
    if (user.trim().toLowerCase() === expected.trim().toLowerCase()) {
        return {
            isCorrect: true,
            userAnswer: user,
            correctAnswer: expected,
            errorCategory: ErrorCategory.NONE,
            explanation: "Correto!"
        };
    }

    // AI Analysis for errors
    const prompt = `
    Context: ${context}
    Verb: ${verb}
    Correct: ${expected}
    User Input: ${user}
    
    Analyze the error. Return JSON:
    {
       "isCorrect": boolean,
       "userAnswer": "${user}",
       "correctAnswer": "${expected}",
       "errorCategory": "CONJUGATION" | "SPELLING" | "TENSE" | "NONE",
       "explanation": "Brief explanation in Portuguese explaining why it is wrong and the nuance."
    }
    `;

    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    } catch (e) {
        return {
            isCorrect: false,
            userAnswer: user,
            correctAnswer: expected,
            errorCategory: ErrorCategory.CONJUGATION,
            explanation: "Resposta incorreta."
        };
    }
};

export const enrichPracticeSentences = async (verb: string, level: string, config: GlobalGameConfig) => {
    // This function can optionally replace the local template sentences with AI generated ones
    // for better variety.
    // Silent fail is fine here.
    return null; 
};

// --- BOSS EXAM GENERATOR ---
export const generateBossExam = async (knownVerbs: string[], level: string): Promise<BossExam | null> => {
    const prompt = `
    Generate a Boss Fight Exam for Italian level ${level}.
    Known Verbs: ${knownVerbs.join(", ")}.
    
    Structure (JSON):
    {
       "id": "boss-${Date.now()}",
       "phase1": [ // 10 Speed Questions (Conjugation)
          { "pronoun": "Io", "verb": "Essere", "tense": "Presente", "correct": "sono" } 
          // ... 10 items mixed verbs/pronouns
       ],
       "phase2": [ // 10 True/False Questions
          { "sentence": "Io mangiamo la pasta.", "isCorrect": false, "reason": "Conjugação errada (mangio).", "correction": "Io mangio" }
          // ... 10 items
       ],
       "phase3": [ // 5 Translation Questions
          { "ptSentence": "Eu vou para casa.", "itSentence": "Io vado a casa.", "targetVerb": "Andare" }
          // ... 5 items
       ]
    }
    `;

    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "null");
    } catch (e) {
        console.error(e);
        return null;
    }
};

// --- STORY GENERATOR ---
export const generateStory = async (targetVerbs: string[], level: string) => {
    const prompt = `
    Write a VERY SHORT (50 words max) story in Italian level ${level} using these verbs: ${targetVerbs.join(", ")}.
    Also provide a Portuguese translation.
    
    JSON:
    {
       "title": "Story Title",
       "storyText": "Italian text...",
       "translation": "Portuguese text..."
    }
    `;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "null");
    } catch (e) {
        return null;
    }
};

// --- MILESTONE GENERATOR ---
export const generateMilestoneExam = async (allVerbs: string[], tier: number): Promise<MilestoneExam | null> => {
     const prompt = `
    Create a Milestone Exam (Tier ${tier}) to test mastery of these verbs: ${allVerbs.slice(0, 15).join(", ")}.
    Generate 10 challenging questions mixed types.
    
    JSON:
    {
       "id": "milestone-${tier}",
       "tier": ${tier},
       "questions": [
          { 
            "type": "TRANSLATE_PT_IT" | "CONJUGATE" | "GAP_FILL",
            "question": "The question text",
            "context": "Optional context",
            "correctAnswer": "Exact string expected",
            "verb": "Target verb"
          }
          // ... 10 items
       ]
    }
    `;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "null");
    } catch (e) {
        return null;
    }
};

// --- STORE CONTENT GENERATORS ---
export const generateStoreItemIdea = async (category: string, priceRange: string) => {
    const prompt = `Generate a creative Store Item idea for a gamified Italian app.
    Category: ${category}. Price Range: ${priceRange} XP.
    JSON: { "name": "...", "description": "...", "emoji": "..." }`;
    
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "null");
    } catch (e) { return null; }
};

export const generateEmoji = async (text: string) => {
    const prompt = `Single emoji representing: ${text}`;
    try {
        const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }]
        });
        return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "📦";
    } catch (e) { return "📦"; }
};

// --- IMAGE GENERATION (Imagen) ---
export const generateIllustration = async (storyText: string): Promise<string | null> => {
    // Generate image for story
    // Use Imagen model
    try {
         const response = await ai.models.generateImages({
            model: imageModelName,
            prompt: `Artistic illustration for a story: ${storyText.substring(0, 300)}`,
            config: {
                numberOfImages: 1,
                aspectRatio: "4:3",
                outputMimeType: "image/jpeg"
            }
        });
        return response.generatedImages?.[0]?.image?.imageBytes 
            ? `data:image/jpeg;base64,${response.generatedImages[0].image.imageBytes}`
            : null;
    } catch (e) {
        console.warn("Image gen failed", e);
        return null;
    }
};

// --- WEIGHTED LEVEL SELECTION LOGIC ---
const selectTargetLevel = (userCurrentLevel: string, config?: GlobalGameConfig): string => {
    const rand = Math.random() * 100;
    
    // Default probabilities if no config provided (Safe fallback)
    const probs = config?.probabilities || {
         levelA2: { a1: 15, a2: 85 },
         levelB1: { a1: 15, a2: 15, b1: 70 },
         levelB2: { a1: 10, a2: 15, b1: 15, b2: 60 },
         levelC1: { a1: 10, a2: 10, b1: 15, b2: 15, c1: 50 }
    };

    switch (userCurrentLevel) {
        case 'A1': return 'A1';
        case 'A2': return rand < probs.levelA2.a1 ? 'A1' : 'A2';
        case 'B1':
            if (rand < probs.levelB1.a1) return 'A1';
            if (rand < probs.levelB1.a1 + probs.levelB1.a2) return 'A2';
            return 'B1';
        case 'B2':
            if (rand < probs.levelB2.a1) return 'A1';
            if (rand < probs.levelB2.a1 + probs.levelB2.a2) return 'A2';
            if (rand < probs.levelB2.a1 + probs.levelB2.a2 + probs.levelB2.b1) return 'B1';
            return 'B2';
        case 'C1':
            if (rand < probs.levelC1.a1) return 'A1';
            if (rand < probs.levelC1.a1 + probs.levelC1.a2) return 'A2';
            if (rand < probs.levelC1.a1 + probs.levelC1.a2 + probs.levelC1.b1) return 'B1';
            if (rand < probs.levelC1.a1 + probs.levelC1.a2 + probs.levelC1.b1 + probs.levelC1.b2) return 'B2';
            return 'C1';
        default: return 'A1';
    }
};

const getRandomVerb = (userLevel: string = 'A1', excludeList: string[] = [], config?: GlobalGameConfig): VerbEntry => {
  const targetBucket = selectTargetLevel(userLevel, config);
  let eligibleVerbs = VERB_DATABASE.filter(v => v.level === targetBucket);
  
  const normalize = (s: string) => s.trim().toLowerCase();
  const excludedSet = new Set(excludeList.map(normalize));
  
  const nonExcluded = eligibleVerbs.filter(v => !excludedSet.has(normalize(v.infinitive)));
  
  if (nonExcluded.length > 0) {
      eligibleVerbs = nonExcluded;
  }

  if (eligibleVerbs.length === 0) {
      const backupVerbs = VERB_DATABASE.filter(v => v.level === userLevel);
      if (backupVerbs.length === 0) return VERB_DATABASE[0];
      return backupVerbs[Math.floor(Math.random() * backupVerbs.length)];
  }

  const randomIndex = Math.floor(Math.random() * eligibleVerbs.length);
  return eligibleVerbs[randomIndex];
};

// --- AUDIO / TTS LOGIC ---
let audioContext: AudioContext | null = null;
const AUDIO_CACHE: Record<string, string> = {}; // Cache for Base64 strings

async function getAudioContext(): Promise<AudioContext> {
    if (!audioContext) {
        // Fix: Do not force sampleRate here. Let browser decide hardware rate.
        // Forcing 24000 can cause playback failure on some systems if resampling fails.
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / 2);
  const frameCount = dataInt16.length / numChannels;
  
  // Create buffer with the Model's sample rate (24000). 
  // The AudioContext (system rate) will handle resampling automatically during playback.
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const prefetchAudio = async (text: string) => {
    if (AUDIO_CACHE[text]) return;
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
        if (base64Audio) AUDIO_CACHE[text] = base64Audio;
    } catch (error) { console.warn("Audio prefetch failed", error); }
};

// --- NATIVE BROWSER TTS FALLBACK ---
// Guaranteed to work if the browser supports SpeechSynthesis (most do)
const playNativeFallback = (text: string) => {
    console.log("Playing Native TTS Fallback for:", text);
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT'; // Italian
    utterance.rate = 0.9; // Slightly slower for clarity
    
    // Try to find a high quality voice
    const voices = window.speechSynthesis.getVoices();
    const italianVoice = voices.find(v => v.lang.includes('it') && v.name.includes('Google')) || 
                         voices.find(v => v.lang.includes('it'));
    
    if (italianVoice) utterance.voice = italianVoice;
    
    window.speechSynthesis.speak(utterance);
};

export const playTextToSpeech = async (text: string) => {
    // 1. Try Gemini first (High Quality)
    try {
        const ctx = await getAudioContext();
        
        // CRITICAL FIX: Resume context immediately.
        // If suspended, any subsequent audio logic will hang.
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        let base64Audio = AUDIO_CACHE[text];

        if (!base64Audio) {
            // Timeout logic: If Gemini takes > 3s, switch to native fallback immediately
            const fetchPromise = ai.models.generateContent({
                model: ttsModelName,
                contents: [{ parts: [{ text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                },
            });

            // Race against a timeout
            const result = await Promise.race([
                fetchPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
            ]) as any;

            base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) AUDIO_CACHE[text] = base64Audio;
        }
        
        if (base64Audio) {
            const audioBytes = decodeBase64(base64Audio);
            // 24000 is Gemini's native rate. 
            // We pass it to createBuffer so it knows how to interpret the bytes.
            const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
            
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();
        } else {
            throw new Error("No audio data returned");
        }
    } catch (error) {
        // 2. FALLBACK: Use Browser Native TTS (Guaranteed)
        console.warn("TTS Error/Timeout, switching to Native:", error);
        playNativeFallback(text);
    }
};
