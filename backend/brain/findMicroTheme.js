// backend/brain/findMicroTheme.js
// K2S Mapper (Keyword-to-Syllabus) — ESM, stable, supports chunk mapping + enriched Phase 2 fields

import { UNIFIED_SYLLABUS_INDEX } from "./unifiedSyllabusIndex.js";

export function mapPlanItemToMicroTheme(topic, subject, extra = {}) {
  const clean = String(topic || "").toLowerCase().trim();

  // 🔥 HARD OVERRIDE — ECONOMY CRITICAL FIX
  if (
    /\bnational income\b|\bmoney and banking\b|\bbanking\b|\bmoney market\b|\bcapital market\b/i.test(clean)
  ) {
    return {
      matched: true,
      confidence: 0.99,
      confidenceBand: "high",
      subjectKey: "economy",
      syllabusNodeId: "GS3-ECO-PRE-BANKING-STRUCTURE",
      code: "GS3-ECO-PRE-BANKING-STRUCTURE",
      gsPaper: "GS3",
      subjectGroup: "Economy",
      macroTheme: "Economy",
      microTheme: topic || "Economy",
      mappedTopicName: topic || "Economy",
      matchedBy: ["CANONICAL_PYQ_BUCKET"],
      aliasesTriggered: [],
      candidateCount: 1,
      alternativeNodeIds: ["GS3-ECO-PRE-MONEY-BASICS", "GS3-ECO-PRE-BANKING-STRUCTURE", "GS3-ECO-PRE-MONEY-BASICS",],
      reviewRequired: false,
      phaseHints: { mode: "plan" },
      analyticsHints: { topScore: 0.99 },
      pyqs: {
        prelims: [],
        mains: [],
        essay: [],
        ethics: [],
        optional: [],
        csat: [],
      },
      pyqStats: {
        prelims: 0,
        mains: 0,
        essay: 0,
        ethics: 0,
        optional: 0,
        csat: 0,
        total: 0,
      },
    };
  }
  const mapped = findMicroTheme(topic, subject, extra);

  const normalizedMapped = mapped?.found
    ? {
      matched: true,
      confidence: mapped.confidence || 0,
      confidenceBand:
        (mapped.confidence || 0) >= 0.85
          ? "high"
          : (mapped.confidence || 0) >= 0.55
            ? "medium"
            : "low",
      subjectKey: null,
      syllabusNodeId: mapped.syllabusNodeId || null,
      code: mapped.code || null,
      gsPaper: mapped.gsPaper || null,
      subjectGroup: mapped.subjectGroup || null,
      macroTheme: mapped.section || "",
      microTheme: mapped.name || "",
      mappedTopicName: topic || mapped.name || "",
      matchedBy: mapped.matched || [],
      aliasesTriggered: [],
      candidateCount: Array.isArray(mapped.matches) ? mapped.matches.length : 0,
      alternativeNodeIds: Array.isArray(mapped.matches)
        ? mapped.matches
          .slice(1, 4)
          .map((x) => x.syllabusNodeId || x.code)
          .filter(Boolean)
        : [],
      reviewRequired: (mapped.confidence || 0) < 0.5,
      phaseHints: { mode: "plan" },
      analyticsHints: {
        topScore: mapped.confidence || 0,
      },
    }
    : {
      matched: false,
      confidence: 0,
      confidenceBand: "low",
      subjectKey: null,
      syllabusNodeId: null,
      code: null,
      gsPaper: null,
      subjectGroup: null,
      macroTheme: "",
      microTheme: "",
      mappedTopicName: topic || "",
      matchedBy: [],
      aliasesTriggered: [],
      candidateCount: 0,
      alternativeNodeIds: [],
      reviewRequired: true,
      phaseHints: { mode: "plan" },
      analyticsHints: {},
    };

  // Legacy-safe placeholder.
  // Real linked PYQ enrichment is now handled in backend/server.js via getPyqSummaryForNode().
  const pyqs = {
    prelims: [],
    mains: [],
    essay: [],
    ethics: [],
    optional: [],
    csat: [],
  };

  const pyqStats = {
    prelims: 0,
    mains: 0,
    essay: 0,
    ethics: 0,
    optional: 0,
    csat: 0,
    total: 0,
  };

  return {
    ...normalizedMapped,
    pyqs,
    pyqStats,
  };
}

export const FIND_MICRO_THEME_BUILD = "2026-03-25-prod-subject-lock-v2";
console.log("[findMicroTheme loaded]", FIND_MICRO_THEME_BUILD);

/* -------------------- NORMALIZE -------------------- */
function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[&]/g, " and ")
    .replace(/[–—]/g, "-")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLoose(text = "") {
  return normalize(text).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

/* -------------------- SUBJECT ALIASES -------------------- */
const SUBJECT_ALIAS_MAP = {
  science: "science and technology",
  "science tech": "science and technology",
  "science and tech": "science and technology",
  "science & tech": "science and technology",
  "science and technology": "science and technology",
  "sci tech": "science and technology",
  "s&t": "science and technology",
  scienceandtech: "science and technology",
  scienceandtechclass: "science and technology",

  "gs3-st": "science and technology",
  "gs3 st": "science and technology",
  gs3st: "science and technology",
  gs3: "economy",
  "gs 3": "economy",

  "general science": "general science",
  gensci: "general science",

  csat: "csat",
  aptitude: "csat",

  polity: "indian polity",
  environment: "environment and ecology",
  eco: "economy",
  economy: "economy",
  history: "history",
  geography: "geography",
};

function normalizeSubject(subject = "") {
  const raw = String(subject || "").trim();
  const tight = normalize(raw);
  const loose = normalizeLoose(raw);
  return SUBJECT_ALIAS_MAP[tight] || SUBJECT_ALIAS_MAP[loose] || loose;
}

const SUBJECT_CANONICAL_LABELS = {
  polity: "Polity",
  economy: "Economy",
  geography: "Geography",
  environment: "Environment",
  sciencetech: "ScienceTech",
  history: "History",
  culture: "Culture",
  society: "Society",
  governance: "Governance",
  internationalrelations: "InternationalRelations",
  internalsecurity: "InternalSecurity",
  ethics: "Ethics",
  essay: "Essay",
  csat: "CSAT",
  optional: "OPTIONAL",
};

function getCanonicalSubjectKey(subject = "") {
  const s = normalizeSubject(subject);
  if (!s) return "";
  if (s.includes("polity")) return "polity";
  if (s.includes("economy") || s === "eco") return "economy";
  if (s.includes("geography")) return "geography";
  if (s.includes("environment") || s.includes("ecology")) return "environment";
  if (s.includes("science")) return "sciencetech";
  if (s.includes("history")) return "history";
  if (s.includes("culture") || s.includes("art")) return "culture";
  if (s.includes("society")) return "society";
  if (s.includes("governance")) return "governance";
  if (s.includes("international relations") || s === "ir") return "internationalrelations";
  if (s.includes("internal security")) return "internalsecurity";
  if (s.includes("ethics") || s.includes("gs4")) return "ethics";
  if (s.includes("essay")) return "essay";
  if (s.includes("csat") || s.includes("aptitude")) return "csat";
  if (s.includes("optional")) return "optional";
  return "";
}

function nodeMatchesCanonicalSubject(node = {}, key = "") {
  if (!key) return true;

  const nodeSubject = normalizeLoose(node.subject || "");
  const nodeSection = normalizeLoose(node.section || "");
  const nodePath = normalizeLoose(node.path || "");
  const nodeGroup = normalizeLoose(node.subjectGroup || "");
  const nodePaper = normalizeLoose(node.gsPaper || "");

  switch (key) {
    case "polity":
      return nodeSubject === "polity";
    case "economy":
      return nodeSubject === "economy";
    case "geography":
      return nodeSubject === "geography";
    case "environment":
      return nodeSubject === "environment";
    case "sciencetech":
      return nodeSubject === "sciencetech" || nodeSubject === "general science";
    case "history":
      return nodeSubject === "history";
    case "culture":
      return nodeSubject === "culture";
    case "society":
      return nodeSubject === "society";
    case "governance":
      return nodeSubject === "governance";
    case "internationalrelations":
      return nodeSubject === "internationalrelations";
    case "internalsecurity":
      return nodeSubject === "internalsecurity";
    case "ethics":
      return nodeSubject === "ethics" || nodeGroup === "gs4" || nodePaper === "gs4";
    case "essay":
      return nodeSubject === "essay" || nodeGroup === "essay" || nodePaper === "essay";
    case "csat":
      return nodeGroup === "csat" || nodePaper === "csat";
    case "optional":
      return nodeGroup === "optional" || nodePaper === "optional";
    default:
      return true;
  }
}

function filterTopicsBySubjectLock(subject = "", topics = ALL_TOPICS) {
  const key = getCanonicalSubjectKey(subject);
  if (!key) return topics;

  const filtered = topics.filter((topic) => {
    if (!nodeMatchesCanonicalSubject(topic, key)) return false;

    const code = normalizeLoose(topic.code || "");

    if (key === "polity") return code.startsWith("gs2 pol");
    if (key === "economy") return code.startsWith("gs3 eco");
    if (key === "geography") return code.startsWith("gs1 geo") || code.startsWith("opt");
    if (key === "environment") return code.startsWith("gs3 env");
    if (key === "sciencetech") return code.startsWith("gs3 st");
    if (key === "history") return code.startsWith("gs1 his");
    if (key === "culture") return code.startsWith("gs1 art");
    if (key === "csat") return code.startsWith("csat");

    return true;
  });

  return filtered.length ? filtered : topics;
}

/* -------------------- SANITIZE TASK -------------------- */
export function sanitizeTaskText(text = "") {
  return String(text || "")
    .replace(/[–—]/g, "-")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\bgs\s*[-:]?\s*\d+\b/gi, "")
    .replace(/\bgeneral\s*studies\s*[-:]?\s*\d+\b/gi, "")
    .replace(/\bpaper\s*[-:]?\s*\d+\b/gi, "")
    .replace(/\bclass\b/gi, "")
    .replace(/\blecture\b/gi, "")
    .replace(/\bvideo(s)?\b/gi, "")
    .replace(/\bnotes?\b/gi, "")
    .replace(/\bshort\s*notes?\b/gi, "")
    .replace(/\bpyqs?\b/gi, "")
    .replace(/\brevision\b/gi, "")
    .replace(/\btopic\b/gi, "")
    .replace(/\bsession\b/gi, "")
    .replace(/\bmodule\b/gi, "")
    .replace(/\bunit\b/gi, "")
    .replace(/\ball topics under\b/gi, "")
    .replace(/\brevision of\b/gi, "")
    .replace(/\bmaking short note on\b/gi, "")
    .replace(/[–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------- ALIAS EXPANSION -------------------- */
function expandAliasText(text = "") {
  let clean = normalizeLoose(text);

  const replacements = [
    [/\bbiotech\b/g, "biotechnology"],
    [/\bs and t\b/g, "science and technology"],
    [/\bsci tech\b/g, "science and technology"],
    [/\bscience tech\b/g, "science and technology"],
    [/\bscience and tech\b/g, "science and technology"],
    [/\bscienceandtech\b/g, "science and technology"],
    [/\bscienceandtechclass\b/g, "science and technology"],
    [/\bgs3 st\b/g, "science and technology"],
    [/\bgs3-st\b/g, "science and technology"],
    [/\bgs3st\b/g, "science and technology"],

    [/\bfrs\b/g, "fundamental rights"],
    [/\bfr\b/g, "fundamental rights"],
    [/\bgm\b/g, "genetically modified"],

    [/\bnumbersystem\b/g, "number system"],
    [/\bnumber\s*system\b/g, "number system"],
    [/\bnum\s*system\b/g, "number system"],

    [/\bshort note\b/g, "short notes"],
    [/\bshort notes on\b/g, ""],
    [/\brevision of\b/g, ""],
    [/\ball topics under\b/g, ""],
  ];

  for (const [pattern, replacement] of replacements) {
    clean = clean.replace(pattern, replacement);
  }

  return clean.replace(/\s+/g, " ").trim();
}

/* -------------------- CHUNK SPLITTING -------------------- */
function splitStudyChunks(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const protectedPhrases = [
    "tone and summary",
    "strengthening the argument",
    "weakening the argument",
    "time and work",
    "profit and loss",
    "air mass and fronts",
    "fundamental rights and duties",
    "science and technology",
    "climate and vegetation",
    "agriculture and irrigation",
    "parliament and state legislature",
    "simple and compound interest",
    "ratio and proportion",
    "speed and distance",
    "centre state relations",
    "pressure groups and formal informal associations",
    "biodiversity and conservation",
    "drainage and river systems",
    "number system",
  ];

  let protectedText = raw;

  for (const phrase of protectedPhrases) {
    const safe = phrase.replace(/\s+/g, "_");
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    protectedText = protectedText.replace(re, safe);
  }

  const normalizedText = protectedText
    .replace(/\r?\n+/g, " | ")
    .replace(/\s*\+\s*/g, " | ")
    .replace(/\s*;\s*/g, " | ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s*\/\s*/g, " | ")
    .replace(/\s*,\s*/g, " | ");

  let parts = normalizedText
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

  parts = parts.map((part) => part.replace(/_/g, " "));

  const finalParts = [];
  for (const part of parts) {
    const clean = normalize(part);

    if (
      protectedPhrases.some((p) => normalize(p) === clean) ||
      clean.split(" ").length <= 3
    ) {
      finalParts.push(part);
      continue;
    }

    const andParts = part.split(/\band\b/i).map((x) => x.trim()).filter(Boolean);

    if (
      andParts.length === 2 &&
      andParts.every((p) => normalize(p).split(" ").length >= 2)
    ) {
      finalParts.push(...andParts);
    } else {
      finalParts.push(part);
    }
  }

  const useful = finalParts
    .map((x) => sanitizeTaskText(x))
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((p) => normalize(p).length >= 3);

  return useful.length ? useful : [sanitizeTaskText(raw)];
}

/* -------------------- STOPWORDS / GENERIC -------------------- */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "from", "by",
  "read", "studied", "study", "revise", "revision", "notes", "write", "wrote", "practice",
  "solve", "solved", "today", "yesterday", "tomorrow", "did", "complete", "completed",
  "watch", "watched", "class", "lecture", "lectures", "video", "videos", "test", "tests",
  "short", "note", "notes", "topic", "topics",
]);

const GENERIC_WORDS = new Set([
  "rights", "law", "laws", "policy", "policies", "government", "state", "india",
  "case", "cases", "study", "studies", "ethics", "international", "institutions",
  "summary", "tone",
]);

const BROAD_BUCKET_WORDS = new Set([
  "history",
  "geography",
  "polity",
  "economy",
  "society",
  "environment",
  "ethics",
  "governance",
  "international relations",
  "internal security",
  "science and technology",
  "science technology",
  "science tech",
  "general geography",
  "indian geography",
  "general science",
]);

/* -------------------- TOKEN HELPERS -------------------- */
function uniqueStrings(arr = []) {
  return [...new Set((arr || []).filter(Boolean).map((x) => String(x).trim()).filter(Boolean))];
}

function extractMeaningfulTokens(text = "") {
  return normalize(text)
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !STOPWORDS.has(x));
}

function getNodeDepth(node = {}) {
  const codeDepth = String(node.code || node.syllabusNodeId || "")
    .split("-")
    .filter(Boolean).length;

  const pathDepth = String(node.path || "")
    .split(">")
    .map((x) => x.trim())
    .filter(Boolean).length;

  return codeDepth + pathDepth;
}

function isMultiTopicBlock(text = "") {
  const t = normalizeLoose(text);
  return t.includes(",") || t.includes(" and ") || t.includes("&");
}

/* -------------------- UNIFIED SYLLABUS SOURCE -------------------- */
const ALL_TOPICS = UNIFIED_SYLLABUS_INDEX.map((node) => ({
  syllabusNodeId: node.syllabusNodeId,
  code: node.syllabusNodeId,
  name: node.name,
  keywords: uniqueStrings([
    ...(node.aliases || []),
    ...(node.keywords || []),
    ...(node.microThemes || []),
    ...(node.rawTextPool || []),
    node.name || "",
    node.subject || "",
    node.section || "",
    node.parentTopic || "",
  ]),
  path: node.path,
  tags: node.tags || [],
  gsPaper: node.gsPaper || null,
  subjectGroup: node.subjectGroup || null,
  subject: node.subject || null,
  section: node.section || null,
  parentTopic: node.parentTopic || null,
  sourceType: node.sourceType || null,
}));

/* -------------------- CONTEXT FILTER -------------------- */
function filterTopicsByBroadContext(userText, topics, subject = "") {
  const clean = normalize(userText);
  let subjectLockedTopics = filterTopicsBySubjectLock(subject, topics);
  if (
    /\bnational income\b|\bmoney and banking\b|\bbanking\b|\bmoney market\b|\bcapital market\b|\bmonetary\b|\bfiscal\b|\binflation\b/i.test(clean)
  ) {
    const filtered = topics.filter((t) => {
      const code = String(t.code || t.syllabusNodeId || "").toUpperCase();
      return code.startsWith("GS3-ECO");
    });
    if (filtered.length) return filtered;
  }
  if (
    /\bbiotechnology\b|\bbiotech\b|\bgenetic\b|\bdna\b|\brna\b|\bgene\b|\bcrispr\b|\bstem cell\b|\bgm\b|\bgenomics\b|\bproteomics\b/i.test(clean)
  ) {
    const filtered = subjectLockedTopics.filter((t) => {
      const code = String(t.code || t.syllabusNodeId || "").toUpperCase();
      return code.startsWith("GS3-ST-BIOTECH");
    });
    if (filtered.length) return filtered;
  }

  if (
    /\bfundamental rights\b|\bfrs?\b|\bwrits?\b|\barticle\s*(12|13|14|15|16|17|18|19|20|21|21a|22|23|24|25|26|27|28|29|30|31|32)\b/i.test(clean)
  ) {
    const filtered = subjectLockedTopics.filter(
      (t) =>
        normalize(t.gsPaper) === "gs2" &&
        (
          normalize(t.subject).includes("polity") ||
          normalize(t.path).includes("fundamental rights") ||
          normalize(t.path).includes("polity")
        )
    );
    if (filtered.length) return filtered;
  }

  if (
    /\bancient\b|\bindus\b|\bivc\b|\bvedic\b|\bmaurya\b|\bgupta\b|\bsangam\b|\bbuddhism\b|\bjainism\b/i.test(clean)
  ) {
    const filtered = subjectLockedTopics.filter(
      (t) =>
        normalize(t.gsPaper) === "gs1" &&
        (
          normalize(t.subject).includes("history") ||
          normalize(t.path).includes("ancient")
        )
    );
    if (filtered.length) return filtered;
  }

  if (
    /\bmedieval\b|\bdelhi sultanate\b|\bmughal\b|\bchola\b|\bmarathas?\b/i.test(clean)
  ) {
    const filtered = subjectLockedTopics.filter(
      (t) =>
        normalize(t.gsPaper) === "gs1" &&
        (
          normalize(t.subject).includes("history") ||
          normalize(t.path).includes("medieval")
        )
    );
    if (filtered.length) return filtered;
  }

  if (
    /\bmonsoon\b|\benso\b|\bitcz\b|\bjet stream\b|\bindian climate\b|\bair mass\b|\bfronts?\b/i.test(clean)
  ) {
    const filtered = subjectLockedTopics.filter(
      (t) =>
        normalize(t.gsPaper) === "gs1" &&
        normalize(t.subject).includes("geography") &&
        (
          normalize(t.path).includes("climatology") ||
          normalize(t.path).includes("indian climate") ||
          normalize(t.name).includes("monsoon")
        )
    );
    if (filtered.length) return filtered;
  }

  if (
    /\bcsat\b|\bnumber system\b|\breading comprehension\b|\breasoning\b|\bprofit and loss\b|\bspeed and distance\b|\bratio and proportion\b|\baverages\b|\bmixtures\b|\balligation\b/i.test(clean)
  ) {
    const filtered = subjectLockedTopics.filter((t) => normalize(t.subjectGroup) === "csat");
    if (filtered.length) return filtered;
  }

  return subjectLockedTopics;
}

/* -------------------- KEYWORD SCORING -------------------- */
function scoreKeyword(cleanText, kwRaw) {
  const kw = normalize(kwRaw);
  if (!kw) return { score: 0, hit: false };

  const isPhrase = kw.includes(" ");
  const kwLen = kw.length;

  if (isPhrase) {
    if (cleanText.includes(kw)) {
      const base = 10;
      const lenBoost = Math.min(8, Math.floor(kwLen / 8));
      return { score: base + lenBoost, hit: true };
    }
    return { score: 0, hit: false };
  }

  const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i");
  if (re.test(cleanText)) {
    const base = GENERIC_WORDS.has(kw) ? 1 : 3;
    return { score: base, hit: true };
  }

  return { score: 0, hit: false };
}

function scoreTopic(userText, topic) {
  const clean = normalize(userText);
  if (!clean) return { score: 0, hits: [] };

  let score = 0;
  const hits = [];

  const keywords = Array.isArray(topic.keywords) ? topic.keywords : [];
  const title = topic.name ? [topic.name] : [];
  const subjectGroup = normalize(topic.subjectGroup || "");
  const subject = normalize(topic.subject || "");
  const section = normalize(topic.section || "");
  const parentTopic = normalize(topic.parentTopic || "");
  const path = normalize(topic.path || "");
  const code = normalizeLoose(topic.code || "");
  const name = normalize(topic.name || "");

  const meaningfulTokens = extractMeaningfulTokens(clean);
  const tokenSet = new Set(meaningfulTokens);

  if (clean && clean.length >= 4 && name.includes(clean)) {
    score += 5;
    hits.push(`title:${clean}`);
  }

  if (clean && clean.length >= 4 && section.includes(clean)) {
    score += 3;
    hits.push(`section:${clean}`);
  }

  if (clean && clean.length >= 4 && parentTopic.includes(clean)) {
    score += 2;
    hits.push(`parent:${clean}`);
  }

  function addHit(text, points) {
    if (!text || !points) return;
    score += points;
    hits.push(String(text));
  }

  function hasWord(word) {
    return tokenSet.has(normalize(word));
  }

  function hasPhrase(phrase) {
    return clean.includes(normalize(phrase));
  }

  function overlapCount(text = "") {
    const toks = extractMeaningfulTokens(text);
    let count = 0;
    for (const t of toks) {
      if (tokenSet.has(t)) count += 1;
    }
    return count;
  }

  for (const t of title) {
    const n = normalize(t);
    if (!n) continue;

    if (clean === n) {
      addHit(t, 26);
      continue;
    }

    if (clean.includes(n)) {
      addHit(t, 18);
      continue;
    }

    const oc = overlapCount(t);
    if (oc >= 2) {
      addHit(t, Math.min(10, oc * 3));
    }
  }

  for (const kw of keywords) {
    const r = scoreKeyword(clean, kw);
    if (r.hit) {
      addHit(kw, r.score);
      continue;
    }

    const oc = overlapCount(kw);
    const kwTokens = extractMeaningfulTokens(kw).length;

    if (kwTokens >= 2 && oc >= 2) {
      addHit(kw, Math.min(8, oc * 2));
    } else if (kwTokens === 1 && oc === 1 && !GENERIC_WORDS.has(normalize(kw))) {
      addHit(kw, 2);
    }
  }

  const parentOverlap = overlapCount(parentTopic);
  if (parentOverlap >= 1) addHit(topic.parentTopic || "parentTopic", parentOverlap * 2);

  const sectionOverlap = overlapCount(section);
  if (sectionOverlap >= 1) addHit(topic.section || "section", sectionOverlap * 2);

  const subjectOverlap = overlapCount(subject);
  if (subjectOverlap >= 1) addHit(topic.subject || "subject", subjectOverlap * 2);

  const hasCaseStudy =
    /\bcase\s*study\b/i.test(clean) ||
    /\bstakeholder(s)?\b/i.test(clean) ||
    /\bdilemma(s)?\b/i.test(clean) ||
    /\bethics?\b/i.test(clean) ||
    /\bintegrity\b/i.test(clean) ||
    /\baptitude\b/i.test(clean);

  if (hasCaseStudy) {
    if (
      subjectGroup === "gs4" ||
      path.includes("gs4") ||
      path.includes("ethics") ||
      name.includes("case studies")
    ) {
      addHit("gs4-case-study-context", 10);
    }
  }

  const hasFRPhrase =
    clean.includes("fundamental rights") ||
    /\barticle\s*(12|13|14|15|16|17|18|19|20|21|21a|22|23|24|25|26|27|28|29|30|31|32)\b/i.test(clean) ||
    /\bfrs?\b/i.test(clean) ||
    /\bwrits?\b/i.test(clean);

  if (hasFRPhrase) {
    if (name.includes("fundamental rights") || path.includes("fundamental rights")) {
      addHit("fundamental-rights-context", 14);
    }
    if (subject.includes("polity") || path.includes("polity")) {
      addHit("polity-context", 6);
    }
  }

  const hasRCToneSummary =
    hasPhrase("tone and summary") ||
    hasPhrase("tone of passage") ||
    hasPhrase("summary of passage") ||
    (hasWord("tone") && hasWord("summary")) ||
    (hasWord("passage") && (hasWord("tone") || hasWord("summary")));

  if (hasRCToneSummary) {
    if (
      subjectGroup === "csat" &&
      (name.includes("tone and summary") || path.includes("reading comprehension"))
    ) {
      addHit("csat-tone-summary-context", 12);
    }
  }

  const hasArgumentSignals =
    hasPhrase("strengthening the argument") ||
    hasPhrase("weakening the argument") ||
    ((hasWord("argument") || hasWord("assumption")) && (hasWord("strengthening") || hasWord("weakening")));

  if (hasArgumentSignals) {
    if (
      subjectGroup === "csat" &&
      (name.includes("strengthening") || name.includes("weakening") || path.includes("reasoning"))
    ) {
      addHit("csat-argument-context", 11);
    }
  }

  const hasMonsoon =
    hasWord("monsoon") ||
    hasPhrase("monsoon mechanism") ||
    hasWord("enso") ||
    hasWord("itcz") ||
    (hasWord("jet") && hasWord("stream"));

  if (hasMonsoon) {
    const hasExactMonsoonMechanism = hasPhrase("monsoon mechanism");
    const hasIndiaSpecificSignal =
      hasWord("indian") || hasWord("india") || hasWord("enso") || hasWord("itcz");

    if (name.includes("indian climate") || path.includes("indian geography")) {
      addHit("indian-monsoon-context", hasExactMonsoonMechanism ? 14 : 10);
    }

    if (
      name.includes("jet streams") ||
      name.includes("air mass") ||
      path.includes("climatology")
    ) {
      addHit("climatology-systems-context", hasExactMonsoonMechanism ? 4 : 6);
    }

    if (hasWord("enso") || hasWord("itcz")) {
      if (name.includes("indian climate") || name.includes("monsoon")) {
        addHit("enso-itcz-context", 6);
      }
    }

    if (hasIndiaSpecificSignal && (name.includes("indian climate") || path.includes("indian geography"))) {
      addHit("india-specific-monsoon-bias", 5);
    }
  }

  const hasEssaySignals =
    hasWord("essay") ||
    hasWord("thesis") ||
    hasWord("intro") ||
    hasWord("introduction") ||
    hasWord("conclusion") ||
    hasWord("dimensions");

  if (hasEssaySignals) {
    if (subjectGroup === "essay" || path.includes("essay")) {
      addHit("essay-context", 8);
    }
  }

  if (subjectGroup === "optional") {
    const optionalOverlap = overlapCount(`${subject} ${section} ${parentTopic}`);
    if (optionalOverlap >= 2) {
      addHit("optional-context", optionalOverlap * 2);
    }
  }

  const hasBiotechSignal =
    /\bbiotech(nology)?\b|\bgenetic\b|\bdna\b|\brna\b|\bgene\b|\bcrispr\b|\bstem cell\b|\bgm\b|\bgenomics\b|\bproteomics\b/i.test(clean);

  if (hasBiotechSignal) {
    if (name.includes("biotechnology") || path.includes("biotechnology")) {
      addHit("biotech-specific-context", 16);
    }

    if (
      name === "science and technology" ||
      name === "science technology" ||
      name.includes("science and technology mains") ||
      path.endsWith("science and technology")
    ) {
      score -= 8;
    }
  }

  if (hasWord("ancient")) {
    if (name.includes("ancient") || path.includes("ancient")) addHit("ancient-specific-context", 14);
    if (name === "history") score -= 6;
  }

  if (hasWord("medieval")) {
    if (name.includes("medieval") || path.includes("medieval")) addHit("medieval-specific-context", 14);
    if (name === "history") score -= 6;
  }

  if (name === "economy" || section === "economy") {
    if (hasWord("economy")) addHit("economy-broad-ok", 4);
  }

  if (subjectGroup === "csat") {
    if (clean.includes("averages") && name.includes("ages")) {
      score -= 8;
    }
  }

  const exactTitleInText = name && clean.includes(name);
  const exactParentInText = parentTopic && clean.includes(parentTopic);
  const exactSectionInText = section && clean.includes(section);

  if (exactTitleInText) addHit("exact-title-match", 8);
  if (exactParentInText) addHit("exact-parent-match", 4);
  if (exactSectionInText) addHit("exact-section-match", 3);

  const depth = getNodeDepth(topic);
  if (depth >= 4) addHit("depth-boost", 4);
  if (depth >= 6) addHit("deep-node-boost", 3);

  const matchedMeaningfulCount = uniqueStrings(hits)
    .map((h) => normalize(h))
    .filter(Boolean)
    .filter((h) => !GENERIC_WORDS.has(h)).length;

  if (matchedMeaningfulCount >= 3) addHit("multi-signal-boost", 5);
  if (matchedMeaningfulCount >= 5) addHit("high-signal-boost", 4);

  const isBroadBucket =
    BROAD_BUCKET_WORDS.has(name) ||
    BROAD_BUCKET_WORDS.has(section) ||
    (depth <= 4 &&
      (name === "science technology" ||
        name === "science and technology" ||
        name === "science technology mains developments applications indigenisation ipr"));

  if (isBroadBucket && matchedMeaningfulCount <= 2) {
    score -= 6;
  }

  const genericOnly =
    hits.length > 0 &&
    hits.every((h) => {
      const n = normalize(h);
      return GENERIC_WORDS.has(n) || extractMeaningfulTokens(n).length <= 1;
    });

  if (genericOnly) {
    score -= 4;
  }

  if (code.includes("gs2") && code.includes("ir")) {
    const hasStrongIR =
      /\bun\b|\bundp\b|\bunhrc\b|\bwho\b|\bimf\b|\bworld bank\b|\bwto\b|\bunesco\b|\btreaty\b|\bconvention\b/i.test(clean);
    if (!hasStrongIR && clean.includes("rights")) score -= 5;
  }

  if (
    code.startsWith("gs2 pol evol") &&
    !(hasWord("company") || hasWord("crown") || hasWord("constituent") || hasWord("assembly") || hasWord("acts") || hasWord("1773") || hasWord("1858") || hasWord("1947"))
  ) {
    score -= 10;
  }

  if (
    clean === "constitution" ||
    clean === "indian constitution" ||
    clean === "constitution of india"
  ) {
    if (code.startsWith("gs2 pol evol")) score -= 12;
    if (code === "gs2 pol preamble" || code === "gs2 pol amend" || code === "gs2 pol doctrines") score += 6;
    if (code === "gs2 pol mains hist") score += 4;
  }

  return {
    score: Math.max(0, score),
    hits: uniqueStrings(hits),
  };
}

/* -------------------- FAST LANE -------------------- */
const K2S_FAST_LANE = {
  biotechnology: "GS3-ST-BIOTECH",
  biotech: "GS3-ST-BIOTECH",
  genomics: "GS3-ST-BIOTECH",
  proteomics: "GS3-ST-BIOTECH",
  "genetic engineering": "GS3-ST-BIOTECH",
  "dna sequencing": "GS3-ST-BIOTECH",
  "stem cell": "GS3-ST-BIOTECH",
  "stem cells": "GS3-ST-BIOTECH",
  dbt: "GS3-ST-BIOTECH",
  "national income": "GS3-ECO",
  "money and banking": "GS3-ECO",
  "economy national income": "GS3-ECO",
  "economy national income money and banking": "GS3-ECO",
  "number system": "CSAT-BN-NS",
  numbersystem: "CSAT-BN-NS",

  ancient: "GS1-HIS-ANC",
  medieval: "GS1-HIS-MED",
  modern: "GS1-HIS-MOD",
  monsoon: "GS1-GEO-IND-CLIMATE",
  "monsoon mechanism": "GS1-GEO-IND-CLIMATE",
  "fundamental rights": "GS2-POL-FR",
  rights: "GS2-POL-FR",
  writs: "GS2-POL-FR",
  polity: "GS2-POL-FEATURES",
  environment: "GS3-ENV-ECOLOGY",
  ecology: "GS3-ENV-ECOLOGY",
  ethics: "GS4",
};

function getTopicByCode(code) {
  return ALL_TOPICS.find((t) => t.code === code || t.syllabusNodeId === code);
}

function getFastLaneTopic(clean = "", subject = "") {
  const normalizedClean = expandAliasText(clean);
  const normalizedSubject = normalizeSubject(subject);

  if (
    /\bbiotechnology\b|\bbiotech\b|\bgenomics\b|\bproteomics\b|\bgenetic engineering\b|\bstem cells?\b|\bdna sequencing\b/i.test(normalizedClean)
  ) {
    const topic = getTopicByCode("GS3-ST-BIOTECH");
    if (topic) return topic;
  }

  const exactCode = K2S_FAST_LANE[normalizedClean];
  if (exactCode) {
    return getTopicByCode(exactCode);
  }

  for (const [key, code] of Object.entries(K2S_FAST_LANE)) {
    if (normalizedClean.includes(key)) {
      const topic = getTopicByCode(code);
      if (!topic) continue;

      if (code === "GS3-ST-BIOTECH") {
        if (
          normalizedSubject === "science and technology" ||
          normalizedSubject === "science" ||
          normalizedSubject === "gs3" ||
          normalizedSubject === "" ||
          normalizedClean.includes("science") ||
          normalizedClean.includes("biotechnology")
        ) {
          return topic;
        }
        continue;
      }

      return topic;
    }
  }

  return null;
}

/* -------------------- TOP-K FINDER -------------------- */
export function findTopMicroThemes(userText = "", k = 3, subject = "") {
  const rawClean = normalize(sanitizeTaskText(userText));
  const clean = expandAliasText(rawClean);
  if (!clean) return [];

  const subjectLocked = filterTopicsBySubjectLock(subject, ALL_TOPICS);
  const candidateTopics = filterTopicsByBroadContext(clean, subjectLocked, subject);
  const scored = [];

  for (const topic of candidateTopics) {
    const { score, hits } = scoreTopic(clean, topic);
    if (score >= 4) {
      const confidence = Math.max(0, Math.min(1, score / (score + 20)));
      scored.push({
        found: true,
        syllabusNodeId: topic.syllabusNodeId || topic.code,
        code: topic.code,
        name: topic.name,
        path: topic.path,
        tags: topic.tags,
        gsPaper: topic.gsPaper || null,
        subjectGroup: topic.subjectGroup || null,
        subject: topic.subject || null,
        section: topic.section || null,
        parentTopic: topic.parentTopic || null,
        sourceType: topic.sourceType || null,
        confidence,
        matched: hits.slice(0, 8),
        matchedTokens: hits.slice(0, 8),
        _score: score,
      });
    }
  }

  scored.sort((a, b) => {
    if ((b._score || 0) !== (a._score || 0)) {
      return (b._score || 0) - (a._score || 0);
    }

    const aDepth = getNodeDepth(a);
    const bDepth = getNodeDepth(b);

    if (bDepth !== aDepth) return bDepth - aDepth;

    return (b.confidence || 0) - (a.confidence || 0);
  });

  return scored.slice(0, Math.max(1, k)).map(({ _score, ...rest }) => rest);
}

/* -------------------- CHUNK MAPPER -------------------- */
export function mapTextToSyllabusChunks(userText = "", kPerChunk = 2, subject = "") {
  const cleanedUserText = sanitizeTaskText(userText);
  const chunks = splitStudyChunks(cleanedUserText);

  if (!chunks.length) {
    return {
      found: false,
      primary: null,
      matches: [],
      chunks: [],
      ignoredTokens: [],
      ignoredText: "",
    };
  }

  const allMatches = [];
  const chunkResults = [];
  const ignoredTokens = [];

  for (const chunk of chunks) {
    const ranked = findTopMicroThemes(chunk, kPerChunk, subject);

    if (ranked.length) {
      chunkResults.push({
        chunk,
        found: true,
        matches: ranked,
      });

      for (const r of ranked) {
        allMatches.push({
          ...r,
          chunk,
        });
      }
    } else {
      chunkResults.push({
        chunk,
        found: false,
        matches: [],
      });
      ignoredTokens.push(...extractMeaningfulTokens(chunk));
    }
  }

  const bestByCode = new Map();
  for (const item of allMatches) {
    const prev = bestByCode.get(item.code);
    if (!prev || (item.confidence || 0) > (prev.confidence || 0)) {
      bestByCode.set(item.code, item);
    }
  }

  const deduped = Array.from(bestByCode.values()).sort((a, b) => {
    if ((b.confidence || 0) !== (a.confidence || 0)) {
      return (b.confidence || 0) - (a.confidence || 0);
    }

    const aDepth = getNodeDepth(a);
    const bDepth = getNodeDepth(b);

    return bDepth - aDepth;
  });

  return {
    found: deduped.length > 0,
    primary: deduped.length ? deduped[0] : null,
    matches: deduped,
    chunks: chunkResults,
    ignoredTokens: uniqueStrings(ignoredTokens),
    ignoredText: uniqueStrings(ignoredTokens).join(" "),
  };
}

/* -------------------- TOP-1 FINDER -------------------- */
export function findMicroTheme(userText = "", subject = "") {
  const clean = expandAliasText(normalize(sanitizeTaskText(userText)));
  const normalizedSubject = normalizeSubject(subject);
  const canonicalSubjectKey = getCanonicalSubjectKey(subject);

  if (
    canonicalSubjectKey === "polity" &&
    (clean === "constitution" || clean === "indian constitution" || clean === "constitution of india")
  ) {
    const constitutionRoot =
      getTopicByCode("GS2-POL-PREAMBLE") ||
      getTopicByCode("GS2-POL-AMEND") ||
      getTopicByCode("GS2-POL-MAINS-HIST");
    if (constitutionRoot) {
      return {
        found: true,
        syllabusNodeId: constitutionRoot.syllabusNodeId || constitutionRoot.code,
        code: constitutionRoot.code,
        name: constitutionRoot.name,
        path: constitutionRoot.path,
        tags: constitutionRoot.tags || [],
        gsPaper: constitutionRoot.gsPaper || null,
        subjectGroup: constitutionRoot.subjectGroup || null,
        subject: constitutionRoot.subject || null,
        section: constitutionRoot.section || null,
        parentTopic: constitutionRoot.parentTopic || null,
        sourceType: constitutionRoot.sourceType || null,
        confidence: 0.9,
        matched: ["polity-constitution-root", clean],
        matchedTokens: ["polity-constitution-root", clean],
        primary: {
          ...constitutionRoot,
          confidence: 0.9,
          matched: ["polity-constitution-root", clean],
          matchedTokens: ["polity-constitution-root", clean],
        },
        matches: [
          {
            ...constitutionRoot,
            confidence: 0.9,
            matched: ["polity-constitution-root", clean],
            matchedTokens: ["polity-constitution-root", clean],
          },
        ],
        chunks: [],
        ignoredTokens: [],
        ignoredText: "",
        mappingVersion: "phase2-v7-strict-subject-lock",
      };
    }
  }

  const fastTopic = getFastLaneTopic(clean, normalizedSubject);
  if (fastTopic) {
    const isValid = nodeMatchesCanonicalSubject(fastTopic, canonicalSubjectKey);

    if (isValid) {
      return {
        found: true,
        syllabusNodeId: fastTopic.syllabusNodeId || fastTopic.code,
        code: fastTopic.code,
        name: fastTopic.name,
        path: fastTopic.path,
        tags: fastTopic.tags || [],
        gsPaper: fastTopic.gsPaper || null,
        subjectGroup: fastTopic.subjectGroup || null,
        subject: fastTopic.subject || null,
        section: fastTopic.section || null,
        parentTopic: fastTopic.parentTopic || null,
        sourceType: fastTopic.sourceType || null,
        confidence: 0.95,
        matched: ["k2s-fast-lane", clean],
        matchedTokens: ["k2s-fast-lane", clean],
        primary: {
          ...fastTopic,
          confidence: 0.95,
          matched: ["k2s-fast-lane", clean],
          matchedTokens: ["k2s-fast-lane", clean],
        },
        matches: [
          {
            ...fastTopic,
            confidence: 0.95,
            matched: ["k2s-fast-lane", clean],
            matchedTokens: ["k2s-fast-lane", clean],
          },
        ],
        chunks: [],
        ignoredTokens: [],
        ignoredText: "",
        mappingVersion: "phase2-v7-strict-subject-lock",
      };
    }
  }

  if (!clean) {
    return {
      found: false,
      syllabusNodeId: null,
      code: null,
      name: null,
      path: null,
      tags: [],
      gsPaper: null,
      subjectGroup: null,
      subject: null,
      section: null,
      parentTopic: null,
      sourceType: null,
      confidence: 0,
      matched: [],
      matchedTokens: [],
      primary: null,
      matches: [],
      chunks: [],
      ignoredTokens: [],
      ignoredText: "",
      mappingVersion: "phase2-v7-strict-subject-lock",
    };
  }

  const mapped = mapTextToSyllabusChunks(clean, 2, subject);
  if (!mapped.found || !mapped.primary) {
    return {
      found: false,
      syllabusNodeId: null,
      code: null,
      name: null,
      path: null,
      tags: [],
      gsPaper: null,
      subjectGroup: null,
      subject: null,
      section: null,
      parentTopic: null,
      sourceType: null,
      confidence: 0,
      matched: [],
      matchedTokens: [],
      primary: null,
      matches: [],
      chunks: mapped.chunks || [],
      ignoredTokens: mapped.ignoredTokens || [],
      ignoredText: mapped.ignoredText || "",
      mappingVersion: "phase2-v7-strict-subject-lock",
    };
  }

  let best = mapped.primary;
  if (canonicalSubjectKey && !nodeMatchesCanonicalSubject(best, canonicalSubjectKey)) {
    const subjectSafe = (mapped.matches || []).find((m) => nodeMatchesCanonicalSubject(m, canonicalSubjectKey));
    if (subjectSafe) best = subjectSafe;
  }

  return {
    found: true,
    syllabusNodeId: best.syllabusNodeId || best.code,
    code: best.code,
    name: best.name,
    path: best.path,
    tags: best.tags || [],
    gsPaper: best.gsPaper || null,
    subjectGroup: best.subjectGroup || null,
    subject: best.subject || null,
    section: best.section || null,
    parentTopic: best.parentTopic || null,
    sourceType: best.sourceType || null,
    confidence: best.confidence || 0,
    matched: best.matched || [],
    matchedTokens: best.matchedTokens || best.matched || [],
    primary: best,
    matches: mapped.matches || [],
    chunks: mapped.chunks || [],
    ignoredTokens: mapped.ignoredTokens || [],
    ignoredText: mapped.ignoredText || "",
    mappingVersion: "phase2-v7-strict-subject-lock",
  };
}

/* -------------------- SERVER-EXPECTED HELPERS -------------------- */
export function daysToPrelims(fromDate = new Date()) {
  const prelimsDate = new Date("2026-05-24T00:00:00");
  const diffMs = prelimsDate.getTime() - fromDate.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function killSwitchMode(daysRemaining) {
  return daysRemaining <= 90 ? "ON" : "OFF";
}
