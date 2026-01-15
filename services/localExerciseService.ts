
import { Exercise, ExerciseType, VerbLevel, VerbLessonSession, MilestoneExam, MilestoneQuestion } from "../types";
import { VerbEntry, VERB_DATABASE } from "../data/verbs";
import { IRREGULAR_PRESENTE, FULL_PASSATO_PROSSIMO_DB, conjugateRegular, PRONOUNS } from "../data/conjugationRules";
import { RICH_GENERIC_TEMPLATES, VERB_SPECIFIC_TEMPLATES } from "../data/sentenceTemplates";

const normalizeVerb = (v: string) => {
    const trimmed = v.trim().toLowerCase();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const SUBJECTS_BY_PERSON: Record<number, string[]> = {
  0: ["Io"], 
  1: ["Tu"], 
  2: ["Lui", "Lei", "Mario", "Anna", "Il professore", "La mamma"], 
  3: ["Noi"], 
  4: ["Voi"], 
  5: ["Loro", "I ragazzi", "Le ragazze", "I miei amici"] 
};

// Generate a random sentence for a specific verb and specific person index
const generateSentence = (verb: string, personIndex: number, conjugation: string[]): {context: string, sentenceStart: string, sentenceEnd: string, correctAnswer: string} => {
    const subjects = SUBJECTS_BY_PERSON[personIndex];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const answer = conjugation[personIndex];

    // SEMANTICALLY SAFE TEMPLATES
    // Removed "bene", "sempre", "adesso" generic usages that cause logic errors with verbs like "Odiare" or "Morire".
    // Using modal-like structures or emphatic positions which fit 99% of verbs.
    
    const SAFE_TEMPLATES = [
        "In questo momento [SUBJECT] [VERBO].", // Right now... (Works for almost all actions)
        "Perché [SUBJECT] [VERBO] così?", // Why ... like that? (Works for Odiate, Mangiate, Dormite)
        "Forse [SUBJECT] non [VERBO].", // Perhaps ... not ...
        "Di sicuro [SUBJECT] [VERBO].", // For sure ...
        "[SUBJECT] [VERBO] davvero." // ... really ...
    ];

    let template = SAFE_TEMPLATES[Math.floor(Math.random() * SAFE_TEMPLATES.length)];
    
    // Check if specific templates exist (High Priority)
    const specificTemplates = VERB_SPECIFIC_TEMPLATES[verb];
    if (specificTemplates && specificTemplates.length > 0) {
        template = specificTemplates[Math.floor(Math.random() * specificTemplates.length)];
    }

    const sentenceWithSubject = template.replace("[SUBJECT]", subject);
    const parts = sentenceWithSubject.split(/\[VERBO\]/);
    
    const start = parts.length > 0 ? parts[0] : `${subject} `;
    const end = parts.length > 1 ? parts[1] : "";

    return {
        context: "Esercizio Pratico",
        sentenceStart: start,
        sentenceEnd: end,
        correctAnswer: answer
    };
};

export const generateLocalLesson = (verb: VerbEntry, tense: string = "Presente Indicativo"): VerbLessonSession | null => {
    const cleanInfinitive = normalizeVerb(verb.infinitive);
    
    let conjugation: string[] | null = null;
    
    // Check Tense Request
    if (tense === "Passato Prossimo" && FULL_PASSATO_PROSSIMO_DB[cleanInfinitive]) {
        conjugation = FULL_PASSATO_PROSSIMO_DB[cleanInfinitive];
    } else if (IRREGULAR_PRESENTE[cleanInfinitive]) {
        conjugation = IRREGULAR_PRESENTE[cleanInfinitive];
    } else {
        conjugation = conjugateRegular(cleanInfinitive, verb.tags);
    }

    if (!conjugation) return null;

    // Generate sentences for practice stage
    const p1 = Math.floor(Math.random() * 6);
    let p2 = Math.floor(Math.random() * 6);
    while(p2 === p1) p2 = Math.floor(Math.random() * 6);
    const s1 = generateSentence(cleanInfinitive, p1, conjugation);
    const s2 = generateSentence(cleanInfinitive, p2, conjugation);

    // Type description
    let typeDesc = "Verbo Regular";
    if (verb.tags?.includes('irregular')) typeDesc = "Verbo Irregular";
    if (cleanInfinitive.endsWith('are')) typeDesc += " (-ARE)";
    else if (cleanInfinitive.endsWith('ere')) typeDesc += " (-ERE)";
    else if (cleanInfinitive.endsWith('ire')) typeDesc += " (-IRE)";

    return {
        id: `local-lesson-${Date.now()}`,
        verb: verb.infinitive,
        level: verb.level,
        tense: tense,
        lesson: {
            definition: verb.translation,
            secondaryTranslations: [], 
            verbType: typeDesc,
            fullConjugation: conjugation,
            usageTip: "Verbo essenziale nella lingua italiana." // Safer Fallback Tip
        },
        practiceSentences: [s1, s2]
    };
};

export const generateLocalExercise = (verb: VerbEntry): Exercise | null => {
   return null; 
};

// --- NEW: MILESTONE FALLBACK GENERATOR ---
export const generateLocalMilestoneExam = (tier: number, userVerbs: string[]): MilestoneExam => {
    const questions: MilestoneQuestion[] = [];
    
    // 1. Select Verbs to test (Prioritize user verbs, fill with DB)
    let candidates = VERB_DATABASE.filter(v => userVerbs.includes(v.infinitive));
    if (candidates.length < 10) {
        // If not enough history, take randoms from DB
        const others = VERB_DATABASE.filter(v => !userVerbs.includes(v.infinitive));
        candidates = [...candidates, ...others.slice(0, 10 - candidates.length)];
    }
    
    // Shuffle candidates
    candidates = candidates.sort(() => Math.random() - 0.5).slice(0, 10);

    // 2. Create Questions
    candidates.forEach((verbEntry, idx) => {
        const clean = normalizeVerb(verbEntry.infinitive);
        const randType = Math.random();
        
        let q: MilestoneQuestion;

        if (randType < 0.4) {
            // TYPE: TRANSLATE (PT -> IT)
            q = {
                type: 'TRANSLATE_PT_IT',
                question: `Como se diz "${verbEntry.translation}" em Italiano?`,
                context: "Vocabolario",
                correctAnswer: verbEntry.infinitive,
                verb: verbEntry.infinitive
            };
        } else {
            // TYPE: CONJUGATE
            let conjugation = IRREGULAR_PRESENTE[clean] || conjugateRegular(clean, verbEntry.tags);
            
            if (!conjugation) {
                // Safe fallback if conjugation fails
                q = {
                    type: 'TRANSLATE_PT_IT',
                    question: `Qual o significado de "${verbEntry.infinitive}"?`,
                    context: "Significato",
                    correctAnswer: verbEntry.translation,
                    verb: verbEntry.infinitive
                };
            } else {
                const pIdx = Math.floor(Math.random() * 6);
                const pronoun = PRONOUNS[pIdx];
                const answer = conjugation[pIdx];
                
                q = {
                    type: 'CONJUGATE',
                    question: `Conjugue: ${pronoun} ______`,
                    context: `Verbo: ${verbEntry.infinitive}`,
                    correctAnswer: answer,
                    verb: verbEntry.infinitive
                };
            }
        }
        questions.push(q);
    });

    return {
        id: `local-milestone-${Date.now()}`,
        tier: tier,
        questions: questions
    };
};
