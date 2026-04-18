// backend/ingestion/pyqPdfExtractor.js
// PYQ Ingestion — Step 2: PDF text extraction + robust question-block splitting.
// Produces a temporary preview JSON only. Does NOT touch any master index or live data.
//
// Uses the project's established pdf-parse v2 API:
//   import "pdf-parse/worker";
//   import { PDFParse } from "pdf-parse";

import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import fs from "fs";

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — TEXT NORMALISATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Basic Unicode / whitespace normalisation.
 * Matches the pattern used in missingQuestionsDetector.js.
 */
function normalizeText(raw) {
  return String(raw || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\u00A0/g, " ")          // non-breaking spaces → regular space
    .replace(/\u2019/g, "'")          // right single quotation mark
    .replace(/\u2018/g, "'")          // left single quotation mark
    .replace(/\u201C/g, '"')          // left double quotation mark
    .replace(/\u201D/g, '"')          // right double quotation mark
    .replace(/[‐–—]/g, "-")           // various dashes → hyphen
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — ANSWER KEY STRIPPING
   Strip ALL answer key patterns from the raw text BEFORE splitting.
   This handles:
     • "Ans: 148 (d)"   • "Ans: (c)"   • "Answer: b"
     • "Ans.148(d)"     • Inline "Ans:" mid-sentence before next Q
   ═══════════════════════════════════════════════════════════════ */

/**
 * Global answer-key strip pass applied to the full text string.
 * Removes answer leakage completely before any line processing.
 */
function stripAnswerKeys(text) {
  return text
    // "Ans: 148 (d)" / "Ans: (c)" / "Ans. (b)" — with optional question number before letter
    .replace(/\bAns(?:wer)?\.?\s*:?\s*\d*\s*\(?[abcdABCD]\)?\.?\s*/g, " ")
    // "Answer: b" / "Answer - c" / "Answer Key" standalone
    .replace(/\bAnswer\s*(?:Key)?\s*[:\-–]?\s*[abcdABCD]?\b/gi, " ")
    // "Correct Answer: (c)"
    .replace(/\bCorrect\s+Answer\s*[:\-–]\s*\(?[abcdABCD]\)?/gi, " ")
    // "Solution:" / "Explanation:" / "Difficulty:" / "Source:" lines
    .replace(/\b(?:Solution|Explanation|Difficulty|Source)\s*[:\-–][^\n]*/gi, " ")
    // Standalone answer key rows: "1.(a)  2.(b)  3.(c)  ..." (3+ pairs)
    .replace(/(\d{1,3}\s*[.)]\s*\([abcd]\)\s*){3,}/gi, " ")
    // Isolated "(a)" / "(b)" / "(c)" / "(d)" alone on their own (answer key cells)
    .replace(/^\s*\([abcd]\)\.?\s*$/gmi, " ")
    .replace(/\s{2,}/g, " ");
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — NOISE LINE DETECTION
   Lines matching any of these patterns are DISCARDED before
   question splitting begins.
   ═══════════════════════════════════════════════════════════════ */

const NOISE_PATTERNS = [
  // ── Page / section markers ─────────────────────────────────────
  /^page\s+\d+/i,                           // "Page 5" / "Page 5 of 20"
  /^\d+\s+of\s+\d+$/i,                      // "29 of 29"
  /^\d+\s*\/\s*\d+$/,                       // "5/20" / "5 / 20"
  /^-+\s*\d+\s*-+$/,                        // "--- 3 ---" / "- 3 -"
  /^\[\d+\]$/,                              // "[3]"
  /^p\.\s*\d+$/i,                           // "p. 5"

  // ── Paper / examination headers ────────────────────────────────
  /^(upsc|ias|ips|civil\s*services)/i,
  /^general\s+studies/i,
  /^gs\s*[-–]?\s*(paper\s*)?\d/i,
  /^(paper|section)\s*[-–]?\s*(i|ii|iii|iv|\d)/i,
  /^preliminary\s+examination/i,
  /^prelims?\s*\d{4}/i,
  /^time\s*[:\-–]/i,
  /^total\s+marks?\s*[:\-–]/i,
  /^maximum\s+marks?\s*[:\-–]/i,
  /^duration\s*[:\-–]/i,
  /^instructions?\s*[:\-–]/i,
  /^note\s*[:\-–]/i,

  // ── Watermarks, copyright, page-break artefacts ───────────────
  /©\s*(upsc|union\s*public\s*service)/i,
  /all\s+rights\s+reserved/i,
  /^www\./i,
  /^http/i,
  /^\*{3,}$/,                               // "***"
  /^_{4,}$/,                                // "____"
  /^-{4,}$/,                                // "----"
  /^={4,}$/,                                // "===="
  /^\s*\|\s*$/,                             // lone pipe character
];

/**
 * Returns true if the line should be completely discarded.
 */
function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;                // blank
  if (t.length < 2) return true;      // single char
  return NOISE_PATTERNS.some((re) => re.test(t));
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — QUESTION BOUNDARY DETECTION
   ═══════════════════════════════════════════════════════════════ */

/**
 * A line is a question start if it begins with:
 *   N.  or  N)  (1–3 digits, then . or ), then space+text OR end of match)
 *
 * Returns { qno: number, rest: string } or null.
 */
function matchQuestionStart(line) {
  // "54. Which one..." or "54) Which..."
  const m = line.match(/^(\d{1,3})[.)]\s*(.*)/);
  if (!m) return null;
  const qno = Number(m[1]);
  if (qno < 1 || qno > 200) return null;      // sane range for UPSC papers
  return { qno, rest: m[2].trim() };
}

/**
 * PRE-SPLIT PASS: handle inline multi-question chains like:
 *   "... Ans: 28 (a) 29. There are two..."
 *   "... (b) 1 3 2 4 30. Consider..."
 *
 * After stripAnswerKeys() the "Ans: 28 (a)" part is already gone, but 
 * we may still have runs like " 29. Text..." appearing mid-line after 
 * a previous question's option text. We insert newlines before such 
 * transitions so the line splitter sees them as proper boundaries.
 *
 * Pattern: one or more non-digit chars, then whitespace, then
 *          a question-number candidate "NN. " or "NN) "
 */
function injectQuestionBoundaries(text) {
  // Insert a newline before any "NN. " or "NN) " that is preceded by
  // at least one word-character (i.e., it is embedded mid-line).
  // Use a lookbehind to ensure the preceding char is not a newline.
  return text.replace(
    /(?<=[^\n])(\s)(\d{1,3}[.)]\s)(?=[A-Za-z(])/g,
    "\n$2"
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — OPTION PARSING
   ═══════════════════════════════════════════════════════════════ */

/**
 * Option start: matches ONLY the strict patterns
 *   (a)   (b)   (c)   (d)
 *   a)    b)    c)    d)
 * Uppercase variants also accepted.
 *
 * Returns { key: "a"|"b"|"c"|"d", rest: string } or null.
 */
function matchOptionStart(line) {
  // Strict: "(a) text" or "a) text" — letter must be a/b/c/d only
  const m = line.match(/^\s*\(?([abcdABCD])\s*[)]\s*(.*)/);
  if (!m) return null;
  const key = m[1].toLowerCase();
  if (!["a", "b", "c", "d"].includes(key)) return null;
  return { key, rest: m[2].trim() };
}

/**
 * Returns true if the line looks like an option start.
 */
function isOptionStartLine(line) {
  return matchOptionStart(line) !== null;
}

/**
 * Parse option lines from a block.
 * Strict sequential ordering (a → b → c → d) is enforced to prevent
 * false positives from words like "(a)" appearing mid-sentence.
 *
 * Any inline answer tag remaining after prior strips is removed from
 * each option text after parsing.
 */
function parseOptions(lines) {
  const opts = { a: "", b: "", c: "", d: "" };
  const ORDER = ["a", "b", "c", "d"];
  let currentKey = null;

  for (const line of lines) {
    // Strip residual answer tags inline before matching
    const cleaned = stripResidualAnswerTag(line);
    const m = matchOptionStart(cleaned);
    if (m) {
      const candidateIdx = ORDER.indexOf(m.key);
      const currentIdx   = currentKey ? ORDER.indexOf(currentKey) : -1;

      // Accept ONLY if: no option yet (first one, must be 'a' OR we allow
      // any first option), OR strictly follows the previous key.
      // This prevents "(b)" in the MIDDLE of option-a text from hijacking.
      if (
        currentKey === null ||
        candidateIdx === currentIdx + 1
      ) {
        currentKey = m.key;
        opts[m.key] = m.rest;
        continue;
      }
    }

    // Continuation line for current option (if we are inside an option)
    if (currentKey !== null) {
      const contCleaned = stripResidualAnswerTag(line.trim());
      opts[currentKey] += contCleaned ? " " + contCleaned : "";
    }
  }

  // Polish each option
  for (const k of ORDER) {
    opts[k] = polishOption(opts[k]);
  }

  return opts;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — INLINE ANSWER TAG STRIPPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Remove residual answer/key fragments that survived the global strip.
 * Applied per-line inside option blocks.
 */
function stripResidualAnswerTag(text) {
  return text
    .replace(/\s+[Aa]ns\.?\s*[:(]?\s*[abcdABCD][).]?\s*$/g, "")
    .replace(/\s+[Aa]nswer\s*[:\-–]\s*[abcdABCD][).]?\s*$/g, "")
    .replace(/\s+\[[^\]]{0,20}\]\s*$/g, "")
    .trim();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — STEM POLISHING
   ═══════════════════════════════════════════════════════════════ */

function polishStem(text) {
  let t = text;

  // Strip "Q." / "Q.N." / "Qn." prefix sometimes left in stem
  t = t.replace(/^Q\.?\s*N?\.?\s*/i, "");

  // Remove any residual "Ans: ..." fragment anywhere in stem
  t = t.replace(/\bAns(?:wer)?\.?\s*:?\s*\d*\s*\(?[abcdABCD]\)?\s*/gi, "");

  // Remove trailing junk chars: dashes, underscores, pipes, dots
  t = t.replace(/[-_|.]+\s*$/, "");

  // Collapse runs of whitespace
  t = t.replace(/\s{2,}/g, " ");

  return t.trim();
}

function polishOption(text) {
  let t = String(text || "");
  t = stripResidualAnswerTag(t);
  t = t.replace(/[-_|]+\s*$/, "");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 8 — PUBLIC API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Read a PDF from disk and return normalised plain text.
 * Throws if file cannot be parsed.
 */
export async function extractTextFromPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return normalizeText(result?.text || "");
}

/**
 * Split normalised full text into cleaned question blocks.
 *
 * Pipeline:
 *   1. Strip all answer key patterns from the full text
 *   2. Inject newlines at inline question-number transitions
 *   3. Split into lines; discard noise lines
 *   4. Walk lines detecting question starts (N. / N))
 *   5. Accumulate lines into blocks
 *   6. Deduplicate by question number (keep longest block)
 *   7. Per block: separate stem lines from option lines
 *   8. Parse options strictly (a→b→c→d)
 *   9. Polish stem and each option
 *
 * Returns array of:
 *   { questionNumber, rawText, optionA, optionB, optionC, optionD }
 */
export function splitIntoQuestionBlocks(fullText) {
  // ── Pass 1: global answer-key strip ───────────────────────────
  let cleaned = stripAnswerKeys(fullText);

  // ── Pass 2: inject newlines before embedded question numbers ──
  cleaned = injectQuestionBoundaries(cleaned);

  // ── Pass 3: split into lines, discard noise ───────────────────
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => !isNoiseLine(l));

  // ── Pass 4 & 5: walk lines and group into question blocks ──────
  const blocks = [];
  let current  = null;

  for (const line of lines) {
    const qs = matchQuestionStart(line);
    if (qs) {
      if (current) blocks.push(current);
      current = { questionNumber: qs.qno, lines: qs.rest ? [qs.rest] : [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  // ── Pass 6: deduplicate — keep longest block per question number ──
  const best = new Map();
  for (const b of blocks) {
    const existing     = best.get(b.questionNumber);
    const candidateLen = b.lines.join(" ").length;
    const existingLen  = existing ? existing.lines.join(" ").length : 0;
    if (!existing || candidateLen > existingLen) {
      best.set(b.questionNumber, b);
    }
  }

  // ── Pass 7, 8, 9: build output records ───────────────────────
  return [...best.values()]
    .sort((a, b) => a.questionNumber - b.questionNumber)
    .map((b) => {
      // Find where options begin (first strict option-start line)
      const optIdx    = b.lines.findIndex(isOptionStartLine);
      const stemLines = optIdx === -1 ? b.lines : b.lines.slice(0, optIdx);
      const optLines  = optIdx === -1 ? []       : b.lines.slice(optIdx);

      const opts    = parseOptions(optLines);
      const rawText = polishStem(stemLines.join(" "));

      return {
        questionNumber: b.questionNumber,
        rawText,
        optionA: opts.a,
        optionB: opts.b,
        optionC: opts.c,
        optionD: opts.d,
      };
    });
}
