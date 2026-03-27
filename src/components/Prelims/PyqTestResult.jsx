function groupCounts(items, keyName, mode) {
    const map = new Map();

    for (const item of items || []) {
        const key = item?.[keyName];
        if (!key) continue;

        if (!map.has(key)) {
            map.set(key, { label: key, correct: 0, wrong: 0, unattempted: 0, painScore: 0 });
        }

        const row = map.get(key);
        row[item.status] += 1;
        row.painScore = row.wrong * 2 + row.unattempted;
    }

    const arr = Array.from(map.values());

    if (mode === "weak") {
        return arr
            .filter((x) => x.wrong > 0 || x.unattempted > 0)
            .sort((a, b) => b.painScore - a.painScore)
            .slice(0, 5);
    }

    return arr
        .filter((x) => x.correct > 0)
        .sort((a, b) => b.correct - a.correct)
        .slice(0, 5);
}

function getResultHeading(result) {
    if (result?.mode === "full_length") {
        const paper = result?.paperType || "PYQ";
        const variant = result?.variant === "mixed" ? "Mixed" : result?.year || "Year-wise";
        return `${paper} Full-Length ${variant}`.trim();
    }

    return `PYQ Test #${result?.testNumber || ""}`.trim();
}

export default function PyqTestResult({ result, onRestart, onReattempt }) {
    if (!result) {
        return (
            <div
                style={{
                    padding: 20,
                    borderRadius: 12,
                    background: "rgba(255,0,0,0.1)",
                    border: "1px solid rgba(255,0,0,0.2)",
                    color: "#ff6b6b",
                    fontWeight: 600,
                }}
            >
                Result not found. Please submit the test again.
            </div>
        );
    }

    const safeResult = result || {};
    const summary = safeResult.summary || {};
    const questions = safeResult.questions || [];
    const label = safeResult.label || "";
    const prescription = safeResult.prescription || {};
    const grouped = safeResult.grouped || {};

    const weakNodes = grouped?.weakNodes?.length ? grouped.weakNodes : groupCounts(questions, "syllabusNodeId", "weak");
    const weakThemes = grouped?.weakThemes?.length ? grouped.weakThemes : groupCounts(questions, "microThemeLabel", "weak");
    const strongNodes = grouped?.strongNodes?.length ? grouped.strongNodes : groupCounts(questions, "syllabusNodeId", "strong");
    const weakQuestionTypes = grouped?.weakQuestionTypes || groupCounts(questions, "questionType", "weak");

    const riskTone =
        summary.riskTendency === "high"
            ? "High Risk"
            : summary.riskTendency === "medium"
                ? "Medium Risk"
                : "Low Risk";

    const attemptTone =
        summary.attemptQuality === "over-risky"
            ? "Over-Risky Attempt"
            : summary.attemptQuality === "over-cautious"
                ? "Over-Cautious Attempt"
                : summary.attemptQuality === "controlled"
                    ? "Controlled Attempt"
                    : "Balanced Attempt";

    return (
        <div style={{ display: "grid", gap: 18 }}>
            <div style={cardMain}>
                <div style={{ fontSize: 14, opacity: 0.75 }}>RESULT</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{getResultHeading(result)}</div>
                <div style={{ fontSize: 14, opacity: 0.8 }}>{label}</div>
                <div style={{ fontSize: 13, marginTop: 6, opacity: 0.8 }}>Attempt #{result?.reattemptNumber || 1}</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <Badge text={riskTone} />
                    <Badge text={attemptTone} />
                    <Badge text={`Accuracy ${summary.accuracy ?? 0}%`} />
                    <Badge text={`Elimination ${summary.eliminationSuccessRate ?? 0}%`} />
                </div>

                <div style={grid6}>
                    <StatCard title="Score" value={`${summary.score ?? 0}/${summary.total ?? 0}`} />
                    <StatCard title="Accuracy" value={`${summary.accuracy ?? 0}%`} />
                    <StatCard title="Correct" value={summary.correct ?? 0} />
                    <StatCard title="Wrong" value={summary.wrong ?? 0} />
                    <StatCard title="Skipped" value={summary.unattempted ?? 0} />
                    <StatCard title="Attempted" value={summary.attempted ?? 0} />
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18 }}>
                <div style={{ display: "grid", gap: 18 }}>
                    <SectionCard title="Behaviour Intelligence">
                        <div style={grid2}>
                            <MiniStatCard title="Safe Attempts" value={summary.safeAttempts ?? 0} />
                            <MiniStatCard title="Cautious Attempts" value={summary.cautiousAttempts ?? 0} />
                            <MiniStatCard title="Risky Attempts" value={summary.riskyAttempts ?? 0} />
                            <MiniStatCard title="Changed Answers" value={summary.changedAnswers ?? 0} />
                            <MiniStatCard title="Safe Accuracy" value={`${summary.safeAccuracy ?? 0}%`} />
                            <MiniStatCard title="Risky Accuracy" value={`${summary.riskyAccuracy ?? 0}%`} />
                            <MiniStatCard title="Guess Rate" value={`${summary.guessRate ?? 0}%`} />
                            <MiniStatCard title="Elimination Success" value={`${summary.eliminationSuccessRate ?? 0}%`} />
                        </div>
                    </SectionCard>

                    <SectionCard title="Trap Insight">
                        <div style={grid2}>
                            <MiniStatCard title="Overconfidence" value={summary.overconfidenceTrapCount ?? 0} />
                            <MiniStatCard title="Blind Guess" value={summary.blindGuessTrapCount ?? 0} />
                            <MiniStatCard title="Elimination Failure" value={summary.eliminationFailureCount ?? 0} />
                            <MiniStatCard title="Answer Switch" value={summary.answerSwitchTrapCount ?? 0} />
                            <MiniStatCard title="Knowledge Gap" value={summary.knowledgeGapCount ?? 0} />
                            <MiniStatCard title="Extreme Words" value={summary.extremeWordTrapCount ?? 0} />
                            <MiniStatCard title="Partial Truth" value={summary.partialTruthTrapCount ?? 0} />
                            <MiniStatCard title="Static-Current" value={summary.staticCurrentConfusionCount ?? 0} />
                        </div>
                        <div style={patternBox}>
                            {summary.topTrapType
                                ? `Top trap detected: ${String(summary.topTrapType).replaceAll("_", " ")}`
                                : "No dominant trap yet. More attempts will sharpen the pattern engine."}
                        </div>
                    </SectionCard>

                    <SectionCard title="Weak Areas">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <InsightCard
                                title="Weak Nodes"
                                items={weakNodes}
                                emptyText="No weak nodes detected yet."
                                renderItem={(item) => (
                                    <>
                                        <strong>{item.label}</strong> — Wrong: {item.wrong}, Skipped: {item.unattempted}
                                    </>
                                )}
                            />

                            <InsightCard
                                title="Weak Themes"
                                items={weakThemes}
                                emptyText="No weak themes detected yet."
                                renderItem={(item) => (
                                    <>
                                        <strong>{item.label}</strong> — Wrong: {item.wrong}, Skipped: {item.unattempted}
                                    </>
                                )}
                            />
                        </div>
                    </SectionCard>

                    <SectionCard title="Question-Type Weakness">
                        <InsightCard
                            title="Weak Question Types"
                            items={weakQuestionTypes}
                            emptyText="No question-type weakness yet."
                            renderItem={(item) => (
                                <>
                                    <strong>{item.label}</strong> — Wrong: {item.wrong}, Skipped: {item.unattempted}
                                </>
                            )}
                        />
                    </SectionCard>

                    <SectionCard title="Strong Areas">
                        <InsightCard
                            title="Top Correct Zones"
                            items={strongNodes}
                            emptyText="No strong areas detected yet."
                            renderItem={(item) => (
                                <>
                                    <strong>{item.label}</strong> — Correct: {item.correct}
                                </>
                            )}
                        />
                    </SectionCard>
                </div>

                <div style={{ display: "grid", gap: 18 }}>
                    <SectionCard title="Next Actions">
                        <div style={{ display: "grid", gap: 12 }}>
                            <ActionBlock heading="Priority" items={[prescription?.priority || "No priority generated yet."]} />
                            <ActionBlock heading="Revise" items={prescription?.revise?.length ? prescription.revise : ["No revise action yet."]} />
                            <ActionBlock heading="Practice" items={prescription?.practice?.length ? prescription.practice : ["No practice action yet."]} />
                            <ActionBlock heading="Avoid" items={prescription?.avoid?.length ? prescription.avoid : ["No avoid action yet."]} />
                        </div>
                    </SectionCard>

                    <SectionCard title="System Action">
                        <div style={{ display: "grid", gap: 10 }}>
                            <SystemLine text={`${(summary.wrong ?? 0) + (summary.unattempted ?? 0)} questions added to mistake log`} />
                            <SystemLine text="Weak themes pushed into revision queue" />
                            <SystemLine text="Wrong questions tagged as must_revise" />
                            <SystemLine text="Skipped questions tagged as must_read" />
                        </div>
                    </SectionCard>
                </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={onRestart} style={btn}>
                    Start New Test
                </button>

                <button
                    onClick={() => onReattempt?.(result)}
                    style={{
                        ...btn,
                        background: "#f59e0b",
                    }}
                >
                    Reattempt Same Paper
                </button>
            </div>
        </div>
    );
}

const cardMain = {
    padding: 22,
    borderRadius: 22,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
};

const grid6 = {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 12,
    marginTop: 12,
};

const grid2 = {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
};

const btn = {
    height: 46,
    borderRadius: 14,
    border: "none",
    background: "#6366f1",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 16px",
};

const patternBox = {
    padding: 14,
    borderRadius: 14,
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(99,102,241,0.22)",
    fontSize: 14,
    lineHeight: 1.7,
};

function Badge({ text }) {
    return (
        <span
            style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 12,
                fontWeight: 700,
            }}
        >
            {text}
        </span>
    );
}

function SectionCard({ title, children }) {
    return (
        <div
            style={{
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>
            {children}
        </div>
    );
}

function StatCard({ title, value }) {
    return (
        <div
            style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
        </div>
    );
}

function MiniStatCard({ title, value }) {
    return (
        <div
            style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
        </div>
    );
}

function InsightCard({ title, items, emptyText, renderItem }) {
    return (
        <div
            style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{title}</div>
            {!items?.length ? (
                <div style={{ opacity: 0.7 }}>{emptyText}</div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {items.map((item) => (
                        <div key={item.label} style={{ fontSize: 13, lineHeight: 1.6 }}>
                            {renderItem(item)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ActionBlock({ heading, items }) {
    return (
        <div
            style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{heading}</div>
            <div style={{ display: "grid", gap: 8 }}>
                {items?.map((item, idx) => (
                    <div
                        key={`${heading}_${idx}`}
                        style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            padding: "8px 10px",
                            borderRadius: 10,
                            background: "rgba(255,255,255,0.03)",
                        }}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SystemLine({ text }) {
    return (
        <div
            style={{
                fontSize: 13,
                lineHeight: 1.6,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            {text}
        </div>
    );
}
