// src/pages/PrelimsInstitutionalTestsPage.jsx
// Phase 2+ — route-wired, safe staging, evaluation engine, approval screen.

import React, { useState, useRef } from "react";
import {
    loadTests,
    addTest,
    updateTest,
    deleteTest,
    fileMeta,
} from "../utils/prelimsInstitutionalTestStore";
import {
    parseAnswerFile,
    evaluateAnswers,
    ParseError,
} from "../utils/prelimsInstitutionalEvaluator";
import { parseInstitutionalQuestionPaper } from "../utils/parseInstitutionalQuestionPaper";
import {
    previewSync,
    syncToMistakeBook,
    syncToRevisionQueue,
} from "../utils/prelimsInstitutionalSyncEngine";
import {
    markMistakeBookSynced,
    markRevisionSynced,
} from "../utils/prelimsInstitutionalTestStore";

// ─── Constants ────────────────────────────────────────────────────────────────
const TEST_STATUSES = {
    DRAFT: "draft",
    NEEDS_ANSWER_KEY: "needs_answer_key",
    NEEDS_USER_ANSWERS: "needs_user_answers",
    READY: "ready_to_evaluate",
    EVALUATED: "evaluated",
};
const PAPER_TYPES = { GS: "GS", CSAT: "CSAT" };
const STATUS_LABELS = {
    draft: "Draft",
    needs_answer_key: "Needs Answer Key",
    needs_user_answers: "Needs Your Answers",
    ready_to_evaluate: "Ready to Evaluate",
    evaluated: "Evaluated",
};
const STATUS_COLORS = {
    draft: "#6b7280",
    needs_answer_key: "#d97706",
    needs_user_answers: "#d97706",
    ready_to_evaluate: "#3b82f6",
    evaluated: "#10b981",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function deriveStatus(test) {
    if (test.correct !== null && test.correct !== undefined) return TEST_STATUSES.EVALUATED;
    if (!test.questionPaperMeta && !test.answerKeyMeta) return TEST_STATUSES.DRAFT;
    if (!test.answerKeyMeta) return TEST_STATUSES.NEEDS_ANSWER_KEY;
    if (!test.userAnswersMeta) return TEST_STATUSES.NEEDS_USER_ANSWERS;
    return TEST_STATUSES.READY;
}

function fmtFileSize(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ResultBadge({ result }) {
    const map = {
        correct: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)", color: "#10b981", label: "✓ Correct" },
        wrong: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.4)", color: "#ef4444", label: "✗ Wrong" },
        unattempted: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.4)", color: "#f59e0b", label: "— Skipped" },
    };
    const s = map[result] || map.unattempted;
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
            background: s.bg, border: `1px solid ${s.border}`, color: s.color,
            letterSpacing: "0.05em",
        }}>
            {s.label}
        </span>
    );
}

// ─── Sub-components (unchanged from original) ────────────────────────────────
function FileField({ label, file, onChange, accept }) {
    const ref = useRef();
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a" }}>
                {label}
            </span>
            <input type="file" ref={ref} style={{ display: "none" }} accept={accept}
                onChange={(e) => onChange(e.target.files[0] || null)} />
            <div onClick={() => ref.current.click()} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 14px", borderRadius: 8, cursor: "pointer", minHeight: 44,
                border: file ? "1px solid #22c55e44" : "1px dashed #3f3f46",
                background: file ? "#0f1f0f" : "#0c0c0e",
                color: file ? "#86efac" : "#52525b", fontSize: 13, boxSizing: "border-box",
            }}>
                {file ? (
                    <>
                        <span style={{ color: "#22c55e", fontSize: 15 }}>✓</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140, color: "#86efac" }}>
                            {file.name}
                        </span>
                    </>
                ) : (
                    <><span style={{ fontSize: 16 }}>↑</span><span>Choose file</span></>
                )}
            </div>
        </div>
    );
}

function StatBox({ label, value, color }) {
    return (
        <div style={{ background: "#0c0c0e", border: "1px solid #1f1f23", borderRadius: 10, padding: "14px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#52525b", marginBottom: 8 }}>
                {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: color || (value !== null ? "#e4e4e7" : "#3f3f46") }}>
                {value ?? "—"}
            </div>
        </div>
    );
}

function Section({ label, accent, children }) {
    return (
        <div style={{ background: "#111113", border: "1px solid #1f1f23", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ height: 2, background: accent || "#f59e0b", width: "100%" }} />
            <div style={{ padding: "22px 26px" }}>
                {label && (
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#52525b", marginBottom: 18 }}>
                        {label}
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a" }}>
                {label}
            </label>
            {children}
        </div>
    );
}

const inputStyle = {
    background: "#0c0c0e", border: "1px solid #27272a", borderRadius: 8,
    color: "#e4e4e7", fontSize: 14, padding: "10px 13px", outline: "none",
    width: "100%", boxSizing: "border-box", fontFamily: "inherit",
};

const btnPrimary = {
    background: "#f59e0b", color: "#0c0c0e", border: "none", borderRadius: 8,
    fontWeight: 800, fontSize: 14, padding: "11px 28px", cursor: "pointer",
    letterSpacing: "0.04em", fontFamily: "inherit",
};

const btnSecondary = {
    background: "#111113", color: "#a1a1aa", border: "1px solid #27272a",
    borderRadius: 8, fontWeight: 600, fontSize: 13, padding: "9px 18px",
    cursor: "pointer", fontFamily: "inherit",
};

// ─── Approval Screen ─────────────────────────────────────────────────────────
function ApprovalScreen({ pending, onConfirm, onCancel }) {
    const { test, evaluationResult } = pending;
    const ev = evaluationResult;
    const [showAll, setShowAll] = useState(false);

    const mistakeRows = ev.questionResults.filter((r) => r.result !== "correct");
    const displayRows = showAll ? ev.questionResults : ev.questionResults.slice(0, 30);

    return (
        <div style={{ padding: "28px 32px", maxWidth: 880, margin: "0 auto" }}>
            {/* Header */}
            <div style={{
                background: "linear-gradient(135deg, #111113 0%, #18181b 100%)",
                border: "1px solid #27272a", borderRadius: 16, padding: "24px 28px",
                marginBottom: 24, position: "relative",
            }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg,#3b82f6,#6366f1)", borderRadius: "14px 0 0 14px" }} />
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b", marginBottom: 8 }}>
                    Evaluation Review — Approval Required
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f4f4f5", margin: "0 0 6px" }}>
                    {test.title}
                </h2>
                <div style={{ fontSize: 13, color: "#71717a" }}>
                    {[test.instituteName, test.batch, test.year, test.paperType].filter(Boolean).join(" · ")}
                </div>
            </div>

            {/* Section A — File summary */}
            <Section label="A. Files Evaluated" accent="#6366f1">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                        { label: "Question Paper", meta: test.questionPaperMeta },
                        { label: "Answer Key", meta: test.answerKeyMeta },
                        { label: "Your Answers", meta: test.userAnswersMeta },
                    ].map(({ label, meta }) => (
                        <div key={label} style={{ background: "#0c0c0e", border: "1px solid #1f1f23", borderRadius: 8, padding: "12px 14px" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#52525b", marginBottom: 6 }}>{label}</div>
                            {meta ? (
                                <>
                                    <div style={{ fontSize: 13, color: "#e4e4e7", fontWeight: 600, wordBreak: "break-all" }}>{meta.name}</div>
                                    <div style={{ fontSize: 11, color: "#52525b", marginTop: 3 }}>{fmtFileSize(meta.size)}</div>
                                </>
                            ) : (
                                <div style={{ fontSize: 12, color: "#3f3f46", fontStyle: "italic" }}>Not uploaded</div>
                            )}
                        </div>
                    ))}
                </div>
            </Section>

            {/* Section B — Evaluation summary */}
            <Section label="B. Evaluation Summary" accent="#3b82f6">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
                    <StatBox label="Total Qs" value={ev.totalQuestions} />
                    <StatBox label="Attempted" value={ev.attempted} />
                    <StatBox label="Correct" value={ev.correct} color="#10b981" />
                    <StatBox label="Wrong" value={ev.wrong} color="#ef4444" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    <StatBox label="Unattempted" value={ev.unattempted} color="#f59e0b" />
                    <StatBox label="Score" value={ev.score} color="#e4e4e7" />
                    <StatBox label="Neg. Marks" value={ev.negativeMarks} color="#f87171" />
                    <StatBox label="Accuracy %" value={ev.accuracy !== null ? `${ev.accuracy}%` : null} />
                </div>
            </Section>

            {/* Section C — Question review table */}
            <Section label={`C. Question-by-Question Review (${ev.totalQuestions} Questions)`} accent="#27272a">
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #27272a" }}>
                                {["Q#", "Correct Answer", "Your Answer", "Result"].map((h) => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#52525b" }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayRows.map((r) => (
                                <tr key={r.questionNumber} style={{ borderBottom: "1px solid #1f1f23" }}>
                                    <td style={{ padding: "7px 12px", color: "#71717a", fontFamily: "monospace" }}>Q{r.questionNumber}</td>
                                    <td style={{ padding: "7px 12px", fontWeight: 700, color: "#10b981", fontFamily: "monospace" }}>{r.correctAnswer}</td>
                                    <td style={{ padding: "7px 12px", fontWeight: 700, color: r.result === "unattempted" ? "#f59e0b" : r.result === "correct" ? "#10b981" : "#ef4444", fontFamily: "monospace" }}>
                                        {r.userAnswer ?? "—"}
                                    </td>
                                    <td style={{ padding: "7px 12px" }}>
                                        <ResultBadge result={r.result} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {ev.questionResults.length > 30 && (
                        <button type="button" onClick={() => setShowAll((v) => !v)} style={{ ...btnSecondary, marginTop: 12, fontSize: 12 }}>
                            {showAll ? "▲ Show Less" : `▼ Show all ${ev.questionResults.length} questions`}
                        </button>
                    )}
                </div>
            </Section>

            {/* Section D — Approval actions */}
            <Section label="D. Confirm or Cancel" accent="#10b981">
                <div style={{ fontSize: 13, color: "#71717a", marginBottom: 18, lineHeight: 1.65 }}>
                    Review the results above carefully. Once you confirm, the evaluation is saved permanently.
                    Wrong and unattempted questions will be eligible for the Mistake Book in a future step.
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <button type="button" onClick={onConfirm} style={{ ...btnPrimary, background: "#10b981" }}>
                        ✓ Confirm Evaluation
                    </button>
                    <button type="button" onClick={onCancel} style={btnSecondary}>
                        ✕ Cancel / Re-upload
                    </button>
                </div>
            </Section>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PrelimsInstitutionalTestsPage() {
    // Form state — fields only (no File objects)
    const [form, setForm] = useState({
        title: "",
        instituteName: "",
        batch: "",
        year: "",
        paperType: PAPER_TYPES.GS,
        questionPaperFile: null,   // File object — in memory only
        answerKeyFile: null,
        userAnswersFile: null,
    });

    // Persisted tests — safe, no File objects
    const [stagedTests, setStagedTests] = useState(() => loadTests());

    // File objects kept in memory for the active evaluate flow; keyed by test id
    // Shape: { [id]: { answerKeyFile: File, userAnswersFile: File } }
    const fileRefs = useRef({});

    // Approval flow state
    const [pendingApproval, setPendingApproval] = useState(null);
    const [evalError, setEvalError] = useState(null);
    const [evalLoading, setEvalLoading] = useState(null); // testId being evaluated

    const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

    // ── Stage a new test ──────────────────────────────────────────────────────
    function handleStage() {
        if (!form.title.trim()) {
            alert("Please enter a test title.");
            return;
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        // Keep File objects only in fileRefs (never in localStorage)
        if (form.answerKeyFile || form.userAnswersFile || form.questionPaperFile) {
            fileRefs.current[id] = {
                questionPaperFile: form.questionPaperFile || null,
                answerKeyFile:    form.answerKeyFile    || null,
                userAnswersFile:  form.userAnswersFile  || null,
            };
        }

        const newTest = {
            id,
            title: form.title.trim(),
            instituteName: form.instituteName.trim(),
            batch: form.batch.trim(),
            year: form.year.trim(),
            paperType: form.paperType,

            // Serializable file metadata only
            questionPaperMeta: fileMeta(form.questionPaperFile),
            answerKeyMeta: fileMeta(form.answerKeyFile),
            userAnswersMeta: fileMeta(form.userAnswersFile),

            status: TEST_STATUSES.DRAFT,  // will be re-derived below
            totalQuestions: null,
            attempted: null,
            correct: null,
            wrong: null,
            unattempted: null,
            score: null,
            negativeMarks: null,
            accuracy: null,
            evaluationResult: null,

            evaluationReady: false,
            mistakeSyncReady: false,
            revisionSyncReady: false,

            createdAt: now,
            updatedAt: now,
        };

        // Derive status from what was uploaded
        newTest.status = deriveStatus(newTest);

        const updated = addTest(newTest);
        setStagedTests(updated);

        setForm({
            title: "", instituteName: "", batch: "", year: "",
            paperType: PAPER_TYPES.GS,
            questionPaperFile: null, answerKeyFile: null, userAnswersFile: null,
        });
    }

    // ── Evaluate a staged test ────────────────────────────────────────────────
    async function handleEvaluate(test) {
        setEvalError(null);
        setEvalLoading(test.id);

        // Check if we have File objects in memory for this test
        const refs = fileRefs.current[test.id];
        if (!refs?.answerKeyFile || !refs?.userAnswersFile) {
            setEvalError("Files are no longer in memory. Please re-stage this test with the answer key and user answers to evaluate.");
            setEvalLoading(null);
            return;
        }

        try {
            // Parse answer key + user answers (required)
            // Parse question paper text in parallel if available (optional — never blocks)
            const [answerKey, userAnswers, questionPaperData] = await Promise.all([
                parseAnswerFile(refs.answerKeyFile),
                parseAnswerFile(refs.userAnswersFile),
                refs.questionPaperFile
                    ? parseInstitutionalQuestionPaper(refs.questionPaperFile).catch(() => ({}))
                    : Promise.resolve({}),
            ]);

            // questionPaperData: { [qNum]: { questionText, options } } or {} if unavailable
            const evaluationResult = evaluateAnswers(
                answerKey,
                userAnswers,
                test.paperType,
                questionPaperData,
            );
            setPendingApproval({ test, evaluationResult });
        } catch (err) {
            if (err?.isParseError) {
                setEvalError(err.message);  // user-friendly multi-line instruction
            } else {
                setEvalError(`Evaluation failed: ${err?.message || String(err)}`);
            }
        }

        setEvalLoading(null);
    }

    // ── Confirm approved evaluation ───────────────────────────────────────────
    function handleConfirmEvaluation() {
        const { test, evaluationResult: ev } = pendingApproval;
        const patch = {
            status: TEST_STATUSES.EVALUATED,
            totalQuestions: ev.totalQuestions,
            attempted: ev.attempted,
            correct: ev.correct,
            wrong: ev.wrong,
            unattempted: ev.unattempted,
            score: ev.score,
            negativeMarks: ev.negativeMarks,
            accuracy: ev.accuracy,
            evaluationResult: ev,
            evaluationReady: true,
        };
        const updated = updateTest(test.id, patch);
        setStagedTests(updated);
        setPendingApproval(null);
    }

    // ── Sync state ────────────────────────────────────────────────────
    // previewModal: { test, evaluationResult, syncTarget: "mistakes"|"revision" } | null
    const [previewModal, setPreviewModal] = useState(null);
    const [syncMsg, setSyncMsg] = useState({});  // { [testId]: string }

    function handleOpenSyncPreview(test, syncTarget) {
        const ev = test.evaluationResult;
        if (!ev) return;
        setPreviewModal({ test, evaluationResult: ev, syncTarget });
    }

    function handleConfirmSync() {
        if (!previewModal) return;
        const { test, evaluationResult, syncTarget } = previewModal;
        let result;

        if (syncTarget === "mistakes") {
            result = syncToMistakeBook(test, evaluationResult);
            const updated = markMistakeBookSynced(test.id);
            setStagedTests(updated);
            setSyncMsg((p) => ({ ...p, [test.id]: `✓ Mistake Book: ${result.added} added, ${result.skipped} already present` }));
        } else {
            result = syncToRevisionQueue(test, evaluationResult);
            const updated = markRevisionSynced(test.id);
            setStagedTests(updated);
            setSyncMsg((p) => ({ ...p, [test.id]: `✓ Revision Queue: ${result.added} added, ${result.skipped} already present` }));
        }

        setPreviewModal(null);
        // Auto-clear message after 6 seconds
        setTimeout(() => setSyncMsg((p) => { const n = { ...p }; delete n[test.id]; return n; }), 6000);
    }

    function handleCancelSync() {
        setPreviewModal(null);
    }

    function handleDeleteTest(id) {
        if (!window.confirm("Delete this test? This cannot be undone.")) return;
        const updated = deleteTest(id);
        setStagedTests(updated);
        // Clean up file refs
        delete fileRefs.current[id];
    }


    // ── Re-stage files for an existing test (after page reload) ──────────────
    // Use a ref (not state) so onChange handlers always read the latest target ID
    // without stale-closure issues from async setState.
    const reFileTestIdRef = useRef(null);
    const reFileKeyRef = useRef(null);
    const reFileUserRef = useRef(null);

    function handleReFileKeyChange(e) {
        const file = e.target.files[0];
        const targetId = reFileTestIdRef.current;
        if (!file || !targetId) return;
        if (!fileRefs.current[targetId]) fileRefs.current[targetId] = {};
        fileRefs.current[targetId].answerKeyFile = file;
        const updated = updateTest(targetId, { answerKeyMeta: fileMeta(file) });
        setStagedTests(updated);
        // Reset so a second click on a different test works cleanly
        reFileTestIdRef.current = null;
        e.target.value = "";
    }

    function handleReFileUserChange(e) {
        const file = e.target.files[0];
        const targetId = reFileTestIdRef.current;
        if (!file || !targetId) return;
        if (!fileRefs.current[targetId]) fileRefs.current[targetId] = {};
        fileRefs.current[targetId].userAnswersFile = file;
        const updated = updateTest(targetId, { userAnswersMeta: fileMeta(file) });
        setStagedTests(updated);
        reFileTestIdRef.current = null;
        e.target.value = "";
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (pendingApproval) {
        return (
            <div style={{ minHeight: "100vh", background: "#09090b", color: "#e4e4e7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}>
                {/* Breadcrumb */}
                <div style={{ borderBottom: "1px solid #1f1f23", padding: "14px 32px", display: "flex", alignItems: "center", gap: 8, background: "#09090b", position: "sticky", top: 0, zIndex: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#52525b" }}>Prelims</span>
                    <span style={{ color: "#3f3f46", fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#71717a" }}>Institutional Tests</span>
                    <span style={{ color: "#3f3f46", fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#3b82f6" }}>Approval Required</span>
                </div>
                <ApprovalScreen
                    pending={pendingApproval}
                    onConfirm={handleConfirmEvaluation}
                    onCancel={() => { setPendingApproval(null); setEvalError(null); }}
                />
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: "#09090b", color: "#e4e4e7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif" }}>
            {/* Hidden re-file inputs (for loading files into existing tests) */}
            <input type="file" ref={reFileKeyRef} style={{ display: "none" }} accept=".txt,.csv" onChange={handleReFileKeyChange} />
            <input type="file" ref={reFileUserRef} style={{ display: "none" }} accept=".txt,.csv" onChange={handleReFileUserChange} />

            {/* Breadcrumb */}
            <div style={{ borderBottom: "1px solid #1f1f23", padding: "14px 32px", display: "flex", alignItems: "center", gap: 8, background: "#09090b", position: "sticky", top: 0, zIndex: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#52525b" }}>Prelims</span>
                <span style={{ color: "#3f3f46", fontSize: 11 }}>·</span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#71717a" }}>Institutional Tests</span>
            </div>

            <div style={{ padding: "28px 32px", maxWidth: 880, margin: "0 auto" }}>
                {/* Hero */}
                <div style={{ background: "linear-gradient(135deg, #111113 0%, #18181b 100%)", border: "1px solid #27272a", borderRadius: 16, padding: "28px 32px", marginBottom: 24, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg, #f59e0b, #d97706)", borderRadius: "14px 0 0 14px" }} />
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b", marginBottom: 10 }}>Institutional Test System</div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f4f4f5", margin: "0 0 10px 0", lineHeight: 1.2 }}>
                        Prelims <span style={{ color: "#f59e0b" }}>Institutional Tests</span>
                    </h1>
                    <p style={{ fontSize: 14, color: "#71717a", lineHeight: 1.65, margin: 0, maxWidth: 580 }}>
                        Upload coaching institute answer keys and your marked answers — for both{" "}
                        <span style={{ color: "#fbbf24", fontWeight: 600 }}>GS</span> and{" "}
                        <span style={{ color: "#60a5fa", fontWeight: 600 }}>CSAT</span>.
                        Evaluation runs in-browser. Approval required before saving.
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                        {[
                            { label: "GS Paper", color: "#f59e0b" },
                            { label: "CSAT Paper", color: "#60a5fa" },
                            { label: "Eval in Browser", color: "#10b981" },
                            { label: "Approval Required", color: "#6366f1" },
                        ].map((p) => (
                            <span key={p.label} style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, border: `1px solid ${p.color}33`, color: p.color, background: `${p.color}11`, letterSpacing: "0.06em" }}>
                                {p.label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Error banner */}
                {evalError && (
                    <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "14px 18px", marginBottom: 20, color: "#fca5a5", fontSize: 13, lineHeight: 1.75 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Evaluation Error</div>
                        <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap", fontSize: 12, color: "#fca5a5" }}>{evalError}</pre>
                        <button type="button" onClick={() => setEvalError(null)} style={{ marginTop: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#fca5a5", cursor: "pointer", fontSize: 12, padding: "4px 12px", fontFamily: "inherit" }}>Dismiss</button>
                    </div>
                )}

                {/* Stage a new test */}
                <Section label="Stage a New Test" accent="#f59e0b">
                    {/* Paper type */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#71717a", marginBottom: 10 }}>Paper Type</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            {[PAPER_TYPES.GS, PAPER_TYPES.CSAT].map((pt) => {
                                const active = form.paperType === pt;
                                const accent = pt === "GS" ? "#f59e0b" : "#60a5fa";
                                return (
                                    <button key={pt} onClick={() => set("paperType")(pt)} style={{ padding: "8px 28px", borderRadius: 8, border: active ? `1.5px solid ${accent}` : "1px solid #27272a", background: active ? `${accent}15` : "#0c0c0e", color: active ? accent : "#52525b", fontWeight: 800, fontSize: 13, cursor: "pointer", letterSpacing: "0.08em", fontFamily: "inherit" }}>
                                        {pt}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                        <Field label="Test Title *">
                            <input style={inputStyle} placeholder="e.g. Vision IAS PT-3 2025" value={form.title} onChange={(e) => set("title")(e.target.value)} />
                        </Field>
                        <Field label="Institute Name">
                            <input style={inputStyle} placeholder="e.g. Vision IAS, Vajiram, Self" value={form.instituteName} onChange={(e) => set("instituteName")(e.target.value)} />
                        </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                        <Field label="Batch">
                            <input style={inputStyle} placeholder="e.g. 2025-26" value={form.batch} onChange={(e) => set("batch")(e.target.value)} />
                        </Field>
                        <Field label="Year">
                            <input style={inputStyle} placeholder="e.g. 2025" value={form.year} onChange={(e) => set("year")(e.target.value)} />
                        </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                        <FileField label="Question Paper (optional)" file={form.questionPaperFile} onChange={set("questionPaperFile")} accept=".pdf,.doc,.docx,.txt" />
                        <FileField label="Answer Key *" file={form.answerKeyFile} onChange={set("answerKeyFile")} accept=".txt,.csv" />
                        <FileField label="Your Answers *" file={form.userAnswersFile} onChange={set("userAnswersFile")} accept=".txt,.csv" />
                    </div>

                    <div style={{ fontSize: 12, color: "#3f3f46", marginBottom: 18, lineHeight: 1.65 }}>
                        Answer key &amp; your answers must be <strong style={{ color: "#71717a" }}>readable text</strong> (.txt or .csv recommended).
                        Patterns supported per line:
                        {" "}<code style={{ color: "#52525b" }}>1 A</code>,
                        {" "}<code style={{ color: "#52525b" }}>1. A</code>,
                        {" "}<code style={{ color: "#52525b" }}>1) A</code>,
                        {" "}<code style={{ color: "#52525b" }}>(1) A</code>,
                        {" "}<code style={{ color: "#52525b" }}>Q 1 A</code>,
                        {" "}<code style={{ color: "#52525b" }}>( 1 ) A</code>,
                        {" "}<code style={{ color: "#52525b" }}>Q1,A</code>,
                        {" "}<code style={{ color: "#52525b" }}>1:B</code>.
                        Lowercase works. Scanned/binary PDFs will not parse — save as .txt if unsure.
                    </div>

                    <button onClick={handleStage} style={btnPrimary}>▶ Stage Test</button>
                </Section>

                {/* Staged tests */}
                <Section label={`Staged Tests${stagedTests.length ? `  (${stagedTests.length})` : ""}`} accent="#27272a">
                    {stagedTests.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "36px 0", color: "#3f3f46" }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#52525b" }}>No tests staged yet</div>
                            <div style={{ fontSize: 12, marginTop: 6 }}>Use the form above to stage your first institutional test.</div>
                        </div>
                    ) : (
                        <div>
                            {stagedTests.map((test, i) => {
                                const isReady = test.status === TEST_STATUSES.READY;
                                const isEvaluated = test.status === TEST_STATUSES.EVALUATED;
                                const isLoading = evalLoading === test.id;
                                const hasFilesInMemory = !!(fileRefs.current[test.id]?.answerKeyFile && fileRefs.current[test.id]?.userAnswersFile);

                                return (
                                    <div key={test.id} style={{ padding: "16px 0", borderBottom: i < stagedTests.length - 1 ? "1px solid #1f1f23" : "none" }}>
                                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 700, fontSize: 15, color: "#f4f4f5", marginBottom: 5 }}>{test.title}</div>
                                                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#52525b", flexWrap: "wrap", marginBottom: isEvaluated ? 10 : 0 }}>
                                                    {test.instituteName && <span>{test.instituteName}</span>}
                                                    {test.batch && <span>Batch: {test.batch}</span>}
                                                    {test.year && <span>{test.year}</span>}
                                                    <span style={{ color: test.paperType === "GS" ? "#fbbf24" : "#60a5fa", fontWeight: 700 }}>{test.paperType}</span>
                                                    <span style={{ color: "#3f3f46" }}>{new Date(test.createdAt).toLocaleDateString()}</span>
                                                </div>

                                                {/* Sync success message */}
                                                {syncMsg[test.id] && (
                                                    <div style={{ marginTop: 6, fontSize: 11, color: "#10b981", fontFamily: "monospace" }}>
                                                        {syncMsg[test.id]}
                                                    </div>
                                                )}

                                                {/* Evaluated stats mini-row */}
                                                {isEvaluated && test.score !== null && (
                                                    <div style={{ display: "flex", gap: 14, fontSize: 12, flexWrap: "wrap" }}>
                                                        {[
                                                            { label: "Score", val: test.score, color: "#e4e4e7" },
                                                            { label: "Correct", val: test.correct, color: "#10b981" },
                                                            { label: "Wrong", val: test.wrong, color: "#ef4444" },
                                                            { label: "Unattempted", val: test.unattempted, color: "#f59e0b" },
                                                            { label: "Accuracy", val: test.accuracy != null ? `${test.accuracy}%` : null, color: "#a78bfa" },
                                                        ].map(({ label, val, color }) => (
                                                            <span key={label} style={{ color: "#52525b" }}>
                                                                {label}: <span style={{ color, fontWeight: 700 }}>{val ?? "—"}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Sync timestamps */}
                                                {isEvaluated && (test.mistakeBookSyncedAt || test.revisionSyncedAt) && (
                                                    <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", fontSize: 11, color: "#52525b" }}>
                                                        {test.mistakeBookSyncedAt && (
                                                            <span style={{ color: "#10b981" }}>
                                                                ✓ Mistake Book synced {new Date(test.mistakeBookSyncedAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {test.revisionSyncedAt && (
                                                            <span style={{ color: "#a78bfa" }}>
                                                                ✓ Revision synced {new Date(test.revisionSyncedAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Re-upload files */}
                                                {isReady && !hasFilesInMemory && !isLoading && (
                                                    <div style={{ marginTop: 8, fontSize: 12, color: "#52525b", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                                        <span>⚠ Files not in memory.</span>
                                                        <button type="button" style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}
                                                            onClick={() => { reFileTestIdRef.current = test.id; reFileKeyRef.current?.click(); }}>
                                                            Load Answer Key
                                                        </button>
                                                        <button type="button" style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px" }}
                                                            onClick={() => { reFileTestIdRef.current = test.id; reFileUserRef.current?.click(); }}>
                                                            Load Your Answers
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                                                <span style={{
                                                    display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                                                    letterSpacing: "0.07em", textTransform: "uppercase",
                                                    border: `1px solid ${STATUS_COLORS[test.status]}33`,
                                                    color: STATUS_COLORS[test.status],
                                                    background: `${STATUS_COLORS[test.status]}15`,
                                                }}>
                                                    {STATUS_LABELS[test.status]}
                                                </span>

                                                {(isReady && hasFilesInMemory) && (
                                                    <button type="button" disabled={isLoading}
                                                        onClick={() => handleEvaluate(test)}
                                                        style={{ ...btnPrimary, fontSize: 12, padding: "7px 16px", background: isLoading ? "#374151" : "#3b82f6" }}>
                                                        {isLoading ? "Evaluating…" : "▶ Evaluate"}
                                                    </button>
                                                )}

                                                <button type="button" onClick={() => handleDeleteTest(test.id)}
                                                    style={{ ...btnSecondary, fontSize: 11, padding: "4px 10px", color: "#6b7280" }}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Section>

                {/* Downstream actions */}
                <Section label="Downstream Actions" accent="#27272a">
                    <div style={{ fontSize: 12, color: "#3f3f46", marginBottom: 16 }}>
                        Select an evaluated test above, then use these actions to sync its mistakes and revision items.
                    </div>
                    {/* Per-evaluated-test action rows */}
                    {stagedTests.filter((t) => t.status === TEST_STATUSES.EVALUATED).length === 0 ? (
                        <div style={{ fontSize: 12, color: "#3f3f46", fontStyle: "italic" }}>No evaluated tests yet.</div>
                    ) : (
                        stagedTests
                            .filter((t) => t.status === TEST_STATUSES.EVALUATED)
                            .map((test) => (
                                <div key={test.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #1f1f23" }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", flex: 1, minWidth: 140 }}>{test.title}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenSyncPreview(test, "mistakes")}
                                        style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px",
                                            color: test.mistakeBookSyncedAt ? "#10b981" : "#e4e4e7",
                                            borderColor: test.mistakeBookSyncedAt ? "rgba(16,185,129,0.3)" : undefined,
                                        }}
                                    >
                                        {test.mistakeBookSyncedAt ? "✓ Mistake Book" : "📚  Send to Mistake Book"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenSyncPreview(test, "revision")}
                                        style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px",
                                            color: test.revisionSyncedAt ? "#a78bfa" : "#e4e4e7",
                                            borderColor: test.revisionSyncedAt ? "rgba(167,139,250,0.3)" : undefined,
                                        }}
                                    >
                                        {test.revisionSyncedAt ? "✓ Revision Queue" : "🔁  Add to Revision Queue"}
                                    </button>
                                </div>
                            ))
                    )}
                </Section>
            </div>

            {/* ── Sync Preview Modal ── */}
            {previewModal && (() => {
                const { test, evaluationResult: ev, syncTarget } = previewModal;
                const preview = previewSync(test, ev);
                const isM    = syncTarget === "mistakes";
                const accent = isM ? "#10b981" : "#a78bfa";
                const label  = isM ? "Mistake Book" : "Revision Queue";
                const newCount = isM ? preview.mistakeBookNew : preview.revisionNew;
                return (
                    <div style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(0,0,0,0.72)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: 24,
                    }}>
                        <div style={{
                            background: "#111113", border: `1px solid ${accent}33`,
                            borderRadius: 14, padding: "28px 32px", maxWidth: 480, width: "100%",
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>
                                Sync Preview — {label}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5", marginBottom: 18 }}>{test.title}</div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                                {[
                                    { label: "Total Qs",    val: preview.total },
                                    { label: "Wrong",       val: preview.wrong,       color: "#ef4444" },
                                    { label: "Unattempted", val: preview.unattempted, color: "#f59e0b" },
                                ].map(({ label: l, val, color }) => (
                                    <div key={l} style={{ background: "#0c0c0e", border: "1px solid #1f1f23", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#52525b", marginBottom: 4 }}>{l}</div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: color || "#e4e4e7" }}>{val}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ fontSize: 13, color: "#71717a", marginBottom: 6 }}>
                                <span style={{ color: accent, fontWeight: 700 }}>{preview.eligible}</span> eligible •{" "}
                                <span style={{ color: "#10b981", fontWeight: 700 }}>{newCount} new</span> will be added
                                {newCount < preview.eligible && (
                                    <span style={{ color: "#52525b" }}> ({preview.eligible - newCount} already present)</span>
                                )}
                            </div>
                            <div style={{ fontSize: 11, color: "#3f3f46", marginBottom: 22 }}>
                                Items stored as unmapped question entries (no subject/topic). You can add context later.
                            </div>

                            <div style={{ display: "flex", gap: 10 }}>
                                <button type="button" onClick={handleConfirmSync}
                                    style={{ ...btnPrimary, background: accent, fontSize: 13, padding: "9px 22px" }}>
                                    ✓ Confirm Sync
                                </button>
                                <button type="button" onClick={handleCancelSync} style={btnSecondary}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

