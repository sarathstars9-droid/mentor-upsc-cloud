export function formatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "0%";
    }
    return `${Number(value).toFixed(1)}%`;
}

export function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "0";
    }
    return String(Number(value));
}

export function normalizeArray(value) {
    return Array.isArray(value) ? value : [];
}

export function getMetricTone(value, inverse = false) {
    const num = Number(value || 0);
    if (inverse) {
        if (num >= 70) return "#ef4444";
        if (num >= 40) return "#f59e0b";
        return "#22c55e";
    }
    if (num >= 70) return "#22c55e";
    if (num >= 40) return "#f59e0b";
    return "#ef4444";
}

export function getWeakItemLabel(item) {
    if (!item) return "Unknown";
    if (typeof item === "string") return item;
    return item.name || item.label || item.nodeName || item.subject || item.type || "Unknown";
}

export function getWeakItemAccuracy(item) {
    if (!item || typeof item === "string") return null;
    return item.accuracy ?? item.accuracyRate ?? item.score ?? null;
}

export function getWeakItemAttempts(item) {
    if (!item || typeof item === "string") return null;
    return item.attempted ?? item.total ?? item.count ?? null;
}

export function getTrapLabel(item) {
    if (!item) return "Unknown trap";
    if (typeof item === "string") return item;
    return item.trapType || item.name || item.label || "Unknown trap";
}

export function getTrapCount(item) {
    if (!item || typeof item === "string") return null;
    return item.count ?? item.errors ?? item.total ?? null;
}

export function getRecommendationLabel(item) {
    if (!item) return "No recommendation";
    if (typeof item === "string") return item;
    return item.text || item.label || item.message || "No recommendation";
}

export function getStatRows(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;

    return Object.entries(data).map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
            return {
                label: key,
                ...value,
            };
        }
        return {
            label: key,
            value,
        };
    });
}

export function getRowLabel(row) {
    return row.label || row.name || row.subject || row.type || row.nodeName || "Unknown";
}

export function getRowAttempted(row) {
    return row.attempted ?? row.total ?? row.count ?? row.questions ?? 0;
}

export function getRowCorrect(row) {
    return row.correct ?? row.right ?? row.correctCount ?? 0;
}

export function getRowWrong(row) {
    return row.wrong ?? row.incorrect ?? row.wrongCount ?? 0;
}

export function getRowAccuracy(row) {
    return row.accuracy ?? row.accuracyRate ?? row.score ?? 0;
}