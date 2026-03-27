export function detectQuestionType(questionText = "") {
    const text = String(questionText).toLowerCase();

    // 🔥 comparative detection (VERY IMPORTANT)
    if (
        text.includes("difference between") ||
        text.includes("distinguish between") ||
        text.includes("compare") ||
        text.includes("comparison") ||
        text.includes("between")
    ) {
        return {
            primaryType: "comparative"
        };
    }

    // 🔹 statement-based
    if (
        text.includes("consider the following") ||
        text.includes("which of the following statements") ||
        text.includes("1.") ||
        text.includes("2.")
    ) {
        return {
            primaryType: "statement_based"
        };
    }

    // 🔹 matching
    if (
        text.includes("match the following") ||
        text.includes("list i") ||
        text.includes("list ii")
    ) {
        return {
            primaryType: "matching"
        };
    }

    // 🔹 elimination
    if (
        text.includes("which of the above") ||
        text.includes("only") ||
        text.includes("correct answer")
    ) {
        return {
            primaryType: "elimination"
        };
    }

    // 🔹 default
    return {
        primaryType: "direct"
    };
}