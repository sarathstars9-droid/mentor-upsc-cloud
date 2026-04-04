/**
 * parseInstitutionalQuestionPaper.js
 *
 * Extracts per-question text and options from readable institutional question papers.
 * Input: browser File object (.txt preferred; text-layer PDF/DOC may also work).
 *
 * Returns: { [questionNumber]: { questionText: string|null, options: object|null } }
 *
 * PARSING ASSUMPTIONS:
 *   1. Questions are numbered sequentially (1, 2, 3...) and strictly increasing.
 *   2. Question lines start with:  1. text  |  1) text  |  Q1. text  |  Q 1. text
 *   3. Option lines identifiable by: (a) text | a) text | A. text | (A) text
 *   4. Statements WITHIN a question (e.g. "1. India is..." "2. Parliament...") are
 *      distinguished from new questions by the sequence-tracking heuristic.
 *
 * FALLBACK BEHAVIOUR:
 *   - If a line cannot be parsed (header, blank, separator) → silently ignored.
 *   - If question text extraction yields < 3 questions → returns {} (safe fallback).
 *   - If the file.text() call fails → returns {} (the evaluator proceeds with null text).
 *   - Individual questions missing text keep questionText: null.
 *   - Options are only stored when at least 2 options are detected (A+B minimum).
 */

// ─── Patterns ─────────────────────────────────────────────────────────────────
// Matches: 1. text | 1) text | Q1. text | Q1) text | Q 1. text | Q. 1. text
const QUESTION_RE = /^(?:Q\.?\s*)?(\d{1,3})\s*[.)]\s+(.+)/i;

// Matches: (a) text | a) text | A. text | (A) text | A: text | A - text
// Requires a separator character after the letter to avoid false positives on
// normal words starting with A-D.
const OPTION_RE = /^\s*[\[(]?\s*([A-Da-d])\s*[\]).:,\-]+\s+(.+)/;

// ─── Core parser (exported for testing without File API) ──────────────────────

/**
 * Parse raw text string into the question map.
 * Exported separately so it can be unit-tested without File objects.
 *
 * @param {string} text
 * @returns {{ [qNum: string]: { questionText: string|null, options: object|null } }}
 */
export function parseQuestionText(text) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const result = {};

    let currentQNum   = null;   // string, e.g. "1"
    let currentText   = [];     // text lines for current question
    let currentOpts   = {};     // { A: "...", B: "...", ... }
    let lastQNum      = 0;      // last committed question number (integer)
    let seenOptions   = false;  // have we seen any options for current question?

    // ── Flush current question into result ──────────────────────────────────
    function flush() {
        if (currentQNum === null) return;
        const questionText = currentText.join(" ").replace(/\s+/g, " ").trim() || null;
        const hasOpts = Object.keys(currentOpts).length >= 2;
        result[currentQNum] = {
            questionText,
            options: hasOpts ? { ...currentOpts } : null,
        };
    }

    // ── Heuristic: should this numbered line start a new question? ──────────
    function isNewQuestion(qn) {
        if (lastQNum === 0) return true;          // very first question
        if (qn <= lastQNum) return false;          // not increasing → statement item
        if (qn > 250) return false;                // implausibly large

        const gap = qn - lastQNum;

        // After options are seen for the previous question, any sequential
        // number is a new question.
        if (seenOptions && gap <= 10) return true;

        // No options seen yet (could be purely numbered paper, or still in body).
        // Allow a new question starts only if:
        //   a) gap > 10 (clearly jumped)
        //   b) gap === 1 AND last question was already >= 5
        //      (statement items are usually numbered 1–4;
        //       question 6→7 is safe to call a new boundary)
        if (gap > 10) return true;
        if (gap === 1 && lastQNum >= 5) return true;

        // Conservative: treat as statement item
        return false;
    }

    // ── Main loop ───────────────────────────────────────────────────────────
    for (const line of lines) {
        const qm = line.match(QUESTION_RE);

        if (qm) {
            const qn   = parseInt(qm[1], 10);
            const rest = qm[2].trim();

            if (isNewQuestion(qn)) {
                // Commit previous question
                flush();
                currentQNum = String(qn);
                lastQNum    = qn;
                currentText = [rest];
                currentOpts = {};
                seenOptions = false;
            } else {
                // Statement item inside current question body
                if (currentQNum !== null && !seenOptions) {
                    currentText.push(line);
                }
                // After options started, ignore numbered lines (likely mis-parse)
            }
            continue;
        }

        // Skip if no question context yet
        if (currentQNum === null) continue;

        const om = line.match(OPTION_RE);
        if (om) {
            const letter = om[1].toUpperCase();
            if ("ABCD".includes(letter)) {
                seenOptions = true;
                currentOpts[letter] = om[2].trim();
                continue;
            }
        }

        // Line is neither question start nor option →
        if (!seenOptions) {
            // Continuation of question text
            currentText.push(line);
        } else {
            // Continuation of the last option
            const lastOpt = Object.keys(currentOpts).slice(-1)[0];
            if (lastOpt) {
                currentOpts[lastOpt] += " " + line;
            }
        }
    }

    flush(); // Commit final question

    // If we extracted very few questions, the file probably isn't a question paper
    if (Object.keys(result).length < 3) return {};

    return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Parse a question paper File into a question map.
 * Always resolves (never rejects) — returns {} on any failure so the
 * evaluation can proceed with null questionText.
 *
 * @param {File} file
 * @returns {Promise<{ [qNum: string]: { questionText: string|null, options: object|null } }>}
 */
export async function parseInstitutionalQuestionPaper(file) {
    try {
        if (!file) return {};
        const text = await file.text();
        if (!text || text.trim().length < 50) return {};
        return parseQuestionText(text);
    } catch {
        // File read failed (binary PDF, permission error, etc.) → safe fallback
        return {};
    }
}
