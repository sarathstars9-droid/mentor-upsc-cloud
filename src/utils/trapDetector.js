export function detectTraps(questionText = "") {
    const text = questionText.toLowerCase();

    const traps = [];

    if (text.includes("only") || text.includes("always") || text.includes("none")) {
        traps.push("extreme_word_trap");
    }

    if (text.includes("consider the following statements")) {
        traps.push("statement_trap");
    }

    return traps;
}
