import { useEffect, useMemo, useRef, useState } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeOption(text) {
    if (!text) return "";
    // Strip trailing "Solution: x)" or "Answer: x)" contamination from raw data
    return String(text).replace(/[\.\s]*(?:Solution|Answer|Ans)\s*[:\-]?\s*[a-dA-D1-4]\s*\)?\.?\s*$/i, "").trim();
}

function normalizeOptions(question) {
    if (!question) return {};
    if (Array.isArray(question.options)) {
        return {
            A: sanitizeOption(question.options[0] ?? ""),
            B: sanitizeOption(question.options[1] ?? ""),
            C: sanitizeOption(question.options[2] ?? ""),
            D: sanitizeOption(question.options[3] ?? ""),
        };
    }
    if (question.options && typeof question.options === "object") {
        return {
            A: sanitizeOption(question.options.A ?? question.options.a ?? ""),
            B: sanitizeOption(question.options.B ?? question.options.b ?? ""),
            C: sanitizeOption(question.options.C ?? question.options.c ?? ""),
            D: sanitizeOption(question.options.D ?? question.options.d ?? ""),
        };
    }
    return {
        A: sanitizeOption(question.optionA ?? question.option_a ?? question.a ?? ""),
        B: sanitizeOption(question.optionB ?? question.option_b ?? question.b ?? ""),
        C: sanitizeOption(question.optionC ?? question.option_c ?? question.c ?? ""),
        D: sanitizeOption(question.optionD ?? question.option_d ?? question.d ?? ""),
    };
}

function optionKeys(question) {
    const n = normalizeOptions(question);
    return ["A", "B", "C", "D"].filter((k) => n[k]);
}

function getQid(question) {
    return question?.questionId || question?.id || question?.qid || null;
}

function getTestHeading(testMeta) {
    if (!testMeta) return "PYQ Test";
    if (testMeta.mode === "full_length") {
        if (testMeta.paperType === "GS") return `GS Full-Length ${testMeta.year || ""}`.trim();
        if (testMeta.paperType === "CSAT") return `CSAT Full-Length ${testMeta.year || ""}`.trim();
    }
    if (testMeta.mode === "practice") return "Practice Test";
    return `PYQ Test #${testMeta?.testNumber || ""}`.trim();
}

function buildRcDisplayMeta(items = []) {
    let questionNo = 0;
    let passageNo = 0;
    return items.map((item, index) => {
        if (item?.isPassage) {
            passageNo += 1;
            return { index, isPassage: true, passageNo, questionNo: null, displayLabel: `P${passageNo}` };
        }
        questionNo += 1;
        return { index, isPassage: false, passageNo: null, questionNo, displayLabel: String(questionNo) };
    });
}

function findNearestQuestionYear(items = [], index) {
    for (let i = index + 1; i < items.length; i += 1) {
        if (!items[i]?.isPassage && items[i]?.year) return items[i].year;
    }
    for (let i = index - 1; i >= 0; i -= 1) {
        if (!items[i]?.isPassage && items[i]?.year) return items[i].year;
    }
    return null;
}

function formatElapsed(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getConfidenceTone(level, active) {
    const map = {
        sure: {
            border: active ? "1px solid rgba(16,185,129,0.9)" : "1px solid rgba(16,185,129,0.25)",
            background: active ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.08)",
            color: active ? "#d1fae5" : "#a7f3d0",
        },
        unsure: {
            border: active ? "1px solid rgba(245,158,11,0.9)" : "1px solid rgba(245,158,11,0.25)",
            background: active ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.08)",
            color: active ? "#fef3c7" : "#fde68a",
        },
        guess: {
            border: active ? "1px solid rgba(99,102,241,0.9)" : "1px solid rgba(99,102,241,0.25)",
            background: active ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.08)",
            color: active ? "#e0e7ff" : "#c7d2fe",
        },
    };
    return map[level] || map.guess;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PyqTestAttempt({
    testMeta,
    questions = [],
    currentIndex = 0,
    currentQuestion,
    answersMap = {},
    confidenceMap = {},
    onSetConfidence = () => { },
    onSelectOption = () => { },
    onClearOption = () => { },
    onPrev = () => { },
    onNext = () => { },
    onJumpTo = () => { },
    onSubmit = () => { },
    testStartTime = null,
    practiceMode = "",
    questionCount = 0,
}) {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const confirmRef = useRef(null);

    // Scroll confirm block into view as soon as it appears
    useEffect(() => {
        if (showSubmitConfirm && confirmRef.current) {
            confirmRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [showSubmitConfirm]);

    useEffect(() => {
        if (!testStartTime) return undefined;
        const tick = () => setElapsedSeconds(Math.floor((Date.now() - testStartTime) / 1000));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [testStartTime]);

    const safeQuestions = Array.isArray(questions) ? questions : [];
    const displayMeta = useMemo(() => buildRcDisplayMeta(safeQuestions), [safeQuestions]);
    const totalAnswerable = displayMeta.filter((m) => !m.isPassage).length;

    const safeCurrentQuestion = currentQuestion || safeQuestions[currentIndex] || null;
    const currentMeta = displayMeta[currentIndex] || {};
    const isPassageCard = !!safeCurrentQuestion?.isPassage;
    const currentQid = isPassageCard ? null : getQid(safeCurrentQuestion);

    const currentYear =
        safeCurrentQuestion?.year ||
        (isPassageCard ? findNearestQuestionYear(safeQuestions, currentIndex) : null);

    const answeredQuestionCount = safeQuestions.filter((q) => {
        if (q?.isPassage) return false;
        const qid = getQid(q);
        return qid && answersMap[qid];
    }).length;

    const sureCount = Object.values(confidenceMap || {}).filter((c) => c === "sure").length;
    const unsureCount = Object.values(confidenceMap || {}).filter((c) => c === "unsure").length;
    const guessCount = Object.values(confidenceMap || {}).filter((c) => c === "guess").length;

    const selectedOption = currentQid ? answersMap[currentQid] || "" : "";
    const selectedConfidence = currentQid ? confidenceMap?.[currentQid] || "" : "";
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === safeQuestions.length - 1;
    const normalizedOptions = normalizeOptions(safeCurrentQuestion);

    const visibleQuestionText = isPassageCard
        ? safeCurrentQuestion?.passage || safeCurrentQuestion?.passageText || ""
        : safeCurrentQuestion?.question ||
        safeCurrentQuestion?.questionText ||
        safeCurrentQuestion?.prompt ||
        safeCurrentQuestion?.stem ||
        "Question text not available.";

    const attemptLabel = practiceMode
        ? `Mode: ${String(practiceMode).replaceAll("_", " ")} • ${questionCount || totalAnswerable || safeQuestions.length} Questions`
        : "";

    if (!safeCurrentQuestion) {
        return (
            <div
                style={{
                    padding: 20,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#e5e7eb",
                }}
            >
                Loading question...
            </div>
        );
    }

    return (
        <div style={{ position: "relative", minWidth: 0 }}>
            {isNavigatorOpen && (
                <div
                    onClick={() => {
                        setIsNavigatorOpen(false);
                        setShowSubmitConfirm(false);
                    }}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(2,6,23,0.62)",
                        backdropFilter: "blur(4px)",
                        zIndex: 90,
                    }}
                />
            )}

            <aside
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    width: "min(360px, 92vw)",
                    height: "100vh",
                    padding: 18,
                    boxSizing: "border-box",
                    background: "linear-gradient(180deg, rgba(10,15,30,0.98), rgba(8,12,24,0.98))",
                    borderLeft: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: isNavigatorOpen ? "-20px 0 60px rgba(0,0,0,0.45)" : "none",
                    transform: isNavigatorOpen ? "translateX(0)" : "translateX(110%)",
                    transition: "transform 0.24s ease",
                    zIndex: 100,
                    overflowY: "auto",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>{getTestHeading(testMeta)}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, lineHeight: 1.5 }}>
                            {testMeta?.label || "Navigate questions and review submission."}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setIsNavigatorOpen(false);
                            setShowSubmitConfirm(false);
                        }}
                        style={iconBtnStyle}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                    <div style={drawerStatCardStyle}>
                        <div style={drawerStatValueStyle}>{answeredQuestionCount}</div>
                        <div style={drawerStatLabelStyle}>Answered</div>
                    </div>
                    <div style={drawerStatCardStyle}>
                        <div style={drawerStatValueStyle}>{totalAnswerable || safeQuestions.length}</div>
                        <div style={drawerStatLabelStyle}>Total</div>
                    </div>
                    <div style={drawerStatCardStyle}>
                        <div style={{ ...drawerStatValueStyle, color: "#a7f3d0" }}>{sureCount}</div>
                        <div style={drawerStatLabelStyle}>Sure</div>
                    </div>
                    <div style={drawerStatCardStyle}>
                        <div style={{ ...drawerStatValueStyle, color: "#c7d2fe" }}>{guessCount}</div>
                        <div style={drawerStatLabelStyle}>Guess</div>
                    </div>
                </div>

                <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                    Question Navigator
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 18 }}>
                    {safeQuestions.map((q, idx) => {
                        if (!q) return null;
                        const meta = displayMeta[idx];
                        const isP = q?.isPassage;
                        const qid = isP ? null : getQid(q);
                        const picked = qid ? answersMap[qid] || "" : "";
                        const confidence = qid ? confidenceMap?.[qid] || "" : "";
                        const active = idx === currentIndex;

                        let bg = isP ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.04)";
                        let color = isP ? "#818cf8" : "#e5e7eb";

                        if (!isP && picked) {
                            if (confidence === "sure") {
                                bg = "rgba(16,185,129,0.22)";
                                color = "#d1fae5";
                            } else if (confidence === "unsure") {
                                bg = "rgba(245,158,11,0.22)";
                                color = "#fef3c7";
                            } else {
                                bg = "rgba(99,102,241,0.18)";
                                color = "#e0e7ff";
                            }
                        }

                        return (
                            <button
                                key={qid || `p-${idx}`}
                                type="button"
                                onClick={() => {
                                    onJumpTo(idx);
                                    setIsNavigatorOpen(false);
                                    setShowSubmitConfirm(false);
                                }}
                                title={isP ? `Passage ${meta?.passageNo}` : `Q${meta?.questionNo}`}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: active
                                        ? "1.5px solid rgba(56,189,248,0.9)"
                                        : isP
                                            ? "1px solid rgba(99,102,241,0.25)"
                                            : "1px solid rgba(255,255,255,0.08)",
                                    background: active ? "rgba(56,189,248,0.18)" : bg,
                                    color,
                                    fontWeight: 800,
                                    fontSize: isP ? 10 : 12,
                                    cursor: "pointer",
                                }}
                            >
                                {meta?.displayLabel || idx + 1}
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setIsNavigatorOpen(false);
                        setShowSubmitConfirm(true);
                    }}
                    style={{
                        width: "100%",
                        height: 46,
                        borderRadius: 12,
                        border: "1px solid rgba(99,102,241,0.35)",
                        background: "rgba(99,102,241,0.16)",
                        color: "#e0e7ff",
                        fontWeight: 800,
                        cursor: "pointer",
                    }}
                >
                    Review & Submit
                </button>
            </aside>

            <div
                style={{
                    padding: 22,
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    minWidth: 0,
                    width: "100%",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                        marginBottom: 16,
                    }}
                >
                    <button type="button" onClick={() => setIsNavigatorOpen(true)} style={iconActionBtnStyle}>
                        ☰ Navigator
                    </button>

                    {isPassageCard ? (
                        <span style={{ ...pillStyle, background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" }}>
                            {currentMeta.passageNo != null ? `P${currentMeta.passageNo}` : "Passage"}
                        </span>
                    ) : (
                        <span style={pillStyle}>
                            Q {currentMeta.questionNo ?? "—"} / {totalAnswerable || safeQuestions.length}
                        </span>
                    )}

                    {currentYear ? <span style={pillStyle}>{currentYear}</span> : null}
                    {!isPassageCard && safeCurrentQuestion?.paper ? <span style={pillStyle}>{safeCurrentQuestion.paper}</span> : null}
                    {attemptLabel ? <span style={subtlePillStyle}>{attemptLabel}</span> : null}

                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span
                            style={{
                                ...pillStyle,
                                color: "#93c5fd",
                                background: "rgba(14,165,233,0.12)",
                                border: "1px solid rgba(56,189,248,0.22)",
                            }}
                        >
                            ⏱ {formatElapsed(elapsedSeconds)}
                        </span>
                    </div>
                </div>

                {!isPassageCard && safeCurrentQuestion?.passageText && (
                    <div style={{ marginBottom: 20 }}>
                        <div style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: 1.2,
                            textTransform: "uppercase",
                            color: "#6366f1",
                            marginBottom: 8,
                        }}>
                            Passage
                        </div>
                        <div
                            style={{
                                background: "rgba(148,163,184,0.05)",
                                border: "1px solid rgba(148,163,184,0.12)",
                                borderLeft: "3px solid rgba(99,102,241,0.5)",
                                borderRadius: 10,
                                padding: "16px 20px",
                                fontSize: 15,
                                lineHeight: 1.85,
                                color: "#cbd5e1",
                                whiteSpace: "pre-wrap",
                                overflowWrap: "break-word",
                                wordBreak: "break-word",
                            }}
                        >
                            {safeCurrentQuestion.passageText}
                        </div>
                    </div>
                )}

                <div
                    style={{
                        fontSize: isPassageCard ? 15 : 20,
                        lineHeight: isPassageCard ? 1.8 : 1.7,
                        fontWeight: isPassageCard ? 400 : 600,
                        marginBottom: 18,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                        minWidth: 0,
                        width: "100%",
                        color: isPassageCard ? "#94a3b8" : "#e5e7eb",
                    }}
                >
                    {visibleQuestionText}
                </div>

                {isPassageCard && (
                    <div
                        style={{
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            display: "flex",
                            gap: 10,
                        }}
                    >
                        <button type="button" onClick={onPrev} disabled={isFirst} style={navBtn(isFirst)}>
                            Previous
                        </button>
                        <button type="button" onClick={onNext} disabled={isLast} style={primaryNextBtn(isLast)}>
                            Next →
                        </button>
                    </div>
                )}

                {!isPassageCard && (
                    <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
                        {optionKeys(safeCurrentQuestion).map((key) => {
                            const active = selectedOption === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => {
                                        if (currentQid) onSelectOption(currentQid, key);
                                    }}
                                    style={{
                                        textAlign: "left",
                                        width: "100%",
                                        minWidth: 0,
                                        padding: "14px 16px",
                                        borderRadius: 14,
                                        border: active
                                            ? "1px solid rgba(99,102,241,0.95)"
                                            : "1px solid rgba(255,255,255,0.08)",
                                        background: active
                                            ? "rgba(99,102,241,0.18)"
                                            : "rgba(255,255,255,0.03)",
                                        color: "#e5e7eb",
                                        cursor: "pointer",
                                        overflowWrap: "break-word",
                                        wordBreak: "break-word",
                                        whiteSpace: "pre-wrap",
                                        transition: "all 0.16s ease",
                                    }}
                                >
                                    <div style={{ fontWeight: 800, marginBottom: 6 }}>{key}</div>
                                    <div
                                        style={{
                                            lineHeight: 1.6,
                                            overflowWrap: "break-word",
                                            wordBreak: "break-word",
                                            whiteSpace: "pre-wrap",
                                        }}
                                    >
                                        {normalizedOptions[key]}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {!isPassageCard && (
                    <div
                        style={{
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            display: "grid",
                            gap: 14,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.45 }}>
                                Confidence
                            </div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {["sure", "unsure", "guess"].map((level) => {
                                    const active = selectedConfidence === level;
                                    const tone = getConfidenceTone(level, active);
                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => {
                                                if (currentQid) onSetConfidence(currentQid, level);
                                            }}
                                            style={{
                                                height: 38,
                                                borderRadius: 999,
                                                padding: "0 14px",
                                                fontWeight: 800,
                                                cursor: "pointer",
                                                textTransform: "capitalize",
                                                ...tone,
                                            }}
                                        >
                                            {level}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", minHeight: 16 }}>
                                {selectedConfidence === "guess" && "⚠️ Marked as guess — treat this as a risky attempt."}
                                {selectedConfidence === "unsure" && "🤔 Marked as unsure — use elimination carefully before moving on."}
                                {selectedConfidence === "sure" && "✅ Marked as sure — confirm all statements before you proceed."}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.45 }}>
                                Actions
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <button type="button" onClick={onPrev} disabled={isFirst} style={navBtn(isFirst)}>
                                        Previous
                                    </button>
                                    {!isLast && (
                                        <button type="button" onClick={onNext} style={primaryNextBtn(false)}>
                                            Next →
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginLeft: "auto" }}>
                                    {!isLast && (
                                        <button type="button" onClick={() => setShowSubmitConfirm(true)} style={submitInlineBtnStyle}>
                                            Review & Submit
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (currentQid) onClearOption(currentQid);
                                        }}
                                        style={clearBtnStyle(selectedOption)}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* On the last question: prominent full-width submit CTA */}
                            {isLast && (
                                <button
                                    type="button"
                                    onClick={() => setShowSubmitConfirm(true)}
                                    style={{
                                        marginTop: 16,
                                        width: "100%",
                                        height: 52,
                                        borderRadius: 14,
                                        border: "1px solid rgba(34,197,94,0.55)",
                                        background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(16,185,129,0.18))",
                                        color: "#86efac",
                                        fontWeight: 900,
                                        fontSize: 16,
                                        cursor: "pointer",
                                        letterSpacing: "0.04em",
                                        boxShadow: "0 8px 24px rgba(34,197,94,0.18)",
                                    }}
                                >
                                    ✓ Review & Submit Test
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Inline submit confirm — appears in main content where user is already looking */}
                {!isPassageCard && showSubmitConfirm && (
                    <div
                        ref={confirmRef}
                        style={{
                            marginTop: 16,
                            borderRadius: 16,
                            border: "1px solid rgba(245,158,11,0.30)",
                            background: "linear-gradient(135deg, rgba(120,53,15,0.18), rgba(180,83,9,0.10))",
                            padding: "18px 20px",
                        }}
                    >
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#fef3c7", marginBottom: 6 }}>
                            Confirm Submission
                        </div>
                        <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.65, marginBottom: 16 }}>
                            You answered <strong style={{ color: "#fde68a" }}>{answeredQuestionCount}</strong> of{" "}
                            <strong style={{ color: "#fde68a" }}>{totalAnswerable || safeQuestions.length}</strong> questions.
                            {sureCount || unsureCount || guessCount
                                ? ` Confidence — Sure: ${sureCount}, Unsure: ${unsureCount}, Guess: ${guessCount}.`
                                : ""}
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => setShowSubmitConfirm(false)}
                                style={{ ...navBtn(false), flex: 1 }}
                            >
                                Go Back
                            </button>
                            <button
                                type="button"
                                onClick={onSubmit}
                                style={{
                                    ...navBtn(false),
                                    flex: 1,
                                    border: "1px solid rgba(16,185,129,0.45)",
                                    background: "linear-gradient(135deg, rgba(16,185,129,0.24), rgba(34,197,94,0.18))",
                                    color: "#d1fae5",
                                    fontWeight: 900,
                                }}
                            >
                                ✓ Final Submit
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const pillStyle = {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 12,
    fontWeight: 700,
};

const subtlePillStyle = {
    ...pillStyle,
    color: "#94a3b8",
    background: "rgba(148,163,184,0.06)",
};

const iconBtnStyle = {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 800,
};

const iconActionBtnStyle = {
    height: 36,
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(14,165,233,0.12)",
    color: "#bae6fd",
    padding: "0 12px",
    fontWeight: 800,
    cursor: "pointer",
};


const drawerStatCardStyle = {
    borderRadius: 12,
    padding: "12px 10px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    textAlign: "center",
};

const drawerStatValueStyle = {
    fontSize: 20,
    fontWeight: 800,
    color: "#e5e7eb",
};

const drawerStatLabelStyle = {
    marginTop: 4,
    fontSize: 11,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.4,
};

function navBtn(disabled) {
    return {
        height: 42,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
        color: disabled ? "rgba(229,231,235,0.4)" : "#e5e7eb",
        padding: "0 14px",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
    };
}

function clearBtnStyle(hasSelection) {
    return {
        height: 34,
        borderRadius: 8,
        border: hasSelection ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(239,68,68,0.18)",
        background: hasSelection ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.05)",
        color: hasSelection ? "#fca5a5" : "#7f1d1d",
        padding: "0 10px",
        fontWeight: 700,
        fontSize: 12,
        cursor: "pointer",
    };
}

const submitInlineBtnStyle = {
    height: 42,
    borderRadius: 10,
    border: "1px solid rgba(34,197,94,0.45)",
    background: "rgba(34,197,94,0.14)",
    color: "#86efac",
    padding: "0 18px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
};

function primaryNextBtn(disabled) {
    return {
        height: 46,
        borderRadius: 12,
        border: disabled ? "1px solid rgba(56,189,248,0.12)" : "1px solid rgba(56,189,248,0.42)",
        background: disabled
            ? "rgba(56,189,248,0.06)"
            : "linear-gradient(135deg, rgba(14,165,233,0.30), rgba(99,102,241,0.28))",
        color: disabled ? "rgba(186,230,253,0.45)" : "#f0f9ff",
        padding: "0 22px",
        fontWeight: 900,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "0 10px 24px rgba(56,189,248,0.16)",
    };
}
