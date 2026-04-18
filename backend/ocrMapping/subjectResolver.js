/**
 * backend/ocrMapping/subjectResolver.js
 *
 * Deterministically resolves OCR / typed block text to a canonical Subject.
 * This version is stronger than flat word matching because it uses:
 * - exact phrase matches
 * - token matches
 * - partial phrase support
 * - subject dominance boost
 * - CA suppression
 * - ambiguity gap rules
 */

const SUBJECT_DICT = [
  {
    id: "GS1-HIS",
    name: "History",
    exact: [
      "history",
      "his",
      "modern history",
      "ancient history",
      "medieval history",
      "freedom struggle",
      "national movement",
      "indian history",
    ],
    keywords: [
      "history",
      "bengal",
      "gandhi",
      "revolt",
      "act 1909",
      "act 1919",
      "act 1935",
      "maurya",
      "gupta",
      "mughal",
      "bhakti",
      "sufi",
      "congress",
      "swadeshi",
      "1857",
      "moderates",
      "extremists",
      "governor general",
      "viceroy",
    ],
  },
  {
    id: "GS1-GEO",
    name: "Geography",
    exact: [
      "geography",
      "geo",
      "world geography",
      "indian geography",
      "physical geography",
      "human geography",
    ],
    keywords: [
      "geography",
      "earthquake",
      "volcano",
      "climate",
      "monsoon",
      "ocean",
      "river",
      "soil",
      "agriculture",
      "industry",
      "cyclone",
      "plate tectonics",
      "drainage",
      "population geography",
      "settlement",
      "resources",
      "landform",
      "weather",
    ],
  },
  {
    id: "GS1-CUL",
    name: "Culture",
    exact: [
      "culture",
      "cul",
      "art and culture",
      "indian heritage",
      "heritage",
    ],
    keywords: [
      "culture",
      "architecture",
      "temple",
      "dance",
      "music",
      "painting",
      "bhakti",
      "sufi",
      "sculpture",
      "literature",
      "religion",
      "performing arts",
      "heritage",
      "stupa",
      "cave",
      "school of art",
    ],
  },
  {
    id: "GS1-SOC",
    name: "Society",
    exact: [
      "society",
      "soc",
      "indian society",
      "social issues",
    ],
    keywords: [
      "society",
      "women",
      "population",
      "poverty",
      "urbanization",
      "globalization",
      "secularism",
      "communalism",
      "regionalism",
      "social empowerment",
      "diversity",
      "caste",
    ],
  },
  {
    id: "GS2-POL",
    name: "Polity",
    exact: [
      "polity",
      "pol",
      "indian polity",
      "constitution",
      "constitutional law",
    ],
    keywords: [
      "polity",
      "constitution",
      "parliament",
      "president",
      "governor",
      "judiciary",
      "fundamental rights",
      "dpsp",
      "panchayat",
      "election",
      "citizenship",
      "writ",
      "amendment",
      "federalism",
      "supreme court",
      "high court",
      "constitutional bodies",
      "ordinance",
      "bill",
      "article",
    ],
  },
  {
    id: "GS2-GOV",
    name: "Governance",
    exact: [
      "governance",
      "gov",
      "social justice",
    ],
    keywords: [
      "governance",
      "ngo",
      "shg",
      "civil services",
      "e-governance",
      "welfare schemes",
      "health",
      "education",
      "poverty",
      "hunger",
      "service delivery",
      "transparency",
      "accountability",
      "social sector",
    ],
  },
  {
    id: "GS2-IR",
    name: "International Relations",
    exact: [
      "international relations",
      "ir",
      "foreign policy",
    ],
    keywords: [
      "international relations",
      "ir",
      "india and neighborhood",
      "bilateral",
      "regional",
      "global",
      "un",
      "wto",
      "imf",
      "world bank",
      "foreign policy",
      "geopolitics",
      "strategic partnership",
      "quad",
      "brics",
      "g20",
      "unsc",
    ],
  },
  {
    id: "GS3-ECO",
    name: "Economy",
    exact: [
      "economy",
      "eco",
      "indian economy",
      "economics",
      "economic development",
    ],
    keywords: [
      "economy",
      "gdp",
      "inflation",
      "rbi",
      "monetary policy",
      "fiscal policy",
      "budget",
      "taxation",
      "banking",
      "agriculture pricing",
      "infrastructure",
      "investment",
      "repo rate",
      "reverse repo",
      "mpc",
      "bop",
      "balance of payments",
      "forex",
      "exchange rate",
      "cad",
      "sebi",
      "capital market",
      "money market",
      "subsidy",
    ],
  },
  {
    id: "GS3-ENV",
    name: "Environment",
    exact: [
      "environment",
      "env",
      "ecology",
      "biodiversity",
    ],
    keywords: [
      "environment",
      "ecology",
      "biodiversity",
      "climate change",
      "pollution",
      "conservation",
      "eia",
      "disaster",
      "ecosystem",
      "species",
      "wetland",
      "national park",
      "wildlife sanctuary",
      "protected area",
      "unfccc",
      "cbd",
      "ramsar",
      "cites",
      "cop",
      "desertification",
    ],
  },
  {
    id: "GS3-ST",
    name: "Science Tech",
    exact: [
      "science tech",
      "st",
      "science and tech",
      "science and technology",
      "sci tech",
      "science",
    ],
    keywords: [
      "science",
      "technology",
      "space",
      "it",
      "computers",
      "robotics",
      "nano-tech",
      "bio-tech",
      "ipr",
      "defense",
      "artificial intelligence",
      "ai",
      "machine learning",
      "quantum",
      "semiconductor",
      "isro",
      "satellite",
      "biotechnology",
      "gene editing",
      "crispr",
    ],
  },
  {
    id: "GS3-IS",
    name: "Internal Security",
    exact: [
      "internal security",
      "is",
      "security",
    ],
    keywords: [
      "security",
      "extremism",
      "terrorism",
      "border management",
      "cyber security",
      "money laundering",
      "organized crime",
      "radicalization",
      "insurgency",
      "naxalism",
    ],
  },
  {
    id: "GS3-DM",
    name: "Disaster Management",
    exact: [
      "disaster management",
      "dm",
    ],
    keywords: [
      "disaster",
      "earthquake",
      "tsunami",
      "cyclone",
      "ndma",
      "disaster management act",
      "mitigation",
      "preparedness",
      "response",
      "resilience",
    ],
  },
  {
    id: "GS4-ETH",
    name: "Ethics",
    exact: [
      "ethics",
      "eth",
      "ethics integrity and aptitude",
      "ethics integrity aptitude",
      "ethics, integrity, aptitude",
      "ethics integrity & aptitude",
      "gs4",
      "gs 4",
      "gs-4",
      "gs iv",
      "gs-iv",
      "general studies 4",
      "general studies iv",
      "general studies paper 4",
      "general studies paper iv",
    ],
    keywords: [
      "ethics",
      "integrity",
      "aptitude",
      "values",
      "emotional intelligence",
      "probity",
      "moral",
      "philosopher",
      "attitude",
      "civil service values",
      "case study",
    ],
  },
  {
    id: "CSAT",
    name: "CSAT",
    exact: [
      "csat",
      "aptitude",
      "reasoning",
      "quant",
      "reading comprehension",
    ],
    keywords: [
      "csat",
      "math",
      "reasoning",
      "logic",
      "comprehension",
      "passage",
      "number system",
      "percentage",
      "ratio",
      "profit loss",
      "time work",
      "time speed",
      "clock",
      "calendar",
      "syllogism",
      "seating arrangement",
      "analytical reasoning",
      "data interpretation",
      "permutation",
      "probability",
    ],
  },
  {
    id: "CA",
    name: "Current Affairs",
    exact: [
      "current affairs",
      "ca",
      "daily ca",
      "monthly mag",
      "newspaper",
      "hindu",
      "express",
    ],
    keywords: [
      "current affairs",
      "ca",
      "news",
      "editorial",
      "today news",
      "monthly current affairs",
      "daily current affairs",
    ],
  },
  {
    id: "ESSAY",
    name: "Essay",
    exact: [
      "essay",
    ],
    keywords: [
      "essay",
      "writing",
      "quote",
      "philosophical essay",
      "argumentative essay",
    ],
  },
  {
    id: "OPTIONAL",
    name: "Optional",
    exact: [
      "optional",
    ],
    keywords: [
      "optional",
      "paper 1",
      "paper 2",
    ],
  },
];

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[_/\\|]+/g, " ")
    .replace(/[^\w\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPhrases(text = "") {
  const words = normalizeText(text).split(" ").filter(Boolean);
  const phrases = new Set();

  for (let i = 0; i < words.length; i++) {
    phrases.add(words[i]);

    if (i < words.length - 1) {
      phrases.add(`${words[i]} ${words[i + 1]}`);
    }

    if (i < words.length - 2) {
      phrases.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    if (i < words.length - 3) {
      phrases.add(`${words[i]} ${words[i + 1]} ${words[i + 2]} ${words[i + 3]}`);
    }
  }

  return Array.from(phrases);
}

function countPhraseHits(text, list = []) {
  let count = 0;
  for (const item of list) {
    const normalizedItem = normalizeText(item);
    if (normalizedItem && text.includes(normalizedItem)) {
      count += 1;
    }
  }
  return count;
}

function calculateSubjectScore(text, subjectDef) {
  let score = 0;
  const normalizedText = normalizeText(text);
  const phrases = buildPhrases(normalizedText);
  const exactList = subjectDef.exact.map(normalizeText);
  const keywordList = subjectDef.keywords.map(normalizeText);

  if (exactList.includes(normalizedText)) {
    score += 140;
  }

  for (const phrase of phrases) {
    if (exactList.includes(phrase)) {
      score += phrase.includes(" ") ? 90 : 70;
    } else if (keywordList.includes(phrase)) {
      score += phrase.includes(" ") ? 45 : 30;
    } else {
      for (const kw of keywordList) {
        if (
          phrase.length > 3 &&
          kw.length > phrase.length &&
          kw.includes(phrase)
        ) {
          score += 5;
        }
      }
    }
  }

  const exactPhraseHits = countPhraseHits(normalizedText, exactList);
  const keywordPhraseHits = countPhraseHits(normalizedText, keywordList);

  score += exactPhraseHits * 20;
  score += keywordPhraseHits * 10;

  const hasStrongDomainPhrase = keywordList.some(
    (kw) => kw.includes(" ") && normalizedText.includes(kw)
  );

  const hasAnyDomainKeyword = keywordList.some((kw) => normalizedText.includes(kw));

  if (hasStrongDomainPhrase) {
    score += 25;
  }

  if (hasAnyDomainKeyword) {
    score += 15;
  }

  if (subjectDef.id === "CA") {
    score -= 25;
    if (
      !exactList.some((phrase) => normalizedText.includes(phrase)) &&
      keywordPhraseHits < 2
    ) {
      score -= 20;
    }
  }

  if (subjectDef.id === "CSAT") {
    const csatStrong = [
      "number system",
      "reading comprehension",
      "analytical reasoning",
      "data interpretation",
      "profit loss",
      "time work",
      "ratio",
      "percentage",
      "passage",
      "reasoning",
      "clock",
      "calendar",
    ];
    const csatStrongHits = csatStrong.filter((k) =>
      normalizedText.includes(k)
    ).length;
    score += csatStrongHits * 18;
  }

  if (subjectDef.id === "GS3-ECO") {
    const ecoStrong = [
      "repo rate",
      "reverse repo",
      "monetary policy",
      "fiscal policy",
      "rbi",
      "inflation",
      "banking",
      "balance of payments",
      "forex",
      "exchange rate",
      "mpc",
    ];
    const ecoStrongHits = ecoStrong.filter((k) =>
      normalizedText.includes(k)
    ).length;
    score += ecoStrongHits * 18;
  }

  if (subjectDef.id === "GS2-POL") {
    const polStrong = [
      "fundamental rights",
      "dpsp",
      "constitution",
      "parliament",
      "judiciary",
      "supreme court",
      "high court",
      "citizenship",
      "writ",
      "federalism",
    ];
    const polStrongHits = polStrong.filter((k) =>
      normalizedText.includes(k)
    ).length;
    score += polStrongHits * 18;
  }

  if (subjectDef.id === "GS3-ENV") {
    const envStrong = [
      "climate change",
      "biodiversity",
      "ecosystem",
      "unfccc",
      "cbd",
      "ramsar",
      "cites",
      "species",
      "national park",
      "wildlife sanctuary",
    ];
    const envStrongHits = envStrong.filter((k) =>
      normalizedText.includes(k)
    ).length;
    score += envStrongHits * 18;
  }

  if (subjectDef.id === "GS1-CUL") {
    const culStrong = [
      "architecture",
      "temple",
      "dance",
      "music",
      "painting",
      "sculpture",
      "literature",
      "performing arts",
      "heritage",
    ];
    const culStrongHits = culStrong.filter((k) =>
      normalizedText.includes(k)
    ).length;
    score += culStrongHits * 18;
  }

  return Math.max(score, 0);
}

// Stage → GS paper prefix suffix map for boosting correct paper
const GS_PAPER_PREFIX = {
  GS1: 'GS1',
  GS2: 'GS2',
  GS3: 'GS3',
  GS4: 'GS4',
};

// Stage-compatible subject IDs
// prelims: ALL subjects are fair game (prelims is general)
// mains: prefer GS1/GS2/GS3/GS4 subjects, suppress CSAT/CA for non-CA blocks
const MAINS_ONLY_SUBJECTS = new Set(['GS1-HIS', 'GS1-GEO', 'GS1-CUL', 'GS1-SOC',
  'GS2-POL', 'GS2-GOV', 'GS2-IR', 'GS3-ECO', 'GS3-ENV', 'GS3-ST', 'GS3-IS',
  'GS3-DM', 'GS4-ETH']);

/**
 * Resolve subject from cleaned OCR text.
 *
 * @param {string} cleanedText  - Cleaned OCR text
 * @param {Object} [ctx]        - Stage context from detectOcrStage
 * @param {string} [ctx.stage]  - 'prelims'|'mains'|'csat'|'essay'|'general'
 * @param {string|null} [ctx.gsPaper] - 'GS1'|'GS2'|'GS3'|'GS4'|null
 * @returns {Object} - Subject resolution result
 */
export function resolveSubject(cleanedText, ctx = {}) {
  const normalizedText = normalizeText(cleanedText);
  const { stage = 'general', gsPaper = null } = ctx;

  if (!normalizedText) {
    return {
      subjectId: null,
      subjectName: "Unknown",
      confidenceScore: 0,
      confidenceBadge: "LOW",
      isLocked: false,
      candidates: [],
      gapScore: 0,
      reason: "empty_input",
    };
  }

  const scoreEntries = SUBJECT_DICT.map((sub) => {
    let score = calculateSubjectScore(normalizedText, sub);

    // Stage-based boosting:
    // If stage is 'prelims', suppress mains-specific subjects slightly
    if (stage === 'prelims' && MAINS_ONLY_SUBJECTS.has(sub.id)) {
      score = Math.max(score - 20, 0);
    }

    // If a GS paper is detected, boost the matching paper's subjects
    if (gsPaper && sub.id.startsWith(GS_PAPER_PREFIX[gsPaper] || '__')) {
      score += 30;
    }

    // If stage is 'mains', suppress CSAT and CA unless text matches them
    if (stage === 'mains' && (sub.id === 'CSAT' || sub.id === 'CA')) {
      score = Math.max(score - 40, 0);
    }

    // If stage is 'prelims', suppress mains-exclusive subjects
    if (stage === 'prelims' && (sub.id === 'ESSAY')) {
      score = Math.max(score - 40, 0);
    }

    return { subjectId: sub.id, subjectName: sub.name, score };
  }).filter((s) => s.score > 0);

  scoreEntries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.subjectId.localeCompare(b.subjectId);
  });

  if (scoreEntries.length === 0) {
    return {
      subjectId: null,
      subjectName: "Unmapped",
      confidenceScore: 0,
      confidenceBadge: "LOW",
      isLocked: false,
      candidates: [],
      gapScore: 0,
      reason: "no_subject_match",
    };
  }

  const top = scoreEntries[0];
  const second = scoreEntries[1] || null;

  const confidenceScore = Math.min(top.score / 160, 1.0);
  const gapScore = second ? Math.max((top.score - second.score) / 160, 0) : 1.0;

  const isAmbiguous =
    confidenceScore < 0.60 ||
    (confidenceScore < 0.80 && gapScore < 0.15);

  const confidenceBadge = isAmbiguous
    ? "LOW"
    : confidenceScore >= 0.85 && gapScore >= 0.15
      ? "HIGH"
      : "MEDIUM";

  return {
    subjectId: isAmbiguous ? null : top.subjectId,
    subjectName: isAmbiguous ? "Unmapped" : top.subjectName,
    confidenceScore,
    confidenceBadge,
    isLocked: !isAmbiguous,
    candidates: scoreEntries.slice(0, 3),
    gapScore,
    reason: isAmbiguous ? "ambiguous_subject_match" : "subject_locked",
  };
}