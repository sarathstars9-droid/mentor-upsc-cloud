function optionKeys(question) {
    return ["A", "B", "C", "D"].filter((k) => question?.options?.[k]);
}

function getQid(question) {
    return question?.questionId || question?.id || null;
}

function getTestHeading(testMeta) {
    if (!testMeta) return "PYQ Test";

    if (testMeta.mode === "full_length") {
        if (testMeta.paperType === "GS" && testMeta.variant === "yearwise") {
            return `GS Full-Length ${testMeta.year || ""}`.trim();
        }
        if (testMeta.paperType === "CSAT" && testMeta.variant === "yearwise") {
            return `CSAT Full-Length ${testMeta.year || ""}`.trim();
        }
        if (testMeta.paperType === "GS" && testMeta.variant === "mixed") {
            return "GS Mixed Full-Length";
        }
        if (testMeta.paperType === "CSAT" && testMeta.variant === "mixed") {
            return "CSAT Mixed Full-Length";
        }
    }

    if (testMeta.mode === "practice") {
        return "Practice Test";
    }

    return `PYQ Test #${testMeta?.testNumber || ""}`.trim();
}

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
}) {
    const safeQuestions = Array.isArray(questions) ? questions : [];
    const safeCurrentQuestion =
        currentQuestion || safeQuestions[currentIndex] || null;
    const currentQid = getQid(safeCurrentQuestion);

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

    const selectedOption = currentQid ? answersMap[currentQid] || "" : "";
    const selectedConfidence = currentQid ? confidenceMap?.[currentQid] || "" : "";
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === safeQuestions.length - 1;
    const answeredCount = Object.values(answersMap || {}).filter(Boolean).length;

    const sureCount = Object.values(confidenceMap || {}).filter(
        (c) => c === "sure"
    ).length;
    const guessCount = Object.values(confidenceMap || {}).filter(
        (c) => c === "guess"
    ).length;

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "280px minmax(0, 1fr)",
                gap: 20,
                alignItems: "start",
                minWidth: 0,
            }}
        >
            <div
                style={{
                    padding: 16,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    position: "sticky",
                    top: 16,
                    alignSelf: "start",
                    maxHeight: "calc(100vh - 32px)",
                    overflowY: "auto",
                    minWidth: 0,
                }}
            >
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                    {getTestHeading(testMeta)}
                </div>

                <div
                    style={{
                        fontSize: 13,
                        opacity: 0.8,
                        marginBottom: 14,
                        lineHeight: 1.5,
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                    }}
                >
                    {testMeta?.label}
                </div>

                <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
                    Answered: {answeredCount} / {safeQuestions.length}
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 8,
                        marginTop: 12,
                    }}
                >
                    {safeQuestions.map((q, idx) => {
                        if (!q) return null;

                        const qid = getQid(q);
                        if (!qid) return null;

                        const picked = answersMap[qid] || "";
                        const active = idx === currentIndex;
                        const confidence = confidenceMap?.[qid] || "";

                        let bg = "rgba(255,255,255,0.04)";

                        if (picked) {
                            if (confidence === "sure") bg = "rgba(16,185,129,0.25)";
                            else if (confidence === "unsure") bg = "rgba(234,179,8,0.25)";
                            else bg = "rgba(239,68,68,0.25)";
                        }

                        return (
                            <button
                                key={qid || idx}
                                onClick={() => onJumpTo(idx)}
                                style={{
                                    height: 40,
                                    borderRadius: 10,
                                    border: active
                                        ? "1px solid rgba(99,102,241,0.9)"
                                        : "1px solid rgba(255,255,255,0.08)",
                                    background: active ? "rgba(99,102,241,0.28)" : bg,
                                    color: "#e5e7eb",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                }}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={onSubmit}
                    style={{
                        marginTop: 16,
                        width: "100%",
                        height: 44,
                        borderRadius: 12,
                        border: "none",
                        background: "#10b981",
                        color: "white",
                        fontWeight: 800,
                        cursor: "pointer",
                    }}
                >
                    Submit Test
                </button>
            </div>

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
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginBottom: 14,
                        minWidth: 0,
                    }}
                >
                    <span style={pillStyle}>{`Q ${currentIndex + 1} / ${safeQuestions.length}`}</span>
                    {safeCurrentQuestion.year ? (
                        <span style={pillStyle}>{safeCurrentQuestion.year}</span>
                    ) : null}
                    {safeCurrentQuestion.paper ? (
                        <span style={pillStyle}>{safeCurrentQuestion.paper}</span>
                    ) : null}
                    {safeCurrentQuestion.microThemeLabel ? (
                        <span style={pillStyle}>{safeCurrentQuestion.microThemeLabel}</span>
                    ) : null}
                </div>

                <div
                    style={{
                        marginBottom: 14,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: 13,
                    }}
                >
                    Attempted: {answeredCount}/{safeQuestions.length} • Sure: {sureCount} • Guess: {guessCount}
                </div>

                <div
                    style={{
                        fontSize: 20,
                        lineHeight: 1.7,
                        fontWeight: 600,
                        marginBottom: 18,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                        minWidth: 0,
                        width: "100%",
                    }}
                >
                    {safeCurrentQuestion.questionText || "Question text not available."}
                </div>

                <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
                    {optionKeys(safeCurrentQuestion).map((key) => {
                        const active = selectedOption === key;
                        return (
                            <button
                                key={key}
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
                                    {safeCurrentQuestion.options?.[key]}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div style={{ marginTop: 18 }}>
                    <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
                        Confidence
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {["sure", "unsure", "guess"].map((level) => {
                            const active = selectedConfidence === level;

                            return (
                                <button
                                    key={level}
                                    onClick={() => {
                                        if (currentQid) onSetConfidence(currentQid, level);
                                    }}
                                    style={{
                                        height: 36,
                                        borderRadius: 999,
                                        border: active
                                            ? "1px solid rgba(99,102,241,0.95)"
                                            : "1px solid rgba(255,255,255,0.08)",
                                        background: active
                                            ? "rgba(99,102,241,0.18)"
                                            : "rgba(255,255,255,0.04)",
                                        color: "#e5e7eb",
                                        padding: "0 14px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        textTransform: "capitalize",
                                    }}
                                >
                                    {level}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                    {selectedConfidence === "guess" && "⚠️ This is a guess — be careful"}
                    {selectedConfidence === "unsure" &&
                        "🤔 Try eliminating 2 options before answering"}
                    {selectedConfidence === "sure" &&
                        "✅ Confirm all statements before locking"}
                </div>

                <div
                    style={{
                        marginTop: 22,
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                    }}
                >
                    <button onClick={onPrev} disabled={isFirst} style={navBtn(isFirst)}>
                        Previous
                    </button>
                    <button onClick={onNext} disabled={isLast} style={navBtn(isLast)}>
                        Next
                    </button>
                    <button
                        onClick={() => {
                            if (currentQid) onClearOption(currentQid);
                        }}
                        style={{
                            ...navBtn(false),
                            background: "rgba(239,68,68,0.16)",
                            border: "1px solid rgba(239,68,68,0.35)",
                        }}
                    >
                        Clear Answer
                    </button>
                </div>

                <div
                    style={{
                        position: "sticky",
                        bottom: 0,
                        marginTop: 20,
                        paddingTop: 12,
                        background: "#0b1020",
                    }}
                >
                    <button
                        onClick={onSubmit}
                        style={{
                            width: "100%",
                            height: 48,
                            borderRadius: 14,
                            border: "none",
                            background: "#6366f1",
                            color: "white",
                            fontWeight: 800,
                            cursor: "pointer",
                        }}
                    >
                        Submit Test
                    </button>
                </div>
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

function navBtn(disabled) {
    return {
        height: 40,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
        color: disabled ? "rgba(229,231,235,0.4)" : "#e5e7eb",
        padding: "0 14px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
    };
}