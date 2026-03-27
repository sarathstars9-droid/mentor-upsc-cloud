import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { BACKEND_URL } from "../config";
import PyqTopicHeader from "../components/pyq/PyqTopicHeader";
import PyqControlBar from "../components/pyq/PyqControlBar";
import PyqQuickView from "../components/pyq/PyqQuickView";
import PyqAnalysisView from "../components/pyq/PyqAnalysisView";

function getPyqProgressKey(syllabusNodeId) {
    return `pyq_progress_${syllabusNodeId}`;
}

function loadPyqProgress(syllabusNodeId) {
    try {
        const raw = localStorage.getItem(getPyqProgressKey(syllabusNodeId));
        if (!raw) {
            return {
                readIds: [],
                weakIds: [],
                importantIds: [],
            };
        }

        const parsed = JSON.parse(raw);
        return {
            readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
            weakIds: Array.isArray(parsed.weakIds) ? parsed.weakIds : [],
            importantIds: Array.isArray(parsed.importantIds) ? parsed.importantIds : [],
        };
    } catch {
        return {
            readIds: [],
            weakIds: [],
            importantIds: [],
        };
    }
}

function savePyqProgress(syllabusNodeId, progress) {
    try {
        localStorage.setItem(
            getPyqProgressKey(syllabusNodeId),
            JSON.stringify({
                readIds: Array.isArray(progress.readIds) ? progress.readIds : [],
                weakIds: Array.isArray(progress.weakIds) ? progress.weakIds : [],
                importantIds: Array.isArray(progress.importantIds) ? progress.importantIds : [],
            })
        );
    } catch {
        // ignore localStorage errors
    }
}

function getTrendLabel(years) {
    const ys = [...new Set((years || []).filter(Boolean))].sort((a, b) => a - b);
    if (!ys.length) return "No Recent Signal";

    const lastYear = ys[ys.length - 1];
    const total = ys.length;

    if (lastYear >= 2024) return "Recently Active";
    if (lastYear >= 2020) return "Moderately Active";
    if (total >= 8) return "Consistent UPSC Presence";
    if (total >= 4) return "Stable";
    return "Low Activity";
}

function getWeightageLabel(total) {
    if (total >= 50) return "High Yield";
    if (total >= 15) return "Medium Yield";
    if (total > 0) return "Low Yield";
    return "No PYQs";
}

function titleCase(text = "") {
    return String(text)
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function humanizeNodeId(nodeId = "") {
    if (!nodeId) {
        return {
            subject: "Unknown",
            topicName: "PYQ Topic",
            parentTopic: "Syllabus",
        };
    }

    const parts = String(nodeId).split("-").filter(Boolean);

    const subjectMap = {
        GS1: "GS1",
        GS2: "GS2",
        GS3: "GS3",
        GS4: "GS4",
        CSAT: "CSAT",
        ESSAY: "Essay",
        OPTIONAL: "Optional",
        OPT: "Optional",
    };

    const secondMap = {
        POL: "Polity",
        ECO: "Economy",
        GEO: "Geography",
        HIS: "History",
        ENV: "Environment",
        SCI: "Science",
        ST: "Science & Technology",
        ETH: "Ethics",
        BN: "Basic Numeracy",
        RC: "Reading Comprehension",
        LR: "Logical Reasoning",
    };

    const thirdMap = {
        NS: "Number System",
        PERCENTAGE: "Percentage",
        RATIO: "Ratio and Proportion",
        AVERAGE: "Average",
        SI_CI: "Simple and Compound Interest",
        PROFIT_LOSS: "Profit and Loss",
        TIME_WORK: "Time and Work",
        TIME_DISTANCE: "Time Speed Distance",
        LCM_HCF: "LCM and HCF",
    };

    const subject = subjectMap[parts[0]] || parts[0] || "Unknown";
    const parentTopic = secondMap[parts[1]] || titleCase((parts[1] || "").replace(/_/g, " "));

    const topicCode = parts.slice(2).join("_");
    const topicName =
        thirdMap[topicCode] ||
        thirdMap[parts[2]] ||
        titleCase(parts.slice(2).join(" ").replace(/_/g, " "));

    return {
        subject,
        parentTopic: parentTopic || "Syllabus",
        topicName: topicName || nodeId,
    };
}

function getMicroTheme(raw = {}) {
    return (
        raw.microTheme ||
        raw.micro_theme ||
        raw.mappedTopicName ||
        raw.mapped_topic_name ||
        raw.subtopic ||
        raw.topic ||
        raw.themeLabel ||
        raw.subject ||
        ""
    );
}

function normalizeQuestion(raw = {}) {
    const questionText =
        raw.questionText ||
        raw.question_text ||
        raw.question ||
        raw.fullQuestion ||
        raw.questionStem ||
        raw.stem ||
        raw.body ||
        raw.text ||
        raw.passageText ||
        raw.title ||
        "Question text not available";

    const stageRaw = String(raw.stage || raw.exam || "").toLowerCase();
    const paperRaw = String(raw.paper || "").toLowerCase();
    const id = String(raw.id || "").trim().toUpperCase();

    let paper = "prelims";

    // 1) Stage/exam field if explicitly present
    if (stageRaw.includes("main")) {
        paper = "mains";
    } else if (stageRaw.includes("essay")) {
        paper = "essay";
    } else if (stageRaw.includes("ethic")) {
        paper = "ethics";
    } else if (stageRaw.includes("optional")) {
        paper = "optional";
    } else if (stageRaw.includes("csat")) {
        paper = "csat";
    }

    // 2) ID has stronger priority than paper field
    else if (id.startsWith("PRE_CSAT_") || id.startsWith("CSAT_")) {
        paper = "csat";
    } else if (id.startsWith("PRE_")) {
        paper = "prelims";
    } else if (id.startsWith("MAIN_") || id.startsWith("MAINS_")) {
        paper = "mains";
    } else if (/^GS[1-4]_/.test(id)) {
        paper = id.startsWith("GS4_") ? "ethics" : "mains";
    } else if (id.startsWith("ESSAY_")) {
        paper = "essay";
    } else if (id.startsWith("ETH_")) {
        paper = "ethics";
    } else if (id.startsWith("OPT_")) {
        paper = "optional";
    }

    // 3) Paper field only as a last fallback
    else if (paperRaw === "prelims") {
        paper = "prelims";
    } else if (paperRaw === "mains") {
        paper = "mains";
    } else if (paperRaw === "essay") {
        paper = "essay";
    } else if (paperRaw === "ethics" || paperRaw === "gs4") {
        paper = "ethics";
    } else if (paperRaw === "optional" || paperRaw.includes("optional")) {
        paper = "optional";
    } else if (paperRaw === "csat") {
        paper = "csat";
    }

    // IMPORTANT:
    // Do NOT map gs1/gs2/gs3 directly to prelims here.
    // In your dataset, prelims and mains can both carry gs1/gs2/gs3-like labels.
    // ID/stage must decide first.

    const microTheme = getMicroTheme(raw);

    const questionNumber =
        raw.questionNumber ??
        raw.question_number ??
        raw.qno ??
        raw.questionNo ??
        raw.question_no ??
        raw.number ??
        raw.q_num ??
        raw.serialNo ??
        raw.serial_no ??
        raw.questionIndex ??
        raw.question_index ??
        null;

    const options =
        Array.isArray(raw.options) ? raw.options :
            Array.isArray(raw.choices) ? raw.choices :
                Array.isArray(raw.mcqOptions) ? raw.mcqOptions :
                    Array.isArray(raw.answers) ? raw.answers :
                        Array.isArray(raw.answerOptions) ? raw.answerOptions :
                            Array.isArray(raw.answer_choices) ? raw.answer_choices :
                                Array.isArray(raw?.mcq?.options) ? raw.mcq.options :
                                    Array.isArray(raw?.question?.options) ? raw.question.options :
                                        raw.options && typeof raw.options === "object" ? [
                                            raw.options.a,
                                            raw.options.b,
                                            raw.options.c,
                                            raw.options.d,
                                        ].filter(Boolean) :
                                            raw.optionA || raw.optionB || raw.optionC || raw.optionD ? [
                                                raw.optionA,
                                                raw.optionB,
                                                raw.optionC,
                                                raw.optionD,
                                            ].filter(Boolean) :
                                                raw.a || raw.b || raw.c || raw.d ? [
                                                    raw.a,
                                                    raw.b,
                                                    raw.c,
                                                    raw.d,
                                                ].filter(Boolean) :
                                                    [];

    return {
        ...raw,
        id: raw.id || `${paper}-${raw.year || "na"}-${Math.random().toString(36).slice(2, 8)}`,
        year: Number(raw.year) || null,
        paper,
        questionNumber: questionNumber != null ? String(questionNumber) : "",
        options,
        answer: raw.answer || raw.correctAnswer || raw.correct_answer || raw.answerKey || "",
        questionText,
        themeId: raw.themeId || raw.syllabusNodeId || "theme_general",
        themeLabel: raw.themeLabel || raw.subject || raw.section || "General",
        subtopic: raw.subtopic || raw.topic || raw.subject || raw.section || "",
        microTheme,
        nature: raw.nature || "general",
        difficulty: raw.difficulty || "moderate",
        linkedQuestionIds: Array.isArray(raw.linkedQuestionIds) ? raw.linkedQuestionIds : [],
    };
}

function buildThemes(questions) {
    const map = new Map();

    for (const q of questions) {
        const key = q.themeId || q.themeLabel || q.subtopic || "theme_general";
        const label = q.themeLabel || q.subtopic || "General";

        if (!map.has(key)) {
            map.set(key, { id: key, label, count: 0 });
        }

        map.get(key).count += 1;
    }

    return [...map.values()].sort((a, b) => b.count - a.count);
}

function buildTimeline(questions) {
    const map = new Map();

    for (const q of questions) {
        const year = Number(q.year);
        if (!year) continue;

        if (!map.has(year)) {
            map.set(year, { year, count: 0, patternLabel: "Asked in this year" });
        }

        map.get(year).count += 1;
    }

    return [...map.values()].sort((a, b) => a.year - b.year);
}

function buildLinkedQuestionsMap(questions) {
    const byTheme = new Map();

    for (const q of questions) {
        const key = q.themeId || "theme_general";
        if (!byTheme.has(key)) byTheme.set(key, []);
        byTheme.get(key).push(q);
    }

    const result = {};

    for (const q of questions) {
        const siblings =
            byTheme
                .get(q.themeId || "theme_general")
                ?.filter((item) => item.id !== q.id)
                ?.slice(0, 3) || [];

        result[q.id] = siblings.map((item) => ({
            id: item.id,
            year: item.year,
            paper: item.paper,
            reason: "same theme",
        }));
    }

    return result;
}

function buildSummary(questions, countsFromApi = null) {
    const total = countsFromApi?.total ?? questions.length;
    const prelims = countsFromApi?.prelims ?? questions.filter((q) => q.paper === "prelims").length;
    const mains = countsFromApi?.mains ?? questions.filter((q) => q.paper === "mains").length;

    const years = questions.map((q) => Number(q.year)).filter(Boolean);

    const yearFreq = {};
    for (const q of questions) {
        if (q.year) {
            yearFreq[q.year] = (yearFreq[q.year] || 0) + 1;
        }
    }

    const peakYears = Object.entries(yearFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([year]) => Number(year));

    return {
        total,
        prelims,
        mains,
        peakYears,
        trendLabel: getTrendLabel(years),
        natureSplit: {
            static: total,
            currentLinked: 0,
        },
        difficultySplit: {
            easy: 0,
            moderate: total,
            tough: 0,
        },
    };
}

function getQuickActionMeta(progress, questionId) {
    return {
        isRead: progress.readIds.includes(questionId),
        isWeak: progress.weakIds.includes(questionId),
        isImportant: progress.importantIds.includes(questionId),
    };
}

function sortQuestions(items, sortMode) {
    const copy = [...items];

    if (sortMode === "latest") {
        return copy.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    if (sortMode === "oldest") {
        return copy.sort((a, b) => (a.year || 0) - (b.year || 0));
    }

    if (sortMode === "random") {
        return copy.sort(() => Math.random() - 0.5);
    }

    return copy;
}

export default function PyqTopicPage() {
    const { syllabusNodeId } = useParams();

    const [paperFilter, setPaperFilter] = useState("both");
    const [viewMode, setViewMode] = useState("quick");
    const [sortMode, setSortMode] = useState("latest");
    const [selectedTheme, setSelectedTheme] = useState("all");
    const [timelineMode, setTimelineMode] = useState("normal");
    const [selectedYear, setSelectedYear] = useState("all");

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [apiCounts, setApiCounts] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [progress, setProgress] = useState({
        readIds: [],
        weakIds: [],
        importantIds: [],
    });

    useEffect(() => {
        let ignore = false;

        async function loadPyqs() {
            if (!syllabusNodeId) {
                setLoading(false);
                setLoadError("Missing syllabus node id.");
                setQuestions([]);
                return;
            }

            try {
                setLoading(true);
                setLoadError("");

                const res = await fetch(
                    `${BACKEND_URL}/api/pyq/node/${encodeURIComponent(syllabusNodeId)}`
                );
                const data = await res.json();

                if (ignore) return;

                if (!data?.success) {
                    setQuestions([]);
                    setApiCounts(null);
                    setLoadError(data?.message || "Failed to load PYQs.");
                    return;
                }

                const normalized = Array.isArray(data.questions)
                    ? data.questions.map(normalizeQuestion)
                    : [];

                setQuestions(normalized);
                setApiCounts(data.counts || null);
            } catch (err) {
                if (ignore) return;
                console.error("Failed to load PYQ topic page:", err);
                setQuestions([]);
                setApiCounts(null);
                setLoadError("Could not load PYQ data.");
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        loadPyqs();

        return () => {
            ignore = true;
        };
    }, [syllabusNodeId]);

    useEffect(() => {
        if (!syllabusNodeId) return;
        const stored = loadPyqProgress(syllabusNodeId);
        setProgress(stored);
    }, [syllabusNodeId]);

    useEffect(() => {
        if (!syllabusNodeId) return;
        savePyqProgress(syllabusNodeId, progress);
    }, [syllabusNodeId, progress]);

    useEffect(() => {
        if (viewMode !== "quick" && timelineMode !== "normal") {
            setTimelineMode("normal");
        }
    }, [viewMode, timelineMode]);

    useEffect(() => {
        setSelectedYear("all");
    }, [paperFilter, selectedTheme, syllabusNodeId]);

    const meta = useMemo(() => humanizeNodeId(syllabusNodeId), [syllabusNodeId]);

    const themes = useMemo(() => buildThemes(questions), [questions]);
    const timeline = useMemo(() => buildTimeline(questions), [questions]);
    const linkedQuestionsMap = useMemo(() => buildLinkedQuestionsMap(questions), [questions]);
    const summary = useMemo(() => buildSummary(questions, apiCounts), [questions, apiCounts]);

    const filteredQuestions = useMemo(() => {
        let items = [...questions];

        if (paperFilter !== "both") {
            items = items.filter((q) => q.paper === paperFilter);
        }

        if (selectedTheme !== "all") {
            items = items.filter((q) => q.themeId === selectedTheme);
        }

        if (selectedYear !== "all") {
            items = items.filter((q) => Number(q.year) === Number(selectedYear));
        }

        return sortQuestions(items, sortMode);
    }, [questions, paperFilter, selectedTheme, selectedYear, sortMode]);

    const pyqInsight = useMemo(() => {
        const years = filteredQuestions.map((q) => Number(q.year)).filter(Boolean);

        const total = filteredQuestions.length;
        const lastAsked = years.length ? Math.max(...years) : null;
        const firstAsked = years.length ? Math.min(...years) : null;

        return {
            total,
            firstAsked,
            lastAsked,
            trend: getTrendLabel(years),
            weightage: getWeightageLabel(total),
        };
    }, [filteredQuestions]);

    const viewedCount = useMemo(() => {
        const visibleIds = new Set(filteredQuestions.map((q) => q.id));
        return progress.readIds.filter((id) => visibleIds.has(id)).length;
    }, [filteredQuestions, progress.readIds]);

    const quickViewQuestions = useMemo(() => {
        return filteredQuestions.map((q) => ({
            ...q,
            ...getQuickActionMeta(progress, q.id),
        }));
    }, [filteredQuestions, progress]);

    const topic = useMemo(() => {
        return {
            syllabusNodeId: syllabusNodeId || "",
            subject: meta.subject,
            topicName: meta.topicName,
            parentTopic: meta.parentTopic,
            totalQuestions: summary.total || questions.length,
            viewedCount,
            visibleCount: filteredQuestions.length,
        };
    }, [syllabusNodeId, meta, summary.total, questions.length, viewedCount, filteredQuestions.length]);

    function toggleRead(questionId) {
        setProgress((prev) => {
            const exists = prev.readIds.includes(questionId);
            return {
                ...prev,
                readIds: exists
                    ? prev.readIds.filter((id) => id !== questionId)
                    : [...prev.readIds, questionId],
            };
        });
    }

    function toggleWeak(questionId) {
        setProgress((prev) => {
            const exists = prev.weakIds.includes(questionId);
            return {
                ...prev,
                weakIds: exists
                    ? prev.weakIds.filter((id) => id !== questionId)
                    : [...prev.weakIds, questionId],
            };
        });
    }

    function toggleImportant(questionId) {
        setProgress((prev) => {
            const exists = prev.importantIds.includes(questionId);
            return {
                ...prev,
                importantIds: exists
                    ? prev.importantIds.filter((id) => id !== questionId)
                    : [...prev.importantIds, questionId],
            };
        });
    }

    const progressPercent =
        filteredQuestions.length > 0
            ? Math.round((viewedCount / filteredQuestions.length) * 100)
            : 0;

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "linear-gradient(180deg, #0f172a 0%, #111827 45%, #0b1220 100%)",
                color: "#e5e7eb",
                padding: "24px",
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                }}
            >
                <PyqTopicHeader topic={topic} />

                <PyqControlBar
                    paperFilter={paperFilter}
                    setPaperFilter={setPaperFilter}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    sortMode={sortMode}
                    setSortMode={setSortMode}
                />

                {!loading && !loadError && (
                    <div
                        style={{
                            marginTop: -2,
                            marginBottom: -2,
                            padding: "16px 18px",
                            borderRadius: 20,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background:
                                "linear-gradient(180deg, rgba(18,30,60,0.92) 0%, rgba(11,20,40,0.92) 100%)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                flexWrap: "wrap",
                                marginBottom: 12,
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        color: "rgba(180, 205, 255, 0.75)",
                                        marginBottom: 6,
                                        fontWeight: 700,
                                    }}
                                >
                                    🔥 PYQ Insight
                                </div>
                                <div
                                    style={{
                                        fontSize: 14,
                                        color: "rgba(255,255,255,0.88)",
                                    }}
                                >
                                    System teaches pattern, not just questions.
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 14,
                                    border: "1px solid rgba(90,140,255,0.28)",
                                    background: "rgba(90,140,255,0.10)",
                                    minWidth: 170,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        textTransform: "uppercase",
                                        color: "rgba(180,205,255,0.72)",
                                        marginBottom: 4,
                                        fontWeight: 700,
                                        letterSpacing: "0.08em",
                                    }}
                                >
                                    Reading progress
                                </div>

                                <div
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 800,
                                        color: "#ffffff",
                                        marginBottom: 10,
                                    }}
                                >
                                    Progress {progressPercent}% ({viewedCount} / {filteredQuestions.length})
                                </div>

                                <div
                                    style={{
                                        height: 6,
                                        borderRadius: 999,
                                        background: "rgba(255,255,255,0.08)",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: `${progressPercent}%`,
                                            height: "100%",
                                            background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)",
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                                gap: 12,
                            }}
                        >
                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 14,
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "rgba(180,205,255,0.72)",
                                        textTransform: "uppercase",
                                        marginBottom: 4,
                                    }}
                                >
                                    Frequency
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                                    {pyqInsight.total}
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 14,
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "rgba(180,205,255,0.72)",
                                        textTransform: "uppercase",
                                        marginBottom: 4,
                                    }}
                                >
                                    Last Asked
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                                    {pyqInsight.lastAsked || "—"}
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 14,
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "rgba(180,205,255,0.72)",
                                        textTransform: "uppercase",
                                        marginBottom: 4,
                                    }}
                                >
                                    Trend
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                                    {pyqInsight.trend}
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "12px 14px",
                                    borderRadius: 14,
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        color: "rgba(180,205,255,0.72)",
                                        textTransform: "uppercase",
                                        marginBottom: 4,
                                    }}
                                >
                                    Weightage
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                                    {pyqInsight.weightage}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div
                        style={{
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)",
                            borderRadius: 18,
                            padding: "24px",
                            color: "#cbd5e1",
                            fontSize: 16,
                        }}
                    >
                        Loading PYQs...
                    </div>
                ) : loadError ? (
                    <div
                        style={{
                            border: "1px solid rgba(248,113,113,0.25)",
                            background: "rgba(127,29,29,0.20)",
                            borderRadius: 18,
                            padding: "24px",
                            color: "#fecaca",
                            fontSize: 16,
                        }}
                    >
                        {loadError}
                    </div>
                ) : viewMode === "quick" ? (
                    <PyqQuickView
                        questions={quickViewQuestions}
                        total={topic.totalQuestions}
                        viewedCount={viewedCount}
                        timelineMode={timelineMode}
                        setTimelineMode={setTimelineMode}
                        selectedYear={selectedYear}
                        setSelectedYear={setSelectedYear}
                        onToggleRead={toggleRead}
                        onToggleWeak={toggleWeak}
                        onToggleImportant={toggleImportant}
                    />
                ) : (
                    <PyqAnalysisView
                        summary={summary}
                        themes={themes}
                        timeline={timeline}
                        questions={filteredQuestions}
                        selectedTheme={selectedTheme}
                        setSelectedTheme={setSelectedTheme}
                        linkedQuestionsMap={linkedQuestionsMap}
                    />
                )}
            </div>
        </div>
    );
}
