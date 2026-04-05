/**
 * backend/blockResolution/subjectClassifier.js — V2
 *
 * Three-tier scoring:
 *   phraseWeights      → highest signal (exact multi-word match)
 *   rareKeywordWeights → rare domain tokens (high signal)
 *   keywordWeights     → common tokens (moderate signal)
 *
 * Context boost: gently lifts prior confirmed subject score.
 * Context never overrides strong contradictory evidence.
 *
 * Output fields:
 *   subject, confidence, confidenceGap, confidenceBand,
 *   scores, matchedKeywords, alternatives, reviewRequired
 */

import { SUBJECT_KEYWORDS } from "./ocrKeywordBank.js";

const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.65,
  MEDIUM: 0.35,
};

const GAP_THRESHOLD = 0.12; // min fractional gap between rank-1 and rank-2

// Score reference — a strongly-matched Polity/Science text typically ~120-160 pts
const SCORE_REFERENCE = 140;

// Context boost: max % of raw score we add for a prior confirmed subject
const CONTEXT_BOOST_MAX_FRACTION = 0.08; // 8% boost max

/**
 * Score one subject against the three-tier bank.
 */
function scoreSubject(subjectName, bank, sanitized) {
  const { normalizedText, phrases = [], tokens = [] } = sanitized;
  let score = 0;
  const matchedKeywords = [];

  // ── Tier 1: phraseWeights (multi-word, highest weight) ──────────────────────
  if (bank.phraseWeights) {
    // From sanitizer-built phrase list
    for (const phrase of phrases) {
      if (bank.phraseWeights[phrase] !== undefined) {
        const w = bank.phraseWeights[phrase];
        score += w;
        matchedKeywords.push({ term: phrase, weight: w, type: "phrase" });
      }
    }
    // Substring sweep for longer phrases not in tokenizer output
    for (const [phrase, weight] of Object.entries(bank.phraseWeights)) {
      if (phrase.includes(" ") && normalizedText.includes(phrase)) {
        if (!matchedKeywords.some((m) => m.term === phrase)) {
          score += weight;
          matchedKeywords.push({ term: phrase, weight, type: "phrase-substring" });
        }
      }
    }
  }

  // ── Tier 2: rareKeywordWeights ───────────────────────────────────────────────
  if (bank.rareKeywordWeights) {
    for (const token of tokens) {
      if (bank.rareKeywordWeights[token] !== undefined) {
        const w = bank.rareKeywordWeights[token];
        score += w;
        matchedKeywords.push({ term: token, weight: w, type: "rare-keyword" });
      }
    }
  }

  // ── Tier 3: keywordWeights ────────────────────────────────────────────────────
  if (bank.keywordWeights) {
    for (const token of tokens) {
      if (bank.keywordWeights[token] !== undefined) {
        // Only add if not already counted in rareKeywords
        const alreadyCounted = matchedKeywords.some((m) => m.term === token);
        if (!alreadyCounted) {
          const w = bank.keywordWeights[token];
          score += w;
          matchedKeywords.push({ term: token, weight: w, type: "keyword" });
        }
      }
    }
  }

  // ── Legacy fallback: old-style bank.phrases / bank.tokens ────────────────────
  // Supports any bank not yet ported to three-tier structure
  if (!bank.phraseWeights && bank.phrases) {
    for (const phrase of phrases) {
      if (bank.phrases[phrase] !== undefined) {
        const w = bank.phrases[phrase];
        score += w;
        matchedKeywords.push({ term: phrase, weight: w, type: "phrase" });
      }
    }
    for (const [phrase, weight] of Object.entries(bank.phrases)) {
      if (phrase.includes(" ") && normalizedText.includes(phrase)) {
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
 * Classify the subject of OCR text.
 *
 * @param {object} sanitized  - Output of sanitizeOcrText()
 * @param {object} context    - Optional: { confirmedSubject, confirmedSection, recentHints }
 * @returns {{
 *   subject: string|null,
 *   confidence: number,
 *   confidenceGap: number,
 *   confidenceBand: string,
 *   scores: object[],
 *   matchedKeywords: object[],
 *   alternatives: object[],
 *   reviewRequired: boolean,
 *   _topSubject: string|null
 * }}
 */
export function classifySubject(sanitized, context = {}) {
  if (!sanitized || !sanitized.normalizedText) {
    return {
      subject: null,
      confidence: 0,
      confidenceGap: 0,
      confidenceBand: "low",
      scores: [],
      matchedKeywords: [],
      alternatives: [],
      reviewRequired: true,
      _topSubject: null,
    };
  }

  const results = [];

  for (const [subjectName, bank] of Object.entries(SUBJECT_KEYWORDS)) {
    const { score, matchedKeywords } = scoreSubject(subjectName, bank, sanitized);
    if (score > 0) {
      results.push({ subject: subjectName, score, matchedKeywords });
    }
  }

  if (results.length === 0) {
    return {
      subject: null,
      confidence: 0,
      confidenceGap: 0,
      confidenceBand: "low",
      scores: [],
      matchedKeywords: [],
      alternatives: [],
      reviewRequired: true,
      _topSubject: null,
    };
  }

  // ── Context boost (gentle, never override strong leader) ─────────────────────
  if (context.confirmedSubject) {
    const entry = results.find((r) => r.subject === context.confirmedSubject);
    if (entry) {
      // Boost is capped at CONTEXT_BOOST_MAX_FRACTION of that entry's raw score
      const boost = Math.round(entry.score * CONTEXT_BOOST_MAX_FRACTION);
      entry.score += boost;
      entry.matchedKeywords.push({ term: "[context-boost]", weight: boost, type: "context" });
    }
  }

  results.sort((a, b) => b.score - a.score);

  const top = results[0];
  const second = results[1] || null;

  const confidence = Math.min(top.score / SCORE_REFERENCE, 1.0);
  const rawGap = second ? top.score - second.score : top.score;
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

  return {
    subject: isReviewRequired ? null : top.subject,
    confidence: parseFloat(confidence.toFixed(3)),
    confidenceGap: parseFloat(fractionGap.toFixed(3)),
    confidenceBand,
    scores: results.slice(0, 5).map((r) => ({ subject: r.subject, score: r.score })),
    matchedKeywords: top.matchedKeywords,
    alternatives: results.slice(1, 4).map((r) => ({
      subject: r.subject,
      score: r.score,
      confidence: parseFloat(Math.min(r.score / SCORE_REFERENCE, 1.0).toFixed(3)),
    })),
    reviewRequired: isReviewRequired,
    _topSubject: top.subject,
  };
}
