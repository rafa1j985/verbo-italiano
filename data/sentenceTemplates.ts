
// --- CULTURAL QUOTES (LOADING SCREEN) ---
export const CULTURAL_QUOTES = [
    { it: "Chi va piano, va sano e va lontano.", pt: "Quem vai devagar, vai saudável e vai longe.", author: "Proverbio" },
    { it: "Non tutte le ciambelle escono col buco.", pt: "Nem tudo sai como planejado (Nem todas as roscas saem com furo).", author: "Modo di dire" },
    { it: "Meglio tardi che mai.", pt: "Antes tarde do que nunca.", author: "Proverbio" },
    { it: "A tavola non si invecchia.", pt: "À mesa não se envelhece.", author: "Tradizione" },
    { it: "Fatti non foste a viver come bruti, ma per seguir virtute e canoscenza.", pt: "Não fostes feitos para viver como brutos, mas para seguir virtude e conhecimento.", author: "Dante Alighieri" },
    { it: "La vita è bella.", pt: "A vida é bela.", author: "Roberto Benigni" },
    { it: "In bocca al lupo!", pt: "Boa sorte! (Na boca do lobo)", author: "Espressione" },
    { it: "L'abito non fa il monaco.", pt: "O hábito não faz o monge.", author: "Proverbio" },
    { it: "Chi dorme non piglia pesci.", pt: "Quem dorme não pega peixe.", author: "Proverbio" },
    { it: "Tutto è possibile a chi crede.", pt: "Tudo é possível para quem acredita.", author: "San Francesco" },
    { it: "Ride bene chi ride ultimo.", pt: "Ri melhor quem ri por último.", author: "Proverbio" },
    { it: "L'appetito vien mangiando.", pt: "O apetite vem comendo.", author: "Modo di dire" },
    { it: "Roma non è stata costruita in un giorno.", pt: "Roma não foi construída em um dia.", author: "Proverbio" },
    { it: "Oggi a me, domani a te.", pt: "Hoje eu, amanhã você.", author: "Modo di dire" },
    { it: "Vedi Napoli e poi muori.", pt: "Veja Nápoles e depois morra (de tão bela).", author: "Goethe" }
];

// --- RICH FALLBACK TEMPLATES (OFFLINE MODE) ---
// Used when AI is unreachable. Structured to be grammatically safe but contextually rich.

export const RICH_GENERIC_TEMPLATES = [
  "In mezzo al traffico di Roma, [SUBJECT] [VERBO] furiosamente.",
  "Sinceramente, non capisco perché [SUBJECT] non [VERBO] mai la domenica.",
  "Dopo aver mangiato una pizza intera, [SUBJECT] [VERBO] con fatica.",
  "Se non smette di piovere, [SUBJECT] [VERBO] a casa tutto il giorno.",
  "In ufficio tutti sanno che [SUBJECT] [VERBO] meglio di chiunque altro.",
  "[SUBJECT] [VERBO], ma senza troppa convinzione.",
  "Durante la riunione di condominio, [SUBJECT] [VERBO] ad alta voce.",
  "Per risparmiare soldi, [SUBJECT] [VERBO] raramente al ristorante.",
  "È incredibile come [SUBJECT] [VERBO] sempre nel momento sbagliato.",
  "Davanti al Colosseo, [SUBJECT] [VERBO] con ammirazione."
];

export const VERB_SPECIFIC_TEMPLATES: Record<string, string[]> = {
  "Mangiare": [
    "Come un vero italiano, [SUBJECT] [VERBO] la pasta al dente.",
    "Non mettere l'ananas sulla pizza se [SUBJECT] [VERBO] qui!",
    "[SUBJECT] [VERBO] il tiramisù della nonna con gioia.",
    "Quando è nervoso, [SUBJECT] [VERBO] troppo cioccolato."
  ],
  "Bere": [
    "Al bar, [SUBJECT] [VERBO] un espresso al volo.",
    "[SUBJECT] [VERBO] solo vino rosso del Chianti.",
    "Per festeggiare, [SUBJECT] [VERBO] un po' di spumante.",
    "D'estate [SUBJECT] [VERBO] molta acqua ghiacciata."
  ],
  "Andare": [
    "Con questo sciopero dei treni, [SUBJECT] [VERBO] a piedi.",
    "[SUBJECT] [VERBO] a Milano per la settimana della moda.",
    "Tutte le estati [SUBJECT] [VERBO] in Sardegna.",
    "[SUBJECT] [VERBO] via perché la festa è noiosa."
  ],
  "Dire": [
    "[SUBJECT] [VERBO] sempre la verità, anche se fa male.",
    "Non [VERBO] sciocchezze, per favore!",
    "[SUBJECT] [VERBO] che la carbonara si fa senza panna.",
    "A bassa voce, [SUBJECT] [VERBO] un segreto importante."
  ],
  "Fare": [
    "[SUBJECT] [VERBO] colazione al bar ogni mattina.",
    "Che casino! [SUBJECT] [VERBO] sempre disastri.",
    "[SUBJECT] [VERBO] la fila alle poste da due ore.",
    "Non preoccuparti, [SUBJECT] [VERBO] tutto il possibile."
  ],
  "Essere": [
    "[SUBJECT] [VERBO] molto stanco dopo il lavoro.",
    "Forse [SUBJECT] [VERBO] in ritardo per colpa del traffico.",
    "[SUBJECT] [VERBO] felice di vederti finalmente.",
    "In Italia, [SUBJECT] [VERBO] importante gesticolare."
  ],
  "Avere": [
    "[SUBJECT] [VERBO] fame da morire!",
    "[SUBJECT] [VERBO] voglia di un gelato artigianale.",
    "Purtroppo [SUBJECT] [VERBO] fretta e non può fermarsi.",
    "[SUBJECT] [VERBO] ragione su tutta la linea."
  ],
  "Volere": [
    "[SUBJECT] [VERBO] assolutamente visitare Venezia.",
    "Per il mio compleanno, [SUBJECT] [VERBO] una festa sorpresa.",
    "[SUBJECT] [VERBO] solo un po' di pace e tranquillità."
  ],
  "Potere": [
    "Mi scusi, [SUBJECT] [VERBO] ripetere la domanda?",
    "Purtroppo oggi [SUBJECT] non [VERBO] venire.",
    "[SUBJECT] [VERBO] fare molto meglio di così."
  ],
  "Dovere": [
    "[SUBJECT] [VERBO] studiare di più i verbi irregolari.",
    "Purtroppo [SUBJECT] [VERBO] lavorare fino a tardi.",
    "[SUBJECT] [VERBO] assolutamente provare questo tiramisù."
  ],
  "Parlare": [
    "[SUBJECT] [VERBO] italiano con un accento strano.",
    "Non mi piace quando [SUBJECT] [VERBO] alle mie spalle.",
    "[SUBJECT] [VERBO] troppo veloce per me."
  ],
  "Capire": [
    "Nonostante il rumore, [SUBJECT] [VERBO] tutto perfettamente.",
    "[SUBJECT] non [VERBO] perché gli italiani gesticolano tanto.",
    "Finalmente [SUBJECT] [VERBO] la differenza tra 'e' ed 'è'."
  ]
};
