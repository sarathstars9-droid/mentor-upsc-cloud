/**
 * prelimsInstitutionalEvaluator.js
 *
 * Parses institutional answer key and user answer files (readable text format).
 * No OMR bubble detection. No image processing. Text extraction only.
 *
 * Each question result is enriched with a broad subject bucket (Phase B).
 * In V1, questionText is null from file upload, so bucket = unmapped.
 * Bucketing activates automatically when questionText becomes available.
 */

import { detectInstitutionalSubjectBucket } from "./detectInstitutionalSubjectBucket";

const MIN_PARSEABLE_ANSWERS = 5;

// ─── Pattern handles all documented formats including spaced variants:
//   Q 1 A  →  optional "Q" or "(", optional spaces, digits, optional spaces
//             + optional "Q" prefix (with possible space after Q)
//   ( 1 ) A  →  parens with spaces around the number
// Captures: group 1 = question number digits, group 2 = answer letter
const ANSWER_RE =
    /^\(?\s*Q?\s*(\d+)\s*[)\].]?\s*[,:.\s)\]]*\s*([A-Ea-e])\b/i;

// ─── Bare letter line (only if the file has NO numbered entries at all)
const BARE_LETTER_RE = /^([A-Ea-e])$/i;

/**
 * Read a browser File as plain text.
 * For PDF/DOC/DOCX: tries text extraction; coaching-institute text-based PDFs
 * often yield readable content via file.text(). Binary/scanned files will
 * not produce parsable patterns — the MIN_PARSEABLE_ANSWERS gate catches this.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
async function readFileAsText(file) {
    // Always attempt text() — works reliably for txt/csv and text-layer PDFs
    return file.text();
}

/**
 * Parse a file into a question-number → answer map.
 * Returns: { "1": "A", "2": "C", ... }
 *
 * Throws a descriptive error if too few answers are found.
 *
 * @param {File} file
 * @returns {Promise<{ [qNum: string]: string }>}
 */
export async function parseAnswerFile(file) {
    const text = await readFileAsText(file);

    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    const numbered = {};
    const bareLetters = [];

    for (const line of lines) {
        // Try numbered pattern first
        const m = line.match(ANSWER_RE);
        if (m) {
            numbered[m[1]] = m[2].toUpperCase();
            continue;
        }

        // Try bare letter (index-based fallback)
        const b = line.match(BARE_LETTER_RE);
        if (b) {
            bareLetters.push(b[1].toUpperCase());
        }
        // Everything else (headers, section labels, blanks) is ignored
    }

    const result = { ...numbered };

    // If file has ONLY bare letters and zero numbered entries → index-based mode
    if (Object.keys(numbered).length === 0 && bareLetters.length > 0) {
        bareLetters.forEach((ans, idx) => {
            result[String(idx + 1)] = ans;
        });
    }

    const count = Object.keys(result).length;

    if (count < MIN_PARSEABLE_ANSWERS) {
        throw new ParseError(
            `Could not extract readable answers from "${file.name}" (found ${count} parsable answer${count === 1 ? "" : "s"}, need at least ${MIN_PARSEABLE_ANSWERS}).\n\n` +
            `Please ensure your file is a readable text-based document (not a scanned image or binary PDF).\n` +
            `Supported formats: .txt or .csv (most reliable). Text-layer PDFs may also work.\n\n` +
            `Expected patterns (any of these per line):\n` +
            `  1 A  |  1. A  |  1) A  |  (1) A  |  Q1,A  |  1:B  |  Q 1 A  |  ( 1 ) A\n` +
            `Lowercase also works: 1 a, 2 b, 3 c, etc.`
        );
    }

    return result;
}

// ─── Typed error for validation failures ──────────────────────────────────────
export class ParseError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "ParseError";
        this.isParseError = true;
    }
}

// ─── Scoring — exact arithmetic. Rounding happens only at output. ─────────────
// GS:   +2 correct, −(2/3) wrong   [= −0.6̄]
// CSAT: +2.5 correct, −(5/6) wrong [= −0.8̄3̄]
const SCORING = {
    GS:   { correct: 2,    wrong: -(2 / 3) },
    CSAT: { correct: 2.5,  wrong: -(5 / 6) },
};

/**
 * Evaluate user answers against an answer key.
 *
 * @param {{ [qNum: string]: string }} answerKey   Source of truth
 * @param {{ [qNum: string]: string }} userAnswers  Possibly sparse — missing = unattempted
 * @param {"GS"|"CSAT"} paperType
 * @param {{ [qNum: string]: { questionText: string|null, options: object|null } }} questionPaperData
 *   Optional — from parseInstitutionalQuestionPaper(). If omitted, questionText stays null.
 * @returns {EvaluationResult}
 */
export function evaluateAnswers(answerKey, userAnswers, paperType, questionPaperData = {}) {
    const scoring = SCORING[paperType] ?? SCORING.GS;

    // Iterate over answer key — it is the source of truth
    const questionNumbers = Object.keys(answerKey).sort(
        (a, b) => Number(a) - Number(b)
    );

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    const questionResults = [];

    for (const qNum of questionNumbers) {
        const correctAnswer = answerKey[qNum].toUpperCase();

        // Unattempted = key absent, null, undefined, or empty string
        const rawUser = userAnswers[qNum];
        const isUnattempted =
            rawUser === undefined || rawUser === null || rawUser === "";
        const userAnswer = isUnattempted ? null : rawUser.toUpperCase();

        let result;
        if (isUnattempted) {
            result = "unattempted";
            unattempted++;
        } else if (userAnswer === correctAnswer) {
            result = "correct";
            correct++;
        } else {
            result = "wrong";
            wrong++;
        }

        // ─ merge question paper data (text + options) if available
        const qpData = questionPaperData[qNum] || {};

        // ─ detect broad subject bucket from question text
        //   In V1 (no question paper), questionText is null → returns unmapped.
        //   When question paper is parsed, real text flows here automatically.
        const bucket = detectInstitutionalSubjectBucket(qpData.questionText ?? null);

        questionResults.push({
            questionNumber: qNum,
            questionText:   qpData.questionText  ?? null,
            options:        qpData.options        ?? null,
            correctAnswer,
            userAnswer,                          // null if unattempted
            result,                              // "correct" | "wrong" | "unattempted"
            sourceType:     "institutional",
            paperType,
            // Broad subject bucket (subject_only or unmapped — never nodeId)
            subjectBucket:      bucket.subjectBucket,
            subjectConfidence:  bucket.subjectConfidence,
            mappingStatus:      bucket.mappingStatus,
            mistakeEligible: result === "wrong" || result === "unattempted",
        });
    }

    const attempted        = correct + wrong;
    const rawScore         = correct * scoring.correct + wrong * scoring.wrong;
    const score            = Math.round(rawScore * 100) / 100;
    const negativeMarks    = Math.round(wrong * Math.abs(scoring.wrong) * 100) / 100;
    const accuracy         = attempted > 0
        ? Math.round((correct / attempted) * 10000) / 100
        : 0;

    return {
        totalQuestions: questionNumbers.length,
        attempted,
        correct,
        wrong,
        unattempted,
        score,
        negativeMarks,
        accuracy,
        evaluatedAt:    new Date().toISOString(),
        paperType,
        questionResults,
    };
}
