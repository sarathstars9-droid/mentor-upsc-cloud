// backend/brain/findMicroTheme.js
// K2S Mapper (Keyword-to-Syllabus) — ESM, stable, supports subTopics + top-k

import SYLLABUS_GRAPH_2026 from "./syllabusGraph.js";

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

/* -------------------- STOPWORDS / GENERIC -------------------- */
const STOPWORDS = new Set([
  "a","an","the","and","or","to","of","in","on","for","with","from","by",
  "read","studied","study","revise","revision","notes","write","wrote","practice",
  "solve","solved","today","yesterday","tomorrow","did"
]);

const GENERIC_WORDS = new Set([
  "rights","law","laws","policy","policies","government","state","india",
  "case","cases","study","studies","ethics","international","institutions"
]);

/* -------------------- KEYWORD SCORING -------------------- */
function scoreKeyword(cleanText, kwRaw) {
  const kw = normalize(kwRaw);
  if (!kw) return { score: 0, hit: false };

  const isPhrase = kw.includes(" ");
  const kwLen = kw.length;

  // Phrase match (substring)
  if (isPhrase) {
    if (cleanText.includes(kw)) {
      const base = 10;
      const lenBoost = Math.min(8, Math.floor(kwLen / 8)); // 0..8
      return { score: base + lenBoost, hit: true };
    }
    return { score: 0, hit: false };
  }

  // Single-word match (word boundary)
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

  // 1) Keywords score
  for (const kw of keywords) {
    const r = scoreKeyword(clean, kw);
    if (r.hit) {
      score += r.score;
      hits.push(String(kw));
    }
  }

  // 2) Title bonus
  for (const kw of title) {
    const r = scoreKeyword(clean, kw);
    if (r.hit) {
      score += r.score + 2;
      hits.push(String(kw));
    }
  }

  // 3) UPSC boosts
  const hasCaseStudy =
    /\bcase\s*study\b/i.test(clean) ||
    /\bstakeholder(s)?\b/i.test(clean) ||
    /\bdilemma(s)?\b/i.test(clean);

  if (hasCaseStudy) {
    const t = normalize(topic.name || "");
    const p = normalize(topic.path || "");
    if (t.includes("case studies") || p.includes("gs4") || p.includes("ethics")) {
      score += 8;
    }
  }

  const hasFRPhrase =
    clean.includes("fundamental rights") ||
    /\barticle\s*(14|19|21)\b/i.test(clean) ||
    /\bfrs?\b/i.test(clean);

  if (hasFRPhrase) {
    const t = normalize(topic.name || "");
    const p = normalize(topic.path || "");
    if (t.includes("fundamental rights") || p.includes("fundamental rights")) {
      score += 12;
    }
  }

  // Penalty to avoid wrong IR institution mapping for generic "rights"
  const code = normalize(topic.code || "");
  if (code.includes("gs2") && code.includes("ir")) {
    const hasStrongIR =
      /\bun\b|\bundp\b|\bunhrc\b|\bwho\b|\bimf\b|\bworld bank\b|\bwto\b|\bunesco\b|\btreaty\b|\bconvention\b/i.test(clean);
    if (!hasStrongIR && clean.includes("rights")) score -= 4;
  }

  return { score, hits };
}

/* -------------------- COLLECT TOPICS -------------------- */
function collectAllTopics() {
  const topics = [];
  const GS = SYLLABUS_GRAPH_2026;

  for (const gsKey of Object.keys(GS)) {
    const gs = GS[gsKey];
    if (!gs?.subjects) continue;

    for (const subjectKey of Object.keys(gs.subjects)) {
      const subject = gs.subjects[subjectKey];

      // sections -> topics
      if (subject?.sections) {
        for (const section of subject.sections || []) {
          for (const topic of section.topics || []) {
            const keywordPool = [
              topic.name,
              ...(topic.keywords || []),
              ...(topic.microThemes || []),
            ].filter(Boolean);

            topics.push({
              code: topic.id,
              name: topic.name,
              keywords: keywordPool,
              path: `${gs.heading} > ${subjectKey} > ${section.name} > ${topic.name}`,
              tags: topic.tags || [],
              gsPaper: gsKey,
              gsHeading: gs.heading,
              macroTheme: gs.macroTheme,
              subject: subjectKey,
            });

            // ✅ subTopics support (GS4 Applied Ethics etc.)
            if (Array.isArray(topic.subTopics) && topic.subTopics.length) {
              for (const sub of topic.subTopics) {
                const subKeywordPool = [
                  sub.name,
                  ...(sub.keywords || []),
                  ...(sub.microThemes || []),
                ].filter(Boolean);

                topics.push({
                  code: sub.id,
                  name: sub.name,
                  keywords: subKeywordPool,
                  path: `${gs.heading} > ${subjectKey} > ${section.name} > ${topic.name} > ${sub.name}`,
                  tags: sub.tags || topic.tags || [],
                  gsPaper: gsKey,
                  gsHeading: gs.heading,
                  macroTheme: gs.macroTheme,
                  subject: subjectKey,
                });
              }
            }
          }
        }
      }

      // blocks -> microThemes (if any special module uses it)
      if (subject?.blocks) {
        for (const block of subject.blocks || []) {
          for (const micro of block.microThemes || []) {
            const extra = (micro.subtopics || []).map((s) => s.t).filter(Boolean);

            const keywordPool = [
              micro.title,
              ...(micro.keywords || []),
              ...extra,
            ].filter(Boolean);

            topics.push({
              code: micro.code,
              name: micro.title,
              keywords: keywordPool,
              path: `${gs.heading} > ${subjectKey} > ${block.block} > ${micro.title}`,
              tags: [micro.examTag || "PM"],
              gsPaper: gsKey,
              gsHeading: gs.heading,
              macroTheme: gs.macroTheme,
              subject: subjectKey,
            });
          }
        }
      }
    }
  }

  return topics;
}

const ALL_TOPICS = collectAllTopics();

/* -------------------- TOP-1 FINDER -------------------- */
export function findMicroTheme(userText = "") {
  const clean = normalize(userText);
  if (!clean) {
    return { found: false, code: null, name: null, path: null, tags: [], confidence: 0 };
  }

  let best = null;
  let bestScore = -Infinity;
  let bestHits = [];

  for (const topic of ALL_TOPICS) {
    const { score, hits } = scoreTopic(clean, topic);
    if (score > bestScore) {
      bestScore = score;
      best = topic;
      bestHits = hits;
    }
  }

  // Threshold
  if (!best || bestScore < 6) {
    return { found: false, code: null, name: null, path: null, tags: [], confidence: 0 };
  }

  const confidence = Math.max(0, Math.min(1, bestScore / (bestScore + 20)));

  return {
    found: true,
    code: best.code,
    name: best.name,
    path: best.path,
    tags: best.tags,
    confidence,
    matched: bestHits.slice(0, 8),
  };
}

/* -------------------- TOP-K FINDER (multi-mapping) -------------------- */
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
        code: topic.code,
        name: topic.name,
        path: topic.path,
        tags: topic.tags,
        confidence,
        matched: hits.slice(0, 8),
        _score: score,
      });
    }
  }

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, Math.max(1, k)).map(({ _score, ...rest }) => rest);
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
  const m = findMicroTheme(`${task} ${subject}`.trim());
  if (!m.found) return null;

  const tag = Array.isArray(m.tags) && m.tags.length ? m.tags[0] : "PM";

  // find full meta from ALL_TOPICS
  const full = ALL_TOPICS.find((x) => x.code === m.code);

  return {
    code: m.code,
    microTitle: m.name,
    tag,
    confidence: m.confidence,
    gsPaper: full?.gsPaper || null,
    gsHeading: full?.gsHeading || null,
    macroTheme: full?.macroTheme || null,
    subject: full?.subject || subject || null,
    caThemes: [],
  };
}