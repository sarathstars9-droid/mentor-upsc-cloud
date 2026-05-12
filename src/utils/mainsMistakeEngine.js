import { BACKEND_URL } from "../config";

const API_BASE = `${BACKEND_URL}/api/mistakes`;
const DEFAULT_USER_ID = "user_1";

export async function saveMainsMistake(entry = {}) {
    const payload = {
        user_id: DEFAULT_USER_ID,
        stage: "mains",
        source_type: "mains",
        source_ref: entry.attemptId || null,
        question_id: crypto.randomUUID?.() || `mm_${Date.now()}`,
        paper: entry.paper || "GS1",
        subject: entry.topic || "",
        node_id: entry.subtopic || "",
        question_text: entry.question || "",
        selected_answer: entry.answerText || "",
        answer_status: entry.status || "open",
        error_type: entry.mistakeTypes?.[0] || entry.severity || "medium",
        notes: entry.notes || "",
        must_revise: entry.mustRevise ?? false
    };

    const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.item;
}

export async function getAllMainsMistakes() {
    const res = await fetch(`${API_BASE}?userId=${DEFAULT_USER_ID}&stage=mains`);
    const items = await res.json();
    return items.map(m => ({
        id: m.id,
        attemptId: m.source_ref,
        createdAt: m.created_at,
        paper: m.paper || "GS1",
        question: m.question_text,
        topic: m.subject,
        subtopic: m.node_id,
        answerText: m.selected_answer,
        status: m.answer_status,
        mustRevise: m.must_revise,
        mistakeTypes: m.error_type ? [m.error_type] : [],
        notes: m.notes
    }));
}

export async function getOpenMainsMistakes() {
    const all = await getAllMainsMistakes();
    return all.filter((m) => m.status === "open");
}

export async function getMistakesByPaper(paper) {
    const all = await getAllMainsMistakes();
    return all.filter((m) => m.paper === paper);
}

export async function markMainsMistakeResolved(id) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_status: "resolved" }),
    });
    return await res.json();
}

export async function toggleMustRevise(id, currentVal) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ must_revise: !currentVal }),
    });
    return await res.json();
}

export async function reopenMainsMistake(id) {
    const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_status: "open" }),
    });
    return await res.json();
}

export async function getMainsWeakPatterns() {
    const open = await getOpenMainsMistakes();
    if (!open.length) return [];

    const freq = {};
    open.forEach((m) => {
        (m.mistakeTypes || []).forEach((t) => {
            freq[t] = (freq[t] || 0) + 1;
        });
    });

    return Object.entries(freq)
        .map(([type, count]) => ({
            type,
            count,
            pct: Math.round((count / open.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);
}

export async function deleteMainsMistake(id) {
    // We can PATCH status to "deleted" or implement DELETE in backend
    await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer_status: "deleted" }),
    });
}
