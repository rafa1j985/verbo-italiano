
import { Exercise, ExerciseType, VerbLevel, VerbLessonSession } from "../types";
import { VerbEntry } from "../data/verbs";
import { IRREGULAR_PRESENTE, FULL_PASSATO_PROSSIMO_DB, conjugateRegular } from "../data/conjugationRules";
import { GENERIC_TEMPLATES, VERB_SPECIFIC_TEMPLATES } from "../data/sentenceTemplates";

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

// Realistic contexts for fallback scenarios to replace "Complete a frase"
const FALLBACK_CONTEXTS = [
    "Vida Cotidiana",
    "Expressando uma Opinião",
    "No Trabalho",
    "Descrevendo uma Ação",
    "Em Casa",
    "Durante uma Viagem",
    "Conversa entre Amigos",
    "Situação Hipotética",
    "Rotina Diária",
    "Expressando Dúvida"
];

// Generate a random sentence for a specific verb and specific person index
const generateSentence = (verb: string, personIndex: number, conjugation: string[]): {context: string, sentenceStart: string, sentenceEnd: string, correctAnswer: string} => {
    const subjects = SUBJECTS_BY_PERSON[personIndex];
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const answer = conjugation[personIndex];

    let template = "";
    const specificTemplates = VERB_SPECIFIC_TEMPLATES[verb];
    
    if (specificTemplates && specificTemplates.length > 0) {
        template = specificTemplates[Math.floor(Math.random() * specificTemplates.length)];
    } else {
        template = GENERIC_TEMPLATES[Math.floor(Math.random() * GENERIC_TEMPLATES.length)];
    }

    const sentenceWithSubject = template.replace("[SUBJECT]", subject);
    const parts = sentenceWithSubject.split("[VERB]");
    const start = parts.length > 0 ? parts[0] : `${subject} `;
    const end = parts.length > 1 ? parts[1] : "";

    // Select a random context to make the fallback feel more alive
    const randomContext = FALLBACK_CONTEXTS[Math.floor(Math.random() * FALLBACK_CONTEXTS.length)];

    return {
        context: randomContext,
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
            usageTip: "Use este verbo em contextos do dia a dia." // Fallback Tip
        },
        practiceSentences: [s1, s2]
    };
};

export const generateLocalExercise = (verb: VerbEntry): Exercise | null => {
   return null; 
};
