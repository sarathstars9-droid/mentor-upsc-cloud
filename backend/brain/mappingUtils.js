export function normalizeText(input = "") {
    return String(input)
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[^a-z0-9\s\-']/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function tokenize(input = "") {
    const text = normalizeText(input);
    if (!text) return [];
    return text.split(" ").filter(Boolean);
}

export function makeNGrams(tokens = [], maxN = 3) {
    const grams = [];
    for (let n = 1; n <= maxN; n += 1) {
        for (let i = 0; i <= tokens.length - n; i += 1) {
            grams.push(tokens.slice(i, i + n).join(" "));
        }
    }
    return grams;
}

export function countOccurrences(text = "", phrase = "") {
    if (!text || !phrase) return 0;
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    const matches = text.match(regex);
    return matches ? matches.length : 0;
}

export function jaccardSimilarity(setA = new Set(), setB = new Set()) {
    if (!setA.size && !setB.size) return 0;
    const intersection = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

export function sortDesc(arr = [], selector = (x) => x) {
    return [...arr].sort((a, b) => selector(b) - selector(a));
}