/**
 * backend/blockResolution/sectionClassifier.js — V2
 *
 * STEP 3 — SECTION CLASSIFIER
 *
 * Three-tier scoring mirroring subjectClassifier.js, locked to one subject.
 * Normalizes predicted section via SECTION_ALIASES before returning.
 * Section labels must match pdfToSyllabusMap.js keys.
 */

import { SECTION_KEYWORDS, SECTION_ALIASES } from "./ocrKeywordBank.js";

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.60,
  MEDIUM: 0.30,
};

const GAP_THRESHOLD = 0.12;
const SCORE_REFERENCE = 90;
const CONTEXT_BOOST_MAX_FRACTION = 0.08;

/** Map classifier subject name → PDF subject prefix */
export const SUBJECT_TO_PDF_LABEL = {
  "Polity":                  "Indian Polity",
  "Economy":                 "Indian Economy",
  "Environment":             "Environment",
  "Science & Technology":    "Science and Technology",
  "Geography":               "Geography",
  "Ancient Indian History":  "Ancient Indian History",
  "Medieval Indian History": "Medieval Indian History",
  "Modern Indian History":   "Modern Indian History",
  "Art & Culture":           "Art and Culture",
  "International Relations": "International Relations",
  "Society":                 "Society",
  "Current Affairs":         "Current Affairs",
};

/**
 * Normalize a section label via SECTION_ALIASES.
 * Returns the alias target if found, else original label.
 */
function normalizeSection(sectionLabel) {
  if (!sectionLabel) return sectionLabel;
  const key = sectionLabel.toLowerCase().trim();
  return SECTION_ALIASES[key] || sectionLabel;
}

/**
 * Score a single section using three-tier bank.
 */
function scoreSection(sectionName, bank, sanitized) {
  const { normalizedText, phrases = [], tokens = [] } = sanitized;
  let score = 0;
  const matchedKeywords = [];

  // ── Tier 1: phraseWeights ─────────────────────────────────────────────────
  if (bank.phraseWeights) {
    for (const phrase of phrases) {
      if (bank.phraseWeights[phrase] !== undefined) {
        const w = bank.phraseWeights[phrase];
        score += w;
        matchedKeywords.push({ term: phrase, weight: w, type: "phrase" });
      }
    }
    for (const [phrase, weight] of Object.entries(bank.phraseWeights)) {
      if (phrase.includes(" ") && normalizedText.includes(phrase)) {
        if (!matchedKeywords.some((m) => m.term === phrase)) {
          score += weight;
          matchedKeywords.push({ term: phrase, weight, type: "phrase-substring" });
        }
      }
    }
  }

  // ── Tier 2: rareKeywordWeights ────────────────────────────────────────────
  if (bank.rareKeywordWeights) {
    for (const token of tokens) {
      if (bank.rareKeywordWeights[token] !== undefined) {
        const w = bank.rareKeywordWeights[token];
        score += w;
        matchedKeywords.push({ term: token, weight: w, type: "rare-keyword" });
      }
    }
  }

  // ── Tier 3: keywordWeights ────────────────────────────────────────────────
  if (bank.keywordWeights) {
    for (const token of tokens) {
      if (bank.keywordWeights[token] !== undefined) {
        const alreadyCounted = matchedKeywords.some((m) => m.term === token);
        if (!alreadyCounted) {
          const w = bank.keywordWeights[token];
          score += w;
          matchedKeywords.push({ term: token, weight: w, type: "keyword" });
        }
      }
    }
  }

  // ── Legacy fallback ───────────────────────────────────────────────────────
  if (!bank.phraseWeights && bank.phrases) {
    for (const phrase of phrases) {
      if (bank.phrases[phrase] !== undefined) {
        const w = bank.phrases[phrase];
        score += w;
        matchedKeywords.push({ term: phrase, weight: w, type: "phrase" });
      }
    }
    for (const [phrase, weight] of Object.entries(bank.phrases)) {
      if (phrase.includes(" ") && normalizedText.includes(phrase) && weight >= 8) {
        if (!matchedKeywords.some((m) => m.term === phrase)) {
          score += weight;
          matchedKeywords.push({ term: phrase, weight, type: "phrase-substring" });
        }
      }
    }
  }
  if (!bank.rareKeywordWeights && !bank.keywordWeights && bank.tokens) {
    for (const token of tokens) {
      if (bank.tokens[token] !== undefined) {
        const w = bank.tokens[token];
        score += w;
        matchedKeywords.push({ term: token, weight: w, type: "token" });
      }
    }
  }

  return { score, matchedKeywords };
}

/**
 * Classify the section within a locked subject.
 *
 * @param {object} params
 * @param {object} params.sanitized  - Output of sanitizeOcrText()
 * @param {string} params.subject    - Subject from classifySubject()
 * @param {object} params.context    - Optional: { confirmedSection }
 * @returns {{
 *   section: string|null,
 *   normalizedSection: string|null,
 *   pdfSection: string|null,
 *   confidence: number,
 *   confidenceGap: number,
 *   confidenceBand: string,
 *   scores: object[],
 *   matchedKeywords: object[],
 *   alternatives: object[],
 *   reviewRequired: boolean,
 *   _topSection: string|null
 * }}
 */
export function classifySection({ sanitized, subject, context = {} }) {
  const empty = {
    section: null,
    normalizedSection: null,
    pdfSection: null,
    confidence: 0,
    confidenceGap: 0,
    confidenceBand: "low",
    scores: [],
    matchedKeywords: [],
    alternatives: [],
    reviewRequired: true,
    _topSection: null,
  };

  if (!sanitized || !subject) return empty;

  const sectionBank = SECTION_KEYWORDS[subject];
  if (!sectionBank) {
    return { ...empty, reason: `no_section_bank_for_subject:${subject}` };
  }

  const results = [];

  for (const [sectionName, bank] of Object.entries(sectionBank)) {
    const { score, matchedKeywords } = scoreSection(sectionName, bank, sanitized);
    if (score > 0) {
      results.push({ section: sectionName, score, matchedKeywords });
    }
  }

  if (results.length === 0) return empty;

  // Context boost
  if (context.confirmedSection) {
    const entry = results.find((r) => r.section === context.confirmedSection);
    if (entry) {
      const boost = Math.round(entry.score * CONTEXT_BOOST_MAX_FRACTION);
      entry.score += boost;
      entry.matchedKeywords.push({ term: "[context-boost]", weight: boost, type: "context" });
    }
  }

  results.sort((a, b) => b.score - a.score);

  const top = results[0];
  const second = results[1] || null;

  const confidence = Math.min(top.score / SCORE_REFERENCE, 1.0);
  const fractionGap = second
    ? (top.score - second.score) / Math.max(top.score, 1)
    : 1.0;

  const isReviewRequired =
    confidence < CONFIDENCE_THRESHOLDS.MEDIUM ||
    (confidence < CONFIDENCE_THRESHOLDS.HIGH && fractionGap < GAP_THRESHOLD);

  const confidenceBand =
    confidence >= CONFIDENCE_THRESHOLDS.HIGH && fractionGap >= GAP_THRESHOLD
      ? "high"
      : confidence >= CONFIDENCE_THRESHOLDS.MEDIUM
      ? "medium"
      : "low";

  const pdfSubjectLabel = SUBJECT_TO_PDF_LABEL[subject] || subject;
  const rawSection = top.section;
  const normalizedSection = normalizeSection(rawSection);
  const pdfSection = `${pdfSubjectLabel} > ${normalizedSection}`;

  return {
    section: rawSection,
    normalizedSection,
    pdfSection,
    confidence: parseFloat(confidence.toFixed(3)),
    confidenceGap: parseFloat(fractionGap.toFixed(3)),
    confidenceBand,
    scores: results.slice(0, 5).map((r) => ({ section: r.section, score: r.score })),
    matchedKeywords: top.matchedKeywords,
    alternatives: results.slice(1, 4).map((r) => ({
      section: r.section,
      normalizedSection: normalizeSection(r.section),
      score: r.score,
      confidence: parseFloat(Math.min(r.score / SCORE_REFERENCE, 1.0).toFixed(3)),
    })),
    reviewRequired: isReviewRequired,
    _topSection: rawSection,
  };
}
