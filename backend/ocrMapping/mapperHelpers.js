// backend/ocrMapping/mapperHelpers.js

export function normalizeText(input = "") {
    return String(input)
        .toLowerCase()
        .replace(/[_/\\|]+/g, " ")
        .replace(/[^\w\s&-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function tokenize(input = "") {
    const text = normalizeText(input);
    if (!text) return [];
    return text.split(" ").filter(Boolean);
}

export function unique(arr = []) {
    return [...new Set(arr)];
}

export function buildNgrams(tokens = [], maxN = 4) {
    const grams = [];
    for (let n = 1; n <= maxN; n++) {
        for (let i = 0; i <= tokens.length - n; i++) {
            grams.push(tokens.slice(i, i + n).join(" "));
        }
    }
    return unique(grams);
}

export function phraseCount(text, phrases = []) {
    if (!text || !phrases?.length) return 0;
    let score = 0;
    for (const phrase of phrases) {
        const p = normalizeText(phrase);
        if (!p) continue;
        if (text.includes(p)) score += 1;
    }
    return score;
}

export function tokenOverlapScore(inputTokens = [], candidateTokens = []) {
    if (!inputTokens.length || !candidateTokens.length) return 0;
    const inputSet = new Set(inputTokens);
    const candidateSet = new Set(candidateTokens);
    let overlap = 0;
    for (const t of candidateSet) {
        if (inputSet.has(t)) overlap += 1;
    }
    return overlap / Math.max(candidateSet.size, 1);
}

export function prefixTokenBoost(inputText, aliases = []) {
    const normalizedInput = normalizeText(inputText);
    let score = 0;

    for (const alias of aliases) {
        const a = normalizeText(alias);
        if (!a) continue;
        if (normalizedInput.startsWith(a)) score += 0.2;
        if (normalizedInput === a) score += 0.4;
    }

    return score;
}

export function pickTopTwo(scored = []) {
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    return {
        top: sorted[0] || null,
        second: sorted[1] || null,
        sorted,
    };
}

export function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

export function flattenAliases(...groups) {
    return unique(
        groups
            .flat()
            .filter(Boolean)
            .map((x) => String(x).trim())
            .filter(Boolean)
    );
}