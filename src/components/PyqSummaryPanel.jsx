import { useMemo, useState } from "react";
import PyqModal from "./PyqModal.jsx";

function safePyq(pyq = {}) {
    return {
        syllabusNodeId: pyq?.syllabusNodeId || "",
        matchedNodeId: pyq?.matchedNodeId || null,
        total: Number(pyq?.total || 0),
        lastAskedYear: pyq?.lastAskedYear || null,
        frequency: Number(pyq?.frequency || 0),
        prelimsCount: Number(pyq?.prelimsCount || 0),
        mainsCount: Number(pyq?.mainsCount || 0),
        essayCount: Number(pyq?.essayCount || 0),
        ethicsCount: Number(pyq?.ethicsCount || 0),
        optionalCount: Number(pyq?.optionalCount || 0),
        csatCount: Number(pyq?.csatCount || 0),
        questions: Array.isArray(pyq?.questions) ? pyq.questions : [],
        mappedNodes: Array.isArray(pyq?.mappedNodes) ? pyq.mappedNodes : [],
    };
}

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

function getQuestionText(q) {
    return q?.question || q?.prompt || "Question text unavailable";
}

export default function PyqSummaryPanel({ pyq }) {
    const [open, setOpen] = useState(false);
    const data = safePyq(pyq);

    const preview = useMemo(() => data.questions.slice(0, 3), [data.questions]);
    const mappedNodes = Array.isArray(data.mappedNodes) ? data.mappedNodes : [];

    if (!data.total) {
        return (
            <div
                style={{
                    marginTop: 12,
                    borderRadius: 16,
                    border: "1px dashed rgba(255,255,255,0.16)",
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.65)",
                    background: "rgba(255,255,255,0.02)",
                }}
            >
                No linked PYQs found.
            </div>
        );
    }

    return (
        <>
            <div
                style={{
                    marginTop: 12,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    padding: 14,
                }}
            >
                {mappedNodes.length > 1 && (
                    <div
                        style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.72)",
                            marginBottom: 10,
                            fontWeight: 600,
                        }}
                    >
                        Combined from {mappedNodes.length} topics
                    </div>
                )}

                {mappedNodes.length > 0 && (
                    <div
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 12,
                        }}
                    >
                        {mappedNodes.slice(0, 6).map((node, idx) => (
                            <span
                                key={`${node?.syllabusNodeId || node?.code || node?.label || "node"}-${idx}`}
                                style={{
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    border: "1px solid rgba(96,165,250,0.28)",
                                    background: "rgba(59,130,246,0.10)",
                                    color: "#dbeafe",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: 1.2,
                                }}
                                title={node?.path || node?.syllabusNodeId || ""}
                            >
                                {node?.label ||
                                    node?.microTheme ||
                                    node?.topic ||
                                    node?.syllabusNodeId ||
                                    "Topic"}
                            </span>
                        ))}
                    </div>
                )}

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 12,
                    }}
                >
                    <span
                        style={{
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "#f8fafc",
                            fontSize: 12,
                            fontWeight: 700,
                        }}
                    >
                        Total: {data.total}
                    </span>

                    {data.lastAskedYear ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: "#e2e8f0",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            Last asked: {data.lastAskedYear}
                        </span>
                    ) : null}

                    {data.prelimsCount ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(16,185,129,0.10)",
                                border: "1px solid rgba(16,185,129,0.22)",
                                color: "#d1fae5",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            Prelims: {data.prelimsCount}
                        </span>
                    ) : null}

                    {data.mainsCount ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(168,85,247,0.10)",
                                border: "1px solid rgba(168,85,247,0.22)",
                                color: "#f3e8ff",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            Mains: {data.mainsCount}
                        </span>
                    ) : null}

                    {data.essayCount ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(245,158,11,0.10)",
                                border: "1px solid rgba(245,158,11,0.22)",
                                color: "#fef3c7",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            Essay: {data.essayCount}
                        </span>
                    ) : null}

                    {data.ethicsCount ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(99,102,241,0.10)",
                                border: "1px solid rgba(99,102,241,0.22)",
                                color: "#e0e7ff",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            Ethics: {data.ethicsCount}
                        </span>
                    ) : null}

                    {data.optionalCount ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(236,72,153,0.10)",
                                border: "1px solid rgba(236,72,153,0.22)",
                                color: "#fce7f3",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            Optional: {data.optionalCount}
                        </span>
                    ) : null}

                    {data.csatCount ? (
                        <span
                            style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(14,165,233,0.10)",
                                border: "1px solid rgba(14,165,233,0.22)",
                                color: "#e0f2fe",
                                fontSize: 12,
                                fontWeight: 700,
                            }}
                        >
                            CSAT: {data.csatCount}
                        </span>
                    ) : null}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                    {preview.map((q, idx) => (
                        <div
                            key={q?.id || idx}
                            style={{
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                padding: "12px 14px",
                            }}
                        >
                            <div
                                style={{
                                    marginBottom: 6,
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 8,
                                    fontSize: 12,
                                    color: "rgba(255,255,255,0.68)",
                                    fontWeight: 600,
                                }}
                            >
                                <span>{normalizePaper(q)}</span>
                                {q?.year ? <span>• {q.year}</span> : null}
                            </div>

                            <div
                                style={{
                                    fontSize: 14,
                                    lineHeight: 1.55,
                                    color: "#f1f5f9",
                                }}
                            >
                                {getQuestionText(q)}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 14 }}>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.08)",
                            color: "#f8fafc",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        View all {data.total} PYQs
                    </button>
                </div>
            </div>

            <PyqModal open={open} onClose={() => setOpen(false)} pyq={data} />
        </>
    );
}