import { useMemo, useState } from "react";
import PyqModal from "./PyqModal.jsx";

function safePyq(pyq = {}) {
    return {
        syllabusNodeId: pyq?.syllabusNodeId || "",
        matchedNodeId: pyq?.matchedNodeId || null,
        sourceNodeId: pyq?.sourceNodeId || pyq?.matchedNodeId || pyq?.syllabusNodeId || "",
        matchLevel: pyq?.matchLevel || null,
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
    const id = String(q?.id || "").trim().toUpperCase();
    const raw = String(q?.paper || q?.exam || "").trim().toLowerCase();

    if (id.startsWith("PRE_CSAT_") || id.startsWith("CSAT_")) return "CSAT";
    if (id.startsWith("PRE_")) return "Prelims";
    if (id.startsWith("MAINS_") || id.startsWith("MAIN_") || /^GS[1-4]_/.test(id)) return "Mains";
    if (id.startsWith("ESSAY_")) return "Essay";
    if (id.startsWith("ETH_")) return "Ethics";
    if (id.startsWith("OPT_")) return "Optional";

    if (raw.includes("pre")) return "Prelims";
    if (raw.includes("main")) return "Mains";
    if (raw.includes("essay")) return "Essay";
    if (raw.includes("ethic")) return "Ethics";
    if (raw.includes("optional")) return "Optional";
    if (raw.includes("csat")) return "CSAT";
    return q?.paper || q?.exam || "PYQ";
}

function getQuestionText(q) {
    return q?.question || q?.questionText || q?.prompt || q?.text || "Question text unavailable";
}

function getMatchMeta(matchLevel) {
    if (matchLevel === "exact") {
        return { label: "Exact topic match", className: "mos-pyq-match--exact" };
    }
    if (matchLevel === "parent_1" || matchLevel === "parent_2") {
        return { label: "Related topic PYQs", className: "mos-pyq-match--related" };
    }
    return null;
}

export default function PyqSummaryPanel({ pyq }) {
    const [open, setOpen] = useState(false);
    const data = safePyq(pyq);

    const preview = useMemo(() => data.questions.slice(0, 3), [data.questions]);
    const mappedNodes = Array.isArray(data.mappedNodes) ? data.mappedNodes : [];
    const matchMeta = getMatchMeta(data.matchLevel);

    if (!data.total) {
        return (
            <div className="mos-pyq-empty">
                <div className="mos-pyq-empty-icon" aria-hidden="true">↗</div>
                <div>
                    <strong>No linked PYQs yet</strong>
                    <span>MentorOS could not find a sufficiently precise PYQ match for this block.</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <section className="mos-pyq-panel">
                <div className="mos-pyq-panel-head">
                    <div>
                        <div className="mos-pyq-eyebrow">Linked PYQs</div>
                        <div className="mos-pyq-title-row">
                            <h4>{data.total} questions</h4>
                            {matchMeta ? (
                                <span className={`mos-pyq-match ${matchMeta.className}`}>
                                    {matchMeta.label}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="mos-pyq-head-meta">
                        {data.lastAskedYear ? <span>Last asked {data.lastAskedYear}</span> : null}
                        {data.sourceNodeId ? (
                            <span className="mos-pyq-source" title={data.sourceNodeId}>
                                {data.matchLevel === "exact" ? "Exact node" : "Mapped node"}
                            </span>
                        ) : null}
                    </div>
                </div>

                {mappedNodes.length > 1 ? (
                    <div className="mos-pyq-mapped-note">
                        Combined from {mappedNodes.length} mapped topics
                    </div>
                ) : null}

                {preview.length ? (
                    <div className="mos-pyq-preview-list">
                        {preview.map((q, idx) => (
                            <article className="mos-pyq-preview-card" key={q?.id || idx}>
                                <div className="mos-pyq-preview-number">{String(idx + 1).padStart(2, "0")}</div>
                                <div className="mos-pyq-preview-content">
                                    <div className="mos-pyq-preview-meta">
                                        <span>{normalizePaper(q)}</span>
                                        {q?.year ? <span>• {q.year}</span> : null}
                                    </div>
                                    <div className="mos-pyq-preview-text">{getQuestionText(q)}</div>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="mos-pyq-preview-unavailable">
                        PYQs are linked, but preview text is not available in this response.
                    </div>
                )}

                <div className="mos-pyq-panel-foot">
                    <div className="mos-pyq-counts" aria-label="PYQ counts by paper">
                        {data.prelimsCount ? <span>Prelims {data.prelimsCount}</span> : null}
                        {data.mainsCount ? <span>Mains {data.mainsCount}</span> : null}
                        {data.csatCount ? <span>CSAT {data.csatCount}</span> : null}
                        {data.essayCount ? <span>Essay {data.essayCount}</span> : null}
                        {data.ethicsCount ? <span>Ethics {data.ethicsCount}</span> : null}
                        {data.optionalCount ? <span>Optional {data.optionalCount}</span> : null}
                    </div>

                    <button
                        type="button"
                        className="mos-pyq-view-all"
                        onClick={() => setOpen(true)}
                    >
                        View all {data.total} PYQs
                        <span aria-hidden="true">→</span>
                    </button>
                </div>
            </section>

            <PyqModal open={open} onClose={() => setOpen(false)} pyq={data} />
        </>
    );
}
