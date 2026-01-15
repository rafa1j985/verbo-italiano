
import { GoogleGenAI, Type, Modality, Schema } from "@google/genai";
import { Exercise, Feedback, ErrorCategory, VerbLessonSession, ExerciseType, BossExam, MilestoneExam, VerbState, StoreItem, GlobalGameConfig, CharacterGender, CharacterArchetype, DetectiveCase } from "../types";
import { VERB_DATABASE, VerbEntry } from "../data/verbs";
import { generateLocalLesson, generateLocalMilestoneExam } from "./localExerciseService";
import { conjugateRegular, FULL_PASSATO_PROSSIMO_DB } from "../data/conjugationRules"; 

// --- LAZY INITIALIZATION ---
let aiInstance: GoogleGenAI | null = null;

const getAi = (): GoogleGenAI => {
    if (!aiInstance) {
        aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return aiInstance;
};

const modelName = "gemini-3-flash-preview"; 
const ttsModelName = "gemini-2.5-flash-preview-tts";
const imageModelName = "gemini-2.5-flash-image"; 

const cleanJSON = (text: string): string => {
    if (!text) return "{}";
    let cleaned = text.replace(/```[\w\s]*\n?/g, "").replace(/```/g, "");
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned.trim();
};

// ... (Audio functions remain the same) ...
let audioContext: AudioContext | null = null;
const BASE64_CACHE: Record<string, string> = {}; 

const playNativeFallback = (text: string) => {
    console.warn("Using Native TTS Fallback for:", text);
    try {
        window.speechSynthesis.cancel(); 
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'it-IT';
            utterance.rate = 0.9;
            utterance.volume = 1.0;
            const voices = window.speechSynthesis.getVoices();
            const itVoice = voices.find(v => v.lang.includes('it') && !v.name.includes('Google')) || 
                            voices.find(v => v.lang.includes('it'));
            if (itVoice) utterance.voice = itVoice;
            window.speechSynthesis.speak(utterance);
        }, 50);
    } catch (e) { console.error(e); }
};

async function getAudioContext(): Promise<AudioContext> {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    return audioContext;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    let cleanBase64 = base64.replace(/\s/g, '');
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

export const prefetchAudio = async (text: string) => {
    if (BASE64_CACHE[text]) return;
    try {
        const response = await getAi().models.generateContent({
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
    } catch (error) { }
};

export const playTextToSpeech = async (text: string) => {
    try {
        const ctx = await getAudioContext();
        let base64Audio = BASE64_CACHE[text];
        if (!base64Audio) {
            const response = await getAi().models.generateContent({
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
                throw new Error("No audio data");
            }
        }
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

// ... (Standard Lesson Generators) ...
export const generateLesson = async (level: string, progress: number, recentVerbs: string[], history: Record<string, VerbState>, config: GlobalGameConfig): Promise<VerbLessonSession> => {
    const verb = getRandomVerb(level, recentVerbs, config);
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
    
    // PRIORITY: AI
    try {
        return await generateLessonAI(targetVerb.infinitive, level, targetTense);
    } catch(e) {
        console.warn("AI Gen failed, using Local Fallback", e);
        return generateLocalLesson(targetVerb, targetTense)!;
    }
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
    // REINFORCED PROMPT FOR SEMANTIC LOGIC
    const prompt = `
    Role: Expert Italian Teacher.
    Task: Create a structured lesson for the verb "${verb}" in "${tense}" (Level: ${level}).
    
    CRITICAL RULES FOR SEMANTICS:
    1. Sentences MUST make logical sense in the real world.
    2. DO NOT use generic templates like "I eat well" for verbs like "Hate" or "Die".
    3. If verb is "Odiare" (Hate), context must be negative (e.g., "Oidio il traffico").
    4. If verb is "Amare" (Love), context must be positive.
    5. If verb is "Morire" (Die), do not say "I die usually". Say "I'm dying of laughter" or "Plants die without water".
    
    Requirements:
    1. Definition: Concise Portuguese translation.
    2. Conjugation: Strict 6 ordered forms (Io, Tu, Lui/Lei, Noi, Voi, Loro).
    3. Practice Sentences: 
       - Sentence format: Start + [VERB_CONJUGATED] + End.
       - Example Correct: "Mario [mangia] la pizza."
       - Example WRONG: "Mario [odia] bene." (NONSENSE).
    
    Return strict JSON:
    {
      "id": "ai_${Date.now()}",
      "verb": "${verb}",
      "level": "${level}",
      "tense": "${tense}",
      "lesson": {
        "definition": "...",
        "secondaryTranslations": ["..."],
        "verbType": "...",
        "fullConjugation": ["io...", "tu...", "lui...", "noi...", "voi...", "loro..."],
        "usageTip": "Short tip about usage in ${tense}."
      },
      "practiceSentences": [
        {
          "context": "Specific Context (e.g. Al Ristorante)",
          "sentenceStart": "Part before verb",
          "sentenceEnd": "Part after verb",
          "correctAnswer": "Conjugated Verb"
        },
        {
          "context": "Another Context",
          "sentenceStart": "...",
          "sentenceEnd": "...",
          "correctAnswer": "..."
        }
      ]
    }`;

    try {
        const result = await getAi().models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json", temperature: 0.5 } // Lower temp for logic
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No text");
        return JSON.parse(cleanJSON(text));
    } catch (e) {
        throw e; // Let the caller handle fallback
    }
};

export const analyzeSubmission = async (context: string, verb: string, expected: string, user: string): Promise<Feedback> => {
    if (user.trim().toLowerCase() === expected.trim().toLowerCase()) {
        return { isCorrect: true, userAnswer: user, correctAnswer: expected, errorCategory: ErrorCategory.NONE, explanation: "Correto!" };
    }
    const prompt = `Analyze error. Context: ${context}. Verb: ${verb}. Correct: ${expected}. User: ${user}. JSON: { "isCorrect": boolean, "userAnswer": "${user}", "correctAnswer": "${expected}", "errorCategory": "CONJUGATION"|"SPELLING"|"TENSE"|"NONE", "explanation": "PT explanation" }`;
    try {
        const result = await getAi().models.generateContent({
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

export const generateBossExam = async (knownVerbs: string[], level: string): Promise<BossExam | null> => {
    const verbsToUse = knownVerbs.length > 0 ? knownVerbs : ["Essere", "Avere", "Andare", "Fare", "Mangiare"];
    const prompt = `Generate Boss Fight Italian level ${level}. Known: ${verbsToUse.join(", ")}. JSON: { "id": "boss", "phase1": [{ "pronoun": "Io", "verb": "Essere", "tense": "Presente", "correct": "sono" }], "phase2": [{ "sentence": "...", "isCorrect": boolean, "reason": "...", "correction": "..." }], "phase3": [{ "ptSentence": "...", "itSentence": "...", "targetVerb": "..." }] }`;
    try {
        const result = await getAi().models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || "null"));
    } catch (e) { return null; }
};

// --- NEW NOVEL STORY MODE GENERATOR (3-ACT STRUCTURE) ---
export const generateStoryChapter = async (
    gender: CharacterGender, 
    archetype: CharacterArchetype, 
    chapterNum: number, 
    previousSummary: string, 
    targetVerbs: string[], 
    level: string
) => {
    const verbsToUse = targetVerbs.length > 0 ? targetVerbs : ["Essere", "Avere", "Andare"];
    
    // Archetype Context Setup
    let contextStr = "";
    if (archetype === 'DETECTIVE') contextStr = "Context: Crime mystery in Rome. Noir atmosphere.";
    if (archetype === 'CHEF') contextStr = "Context: Culinary journey in Tuscany. Sensory descriptions of food.";
    if (archetype === 'STUDENT') contextStr = "Context: Student life in Milan. Fashion, aperitivo, exams.";
    
    const prompt = `
    Write Chapter ${chapterNum} of an interactive Italian novel in 3 DISTINCT ACTS.
    Protagonist: ${gender === 'MALE' ? 'Male' : 'Female'}.
    Role: ${archetype}.
    ${contextStr}
    Language Level: ${level}.
    Target Verbs: ${verbsToUse.join(", ")}.
    
    Previous Context: "${previousSummary}"
    
    Structure the response in 3 Acts:
    Act 1: Setting the scene (approx 80-100 words).
    Act 2: The Conflict & Challenge. Write about 50 words, then STOP at a crucial verb. This will be an interactive gap for the user. Provide the verb that fits the gap and 2 wrong distractors (wrong conjugation or tense). Then provide the rest of the paragraph (approx 50 words).
    Act 3: Resolution & Cliffhanger (approx 80-100 words).
    
    Return strict JSON:
    {
      "title": "Italian Title",
      "emoji": "🍕",
      "summary": "One sentence summary.",
      "acts": {
        "act1": { "textIt": "Italian text...", "textPt": "Portuguese translation..." },
        "act2": { 
            "textPreGap": "Italian text before the gap...", 
            "correctVerb": "ha visto", 
            "distractors": ["vedeva", "vede"], 
            "textPostGap": "... Italian text after gap.", 
            "textPt": "Portuguese translation of the FULL Act 2." 
        },
        "act3": { "textIt": "Italian text...", "textPt": "Portuguese translation..." }
      },
      "options": [
        { "text": "Choice 1 in Italian", "action": "Short desc" },
        { "text": "Choice 2 in Italian", "action": "Short desc" }
      ]
    }
    `;
    
    try {
        const result = await getAi().models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: [{ parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                temperature: 0.8 
            }
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if(!text) throw new Error("Empty text from AI");
        return JSON.parse(cleanJSON(text));
    } catch (e) { 
        console.error("Story Generation Failed:", e);
        // Fallback for demo
        return {
            title: "Errore di Connessione",
            emoji: "⚠️",
            summary: "Error generating story.",
            acts: {
                act1: { textIt: "Non riesco a scrivere ora.", textPt: "Não consigo escrever agora." },
                act2: { textPreGap: "Devo", correctVerb: "riprovare", distractors: ["riprovo", "riproverò"], textPostGap: "più tardi.", textPt: "Devo tentar novamente mais tarde." },
                act3: { textIt: "Spero che funzioni.", textPt: "Espero que funcione." }
            },
            options: [
                { text: "Riprova", action: "Retry" }
            ]
        };
    }
};

// --- DETECTIVE MODE GENERATOR ---
export const generateDetectiveCase = async (level: string): Promise<DetectiveCase | null> => {
    // Logic Context based on level
    let grammarFocus = "";
    if (level === 'A2') grammarFocus = "Passato Prossimo (Completed Action) vs Imperfetto (Habitual/In-progress)";
    if (level === 'B1') grammarFocus = "Conditional (Would do) vs Indicative (Did)";
    if (level === 'B2' || level === 'C1') grammarFocus = "Subjunctive Mood (Opinion/Doubt) vs Reality";
    if (!grammarFocus) grammarFocus = "Passato Prossimo vs Imperfetto";

    const prompt = `
    Create a "Grammar Detective Mystery" in Italian for a student at level ${level}.
    
    Focus on this grammatical nuance: ${grammarFocus}.
    
    Scenario: A suspect gives an alibi. The alibi contains a subtle grammatical mistake or a grammatical tense that reveals the truth (e.g., "I was sleeping" (imperfetto) implies interrupted action or continuity, whereas "I slept" (passato prossimo) implies completion).
    
    Task:
    1. Title: A catchy noir title (e.g. "L'Alibi Imperfetto").
    2. Suspect Statement: A short paragraph in Italian (2-3 sentences). Bold the key verbs using <b></b>.
    3. Question: A logic question about the statement.
    4. Options: 3 options. One is correct based on the grammar rule.
    5. Reward Clue: Name of a physical clue (e.g., "Lente d'ingrandimento", "Biglietto del treno").
    
    Return strict JSON:
    {
      "title": "...",
      "suspectStatement": "...",
      "question": "...",
      "difficulty": "${level}",
      "options": [
        { "text": "...", "isCorrect": boolean, "explanation": "Explain why based on grammar in Portuguese." }
      ],
      "rewardClue": "..."
    }
    `;

    try {
        const result = await getAi().models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: [{ parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                temperature: 0.9 
            }
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if(!text) throw new Error("Empty Detective text");
        const data = JSON.parse(cleanJSON(text));
        return {
            id: `case_${Date.now()}`,
            ...data
        };
    } catch (e) {
        console.error("Detective Case Generation Failed:", e);
        return null;
    }
};

// Deprecated: Old Story Mode (Single)
export const generateStory = async (targetVerbs: string[], level: string) => {
    return { title: "Deprecated", storyText: "Update app", translation: "" };
};

export const generateMilestoneExam = async (allVerbs: string[], tier: number): Promise<MilestoneExam | null> => {
     const verbsToUse = allVerbs.length > 0 ? allVerbs : ["Essere", "Avere", "Andare", "Fare", "Mangiare"];
     
     // 1. Try AI First with stronger Prompt
     const prompt = `
     Create a Milestone Exam for Italian Level Tier ${tier}. 
     Verbs to test: ${verbsToUse.slice(0, 15).join(", ")}.
     
     Rules:
     1. Questions must be non-empty strings.
     2. Context must be clear.
     3. "question" field: The prompt the user sees (e.g., "Conjugate 'Essere' for 'Io'").
     4. "verb": The infinitive of the verb being tested.
     
     Return strict JSON: 
     { 
       "id": "ms_${Date.now()}", 
       "tier": ${tier}, 
       "questions": [
         { 
           "type": "TRANSLATE_PT_IT", 
           "question": "Como se diz 'Eu sou' em Italiano?", 
           "context": "Verbo Essere", 
           "correctAnswer": "Io sono", 
           "verb": "Essere" 
         },
         {
           "type": "CONJUGATE",
           "question": "Conjugue: Noi ______ (Andare) al cinema.",
           "context": "Presente",
           "correctAnswer": "andiamo",
           "verb": "Andare"
         }
       ] 
     }`;

    try {
        const result = await getAi().models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty AI response");
        return JSON.parse(cleanJSON(text));
    } catch (e) {
        console.error("Gemini Milestone Failed, switching to LOCAL:", e);
        // FORCE LOCAL GENERATION IF AI FAILS
        return generateLocalMilestoneExam(tier, allVerbs);
    }
};

export const generateStoreItemIdea = async (category: string, priceRange: string) => {
    const prompt = `Store Item Idea. Category: ${category}. Price: ${priceRange}. JSON: { "name": "...", "description": "...", "emoji": "..." }`;
    try {
        const result = await getAi().models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(cleanJSON(result.candidates?.[0]?.content?.parts?.[0]?.text || "null"));
    } catch (e) { return null; }
};

export const generateEmoji = async (text: string) => {
    try {
        const result = await getAi().models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: `Single emoji for: ${text}` }] }]
        });
        return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "📦";
    } catch (e) { return "📦"; }
};

export const generateIllustration = async (storyText: string): Promise<string | null> => {
    try {
         const cleanPrompt = storyText.replace(/<[^>]*>/g, '').substring(0, 400);
         const response = await getAi().models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: [{ 
                parts: [{ text: `Create an artistic illustration for this story scene (Italian style, warm colors): ${cleanPrompt}` }] 
            }],
            config: {}
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) { return null; }
};

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
