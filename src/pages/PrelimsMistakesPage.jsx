import { useEffect, useMemo, useState } from "react";
import { BACKEND_URL } from "../config";

function formatDate(value) {
    if (!value) return "-";
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
}

function normalizeMistake(item) {
    return {
        ...item,
        status: item.answer_status || item.status || "wrong",
        sourceType: item.source_type || item.sourceType || "unknown",
        actionTag: item.actionTag || (item.must_revise ? "must_revise" : "none"),
        questionTextRaw: item.question_text || item.questionTextRaw || item.questionText || "",
        selectedOption: item.selected_answer || item.selectedOption || item.latestUserAnswer || "—",
        correctOption: item.correct_answer || item.correctOption || item.correctAnswer || "—",
        subjectId: item.subject || item.subjectId || "—",
        syllabusNodeId: item.node_id || item.syllabusNodeId || "—",
        microThemeLabel: item.microThemeLabel || "—",
        createdAt: item.created_at || item.createdAt || item.firstSeenAt || null,
        testNumber: item.source_ref || item.testId || item.testNumber || "-",
        questionNumber: item.question_id || item.questionId || item.questionNumber || "-",
    };
}

export default function PrelimsMistakesPage() {
    const [statusFilter, setStatusFilter] = useState("all");
    const [sourceFilter, setSourceFilter] = useState("all");
    const [actionFilter, setActionFilter] = useState("all");
    const [mistakes, setMistakes] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        async function loadMistakes() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/mistakes?userId=user_1`, { cache: "no-store" });
                if (!res.ok) throw new Error(`Failed to fetch mistakes: ${res.status}`);
                const data = await res.json();
                const normalized = Array.isArray(data) ? data.map(normalizeMistake) : Array.isArray(data.items) ? data.items.map(normalizeMistake) : [];
                if (isMounted) setMistakes(normalized);
            } catch (err) {
                console.error("Failed to fetch prelims mistakes", err);
                if (isMounted) setMistakes([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadMistakes();
        return () => {
            isMounted = false;
        };
    }, []);

    const filtered = useMemo(() => {
        return mistakes.filter((item) => {
            const statusOk = statusFilter === "all" ? true : item.status === statusFilter;

            const sourceNormalized =
                item.sourceType === "sectional_test" ||
                    item.sourceType === "topic_test" ||
                    item.sourceType === "full_length" ||
                    item.sourceType === "prelims_pyq" ||
                    item.sourceType === "pyq"
                    ? "pyq"
                    : item.sourceType === "institutional" || item.sourceType === "prelims_institutional"
                        ? "institutional"
                        : item.sourceType;

            const sourceOk = sourceFilter === "all" ? true : sourceNormalized === sourceFilter;
            const actionOk = actionFilter === "all" ? true : item.actionTag === actionFilter;

            return statusOk && sourceOk && actionOk;
        });
    }, [mistakes, statusFilter, sourceFilter, actionFilter]);

    const summary = useMemo(() => {
        let wrong = 0;
        let unattempted = 0;
        let mustRead = 0;
        let mustRevise = 0;
        let mustRetest = 0;

        for (const item of mistakes) {
            if (item.status === "wrong") wrong += 1;
            if (item.status === "unattempted") unattempted += 1;
            if (item.actionTag === "must_read") mustRead += 1;
            if (item.actionTag === "must_revise") mustRevise += 1;
            if (item.actionTag === "must_retest") mustRetest += 1;
        }

        return {
            total: mistakes.length,
            wrong,
            unattempted,
            mustRead,
            mustRevise,
            mustRetest,
        };
    }, [mistakes]);

    if (loading) {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "#0b1020",
                    color: "#e5e7eb",
                    padding: "24px 16px 56px",
                }}
            >
                <div style={{ maxWidth: 1180, margin: "0 auto" }}>
                    <div
                        style={{
                            marginBottom: 20,
                            padding: 20,
                            borderRadius: 20,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                        }}
                    >
                        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>PHASE 4 FOUNDATION</div>
                        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Prelims Mistake Console</div>
                        <div style={{ fontSize: 14, opacity: 0.8 }}>Loading mistakes from database...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "#0b1020",
                color: "#e5e7eb",
                padding: "24px 16px 56px",
            }}
        >
            <div style={{ maxWidth: 1180, margin: "0 auto" }}>
                <div
                    style={{
                        marginBottom: 20,
                        padding: 20,
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>PHASE 4 FOUNDATION</div>
                    <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Prelims Mistake Console</div>
                    <div style={{ fontSize: 14, opacity: 0.8 }}>
                        Unified mistake view for PYQ and Institutional tests. Every wrong or skipped question
                        should lead to revision.
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(6, 1fr)",
                        gap: 12,
                        marginBottom: 18,
                    }}
                >
                    <StatCard title="Total Mistakes" value={summary.total} />
                    <StatCard title="Wrong" value={summary.wrong} />
                    <StatCard title="Skipped" value={summary.unattempted} />
                    <StatCard title="Must Read" value={summary.mustRead} />
                    <StatCard title="Must Revise" value={summary.mustRevise} />
                    <StatCard title="Must Retest" value={summary.mustRetest} />
                </div>

                <div
                    style={{
                        marginBottom: 18,
                        padding: 16,
                        borderRadius: 18,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <FilterSelect
                        label="Status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { value: "all", label: "All" },
                            { value: "wrong", label: "Wrong" },
                            { value: "unattempted", label: "Unattempted" },
                        ]}
                    />

                    <FilterSelect
                        label="Source"
                        value={sourceFilter}
                        onChange={setSourceFilter}
                        options={[
                            { value: "all", label: "All" },
                            { value: "pyq", label: "PYQ" },
                            { value: "institutional", label: "Institutional" },
                        ]}
                    />

                    <FilterSelect
                        label="Action"
                        value={actionFilter}
                        onChange={setActionFilter}
                        options={[
                            { value: "all", label: "All" },
                            { value: "must_read", label: "Must Read" },
                            { value: "must_revise", label: "Must Revise" },
                            { value: "must_retest", label: "Must Retest" },
                        ]}
                    />
                </div>

                <div
                    style={{
                        padding: 18,
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>
                        Mistake List ({filtered.length})
                    </div>

                    {!filtered.length ? (
                        <div
                            style={{
                                padding: 24,
                                borderRadius: 16,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                fontSize: 14,
                                opacity: 0.8,
                            }}
                        >
                            No mistakes found for the selected filters.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 14 }}>
                            {filtered.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        padding: 16,
                                        borderRadius: 16,
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            gap: 10,
                                            flexWrap: "wrap",
                                            alignItems: "center",
                                            marginBottom: 12,
                                        }}
                                    >
                                        <Pill>{item.sourceType || "unknown"}</Pill>
                                        <Pill>{`Test #${item.testNumber ?? "-"}`}</Pill>
                                        <Pill>{`Q${item.questionNumber ?? "-"}`}</Pill>
                                        <Pill tone={item.status === "wrong" ? "red" : "amber"}>
                                            {item.status || "-"}
                                        </Pill>
                                        <Pill tone="blue">{item.actionTag || "-"}</Pill>
                                    </div>

                                    <div
                                        style={{
                                            fontSize: 17,
                                            lineHeight: 1.7,
                                            fontWeight: 600,
                                            marginBottom: 14,
                                            whiteSpace: "pre-wrap",
                                        }}
                                    >
                                        {item.questionTextRaw || "No question text available."}
                                    </div>

                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                                            gap: 12,
                                            marginBottom: 12,
                                        }}
                                    >
                                        <InfoCard label="Selected Option" value={item.selectedOption || "—"} />
                                        <InfoCard label="Correct Option" value={item.correctOption || "—"} />
                                        <InfoCard label="Subject" value={item.subjectId || "—"} />
                                        <InfoCard label="Syllabus Node" value={item.syllabusNodeId || "—"} />
                                        <InfoCard label="Micro Theme" value={item.microThemeLabel || "—"} />
                                        <InfoCard label="Created At" value={formatDate(item.createdAt)} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value }) {
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }) {
    return (
        <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 12, opacity: 0.72, marginBottom: 6 }}>{label}</div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#e5e7eb",
                    padding: "0 12px",
                    outline: "none",
                }}
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: "#111827", color: "#e5e7eb" }}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function Pill({ children, tone = "default" }) {
    const tones = {
        default: {
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
        },
        red: {
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.35)",
        },
        amber: {
            background: "rgba(245,158,11,0.15)",
            border: "1px solid rgba(245,158,11,0.35)",
        },
        blue: {
            background: "rgba(99,102,241,0.16)",
            border: "1px solid rgba(99,102,241,0.35)",
        },
    };

    return (
        <span
            style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 999,
                ...tones[tone],
            }}
        >
            {children}
        </span>
    );
}

function InfoCard({ label, value }) {
    return (
        <div
            style={{
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div style={{ fontSize: 11, opacity: 0.68, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, fontWeight: 600, wordBreak: "break-word" }}>
                {value}
            </div>
        </div>
    );
}
