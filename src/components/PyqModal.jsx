import { useMemo, useState } from "react";

const FILTERS = [
    { key: "all", label: "All" },
    { key: "Prelims", label: "Prelims" },
    { key: "Mains", label: "Mains" },
    { key: "Essay", label: "Essay" },
    { key: "Ethics", label: "Ethics" },
    { key: "Optional", label: "Optional" },
    { key: "CSAT", label: "CSAT" },
];

function normalizePaper(q) {
    const raw = String(q?.paper || q?.exam || "").trim().toLowerCase();
    if (raw.includes("pre")) return "Prelims";
    if (raw.includes("main")) return "Mains";
    if (raw.includes("essay")) return "Essay";
    if (raw.includes("ethic")) return "Ethics";
    if (raw.includes("optional")) return "Optional";
    if (raw.includes("csat")) return "CSAT";
    return q?.paper || q?.exam || "Other";
}

export default function PyqModal({ open, onClose, pyq }) {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");

    const questions = Array.isArray(pyq?.questions) ? pyq.questions : [];
    const mappedNodes = Array.isArray(pyq?.mappedNodes) ? pyq.mappedNodes : [];

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        return questions.filter((item) => {
            const paper = normalizePaper(item);
            const filterOk = filter === "all" ? true : paper === filter;

            if (!filterOk) return false;
            if (!q) return true;

            const hay = [
                item?.question,
                item?.prompt,
                item?.theme,
                item?.subTopic,
                item?.subtopic,
                item?.directive,
                item?.source,
                item?.year,
                paper,
            ]
                .join(" ")
                .toLowerCase();

            return hay.includes(q);
        });
    }, [questions, query, filter]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
            <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="border-b px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-semibold">All Linked PYQs</h3>
                            <p className="mt-1 text-sm text-slate-600">
                                Total: <span className="font-medium">{pyq?.total || 0}</span>
                                {pyq?.lastAskedYear ? (
                                    <span className="ml-3">
                                        Last asked: <span className="font-medium">{pyq.lastAskedYear}</span>
                                    </span>
                                ) : null}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
                        >
                            Close
                        </button>
                    </div>
                    {mappedNodes.length > 1 && (
                        <div className="mt-3 text-xs text-slate-500">
                            PYQs combined from {mappedNodes.length} mapped topics

                            <div className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                                {mappedNodes
                                    .map((n) => n.label || n.microTheme || n.topic || "")
                                    .filter(Boolean)
                                    .join(" • ")}
                            </div>
                        </div>
                    )}

                    {/* this stays same */}
                    {mappedNodes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {mappedNodes.map((node, idx) => (
                                <span
                                    key={`${node?.syllabusNodeId || node?.code || node?.label || "node"}-${idx}`}
                                    className="rounded-full border px-2 py-1 text-[11px] font-semibold"
                                    style={{
                                        background: "rgba(59,130,246,0.10)",
                                        borderColor: "rgba(96,165,250,0.28)",
                                    }}
                                    title={node?.path || node?.syllabusNodeId || ""}
                                >
                                    {node?.label || node?.microTheme || node?.topic || node?.syllabusNodeId || "Topic"}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search question text, topic, year..."
                            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-slate-400 md:max-w-sm"
                        />

                        <div className="flex flex-wrap gap-2">
                            {FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === f.key
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <div className="mb-3 text-sm text-slate-600">
                        Showing <span className="font-medium">{filtered.length}</span> result(s)
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
                            No PYQs match this filter.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map((q, idx) => {
                                const paper = normalizePaper(q);
                                return (
                                    <div
                                        key={q?.id || `${paper}-${q?.year || "na"}-${idx}`}
                                        className="rounded-2xl border bg-slate-50/60 p-4"
                                    >
                                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                            <span className="rounded-full bg-white px-2 py-1 font-medium border">
                                                {paper}
                                            </span>
                                            {q?.year ? (
                                                <span className="rounded-full bg-white px-2 py-1 font-medium border">
                                                    {q.year}
                                                </span>
                                            ) : null}
                                            {q?.marks ? (
                                                <span className="rounded-full bg-white px-2 py-1 font-medium border">
                                                    {q.marks} marks
                                                </span>
                                            ) : null}
                                            {q?.directive ? (
                                                <span className="rounded-full bg-white px-2 py-1 font-medium border">
                                                    {q.directive}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="text-sm font-medium leading-6 text-slate-900">
                                            {q?.question || q?.prompt || "Question text unavailable"}
                                        </div>

                                        {q?.theme || q?.subTopic || q?.subtopic || q?.source ? (
                                            <div className="mt-2 text-xs text-slate-600">
                                                {q?.theme ? <span>Theme: {q.theme}</span> : null}
                                                {q?.theme && (q?.subTopic || q?.subtopic) ? <span> • </span> : null}
                                                {q?.subTopic || q?.subtopic ? (
                                                    <span>Subtopic: {q?.subTopic || q?.subtopic}</span>
                                                ) : null}
                                                {(q?.theme || q?.subTopic || q?.subtopic) && q?.source ? (
                                                    <span> • </span>
                                                ) : null}
                                                {q?.source ? <span>Source: {q.source}</span> : null}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}