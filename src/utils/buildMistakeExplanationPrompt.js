/**
 * buildMistakeExplanationPrompt.js
 * Generates a strong, prelims-focused ChatGPT explanation prompt
 * from a unified mistake object (PYQ or Institutional).
 */

/**
 * Normalize sourceType to a display label.
 */
function sourceLabel(sourceType) {
    if (!sourceType) return "PYQ";
    const s = String(sourceType).toLowerCase();
    if (s === "institutional") return "Institutional Test";
    return "PYQ";
}

/**
 * Format options object/array into a clean A/B/C/D string.
 * Accepts:
 *   { A: "...", B: "...", C: "...", D: "..." }
 *   [ "...", "...", "...", "..." ]   → auto-labelled A/B/C/D
 *   null / undefined → "(Options not available)"
 */
function formatOptions(options) {
    if (!options) return "(Options not available)";

    if (Array.isArray(options)) {
        if (options.length === 0) return "(Options not available)";
        const labels = ["A", "B", "C", "D", "E"];
        return options
            .map((o, i) => `  ${labels[i] || i + 1}. ${String(o).trim()}`)
            .join("\n");
    }

    if (typeof options === "object") {
        const keys = Object.keys(options);
        if (keys.length === 0) return "(Options not available)";
        return keys
            .sort()
            .map((k) => `  ${k}. ${String(options[k]).trim()}`)
            .join("\n");
    }

    return "(Options not available)";
}

/**
 * Build the full explanation prompt string from a mistake entry.
 *
 * @param {object} mistake  Unified mistake object from prelimsMistakeEngine
 * @returns {string}        Prompt ready to paste into ChatGPT
 */
export function buildMistakeExplanationPrompt(mistake) {
    const {
        sourceType,
        paperType,
        paper,            // fallback field name from engine
        questionText,
        options,
        correctAnswer,
        latestUserAnswer,
        userAnswer,
        latestResult,
        subject,
        topic,
        year,
    } = mistake;

    const source = sourceLabel(sourceType);
    const paperDisplay = paperType || paper || "GS";

    const rawAnswer = latestUserAnswer !== undefined ? latestUserAnswer : userAnswer;
    const isUnattempted =
        latestResult === "unattempted" || (!rawAnswer && !latestResult);

    const myAnswer = isUnattempted
        ? "Unattempted (I skipped this question)"
        : (rawAnswer || "Unknown");

    const result = isUnattempted ? "Unattempted" : "Wrong";

    const contextLine = [
        subject ? `Subject: ${subject}` : null,
        topic   ? `Topic: ${topic}`     : null,
        year    ? `Year: ${year}`       : null,
    ].filter(Boolean).join(" | ");

    const optionsFormatted = formatOptions(options);
    const qText = (questionText || "").trim() || "(Question text not available)";
    const correctAns = (correctAnswer || "").trim() || "(Not specified)";

    return `You are a UPSC CSE Prelims expert mentor.

Analyze the following question like a top UPSC mentor and teach me how to solve it correctly in the exam.

Source: ${source} (${paperDisplay})${contextLine ? `\nContext: ${contextLine}` : ""}

---

Question:
${qText}

Options:
${optionsFormatted}

Correct Answer: ${correctAns}
My Answer: ${myAnswer}
Result: ${result}

---

Your task:

1. Explain the core concept being tested in this question.
2. Explain clearly why the correct answer is right.
3. Eliminate the wrong options using UPSC prelims logic (why each distractor fails).
4. ${isUnattempted
    ? "Explain how I should have approached this question if I had attempted it."
    : "Identify my mistake — why did I pick the wrong answer, and what thinking error led to it."}
5. Show how a UPSC topper would think through this question in the exam under time pressure.
6. Give one strong memory trick or exam shortcut for this concept.
7. Mention if this pattern or theme frequently appears in UPSC Prelims (with any examples if relevant).

---

Instructions:
- Be accurate. Do not make any factual or conceptual mistakes.
- Focus on prelims elimination logic and exam thinking, not textbook theory.
- Keep explanations clear, concise, and directly useful for the exam.
- Avoid unnecessary padding or filler content.`;
}
