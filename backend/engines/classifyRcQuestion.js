// backend/engines/classifyRcQuestion.js
// Classifies a single RC question text into one of 8 types.
// Priority order matters — more specific signals run before generic ones.

export function classifyRcQuestion(questionText = "") {
    const text = String(questionText)
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim();

    // 1. ASSUMPTION — strongest signal, check first
    if (
        text.includes("assumption") ||
        text.includes("presupposes") ||
        text.includes("assumptions have been made")
    ) {
        return "ASSUMPTION";
    }

    // 2. TONE / AUTHOR POSITION (EXPANDED)
    if (
        text.includes("tone") ||
        text.includes("attitude") ||
        text.includes("thinking of the author") ||
        text.includes("best reflects the thinking") ||
        text.includes("author is against") ||
        text.includes("is against") ||
        text.includes("author seems") ||
        text.includes("author's view") ||
        text.includes("author\u2019s view") ||
        text.includes("author argues") ||
        text.includes("author believes") ||
        text.includes("author holds") ||
        text.includes("holds the view") ||
        text.includes("author intends") ||
        text.includes("author wants") ||
        text.includes("author supports") ||
        text.includes("author prefers") ||
        text.includes("author suggests that") ||
        text.includes("seems to argue") ||
        text.includes("argues for") ||
        text.includes("best reflects the attitude") ||
        text.includes("best describes the author") ||
        text.includes("the passage reflects") ||
        text.includes("the author favours") ||
        text.includes("the author favors")
    ) {
        return "TONE";
    }

    // 3. LOGICAL CONCLUSION — before inference so "conclusion" doesn't fall through
    if (
        text.includes("logical conclusion") ||
        text.includes("conclusion") ||
        text.includes("corollary") ||
        text.includes("follows from")
    ) {
        return "LOGICAL_CONCLUSION";
    }

    // 4. MAIN IDEA / CRUX (EXPANDED) — before inference to avoid "suggests" swallowing main idea q's
    if (
        text.includes("main idea") ||
        text.includes("central idea") ||
        text.includes("central theme") ||
        text.includes("crux") ||
        text.includes("best explanation") ||
        text.includes("best reflects the idea") ||
        text.includes("best sums up") ||
        text.includes("ultimate goal") ||
        text.includes("the passage is based on") ||
        text.includes("passage relates to") ||
        text.includes("what is the passage about") ||
        text.includes("primary focus") ||
        text.includes("central focus") ||
        text.includes("keynote") ||
        text.includes("thematically") ||
        text.includes("passage attempts to describe") ||
        text.includes("passage attempts to")
    ) {
        return "MAIN_IDEA";
    }

    // 5. CRITICAL MESSAGE
    if (
        text.includes("critical message") ||
        text.includes("message conveyed") ||
        text.includes("primary message") ||
        text.includes("essential message") ||
        text.includes("most logical, rational") ||
        text.includes("most rational") ||
        text.includes("best reflects the message") ||
        text.includes("best reflects the most") ||
        text.includes("practical, rational")
    ) {
        return "CRITICAL_MESSAGE";
    }

    // 6. INFERENCE (EXPANDED)
    if (
        text.includes("inference") ||
        text.includes("implied") ||
        text.includes("implies") ||
        text.includes("imply") ||
        text.includes("suggests") ||
        text.includes("suggest") ||
        text.includes("what does the author mean") ||
        text.includes("why is") ||
        text.includes("why does") ||
        text.includes("which one is implied") ||
        text.includes("can be inferred") ||
        text.includes("can be concluded from the passage") ||
        text.includes("most important implication") ||
        text.includes("with reference to the passage") ||
        text.includes("in the light of the") ||
        text.includes("according to the passage") ||
        text.includes("according to the above") ||
        text.includes("according to the author") ||
        text.includes("passage refers to") ||
        text.includes("refers to") ||
        text.includes("what do you understand")
    ) {
        return "INFERENCE";
    }

    // 7. STATEMENT-BASED — late, to avoid swallowing specific categories
    if (
        text.includes("which of the following") ||
        text.includes("which one of the following") ||
        text.includes("which of the above") ||
        text.includes("which one of the above") ||
        text.includes("select the correct answer") ||
        text.includes("1.") ||
        text.includes("2.") ||
        text.includes("3.")
    ) {
        return "STATEMENT_BASED";
    }

    // 8. Fallback
    return "MIXED";
}
