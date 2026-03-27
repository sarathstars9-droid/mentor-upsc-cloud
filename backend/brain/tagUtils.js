export function normalizeTag(tag = "") {
    const t = tag.toUpperCase();

    if (t === "P") return "PRELIMS";
    if (t === "M") return "MAINS";
    if (t === "PM") return "BOTH";

    return "UNKNOWN";
}

export function nodeSupportsStage(node, stage) {
    const tags = node.tags || [];

    for (const tag of tags) {
        const normalized = normalizeTag(tag);

        if (normalized === "BOTH") return true;
        if (normalized === "PRELIMS" && stage === "PRELIMS") return true;
        if (normalized === "MAINS" && stage === "MAINS") return true;
    }

    return false;
}