// backend/mainsReview/extractReviewSignals.js
// Extracts structured signals from parsed review sections.
// Schema output: mainsReviewIntelligence (partial — mistake flags + upgrade signals)
//
// HEURISTIC: pulls key phrases from each section into structured buckets.
// Does NOT call any AI. All extraction is regex/keyword-based.

/**
 * Extract structured signals from a parsed review.
 * @param {object} parsed - output of parsePastedReview()
 * @param {object} audit  - output of auditReviewQuality()
 * @returns structured signals object
 */
export function extractReviewSignals(parsed, audit) {
  const sections = parsed?.sections || {};
  const extracted = parsed?.extracted || {};

  // ── Strengths from section D ─────────────────────────────────────────────
  const strengths = extractBulletPoints(sections.contentStrength, /strength/i, 3);

  // ── Missing dimensions from section D ────────────────────────────────────
  const missingDimensions = extractBulletPoints(sections.contentStrength, /missing|absent|lack/i, 5);

  // ── Specific upgrade actions from section F ───────────────────────────────
  const upgradeActions = extractBulletPoints(sections.air1UpgradeAdvice, null, 5);

  // ── Examiner concerns from section E ─────────────────────────────────────
  const examinerConcerns = extractBulletPoints(sections.examinerConcerns, null, 5);

  // ── Directive word analysis from section B ────────────────────────────────
  const directiveHandled = extractDirectiveStatus(sections.directiveWordHandling);

  // ── Structure ratings from section C ─────────────────────────────────────
  const structureRatings = extractStructureRatings(sections.structureReview);

  // ── Rewrite blueprint from section G ─────────────────────────────────────
  const rewriteBlueprint = sections.rewriteBlueprint
    ? sections.rewriteBlueprint
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => Boolean(l) && !SECTION_HEADING_RE.test(l))
    : [];

  return {
    schema:      "mainsReviewSignals",
    extractedAt: new Date().toISOString(),
    qualityLabel:  audit.qualityLabel,
    trustWeight:   audit.trustWeight,
    marksAwarded:  extracted.marksAwarded,
    marksTotal:    extracted.marksTotal,
    verdictLabel:  extracted.verdictLabel,
    directiveHandled,
    structureRatings,
    strengths,
    missingDimensions,
    upgradeActions,
    examinerConcerns,
    rawMistakeLabels: extracted.rawMistakeLabels || [],
    rewriteBlueprint,
    auditFlags:    audit.auditFlags,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Lines that are section headings, not actual bullets. Drop them from extracted arrays.
const SECTION_HEADING_RE = /^(marks awarded|directive word handling|structure review|content strength|examiner concerns|air-?1 upgrade advice|rewrite blueprint|mistake classification|final verdict|strengths[:\s]*$|missing dimensions[:\s]*$|factual weaknesses[:\s]*$)/i;

/**
 * Extract bullet-point style lines from a section text.
 * Optionally filter to lines matching a keyword pattern.
 * HEURISTIC: strips section heading lines that leak through when the parser
 * includes the heading word at the start of the section text.
 */
function extractBulletPoints(text, filterRe, maxItems) {
  if (!text) return [];
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 5 && !SECTION_HEADING_RE.test(l));

  const filtered = filterRe ? lines.filter((l) => filterRe.test(l)) : lines;
  const all = filtered.length > 0 ? filtered : lines;
  return all.slice(0, maxItems);
}

/**
 * HEURISTIC: Extract directive word handling status from section B.
 * Looks for: "Yes", "No", "Partly" in the text.
 *
 * Directive word extraction:
 * Matches a DEDICATED line like:
 *   "Directive word: Discuss"
 *   "Directive Word — Analyze"
 * NOT the section heading "Directive Word Handling" which would incorrectly extract "Handling".
 */
function extractDirectiveStatus(text) {
  if (!text) return { status: "unknown", directiveWord: null };
  const lower = text.toLowerCase();
  let status = "unknown";
  if (/\byes\b/.test(lower)) status = "yes";
  else if (/\bpartly\b/.test(lower)) status = "partly";
  else if (/\bno\b/.test(lower)) status = "no";

  // Match lines of the form: "Directive word: Discuss" or "Directive Word — Analyze"
  // Requires a colon or dash as separator — this excludes the section heading line
  // "Directive Word Handling" which has no colon/dash before "Handling".
  const wordMatch = text.match(/^directive\s+word[:\-–—]+\s*([A-Za-z]+)/im);
  const directiveWord = wordMatch ? wordMatch[1].trim() : null;

  return { status, directiveWord };
}

/**
 * HEURISTIC: Extract intro/body/conclusion quality ratings from section C.
 * Looks for "Strong", "Average", "Weak" near relevant labels.
 */
function extractStructureRatings(text) {
  if (!text) return { intro: "unknown", body: "unknown", conclusion: "unknown" };
  const rating = (label) => {
    const re = new RegExp(`${label}[^\\n]*?(strong|average|weak)`, "i");
    const m = text.match(re);
    return m ? m[1].toLowerCase() : "unknown";
  };
  return {
    intro:      rating("intro"),
    body:       rating("body"),
    conclusion: rating("conclusion"),
  };
}
