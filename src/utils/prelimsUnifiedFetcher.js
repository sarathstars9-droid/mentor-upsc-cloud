// src/utils/prelimsUnifiedFetcher.js
// Frontend fetch layer for the unified prelims question engine.
// Wraps /api/prelims-unified/* endpoints with subject mapping and normalisation.

import { BACKEND_URL } from "../config";

// ── Canonical node alias map (mirrors backend/brain/pyqNodeAliasMap.js) ──────
// Maps parent/intermediate nodeIds → canonical leaf nodeIds (-MTxx suffix).
const PYQ_NODE_ALIAS_MAP = {
  "GS1-HIS-ANC-IVC":              "GS1-HIS-ANC-IVC-MT04",
  "GS1-HIS-ANC-VEDIC-RIG":        "GS1-HIS-ANC-VEDIC-RIG-MT05",
  "GS1-HIS-ANC-VEDIC-LATER":      "GS1-HIS-ANC-VEDIC-LATER-MT04",
  "GS1-HIS-ANC-BUD":              "GS1-HIS-ANC-BUD-MT01",
  "GS1-HIS-ANC-JAIN":             "GS1-HIS-ANC-JAIN-MT01",
  "GS1-HIS-ANC-MAURYA":           "GS1-HIS-ANC-MAURYA-MT06",
  "GS1-HIS-ANC-GUPTA":            "GS1-HIS-ANC-GUPTA-MT02",
  "GS1-HIS-MED-SOCIETY":          "GS1-HIS-MED-REGIONAL-MT08",
  "GS1-HIS-MED-EURO":             "GS1-HIS-MED-REGIONAL-MT08",
  "GS1-HIS-MED-ART":              "GS1-HIS-MED-REGIONAL-MT08",
  "GS1-HIS-MED-REL":              "GS1-HIS-MED-BHAKTI-MT02",
  "GS1-HIS-WORLD-INDUSTRIAL":     "GS1-HIS-WORLD-REV-MT02",
  "GS1-CA-CULT":                  "GS1-HIS-MED-18C-MT04",
  "GS1-CA-HIST":                  "GS1-HIS-MOD-ADMIN-MT01",
  "GS1-CA-GEO":                   "GS1-GEO-IND-AGRI-MT01",
  "GS1-GEO-CURRENT":              "GS1-GEO-PRE-REGIONAL-PLACES-MT01",
  "GS1-GEO-MAPPING-PLACES":       "GS1-GEO-PRE-REGIONAL-PLACES-MT01",
  "GS1-HISTORY-CURRENT":          "GS1-HIS-MOD-NATIONAL-MT05",
  "GS1-ART-CULTURE-CURRENT":      "GS1-HIS-MED-BHAKTI-MT02",
  "GS2-POL-FED":                  "GS2-POL-CSREL-MT02",
  "GS2-POL-GOV":                  "GS2-GOV-GOOD-GOV-MT01",
  "GS2-POL-CONTEMP":              "GS2-POL-PARL-MT01",
  "GS2-POL-PARLIAMENT":           "GS2-POL-PARL-MT01",
  "GS2-POL-STATE-LEG":            "GS2-POL-STATE-MT01",
  "GS2-POL-MISC":                 "GS2-POL-EVOL-CA-MT02",
  "GS2-IR-CONTEMP":               "GS2-IR-INSTITUTIONS-MT04",
  "GS2-CA-IR":                    "GS2-IR-INSTITUTIONS-MT04",
  "GS2-CA-GOV":                   "GS2-GOV-GOOD-GOV-MT01",
  "GS2-GOV-SECURITY-GOVERNANCE":  "GS2-GOV-GOOD-GOV-MT01",
  "GS2-IR-GEOPOLITICS":           "GS2-IR-INSTITUTIONS-MT04",
  "GS2-IR-CURRENT":               "GS2-IR-INSTITUTIONS-MT04",
  "GS2-IR-INTL-ORG":              "GS2-IR-INSTITUTIONS-MT04",
  "GS2-IR-INTERNATIONAL-ORGANISATIONS": "GS2-IR-INSTITUTIONS-MT04",
  "GS2-IR-BILATERAL-REGIONAL":    "GS2-IR-NEIGHBOURS-MT03",
  "GS2-IR-GLOBAL-CURRENT-AFFAIRS":"GS2-IR-INSTITUTIONS-MT04",
  "GS2-IR-PLACES-IN-NEWS":        "GS2-IR-NEIGHBOURS-MT03",
  "GS2-IR-SECURITY":              "GS2-IR-INSTITUTIONS-MT04",
  "GS3-ST-MATERIALS":             "GS3-ST-MATERIALS-NANO-ROBOTICS-AI-MT03",
  "GS3-ST-ENERGY":                "GS3-ENV-ENERGY-GOV-MT01",
  "GS3-ST-CYBERSECURITY":         "GS3-SEC-CYBER-BASICS-MT01",
  "GS3-ST-QUANTUM":               "GS3-ST-IT-COMM-MT02",
  "GS3-ST-AI":                    "GS3-ST-MATERIALS-NANO-ROBOTICS-AI-MT03",
  "GS3-ST-ENV-TECH":              "GS3-ENV-CONSERVATION-MT03",
  "GS3-ST-INFRA-TRANSPORT-TECH":  "GS3-ECO-SECT-INFRA-MT03",
  "GS3-ST-BASIC-SCIENCE":         "GS3-ST-GENSCI-BIO-MT04",
  "GS3-ST-ICT":                   "GS3-ST-IT-COMM-MT02",
  "GS3-ST-BIOLOGY":               "GS3-ST-BIOTECH-MT01",
  "GS3-ST-BIOTECH-HEALTH":        "GS3-ST-BIOTECH-MT01",
  "GS3-ST-GENSCI":                "GS3-ST-GENSCI-BIO-MT04",
  "GS3-ST-PHYSICS":               "GS3-ST-GENSCI-BIO-MT04",
  "GS3-ST-CHEMISTRY":             "GS3-ST-GENSCI-BIO-MT04",
  "GS3-ST-HEALTH-DISEASES":       "GS3-ST-BIOTECH-MT01",
  "GS3-ST-DIGITAL-TECH":          "GS3-ST-IT-COMM-MT02",
  "GS3-SCI-TECH-SPACE":           "GS3-ST-SPACE-MT01",
  "GS3-SCI-TECH-BIOTECH":         "GS3-ST-BIOTECH-MT01",
  "GS3-SCI-TECH-IT":              "GS3-ST-IT-COMM-MT02",
  "GS3-SCI-TECH-GENERAL":         "GS3-ST-GENSCI-BIO-MT04",
  "GS3-SCI-TECH-HEALTH":          "GS3-ST-GENSCI-BIO-MT04",
  "GS3-SCI-TECH-MATERIALS":       "GS3-ST-MATERIALS-NANO-ROBOTICS-AI-MT03",
  "GS3-SCI-TECH-ROBOTICS":        "GS3-ST-MATERIALS-NANO-ROBOTICS-AI-MT03",
  "GS3-SCI-TECH-ENERGY":          "GS3-ENV-ENERGY-GOV-MT01",
  "GS3-ENV-MAINS":                "GS3-ENV-CONSERVATION-MT03",
  "GS3-ENV-RESOURCES":            "GS3-ENV-LAND-WATER-MT03",
  "GS3-ENV-BIODIVERSITY":         "GS3-ENV-CONSERVATION-MT03",
  "GS3-SEC-CONTEMP":              "GS3-SEC-TERRORISM-MT01",
  "GS3-ECO":                      "GS3-ECO-INCLUSIVE-GROWTH-MT07",
  "GS3-ECO-INDUSTRY":             "GS3-ECO-SECT-INDLAB-MT14",
  "GS3-ECO-CURRENT":              "GS3-ECO-PRE-BASICS-MACRO-MT01",
  "GS3-ECO-BANKING-FINANCE":      "GS3-ECO-BANKING-MT04",
  "GS3-ECO-EXTERNAL-SECTOR":      "GS3-ECO-FOREIGN-TRADE-IO-MT03",
  "GS3-CA-ECO":                   "GS3-ECO-INCLUSIVE-GROWTH-MT07",
  "GS3-CA-ENV":                   "GS3-ENV-SPECIES-MT05",
  "GS3-CA-SCI":                   "GS3-ST-GENSCI-BIO-MT04",
  "GS3-CA-GENSCI":                "GS3-ST-GENSCI-BIO-MT04",
  "GS4-ETH-HUM":                  "GS4-ETH-HV",
  "GS4-ETH-FOUND":                "GS4-ETH-APT",
  "GS4-ETH-ATTITUDE":             "GS4-ETH-ATT",
  "GS4-ETH-CONFLICT":             "GS4-ETH-GOV",
  "GS4-CASE-HUM":                 "GS4-ETH-CS",
  "GS4-CASE-FOUND":               "GS4-ETH-CS",
  "GS4-CASE-GOV":                 "GS4-ETH-CS",
  "GS4-CASE-CONFLICT":            "GS4-ETH-CS",
  "GS4-CASE-EI":                  "GS4-ETH-CS",
  "GS4-CASE-PROB":                "GS4-ETH-CS",
  "CSAT-DM":                      "CSAT-LR-MISC-MT01",
  "CSAT-LR-ANALYTICAL":           "CSAT-LR-SYL-MT02",
  "CA-MISC-GK":                   "1C-MISC-SCHEMES-MT04",
  "CA-SPORTS":                    "1C-MISC-INST-MT01",
  "CA-AWARDS-BOOKS-PERSONALITIES":"1C-MISC-INST-MT01",
  "geo.climatology":              "GS1-GEO-IND-CLIMATE-MT04",
  "geo.agriculture":              "GS1-GEO-IND-AGRI-MT01",
};

function normalizePyqNodeId(rawNodeId) {
  if (!rawNodeId) return "";
  const clean = String(rawNodeId).trim();
  return PYQ_NODE_ALIAS_MAP[clean] || clean;
}

// ── PRELIMS_STRUCTURE subject id → unified API subject id(s) ─────────────────
// Single string = one subject; array = merge multiple unified subjects.
export const PRELIMS_TO_UNIFIED_SUBJECT = {
  // GS subjects — flat list matching new PrelimsPage GS_SUBJECTS
  ancient_history:      "ancient_history",
  medieval_history:     "medieval_history",
  modern_history:       "modern_history",
  art_culture:          "art_culture",
  polity:               "indian_polity",
  indian_polity:        "indian_polity",
  economy:              "economy",
  geography:            "geography",
  environment:          "environment",
  science_tech:         "science_tech",
  international_relations: "international_relations",
  current_affairs:      "current_affairs",
  // Legacy / alternate IDs kept for backwards compat
  ir:                   "international_relations",
  current_affairs_misc: "current_affairs",
  culture:              "art_culture",
  history: ["ancient_history", "medieval_history", "modern_history"],
  // CSAT
  csat_quant:           "csat",
  csat_reasoning:       "csat",
  csat_rc:              "csat",
  csat_lr:              "csat",
};

/**
 * Fetch questions from the unified prelims API.
 *
 * @param {object} params
 * @param {string}   [params.subject]       - PRELIMS_STRUCTURE subject id (polity, history, …)
 * @param {string}   [params.nodeId]        - Syllabus node id, supports prefix match (GS2-POL)
 * @param {string}   [params.microTheme]    - Exact microtheme string
 * @param {number}   [params.year]          - Filter by exam year
 * @param {number}   [params.limit=50]      - Max questions to return (capped at 500 on server)
 * @param {string}   [params.rawSubject]    - Direct unified subject name (bypasses mapping)
 * @returns {Promise<{ questions: object[], total: number, source: 'unified' }>}
 */
export async function fetchUnifiedQuestions({
  subject,
  nodeId,
  microTheme,
  year,
  limit = 50,
  rawSubject,
} = {}) {
  // ── Input normalisation ────────────────────────────────────────────────────
  // 1. Trim nodeId and let it win over microTheme if present.
  // 2. Discard sentinel "Unknown" / empty strings before they reach the API.
  const safeNodeId = (typeof nodeId === "string" && nodeId.trim()) ? nodeId.trim() : undefined;
  const rawMicroTheme = microTheme;
  const safeMicroTheme = (
    rawMicroTheme &&
    rawMicroTheme !== "Unknown" &&
    rawMicroTheme !== "unknown" &&
    rawMicroTheme.trim() !== ""
  ) ? rawMicroTheme : undefined;

  // nodeId wins — never send microTheme when nodeId is available
  const effectiveNodeId    = safeNodeId;
  const effectiveMicroTheme = safeNodeId ? undefined : safeMicroTheme;

  if (!effectiveNodeId && !effectiveMicroTheme && subject === undefined && !rawSubject) {
    return { questions: [], total: 0, source: "unified" };
  }

  // Resolve which unified subject(s) to query
  const mapped = rawSubject
    ? [rawSubject]
    : subject
    ? (Array.isArray(PRELIMS_TO_UNIFIED_SUBJECT[subject])
        ? PRELIMS_TO_UNIFIED_SUBJECT[subject]
        : PRELIMS_TO_UNIFIED_SUBJECT[subject]
        ? [PRELIMS_TO_UNIFIED_SUBJECT[subject]]
        : null)
    : null;

  // If nodeId or microTheme is given without subject, do a direct query
  const needsSubjectLoop = mapped && mapped.length > 0;

  if (!needsSubjectLoop && !effectiveNodeId && !effectiveMicroTheme) {
    return { questions: [], total: 0, source: "unified" };
  }

  const perSubjectLimit = needsSubjectLoop
    ? Math.ceil(limit / mapped.length)
    : limit;

  const buildURL = (unifiedSubject) => {
    const url = new URL(`${BACKEND_URL}/api/prelims-unified/questions`);
    if (unifiedSubject) url.searchParams.set("subject", unifiedSubject);
    if (effectiveNodeId) {
      // nodeId takes strict priority — never send microTheme alongside it
      url.searchParams.set("nodeId", effectiveNodeId);
    } else if (effectiveMicroTheme) {
      url.searchParams.set("microTheme", effectiveMicroTheme);
    }
    if (year)  url.searchParams.set("year", String(year));
    url.searchParams.set("limit", String(perSubjectLimit));
    return url.toString();
  };


  const targets = needsSubjectLoop ? mapped : [null];
  const fetches = targets.map((s) =>
    fetch(buildURL(s))
      .then((r) => r.json())
      .then((j) => (j?.ok ? j.questions || [] : []))
      .catch(() => [])
  );

  const results = await Promise.all(fetches);
  const questions = results.flat().slice(0, limit);
  return { questions, total: questions.length, source: "unified" };
}

/**
 * Fetch all questions for a specific node id (prefix-aware on the server).
 */
export async function fetchUnifiedByNode(nodeId, limit = 100) {
  if (!nodeId) return { questions: [], total: 0, source: "unified" };
  const url = `${BACKEND_URL}/api/prelims-unified/node/${encodeURIComponent(nodeId)}`;
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    return {
      questions: (json?.questions || []).slice(0, limit),
      total: json?.count || 0,
      source: "unified",
    };
  } catch {
    return { questions: [], total: 0, source: "unified" };
  }
}

/**
 * Fetch all questions for a specific microtheme.
 */
export async function fetchUnifiedByMicroTheme(microTheme, limit = 100) {
  if (!microTheme) return { questions: [], total: 0, source: "unified" };
  const url = `${BACKEND_URL}/api/prelims-unified/microtheme/${encodeURIComponent(microTheme)}`;
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    return {
      questions: (json?.questions || []).slice(0, limit),
      total: json?.count || 0,
      source: "unified",
    };
  } catch {
    return { questions: [], total: 0, source: "unified" };
  }
}

/**
 * Normalise a question from the unified API to the shape PrelimsPage / PyqTestAttempt expects.
 * Mirrors and extends the inline normalizeQuestion in PrelimsPage.
 */
export function normalizeUnifiedQuestion(q) {
  if (!q) return null;
  const ca =
    q.correctAnswer ||
    q.answer?.correct_option ||
    (typeof q.answer === "string" && /^[A-Da-d]$/.test(q.answer)
      ? q.answer.toUpperCase()
      : null);
  return {
    ...q,
    id:           q.id || q.questionId || q.qid || "",
    question:     q.question || q.questionText || q.stem || q.prompt || "",
    options:      q.options || q.choices || null,
    passageText:  q.passageText || q.passage || "",
    correctAnswer: ca ? String(ca).toUpperCase() : null,
    nodeId:       q.nodeId || q.syllabusNodeId || q.sectionId || "",
    syllabusNodeId: q.syllabusNodeId || q.nodeId || "",
    microTheme:   q.microTheme || "",
    subject:      q.subject || "",
    year:         q.year || null,
    questionType: q.questionType || (q.options ? "MCQ_SINGLE" : ""),
    stage:        q.stage || "Prelims",
    paper:        q.paper || "",
    confidenceBand: q.confidenceBand || "",
    reviewRequired: q.reviewRequired || false,
  };
}

/**
 * Fetch available topics for a subject by aggregating microThemes from the unified engine.
 * Returns sorted array of { id, label, count, nodeId, microTheme }.
 *
 * @param {object} params
 * @param {string} params.subject  - PRELIMS_STRUCTURE subject id (will be mapped via PRELIMS_TO_UNIFIED_SUBJECT)
 */
export async function fetchUnifiedTopics({ subject }) {
  const { questions } = await fetchUnifiedQuestions({ subject, limit: 5000 });

  // Track nodeId frequency per microTheme so majority nodeId wins
  const byTheme = new Map();
  const nodeIdFreq = new Map(); // microTheme → { nodeId → count }

  for (const q of questions || []) {
    const id = q.microTheme || "general";
    const label = id
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (!byTheme.has(id)) {
      byTheme.set(id, { id, label, count: 0, nodeId: "", microTheme: id });
      nodeIdFreq.set(id, {});
    }

    byTheme.get(id).count += 1;

    // Use raw dataset nodeId for counting frequency (DO NOT normalize/alias)
    const rawNodeId = q.nodeId || q.syllabusNodeId || "";
    if (rawNodeId) {
      const freq = nodeIdFreq.get(id);
      freq[rawNodeId] = (freq[rawNodeId] || 0) + 1;
    }
  }

  // Resolve best nodeId per topic (highest-frequency raw node wins)
  for (const [id, entry] of byTheme.entries()) {
    const freq = nodeIdFreq.get(id) || {};
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const finalNodeId = sorted[0]?.[0] || "";
    entry.nodeId = finalNodeId;
    entry.originalNodeId = finalNodeId;
    console.log("TOPIC NODE RESOLUTION", { microTheme: id, finalNodeId });
  }

  return Array.from(byTheme.values())
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
