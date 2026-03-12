// backend/brain/findMicroTheme.js
// K2S Mapper (Keyword-to-Syllabus) — ESM, stable, supports chunk mapping + enriched Phase 2 fields

import { UNIFIED_SYLLABUS_INDEX } from "./unifiedSyllabusIndex.js";

/* -------------------- NORMALIZE -------------------- */
function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  ];

  let protectedText = raw;

  for (const phrase of protectedPhrases) {
    const safe = phrase.replace(/\s+/g, "_");
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    protectedText = protectedText.replace(re, safe);
  }

  const normalized = protectedText
    .replace(/\r?\n+/g, " | ")
    .replace(/\s*\+\s*/g, " | ")
    .replace(/\s*;\s*/g, " | ")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\s*\/\s*/g, " | ");

  let parts = normalized
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

  // restore protected phrases
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
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((p) => normalize(p).length >= 3);

  return useful.length ? useful : [raw];
}

/* -------------------- STOPWORDS / GENERIC -------------------- */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "from", "by",
  "read", "studied", "study", "revise", "revision", "notes", "write", "wrote", "practice",
  "solve", "solved", "today", "yesterday", "tomorrow", "did", "complete", "completed",
  "watch", "watched", "class", "lecture", "lectures", "video", "videos", "test", "tests"
]);

const GENERIC_WORDS = new Set([
  "rights", "law", "laws", "policy", "policies", "government", "state", "india",
  "case", "cases", "study", "studies", "ethics", "international", "institutions",
  "summary", "tone", "climate", "monsoon"
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

/* -------------------- UNIFIED SYLLABUS SOURCE -------------------- */
const ALL_TOPICS = UNIFIED_SYLLABUS_INDEX.map((node) => ({
  syllabusNodeId: node.syllabusNodeId,
  code: node.syllabusNodeId, // backward compatibility
  name: node.name,
  keywords: uniqueStrings([
    ...(node.aliases || []),
    ...(node.keywords || []),
    ...(node.microThemes || []),
    ...(node.rawTextPool || []),
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
  const code = normalize(topic.code || "");
  const name = normalize(topic.name || "");

  const meaningfulTokens = extractMeaningfulTokens(clean);
  const tokenSet = new Set(meaningfulTokens);

  function addHit(text, points) {
    if (!text || !points) return;
    score += points;
    hits.push(String(text));
  }

  function hasWord(word) {
    return tokenSet.has(normalize(word));
  }

  function hasAny(words = []) {
    return words.some((w) => hasWord(w));
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

  // 1) Strong exact phrase priority for title
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

  // 2) Keywords / aliases / microthemes
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

  // 3) Parent/section/path support
  const parentOverlap = overlapCount(parentTopic);
  if (parentOverlap >= 1) addHit(topic.parentTopic || "parentTopic", parentOverlap * 2);

  const sectionOverlap = overlapCount(section);
  if (sectionOverlap >= 1) addHit(topic.section || "section", sectionOverlap * 2);

  const subjectOverlap = overlapCount(subject);
  if (subjectOverlap >= 1) addHit(topic.subject || "subject", subjectOverlap * 2);

  // 4) UPSC-specific disambiguation boosts

  // GS4 ethics / case study signals
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

  // Fundamental Rights / polity signals
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

  // CSAT RC tone/summary signals
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

  // Strengthen / weaken argument signals
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

  // Monsoon / climatology disambiguation
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

  // Essay signals
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

  // Optional signals
  if (subjectGroup === "optional") {
    const optionalOverlap = overlapCount(`${subject} ${section} ${parentTopic}`);
    if (optionalOverlap >= 2) {
      addHit("optional-context", optionalOverlap * 2);
    }
  }

  // 5) Penalties for generic weak matches
  const genericOnly =
    hits.length > 0 &&
    hits.every((h) => {
      const n = normalize(h);
      return GENERIC_WORDS.has(n) || extractMeaningfulTokens(n).length <= 1;
    });

  if (genericOnly) {
    score -= 4;
  }

  // avoid wrong IR match for generic "rights"
  if (code.includes("gs2") && code.includes("ir")) {
    const hasStrongIR =
      /\bun\b|\bundp\b|\bunhrc\b|\bwho\b|\bimf\b|\bworld bank\b|\bwto\b|\bunesco\b|\btreaty\b|\bconvention\b/i.test(clean);
    if (!hasStrongIR && clean.includes("rights")) score -= 5;
  }

  // if there is no meaningful overlap at all, suppress accidental weak hits
  const totalFieldOverlap =
    overlapCount(topic.name || "") +
    overlapCount(topic.parentTopic || "") +
    overlapCount(topic.section || "");

  if (totalFieldOverlap === 0 && hits.length <= 1 && score < 10) {
    score -= 3;
  }

  return {
    score: Math.max(0, score),
    hits: uniqueStrings(hits),
  };
}

/* -------------------- TOP-K FINDER -------------------- */
export function findTopMicroThemes(userText = "", k = 3) {
  const clean = normalize(userText);
  if (!clean) return [];

  const scored = [];

  for (const topic of ALL_TOPICS) {
    const { score, hits } = scoreTopic(clean, topic);
    if (score >= 6) {
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

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, Math.max(1, k)).map(({ _score, ...rest }) => rest);
}

/* -------------------- CHUNK MAPPER -------------------- */
export function mapTextToSyllabusChunks(userText = "", kPerChunk = 2) {
  const chunks = splitStudyChunks(userText);
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
    const ranked = findTopMicroThemes(chunk, kPerChunk);

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

  const deduped = Array.from(bestByCode.values()).sort(
    (a, b) => (b.confidence || 0) - (a.confidence || 0)
  );

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
export function findMicroTheme(userText = "") {
  const clean = normalize(userText);
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
      mappingVersion: "phase2-v1",
    };
  }

  const mapped = mapTextToSyllabusChunks(userText, 2);
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
      mappingVersion: "phase2-v1",
    };
  }

  const best = mapped.primary;

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
    mappingVersion: "phase2-v1",
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

export function mapPlanItemToMicroTheme(task = "", subject = "") {
  const mapped = findMicroTheme(`${task} ${subject}`.trim());
  if (!mapped.found) return null;

  const tag = Array.isArray(mapped.tags) && mapped.tags.length ? mapped.tags[0] : "PM";

  return {
    syllabusNodeId: mapped.syllabusNodeId || mapped.code,
    code: mapped.code, // backward compatibility
    microTitle: mapped.name,
    mappedTopicName: mapped.name,
    tag,
    confidence: mapped.confidence,
    gsPaper: mapped.gsPaper || null,
    subjectGroup: mapped.subjectGroup || null,
    gsHeading: mapped.subjectGroup || null,
    macroTheme: mapped.section || null,
    subject: mapped.subject || subject || null,
    section: mapped.section || null,
    parentTopic: mapped.parentTopic || null,
    path: mapped.path || null,
    matched: mapped.matched || [],
    matchedTokens: mapped.matchedTokens || [],
    allMatches: mapped.matches || [],
    chunks: mapped.chunks || [],
    ignoredTokens: mapped.ignoredTokens || [],
    ignoredText: mapped.ignoredText || "",
    mappingVersion: mapped.mappingVersion || "phase2-v1",
    caThemes: [],
  };
}