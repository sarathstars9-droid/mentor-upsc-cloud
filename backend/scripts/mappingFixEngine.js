import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const DEFAULT_INPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_questions",
    "prelims",
    "gs"
);

const DEFAULT_OUTPUT_DIR = path.join(
    ROOT,
    "backend",
    "data",
    "pyq_fixed",
    "prelims",
    "gs"
);

const SUBJECT_RULES = {
    Polity: {
        keywords: [
            "constitution",
            "constitutional",
            "preamble",
            "fundamental rights",
            "directive principles",
            "dpsp",
            "fundamental duties",
            "parliament",
            "legislature",
            "lok sabha",
            "rajya sabha",
            "speaker",
            "president",
            "vice-president",
            "prime minister",
            "governor",
            "chief minister",
            "supreme court",
            "high court",
            "judiciary",
            "writ",
            "ordinance",
            "citizenship",
            "election commission",
            "cag",
            "finance commission",
            "panchayat",
            "municipality",
            "federalism",
            "center-state",
            "constitutional body",
            "tribunal"
        ],
        topicRules: {
            "Preamble & Constitutional Foundations": [
                "preamble",
                "basic structure",
                "constitutional morality",
                "constitutionalism"
            ],
            "Fundamental Rights / DPSP / Duties": [
                "fundamental rights",
                "article 14",
                "article 19",
                "article 21",
                "writ",
                "directive principles",
                "dpsp",
                "fundamental duties"
            ],
            "Union Executive": [
                "president",
                "vice-president",
                "prime minister",
                "council of ministers",
                "attorney general"
            ],
            "Parliament & Legislature": [
                "parliament",
                "lok sabha",
                "rajya sabha",
                "speaker",
                "money bill",
                "parliamentary committee",
                "legislature"
            ],
            "Judiciary": [
                "supreme court",
                "high court",
                "judicial review",
                "judiciary",
                "tribunal",
                "collegium"
            ],
            "Federalism & Local Governance": [
                "federalism",
                "center-state",
                "inter-state",
                "panchayat",
                "municipality",
                "73rd amendment",
                "74th amendment"
            ],
            "Constitutional / Statutory Bodies": [
                "election commission",
                "cag",
                "finance commission",
                "upsc",
                "nhrc",
                "cic",
                "niti aayog"
            ]
        }
    },

    Economy: {
        keywords: [
            "gdp",
            "gnp",
            "inflation",
            "deflation",
            "stagflation",
            "repo rate",
            "reverse repo",
            "monetary policy",
            "fiscal policy",
            "budget",
            "tax",
            "gst",
            "banking",
            "rbi",
            "slr",
            "crr",
            "poverty",
            "unemployment",
            "inclusive growth",
            "sebi",
            "stock exchange",
            "bond",
            "yield",
            "external sector",
            "balance of payments",
            "current account",
            "capital account",
            "exchange rate",
            "fdi",
            "fii",
            "subsidy",
            "msme",
            "npa"
        ],
        topicRules: {
            "Banking Structure": [
                "bank",
                "banking",
                "rbi",
                "npa",
                "crr",
                "slr",
                "scheduled bank",
                "payment bank",
                "small finance bank"
            ],
            "Monetary Policy": [
                "repo rate",
                "reverse repo",
                "monetary policy",
                "liquidity",
                "open market operations",
                "inflation targeting"
            ],
            "Inflation & Fiscal": [
                "inflation",
                "deflation",
                "stagflation",
                "fiscal deficit",
                "revenue deficit",
                "primary deficit"
            ],
            "Budget": [
                "budget",
                "finance bill",
                "appropriation bill",
                "charged expenditure",
                "public account",
                "contingency fund"
            ],
            "Taxation": [
                "tax",
                "gst",
                "direct tax",
                "indirect tax",
                "customs duty",
                "excise duty"
            ],
            "Financial Markets": [
                "sebi",
                "stock exchange",
                "bond",
                "debenture",
                "equity",
                "mutual fund",
                "yield"
            ],
            "External Sector": [
                "balance of payments",
                "current account",
                "capital account",
                "exchange rate",
                "devaluation",
                "fdi",
                "fii",
                "forex"
            ],
            "Growth & Development": [
                "gdp",
                "gnp",
                "national income",
                "growth",
                "development",
                "human development",
                "inclusive growth"
            ],
            "Poverty & Inclusion": [
                "poverty",
                "unemployment",
                "financial inclusion",
                "self help group",
                "jan dhan",
                "dbt",
                "social sector"
            ]
        }
    },

    Geography: {
        keywords: [
            "monsoon",
            "climate",
            "cyclone",
            "latitude",
            "longitude",
            "earthquake",
            "volcano",
            "river",
            "drainage",
            "plateau",
            "mountain",
            "soil",
            "ocean",
            "current",
            "desert",
            "forest",
            "mineral",
            "agriculture",
            "cropping",
            "resource region"
        ],
        topicRules: {
            "Geomorphology": [
                "earthquake",
                "volcano",
                "plate tectonics",
                "fold mountain",
                "erosion",
                "landform"
            ],
            "Climatology": [
                "monsoon",
                "climate",
                "cyclone",
                "pressure belt",
                "jet stream",
                "el nino",
                "la nina",
                "itcz"
            ],
            "Oceanography": [
                "ocean",
                "ocean current",
                "coral",
                "salinity",
                "tide",
                "upwelling"
            ],
            "Indian Geography": [
                "river",
                "drainage",
                "soil",
                "plateau",
                "mountain",
                "desert",
                "western ghats",
                "eastern ghats"
            ],
            "Resources & Agriculture": [
                "mineral",
                "resource",
                "agriculture",
                "cropping",
                "irrigation",
                "soil type"
            ]
        }
    },

    Environment: {
        keywords: [
            "biodiversity",
            "ecosystem",
            "species",
            "iucn",
            "wetland",
            "ramsar",
            "national park",
            "wildlife sanctuary",
            "biosphere reserve",
            "climate change",
            "pollution",
            "ozone",
            "carbon sink",
            "unfccc",
            "cop",
            "cites",
            "cms",
            "forest",
            "conservation"
        ],
        topicRules: {
            "Biodiversity & Species": [
                "species",
                "iucn",
                "endangered",
                "biodiversity",
                "invasive species"
            ],
            "Protected Areas": [
                "national park",
                "wildlife sanctuary",
                "biosphere reserve",
                "conservation reserve",
                "community reserve"
            ],
            "Climate Change": [
                "climate change",
                "global warming",
                "carbon sink",
                "unfccc",
                "cop",
                "paris agreement"
            ],
            "Environmental Conventions": [
                "ramsar",
                "cites",
                "cms",
                "cbd",
                "montreal protocol"
            ],
            "Pollution & Ecology": [
                "pollution",
                "ozone",
                "ecosystem",
                "food chain",
                "food web",
                "eutrophication"
            ]
        }
    },

    "Science & Technology": {
        keywords: [
            "dna",
            "rna",
            "gene",
            "genome",
            "biotechnology",
            "vaccine",
            "satellite",
            "space",
            "isro",
            "semiconductor",
            "robotics",
            "artificial intelligence",
            "quantum",
            "blockchain",
            "nanotechnology",
            "nuclear reactor",
            "laser",
            "crispr"
        ],
        topicRules: {
            "Biotechnology": [
                "dna",
                "rna",
                "gene",
                "genome",
                "biotechnology",
                "crispr",
                "stem cell",
                "vaccine"
            ],
            "Space Technology": [
                "satellite",
                "space",
                "isro",
                "launch vehicle",
                "orbit",
                "payload"
            ],
            "Emerging Technologies": [
                "artificial intelligence",
                "robotics",
                "quantum",
                "blockchain",
                "semiconductor",
                "nanotechnology"
            ],
            "Physics / Nuclear / Electronics": [
                "nuclear reactor",
                "laser",
                "semiconductor",
                "photon",
                "particle",
                "electromagnetic"
            ]
        }
    },

    "History & Culture": {
        keywords: [
            "harappa",
            "indus valley",
            "vedic",
            "buddhism",
            "jainism",
            "maurya",
            "gupta",
            "mughal",
            "bhakti",
            "sufi",
            "gandhi",
            "congress",
            "revolt of 1857",
            "swadeshi",
            "temple",
            "dance",
            "music",
            "painting",
            "architecture",
            "unesco",
            "stupa"
        ],
        topicRules: {
            "Ancient History": [
                "harappa",
                "indus valley",
                "vedic",
                "buddhism",
                "jainism",
                "maurya",
                "gupta"
            ],
            "Medieval History": [
                "mughal",
                "bhakti",
                "sufi",
                "sultanate",
                "vijayanagara"
            ],
            "Modern History": [
                "gandhi",
                "congress",
                "revolt of 1857",
                "swadeshi",
                "governor-general",
                "viceroy",
                "national movement"
            ],
            "Art & Culture": [
                "temple",
                "dance",
                "music",
                "painting",
                "architecture",
                "unesco",
                "stupa",
                "inscription"
            ]
        }
    }
};

const MICROTHEME_RULES = {
    "Fundamental Rights / DPSP / Duties": [
        { name: "Fundamental Rights", keys: ["fundamental rights", "article 14", "article 19", "article 21"] },
        { name: "DPSP", keys: ["directive principles", "dpsp"] },
        { name: "Fundamental Duties", keys: ["fundamental duties"] },
        { name: "Writs", keys: ["writ", "habeas corpus", "mandamus", "certiorari", "quo warranto", "prohibition"] }
    ],

    "Banking Structure": [
        { name: "RBI Functions", keys: ["rbi", "reserve bank"] },
        { name: "Bank Types", keys: ["payment bank", "small finance bank", "scheduled bank", "commercial bank"] },
        { name: "NPAs & Regulation", keys: ["npa", "prudential", "banking regulation"] }
    ],

    "Monetary Policy": [
        { name: "Policy Rates", keys: ["repo rate", "reverse repo", "bank rate", "standing deposit facility"] },
        { name: "Liquidity Tools", keys: ["liquidity", "open market operations", "omo", "crr", "slr"] },
        { name: "Inflation Targeting", keys: ["inflation targeting", "monetary policy committee", "mpc"] }
    ],

    "Inflation & Fiscal": [
        { name: "Inflation Concepts", keys: ["inflation", "deflation", "stagflation", "core inflation"] },
        { name: "Deficit Concepts", keys: ["fiscal deficit", "revenue deficit", "primary deficit"] }
    ],

    "Budget": [
        { name: "Budget Components", keys: ["budget", "finance bill", "appropriation bill"] },
        { name: "Government Funds", keys: ["public account", "contingency fund", "consolidated fund"] }
    ],

    "Taxation": [
        { name: "Direct Taxes", keys: ["income tax", "corporate tax", "direct tax"] },
        { name: "Indirect Taxes", keys: ["gst", "customs duty", "excise duty", "indirect tax"] }
    ],

    "Financial Markets": [
        { name: "Capital Market Instruments", keys: ["bond", "debenture", "equity", "mutual fund"] },
        { name: "Market Institutions", keys: ["sebi", "stock exchange", "depository"] }
    ],

    "External Sector": [
        { name: "Balance of Payments", keys: ["balance of payments", "current account", "capital account"] },
        { name: "Exchange Rate & Forex", keys: ["exchange rate", "forex", "devaluation", "appreciation"] },
        { name: "Capital Flows", keys: ["fdi", "fii", "fpi"] }
    ],

    "Growth & Development": [
        { name: "National Income", keys: ["gdp", "gnp", "nnp", "national income"] },
        { name: "Development Indicators", keys: ["human development", "hdi", "inclusive growth"] }
    ],

    "Poverty & Inclusion": [
        { name: "Poverty", keys: ["poverty", "poverty line"] },
        { name: "Employment", keys: ["unemployment", "employment"] },
        { name: "Financial Inclusion", keys: ["financial inclusion", "jan dhan", "dbt", "self help group"] }
    ],

    "Climatology": [
        { name: "Indian Monsoon", keys: ["monsoon", "southwest monsoon", "retreating monsoon"] },
        { name: "Climate Drivers", keys: ["el nino", "la nina", "itcz", "jet stream"] },
        { name: "Cyclones", keys: ["cyclone", "tropical cyclone"] }
    ],

    "Protected Areas": [
        { name: "National Parks", keys: ["national park"] },
        { name: "Wildlife Sanctuaries", keys: ["wildlife sanctuary"] },
        { name: "Biosphere Reserves", keys: ["biosphere reserve"] }
    ],

    "Climate Change": [
        { name: "UN Climate Framework", keys: ["unfccc", "cop", "paris agreement"] },
        { name: "Carbon & Warming", keys: ["global warming", "carbon sink", "net zero"] }
    ],

    "Biotechnology": [
        { name: "Genetics", keys: ["dna", "rna", "gene", "genome"] },
        { name: "Gene Editing", keys: ["crispr", "gene editing"] },
        { name: "Vaccines & Biomedical", keys: ["vaccine", "stem cell", "biotechnology"] }
    ],

    "Space Technology": [
        { name: "Satellites", keys: ["satellite", "payload", "orbit"] },
        { name: "Indian Space Missions", keys: ["isro", "launch vehicle", "space mission"] }
    ],

    "Art & Culture": [
        { name: "Temple Architecture", keys: ["temple", "nagara", "dravida", "vesara"] },
        { name: "Dance & Music", keys: ["dance", "music", "classical dance"] },
        { name: "Painting & Sculpture", keys: ["painting", "sculpture", "mural"] },
        { name: "UNESCO Heritage", keys: ["unesco", "heritage"] }
    ]
};

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getAllJsonFiles(dirPath) {
    const out = [];
    if (!fs.existsSync(dirPath)) return out;

    for (const entry of fs.readdirSync(dirPath)) {
        const full = path.join(dirPath, entry);
        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            out.push(...getAllJsonFiles(full));
        } else if (entry.toLowerCase().endsWith(".json")) {
            out.push(full);
        }
    }

    return out;
}

function normalizeText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[‐-–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function compactText(text) {
    return normalizeText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s&/-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseArgs() {
    const args = process.argv.slice(2);
    const out = {};

    for (let i = 0; i < args.length; i++) {
        const key = args[i];
        const val = args[i + 1];

        if (key.startsWith("--")) {
            out[key.slice(2)] = val && !val.startsWith("--") ? val : true;
            if (val && !val.startsWith("--")) i++;
        }
    }

    return out;
}

function scoreKeywords(text, keywords) {
    const normalized = compactText(text);
    let score = 0;

    for (const keyword of keywords) {
        const k = compactText(keyword);
        if (!k) continue;

        if (normalized.includes(k)) {
            score += k.split(" ").length >= 2 ? 3 : 1;
        }
    }

    return score;
}

function extractQuestionText(q) {
    return normalizeText(
        q.question ||
        q.questionText ||
        q.stem ||
        q.title ||
        q.text ||
        ""
    );
}

function detectSubject(text, currentSubject = "") {
    const subjectHint = compactText(currentSubject);

    if (subjectHint.includes("polity")) return { subject: "Polity", confidence: 0.99, reason: "existing-subject" };
    if (subjectHint.includes("economy")) return { subject: "Economy", confidence: 0.99, reason: "existing-subject" };
    if (subjectHint.includes("geography")) return { subject: "Geography", confidence: 0.99, reason: "existing-subject" };
    if (subjectHint.includes("environment")) return { subject: "Environment", confidence: 0.99, reason: "existing-subject" };
    if (subjectHint.includes("science")) return { subject: "Science & Technology", confidence: 0.99, reason: "existing-subject" };
    if (subjectHint.includes("history")) return { subject: "History & Culture", confidence: 0.99, reason: "existing-subject" };
    if (subjectHint.includes("culture")) return { subject: "History & Culture", confidence: 0.99, reason: "existing-subject" };

    let bestSubject = "Unknown";
    let bestScore = 0;

    for (const [subject, config] of Object.entries(SUBJECT_RULES)) {
        const score = scoreKeywords(text, config.keywords);
        if (score > bestScore) {
            bestScore = score;
            bestSubject = subject;
        }
    }

    const confidence =
        bestScore >= 8 ? 0.95 :
            bestScore >= 5 ? 0.85 :
                bestScore >= 3 ? 0.70 :
                    bestScore >= 1 ? 0.55 : 0.20;

    return {
        subject: bestSubject,
        confidence,
        reason: "keyword-score",
        score: bestScore
    };
}

function detectTopic(text, subject) {
    const config = SUBJECT_RULES[subject];
    if (!config) {
        return { topic: "Unmapped Topic", confidence: 0.2, score: 0 };
    }

    let bestTopic = "Unmapped Topic";
    let bestScore = 0;

    for (const [topic, keywords] of Object.entries(config.topicRules)) {
        const score = scoreKeywords(text, keywords);
        if (score > bestScore) {
            bestScore = score;
            bestTopic = topic;
        }
    }

    const confidence =
        bestScore >= 6 ? 0.95 :
            bestScore >= 4 ? 0.85 :
                bestScore >= 2 ? 0.70 :
                    bestScore >= 1 ? 0.55 : 0.20;

    return {
        topic: bestTopic,
        confidence,
        score: bestScore
    };
}

function detectMicrotheme(text, topic, existingMicrotheme = "") {
    const existing = normalizeText(existingMicrotheme);
    if (existing) {
        return {
            microtheme: existing,
            confidence: 0.99,
            reason: "existing-microtheme"
        };
    }

    const microRules = MICROTHEME_RULES[topic] || [];
    let bestMicro = "";
    let bestScore = 0;

    for (const rule of microRules) {
        const score = scoreKeywords(text, rule.keys);
        if (score > bestScore) {
            bestScore = score;
            bestMicro = rule.name;
        }
    }

    if (!bestMicro) {
        return {
            microtheme: topic === "Unmapped Topic" ? "Unmapped Microtheme" : topic,
            confidence: 0.25,
            reason: "fallback-topic"
        };
    }

    const confidence =
        bestScore >= 5 ? 0.95 :
            bestScore >= 3 ? 0.85 :
                bestScore >= 1 ? 0.65 : 0.25;

    return {
        microtheme: bestMicro,
        confidence,
        reason: "micro-keyword-score",
        score: bestScore
    };
}

function detectQuestionType(q) {
    const text = extractQuestionText(q);
    const normalized = compactText(text);

    const statementCount =
        (normalized.match(/\b1\b/g) || []).length > 0 &&
            (normalized.match(/\b2\b/g) || []).length > 0 &&
            (normalized.match(/\b3\b/g) || []).length > 0
            ? 3
            : (normalized.match(/\b1\b/g) || []).length > 0 &&
                (normalized.match(/\b2\b/g) || []).length > 0
                ? 2
                : 0;

    if (
        /consider the following pairs/i.test(text) ||
        /consider the following pairs:/i.test(text) ||
        /consider the following pairs\s*/i.test(text)
    ) {
        return "PAIR_BASED";
    }

    if (
        /which of the following statements/i.test(text) ||
        /consider the following statements/i.test(text)
    ) {
        if (statementCount >= 3) return "MCQ_3_STATEMENT";
        if (statementCount === 2) return "MCQ_2_STATEMENT";
        return "MCQ_1_STATEMENT";
    }

    if (
        /match list/i.test(text) ||
        /match the following/i.test(text) ||
        /list[- ]?i/i.test(text) && /list[- ]?ii/i.test(text)
    ) {
        return "MATCHING";
    }

    return q.questionType || "MCQ";
}

function normalizeSubjectName(subject) {
    const s = compactText(subject);

    if (s.includes("polity")) return "Polity";
    if (s.includes("economy")) return "Economy";
    if (s.includes("geography")) return "Geography";
    if (s.includes("environment")) return "Environment";
    if (s.includes("science")) return "Science & Technology";
    if (s.includes("history")) return "History & Culture";
    if (s.includes("culture")) return "History & Culture";

    return subject || "Unknown";
}

function makeReviewFlag(subjectConfidence, topicConfidence, microConfidence) {
    if (subjectConfidence < 0.5) return "REVIEW_SUBJECT";
    if (topicConfidence < 0.5) return "REVIEW_TOPIC";
    if (microConfidence < 0.5) return "REVIEW_MICROTHEME";
    return "OK";
}

function fixOneQuestion(q) {
    const text = extractQuestionText(q);

    const subjectResult = detectSubject(text, q.subject || "");
    const subject = normalizeSubjectName(subjectResult.subject);

    const topicResult = detectTopic(text, subject);
    const microResult = detectMicrotheme(text, topicResult.topic, q.microtheme || q.microTheme || "");

    const questionType = detectQuestionType(q);

    const fixed = {
        ...q,
        subject: subject,
        topic: topicResult.topic,
        microtheme: microResult.microtheme,
        questionType,
        mappingAudit: {
            subjectConfidence: subjectResult.confidence,
            topicConfidence: topicResult.confidence,
            microthemeConfidence: microResult.confidence,
            subjectReason: subjectResult.reason || "",
            topicScore: topicResult.score || 0,
            reviewFlag: makeReviewFlag(
                subjectResult.confidence,
                topicResult.confidence,
                microResult.confidence
            )
        }
    };

    return fixed;
}

function loadQuestionRows(filePath) {
    const raw = readJson(filePath);

    if (Array.isArray(raw)) {
        return { kind: "array", rows: raw };
    }

    if (Array.isArray(raw.questions)) {
        return { kind: "questions", rows: raw.questions, wrapper: raw };
    }

    if (Array.isArray(raw.data)) {
        return { kind: "data", rows: raw.data, wrapper: raw };
    }

    return { kind: "unknown", rows: [] };
}

function rebuildWithSameShape(fileInfo, newRows) {
    if (fileInfo.kind === "array") return newRows;
    if (fileInfo.kind === "questions") {
        return { ...fileInfo.wrapper, questions: newRows };
    }
    if (fileInfo.kind === "data") {
        return { ...fileInfo.wrapper, data: newRows };
    }
    return newRows;
}

function main() {
    const args = parseArgs();

    const inputDir = args.inputDir
        ? path.resolve(args.inputDir)
        : DEFAULT_INPUT_DIR;

    const outputDir = args.outputDir
        ? path.resolve(args.outputDir)
        : DEFAULT_OUTPUT_DIR;

    ensureDir(outputDir);

    const files = getAllJsonFiles(inputDir).filter((f) =>
        path.basename(f).toLowerCase().includes("tagged")
    );

    const auditRows = [];
    let totalQuestions = 0;

    for (const file of files) {
        const rel = path.relative(inputDir, file);
        const outFile = path.join(outputDir, rel);

        const fileInfo = loadQuestionRows(file);
        const fixedRows = [];

        for (const row of fileInfo.rows) {
            const fixed = fixOneQuestion(row);
            fixedRows.push(fixed);

            auditRows.push({
                file: rel,
                id: fixed.id || null,
                year: fixed.year || null,
                questionNumber: fixed.questionNumber || fixed.qno || fixed.number || null,
                subject: fixed.subject || null,
                topic: fixed.topic || null,
                microtheme: fixed.microtheme || null,
                questionType: fixed.questionType || null,
                reviewFlag: fixed.mappingAudit?.reviewFlag || "OK"
            });

            totalQuestions++;
        }

        const rebuilt = rebuildWithSameShape(fileInfo, fixedRows);
        writeJson(outFile, rebuilt);
    }

    const reviewSummary = auditRows.reduce((acc, row) => {
        acc[row.reviewFlag] = (acc[row.reviewFlag] || 0) + 1;
        return acc;
    }, {});

    const bySubject = auditRows.reduce((acc, row) => {
        const key = row.subject || "Unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const byTopic = auditRows.reduce((acc, row) => {
        const key = row.topic || "Unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    writeJson(path.join(outputDir, "_mapping_audit.json"), {
        totalFiles: files.length,
        totalQuestions,
        reviewSummary,
        bySubject,
        byTopic
    });

    writeJson(path.join(outputDir, "_mapping_review_rows.json"), auditRows);

    console.log("\n✅ mappingFixEngine completed\n");
    console.log(JSON.stringify({
        totalFiles: files.length,
        totalQuestions,
        reviewSummary
    }, null, 2));
    console.log("\nOutput dir:");
    console.log(outputDir);
}

main();