import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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

const GENERIC_THEME_VALUES = new Set([
    "", "general", "general topic", "theme_general", "theme general",
    "unmapped", "unmapped_topic", "unmapped topic", "unknown", "unknown topic",
    "misc", "misc-gen", "misc gen", "miscellaneous",
    "other", "others", "na", "n/a", "null", "none",
]);

function isGenericTheme(value) {
    return GENERIC_THEME_VALUES.has(String(value || "").toLowerCase().trim());
}

function getMicroTheme(raw = {}) {
    const candidates = [
        raw.microTheme,
        raw.micro_theme,
        raw.mappedTopicName,
        raw.mapped_topic_name,
        raw.subtopic,
        raw.topic,
        raw.themeLabel,
        raw.subject,
    ];
    for (const v of candidates) {
        if (v && !isGenericTheme(v)) return String(v).trim();
    }
    return "";
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
        themeId: (() => {
            const v = raw.themeId || raw.syllabusNodeId || "";
            return isGenericTheme(v) ? "theme_general" : (v || "theme_general");
        })(),
        themeLabel: (() => {
            // raw.theme covers optional dataset; raw.themeLabel / raw.section cover GS datasets
            const candidates = [raw.themeLabel, raw.theme, raw.section];
            const v = candidates.find(c => c && !isGenericTheme(c));
            return v ? String(v).trim() : "";
        })(),
        subtopic: (() => {
            // raw.subTopic (capital T) covers optional dataset; raw.subtopic / raw.topic cover GS datasets
            const candidates = [raw.subtopic, raw.subTopic, raw.topic];
            const v = candidates.find(c => c && !isGenericTheme(c));
            return v ? String(v).trim() : "";
        })(),
        microTheme,
        nature: raw.nature || "general",
        difficulty: raw.difficulty || "moderate",
        linkedQuestionIds: Array.isArray(raw.linkedQuestionIds) ? raw.linkedQuestionIds : [],
    };
}

function buildThemes(questions) {
    const map = new Map();

    for (const q of questions) {
        // Skip generic/placeholder theme IDs from the filter chips
        const rawKey = q.themeId || q.themeLabel || q.subtopic || "";
        if (!rawKey || isGenericTheme(rawKey)) continue;

        const label = q.themeLabel || q.subtopic || rawKey;
        if (!map.has(rawKey)) {
            map.set(rawKey, { id: rawKey, label, count: 0 });
        }
        map.get(rawKey).count += 1;
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

/**
 * Resolve the practice stage for filtering purposes.
 * Optional paper items are Mains-type content and must match a "mains" filter.
 */
function getPracticeStage(q) {
    const p = String(q.paper || "").toLowerCase();
    if (p === "optional") return "mains";
    return p; // prelims, mains, essay, ethics, csat
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

/** Map stage query param → paper filter value used by PyqControlBar */
function stageToFilter(stage = "") {
    const s = stage.toLowerCase();
    if (s === "prelims") return "prelims";
    if (s === "mains")   return "mains";
    if (s === "essay")   return "essay";
    if (s === "ethics")  return "ethics";
    if (s === "csat")    return "csat";
    return "both";
}

/** Map GS paper → broadest valid backend node for that paper */
function paperToFetchNode(paper = "", stage = "") {
    const p = paper.toUpperCase().trim();
    const s = stage.toLowerCase().trim();

    // Explicit paper codes — always prefer these
    if (p === "GS1") return "GS1-HIS";
    if (p === "GS2") return "GS2-POL";
    if (p === "GS3") return "GS3-ECO";
    if (p === "GS4") return "GS4-ETH";
    if (p === "ESSAY") return "ESSAY";
    if (p === "CSAT") return "CSAT-BN";
    if (p === "PRELIMS") return "GS1-HIS"; // broadest prelims GS node

    // Stage fallback when paper is empty
    if (s === "prelims") return "GS1-HIS";
    if (s === "mains")   return "GS1-HIS";
    if (s === "essay")   return "ESSAY";
    if (s === "csat")    return "CSAT-BN";

    return "";
}

/**
 * Infer the best syllabus node from a topic/subject keyword string.
 * Belt-and-suspenders fallback for bare ?topic= URLs.
 */
const TOPIC_KEYWORD_NODE_MAP = [
    ["ecology",       "GS3-ENV"],
    ["environment",   "GS3-ENV"],
    ["biodiversity",  "GS3-ENV"],
    ["gs3-env",       "GS3-ENV"],
    ["economy",       "GS3-ECO"],
    ["economics",     "GS3-ECO"],
    ["inflation",     "GS3-ECO"],
    ["gs3-eco",       "GS3-ECO"],
    ["polity",        "GS2-POL"],
    ["governance",    "GS2-POL"],
    ["constitution",  "GS2-POL"],
    ["gs2-pol",       "GS2-POL"],
    ["gs-2",          "GS2-POL"],
    ["gs2",           "GS2-POL"],
    ["history",       "GS1-HIS"],
    ["ancient",       "GS1-HIS"],
    ["medieval",      "GS1-HIS"],
    ["modern history","GS1-HIS"],
    ["gs1-his",       "GS1-HIS"],
    ["geography",     "GS1-GEO"],
    ["gs1-geo",       "GS1-GEO"],
    ["science",       "GS3-ST"],
    ["technology",    "GS3-ST"],
    ["gs3-st",        "GS3-ST"],
    ["ethics",        "GS4-ETH"],
    ["gs4",           "GS4-ETH"],
    ["csat",          "CSAT-BN"],
    ["essay",         "ESSAY"],
    ["gs-1",          "GS1-HIS"],
    ["gs1",           "GS1-HIS"],
    ["gs-3",          "GS3-ECO"],
    ["gs3",           "GS3-ECO"],
    ["gs-4",          "GS4-ETH"],
];

function topicKeywordToNode(topic = "") {
    const lower = topic.toLowerCase().trim();
    if (!lower) return "";
    for (const [kw, node] of TOPIC_KEYWORD_NODE_MAP) {
        if (lower.includes(kw)) return node;
    }
    return "";
}

export default function PyqTopicPage() {
    const { syllabusNodeId: routeNodeId } = useParams();
    const [searchParams] = useSearchParams();

    // Query params passed from plan block "View All PYQs"
    const stageParam = searchParams.get("stage") || "";
    const paperParam = searchParams.get("paper") || "";
    const topicParam = (searchParams.get("topic") || "").trim();

    // Resolve which node to fetch:
    // 1. Route param (/:syllabusNodeId) — highest priority
    // 2. Derive from paper + stage query params
    // 3. Infer from topic keyword (e.g. "Ecology Biodiversity" → GS3-ENV, "GS-2 Mains" → GS2-POL)
    // 4. Last resort: GS1-HIS only for truly unknown topics
    const syllabusNodeId =
        routeNodeId ||
        paperToFetchNode(paperParam, stageParam) ||
        topicKeywordToNode(topicParam) ||
        (topicParam ? "GS1-HIS" : "");

    const [paperFilter, setPaperFilter] = useState(() => stageToFilter(stageParam));
    const [viewMode, setViewMode] = useState("quick");
    const [sortMode, setSortMode] = useState("latest");
    const [selectedTheme, setSelectedTheme] = useState("all");
    const [timelineMode, setTimelineMode] = useState("normal");
    const [selectedYear, setSelectedYear] = useState("all");
    const [topicSearch, setTopicSearch] = useState(topicParam);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [apiCounts, setApiCounts] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [progress, setProgress] = useState({
        readIds: [],
        weakIds: [],
        importantIds: [],
    });
    // Keyed by questionId → { explanation_text, source, ... }
    const [explanationsMap, setExplanationsMap] = useState({});

    useEffect(() => {
        let ignore = false;

        async function loadPyqs() {
            if (!syllabusNodeId) {
                setLoading(false);
                setLoadError(
                    stageParam || topicParam
                        ? `No dataset found for${stageParam ? ` stage: ${stageParam}` : ""}${paperParam ? `, paper: ${paperParam}` : ""}. Try navigating from a specific topic block.`
                        : "No topic selected."
                );
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

    // Bulk-fetch saved explanations for all loaded questions (one request per topic load)
    useEffect(() => {
        if (!questions.length) return;
        const ids = questions.map((q) => q.id).filter(Boolean);
        if (!ids.length) return;

        fetch(
            `${BACKEND_URL}/api/pyq/explanations/bulk?userId=user_1&questionIds=${ids.join(",")}`
        )
            .then((r) => r.json())
            .then((data) => {
                if (data?.success && data.explanations) {
                    setExplanationsMap(data.explanations);
                }
            })
            .catch(() => {}); // non-fatal — UI degrades gracefully
    }, [questions]);

    // Hydrate weakIds from DB so "Revise Later" button state is correct on any device.
    // DB is source of truth; localStorage is used as immediate optimistic state only.
    useEffect(() => {
        if (!syllabusNodeId) return;
        fetch(`${BACKEND_URL}/api/revision-items?userId=user_1`)
            .then((r) => r.json())
            .then((data) => {
                const items = Array.isArray(data) ? data : (data?.items ?? []);
                const pyqWeakIds = items
                    .filter((item) => item.source_type === "pyq_manual" && item.question_id)
                    .map((item) => item.question_id);
                if (pyqWeakIds.length) {
                    setProgress((prev) => ({
                        ...prev,
                        weakIds: [...new Set([...prev.weakIds, ...pyqWeakIds])],
                    }));
                }
            })
            .catch(() => {}); // non-fatal
    }, [syllabusNodeId]);

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
            // Use getPracticeStage so optional items (paper=="optional") match the "mains" filter
            items = items.filter((q) => getPracticeStage(q) === paperFilter);
        }

        if (selectedTheme !== "all") {
            items = items.filter((q) => q.themeId === selectedTheme);
        }

        if (selectedYear !== "all") {
            items = items.filter((q) => Number(q.year) === Number(selectedYear));
        }

        // Keyword search: matches questionText, microTheme, themeLabel, subtopic,
        // tags, themeId nodeId-prefix, and keywords array
        const kw = topicSearch.trim().toLowerCase();
        if (kw) {
            items = items.filter((q) => {
                // nodeId prefix match: keyword matches beginning of themeId code
                if (q.themeId && q.themeId.toUpperCase().startsWith(kw.toUpperCase())) return true;

                // Tags array
                const tagMatch = Array.isArray(q.tags) && q.tags.some(
                    (t) => String(t).toLowerCase().includes(kw)
                );
                if (tagMatch) return true;

                // Keywords array (some datasets carry a `keywords` field)
                const kwMatch = Array.isArray(q.keywords) && q.keywords.some(
                    (k) => String(k).toLowerCase().includes(kw)
                );
                if (kwMatch) return true;

                // Text fields
                return [
                    q.questionText,
                    q.microTheme,
                    q.themeLabel,
                    q.subtopic,
                    q.nature,
                ].some((f) => f && String(f).toLowerCase().includes(kw));
            });
        }

        return sortQuestions(items, sortMode);
    }, [questions, paperFilter, selectedTheme, selectedYear, sortMode, topicSearch]);

    const pyqInsight = useMemo(() => {
        const years = filteredQuestions.map((q) => Number(q.year)).filter(Boolean);

        // practiceCount = raw subquestion rows (every item in the filtered list)
        const practiceCount = filteredQuestions.length;

        // mainCount = deduplicated UPSC questions by year + paperNumber + questionNumber
        const mainQuestions = Array.from(
            new Map(
                filteredQuestions.map((q) => [
                    `${q.year}-${q.paperNumber ?? ""}-${q.questionNumber ?? ""}`,
                    q,
                ])
            ).values()
        );
        const mainCount = mainQuestions.length;

        // Use practiceCount for weightage label (reflects actual volume)
        const lastAsked = years.length ? Math.max(...years) : null;
        const firstAsked = years.length ? Math.min(...years) : null;

        return {
            total: practiceCount,
            mainCount,
            practiceCount,
            firstAsked,
            lastAsked,
            trend: getTrendLabel(years),
            weightage: getWeightageLabel(practiceCount),
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
        // Deduplicate all loaded questions by year + paperNumber + questionNumber
        // so the header shows real UPSC question count, not inflated subquestion count
        const allMainCount = Array.from(
            new Map(
                questions.map((q) => [
                    `${q.year}-${q.paperNumber ?? ""}-${q.questionNumber ?? ""}`,
                    q,
                ])
            ).values()
        ).length;

        return {
            syllabusNodeId: syllabusNodeId || "",
            subject: meta.subject,
            topicName: meta.topicName,
            parentTopic: meta.parentTopic,
            totalQuestions: allMainCount || questions.length,
            viewedCount,
            visibleCount: filteredQuestions.length,
        };
    }, [syllabusNodeId, meta, questions, viewedCount, filteredQuestions.length]);

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

                {/* Stage / paper context badges + keyword search */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(stageParam || paperParam) && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {stageParam && (
                                <span style={{
                                    padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                                    background: "rgba(59,130,246,0.14)", border: "1px solid rgba(96,165,250,0.28)",
                                    color: "#dbeafe", textTransform: "capitalize",
                                }}>
                                    {stageParam}
                                </span>
                            )}
                            {paperParam && (
                                <span style={{
                                    padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                                    background: "rgba(139,92,246,0.14)", border: "1px solid rgba(167,139,250,0.28)",
                                    color: "#ede9fe",
                                }}>
                                    {paperParam}
                                </span>
                            )}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            type="search"
                            value={topicSearch}
                            onChange={(e) => setTopicSearch(e.target.value)}
                            placeholder="Filter by keyword, nodeId prefix, or theme…"
                            style={{
                                flex: 1, padding: "9px 14px", borderRadius: 10,
                                border: "1px solid rgba(96,165,250,0.28)",
                                background: "rgba(255,255,255,0.05)", color: "#f1f5f9",
                                fontSize: 14, fontWeight: 600, outline: "none",
                            }}
                        />
                        {topicSearch && (
                            <button
                                onClick={() => setTopicSearch("")}
                                style={{
                                    padding: "9px 14px", borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.10)",
                                    background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                                    fontWeight: 700, cursor: "pointer", fontSize: 13,
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

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
                                    Main Questions
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                                    {pyqInsight.mainCount}
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
                                    Practice Items
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>
                                    {pyqInsight.practiceCount}
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
                        explanationsMap={explanationsMap}
                        nodeId={syllabusNodeId}
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
