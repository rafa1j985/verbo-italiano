// Este arquivo contém os modelos de frases para o modo de fallback (emergência).
// O app agora prioriza o conteúdo gerado pela IA (buffer), mas usa isso se a conexão cair.
// Frases ajustadas para serem semanticamente neutras.

export const GENERIC_TEMPLATES = [
  "In questo momento [SUBJECT] [VERB] tranquillamente.",
  "Perché [SUBJECT] non [VERB] adesso?",
  "Di solito [SUBJECT] [VERB] molto.",
  "Forse [SUBJECT] [VERB] domani.",
  "Ogni giorno [SUBJECT] [VERB] un po'.",
  "[SUBJECT] [VERB] sempre così.",
  "Non credo che [SUBJECT] [VERB] qui.",
  "Quando [SUBJECT] [VERB], tutto cambia."
];

export const VERB_SPECIFIC_TEMPLATES: Record<string, string[]> = {
  // Verbos que pedem objetos diretos específicos foram simplificados para evitar erro semântico
  "Mangiare": [
    "[SUBJECT] [VERB] molto bene.",
    "Di solito [SUBJECT] non [VERB] carne.",
    "Dove [SUBJECT] [VERB] oggi?",
    "[SUBJECT] [VERB] un po' di pasta."
  ],
  "Bere": [
    "[SUBJECT] [VERB] acqua.",
    "Cosa [SUBJECT] [VERB]?",
    "[SUBJECT] [VERB] troppo caffè."
  ],
  "Essere": [
    "Oggi [SUBJECT] [VERB] felice.",
    "[SUBJECT] [VERB] italiano?",
    "Credo che [SUBJECT] [VERB] qui.",
    "[SUBJECT] non [VERB] pronto."
  ],
  "Avere": [
    "[SUBJECT] [VERB] tempo?",
    "[SUBJECT] [VERB] fame?",
    "[SUBJECT] [VERB] una buona idea."
  ],
  "Andare": [
    "[SUBJECT] [VERB] via.",
    "Dove [SUBJECT] [VERB]?",
    "[SUBJECT] [VERB] a casa."
  ],
  "Parlare": [
    "[SUBJECT] [VERB] piano.",
    "Con chi [SUBJECT] [VERB]?",
    "[SUBJECT] [VERB] italiano."
  ],
  "Vedere": [
    "[SUBJECT] [VERB] tutto.",
    "Non [SUBJECT] [VERB] niente.",
    "Quando [SUBJECT] [VERB]?"
  ]
};