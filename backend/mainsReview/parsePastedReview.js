// backend/mainsReview/parsePastedReview.js
// Parses the raw pasted ChatGPT review into structured sections.
// HEURISTIC: Sections are identified by heading patterns like "A. ...", "B. ...", etc.
// If a section is missing, it is stored as null — pipeline continues with partial data.

/**
 * Section heading lookup — what we expect from the AIR-1 review prompt format.
 */
const SECTION_KEYS = {
  A: "marksAwarded",
  B: "directiveWordHandling",
  C: "structureReview",
  D: "contentStrength",
  E: "examinerConcerns",
  F: "air1UpgradeAdvice",
  G: "rewriteBlueprint",
  H: "mistakeClassification",
  I: "finalVerdict",
};

/**
 * Split raw review text into labelled sections.
 * Returns: { marksAwarded, directiveWordHandling, ... } each as raw text strings or null.
 * Also returns: { raw, sectionCount, parsedAt, isPartial }
 *
 * HEURISTIC NOTES:
 * - Splits on lines matching /^[A-I]\.\s+/ (letter dot space at line start)
 * - Also handles numbered variants like "1. Marks Awarded"
 * - Section content is everything between two headings
 * - Missing sections are null — downstream handles gracefully
 */
export function parsePastedReview(rawText) {
  const lines = (rawText || "").split(/\r?\n/);
  const sections = {};
  let currentKey = null;
  let currentLines = [];

  // Regex: matches "A. " or "A) " at line start (case insensitive)
  const headingRe = /^([A-I])[.)]\s+(.+)?/i;

  for (const line of lines) {
    const match = line.match(headingRe);
    if (match) {
      // Save previous section
      if (currentKey) {
        sections[currentKey] = currentLines.join("\n").trim() || null;
      }
      const letter = match[1].toUpperCase();
      currentKey = SECTION_KEYS[letter] || null;
      currentLines = match[2] ? [match[2]] : [];
    } else {
      if (currentKey) currentLines.push(line);
    }
  }

  // Flush last section
  if (currentKey) {
    sections[currentKey] = currentLines.join("\n").trim() || null;
  }

  // Fill in any completely missing sections as null
  const result = {};
  for (const key of Object.values(SECTION_KEYS)) {
    result[key] = sections[key] ?? null;
  }

  const sectionCount = Object.values(result).filter(Boolean).length;
  const isPartial = sectionCount < Object.keys(SECTION_KEYS).length;

  // ── Extract marks from marksAwarded section ──────────────────────────────
  const marksExtracted = extractMarksFromSection(result.marksAwarded);

  // ── Extract final verdict label ──────────────────────────────────────────
  const verdictLabel = extractVerdictLabel(result.finalVerdict);

  // ── Extract mistake labels from H section ────────────────────────────────
  const rawMistakeLabels = extractMistakeLabels(result.mistakeClassification);

  return {
    schema: "mainsParsedReview",
    parsedAt: new Date().toISOString(),
    isPartial,
    sectionCount,
    totalSections: Object.keys(SECTION_KEYS).length,
    sections: result,
    extracted: {
      marksAwarded: marksExtracted.marks,
      marksTotal:   marksExtracted.total,
      verdictLabel,
      rawMistakeLabels,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * HEURISTIC: Extract marks from text like "8/15" or "8 out of 15" or "Marks: 8"
 */
function extractMarksFromSection(text) {
  if (!text) return { marks: null, total: null };
  const slashMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    return { marks: Number(slashMatch[1]), total: Number(slashMatch[2]) };
  }
  const outOfMatch = text.match(/(\d+)\s+out\s+of\s+(\d+)/i);
  if (outOfMatch) {
    return { marks: Number(outOfMatch[1]), total: Number(outOfMatch[2]) };
  }
  const singleMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return { marks: Number(singleMatch[1]), total: null };
  }
  return { marks: null, total: null };
}

/**
 * HEURISTIC: Extract final verdict from text by matching known verdict phrases.
 */
const VERDICT_PHRASES = [
  "ranker-grade answer",
  "strong answer",
  "good but not ranker level",
  "average but recoverable",
  "below upsc standard",
  "dangerous answer",
];

function extractVerdictLabel(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const phrase of VERDICT_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return text.split("\n")[0].trim().toLowerCase() || null;
}

/**
 * HEURISTIC: Extract mistake labels by matching known taxonomy keywords in section H.
 * Returns array of matched canonical mistake IDs.
 */
const MISTAKE_KEYWORD_MAP = {
  missed_core_demand:        ["missed core demand", "core demand"],
  poor_directive_handling:   ["directive handling", "directive word"],
  weak_intro:                ["weak intro", "poor intro", "introduction"],
  weak_body_flow:            ["body flow", "body organization", "flow"],
  weak_conclusion:           ["weak conclusion", "poor conclusion"],
  low_dimensionality:        ["low dimensionality", "dimensionality", "dimensions"],
  shallow_content:           ["shallow content", "shallow", "surface level"],
  factual_weakness:          ["factual weakness", "factual", "incorrect fact"],
  no_examples:               ["no examples", "lack of examples", "missing examples"],
  poor_balance:              ["poor balance", "one-sided"],
  weak_analysis:             ["weak analysis", "analytical weakness"],
  poor_structure:            ["poor structure", "structure"],
  poor_prioritization:       ["poor prioritization", "prioritization"],
  time_pressure_compression: ["time pressure", "time-pressure", "rushed"],
  weak_presentation:         ["weak presentation", "presentation"],
  no_subheadings:            ["no subheadings", "subheadings"],
  too_short:                 ["too short", "word count low", "length short"],
  too_lengthy:               ["too lengthy", "too long", "word count high"],
  vague_language:            ["vague language", "vague", "unclear language"],
  repetitive_expression:     ["repetitive", "repetition"],
  poor_question_understanding: ["poor question understanding", "misunderstood"],
};

function extractMistakeLabels(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const [key, phrases] of Object.entries(MISTAKE_KEYWORD_MAP)) {
    if (phrases.some((p) => lower.includes(p))) {
      found.push(key);
    }
  }
  return found;
}
