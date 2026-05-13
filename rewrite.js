
const fs = require('fs');
const content = fs.readFileSync("c:/Projects/upsc-mentor-pwa/upsc-mentor-cloud-deploy/upsc-mentor-pwa/src/pages/AnswerWritingPage.jsx", "utf-8");
const before = content.substring(0, 69853);
const after = `// ─── Timer component ──────────────────────────────────────────────────────────
function Timer({ marks, accent, autoStart = false, onStatusChange, timerRef }) {
    const timeLimit = TIME_LIMITS[marks] || TIME_LIMITS["15"];
    const [phase, setPhase] = useState("idle");
    const [countdown, setCountdown] = useState(5);
    const [elapsed, setElapsed] = useState(0);
    const intervalRef = useRef(null);
    const bellFired = useRef(false);
    const domRef = useRef(null);

    useEffect(() => {
        if (timerRef) timerRef.current = domRef.current;
    }, [timerRef]);

    useEffect(() => {
        if (autoStart && phase === "idle") {
            setCountdown(5);
            setPhase("countdown");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    const remaining = Math.max(timeLimit - elapsed, 0);
    const overTime = elapsed > timeLimit;
    const pct = Math.min((elapsed / timeLimit) * 100, 100);

    const fmt = (s) => {
        const m = Math.floor(Math.abs(s) / 60).toString().padStart(2, "0");
        const sec = (Math.abs(s) % 60).toString().padStart(2, "0");
        return \`\${m}:\${sec}\`;
    };

    useEffect(() => {
        if (phase === "running") onStatusChange?.(STATUSES.RUNNING);
        else if (phase === "paused") onStatusChange?.(STATUSES.PAUSED);
        else if (phase === "done") onStatusChange?.(STATUSES.DONE);
        else if (phase === "countdown") onStatusChange?.(STATUSES.COUNTDOWN);
        else if (phase === "idle") onStatusChange?.(STATUSES.IDLE);
    }, [phase]); // eslint-disable-line

    useEffect(() => {
        if (elapsed >= timeLimit && !bellFired.current && phase === "running") {
            bellFired.current = true;
            ringBell(3);
        }
    }, [elapsed, timeLimit, phase]);

    useEffect(() => {
        if (phase !== "countdown") return;
        if (countdown <= 0) { setPhase("running"); return; }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [phase, countdown]);

    useEffect(() => {
        if (phase === "running") {
            intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [phase]);

    const handleStart = () => {
        if (phase === "idle") { setCountdown(5); setPhase("countdown"); }
        else if (phase === "paused") { setPhase("running"); }
        else if (phase === "running") { setPhase("paused"); }
    };

    const handleReset = () => {
        clearInterval(intervalRef.current);
        setPhase("idle"); setElapsed(0); setCountdown(5);
        bellFired.current = false;
    };

    const barColor = phase === "done" || overTime ? T.red
        : pct > 80 ? T.red
            : pct > 60 ? T.amber
                : T.primaryAccent;

    return (
        <div
            ref={domRef}
            style={{
                background: T.surface,
                border: \`1px solid \${
                    phase === "done" ? T.red + "55"
                    : phase === "running" || phase === "countdown" ? (phase === "countdown" ? T.amber : barColor) + "55"
                    : T.border
                }\`,
                borderRadius: 12, padding: "16px 20px",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: (phase === "running" || phase === "countdown")
                    ? \`0 0 24px \${(phase === "countdown" ? T.amber : barColor)}22\` : "none",
                transition: "border-color 0.3s, box-shadow 0.3s",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ ...label11(T.subtle), marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Answer Timer</span>
                        <span style={{ color: T.borderMid }}>•</span>
                        <span>{marks}M</span>
                        <span style={{ color: T.borderMid }}>•</span>
                        <span style={{ color: T.primaryAccent }}>Target: {Math.floor(timeLimit / 60)} min</span>
                    </div>
                    <div style={{ fontSize: 10, color: T.muted }}>
                        UPSC standard — {marks === "10" ? "6 min" : "9 min"} per question
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    {phase === "countdown" ? (
                        <div style={{
                            fontSize: 38, fontWeight: 900, color: T.amber,
                            letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        }}>
                            {countdown}
                        </div>
                    ) : (
                        <div style={{
                            fontSize: 38, fontWeight: 900,
                            color: overTime ? T.red : phase === "done" ? T.red : T.textBright,
                            letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        }}>
                            {overTime ? \`+\${fmt(elapsed - timeLimit)}\` : fmt(remaining)}
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: T.subtle, marginTop: 3, textAlign: "right" }}>
                        {phase === "countdown" ? "Get ready…"
                            : overTime ? "Over time"
                                : phase === "done" ? "Time's up!"
                                    : \`\${fmt(elapsed)} elapsed\`}
                    </div>
                </div>
            </div>

            <div style={{ height: 5, background: T.muted, borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                    height: "100%", width: \`\${pct}%\`,
                    background: barColor, borderRadius: 5,
                    transition: "width 0.8s linear, background 0.4s",
                }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
                {[0, 25, 50, 75, 100].map((p) => (
                    <span key={p} style={{
                        fontSize: 9, color: pct >= p ? T.dim : T.muted,
                        fontWeight: pct >= p ? 700 : 400,
                    }}>
                        {Math.round((timeLimit * p) / 100 / 60)}m
                    </span>
                ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
                {phase !== "done" && phase !== "idle" && (
                    <button
                        onClick={handleStart}
                        disabled={phase === "countdown"}
                        style={{
                            flex: 1,
                            background: T.primaryGradient,
                            color: "#ffffff",
                            border: "none",
                            borderRadius: 8, fontWeight: 900, fontSize: 13,
                            padding: "10px 0",
                            cursor: phase === "countdown" ? "not-allowed" : "pointer",
                            fontFamily: T.font, letterSpacing: "0.04em",
                            opacity: phase === "countdown" ? 0.6 : 1,
                        }}
                    >
                        {phase === "countdown" ? \`Starting in \${countdown}…\`
                                : phase === "running" ? "▐▐  Pause"
                                    : "▶  Resume"}
                    </button>
                )}
                {phase === "done" && (
                    <div style={{
                        flex: 1, background: \`\${T.red}11\`,
                        border: \`1px solid \${T.red}33\`, borderRadius: 8,
                        padding: "10px 16px", textAlign: "center",
                        fontSize: 13, fontWeight: 700, color: T.red,
                    }}>
                        🔔 Time's up! Wrap up your answer.
                    </div>
                )}
                {phase !== "idle" && (
                    <button onClick={handleReset} style={{
                        background: "transparent", color: T.dim,
                        border: \`1px solid \${T.border}\`, borderRadius: 8,
                        fontWeight: 600, fontSize: 13, padding: "10px 16px",
                        cursor: "pointer", fontFamily: T.font,
                    }}>
                        ↺ Reset
                    </button>
                )}
            </div>

            {overTime && phase === "running" && (
                <div style={{
                    background: \`\${T.red}11\`, border: \`1px solid \${T.red}22\`,
                    borderRadius: 8, padding: "8px 12px", fontSize: 12,
                    color: T.red, fontWeight: 600, textAlign: "center",
                }}>
                    ⚠ Over time by {fmt(elapsed - timeLimit)} — finish quickly and move on.
                </div>
            )}
            {phase === "running" && (
                <div style={{ fontSize: 11, color: T.amber, marginTop: 2 }}>
                    ⚡ Stick to structure: Intro → Key Points → Conclusion
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnswerWritingPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // ─── Theme state ─────────────────────────────────────────────────────────
    const [theme, setThemeState] = useState(() => localStorage.getItem("mentoros_theme") || "dark");
    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        localStorage.setItem("mentoros_theme", newTheme);
        setThemeState(newTheme);
    };

    Object.assign(T, theme === "light" ? lightTokens : darkTokens);

    // ─── Route state ─────────────────────────────────────────────────────────
    const rs = location.state || {};
    const paper          = rs.paper          || "GS1";
    const mode           = rs.mode           || "PYQ";
    const year           = rs.year           || null;
    const topic          = rs.topic          || "";
    const syllabusNodeId = rs.syllabusNodeId || "";
    const questions      = (rs.questions && rs.questions.length > 0) ? rs.questions : FALLBACK_QUESTIONS;

    const [currentIndex, setCurrentIndex] = useState(rs.currentIndex || 0);
    const safeIndex = Math.min(currentIndex, questions.length - 1);
    const activeQ   = questions[safeIndex] || {};

    // ─── Derived session ──────────────────────────────────────────────────────
    const paperAccent = getPaperAccent(paper);
    const marks       = String(activeQ.marks || "15");
    const timeLimit   = TIME_LIMITS[marks] || TIME_LIMITS["15"];
    const wordTarget  = WORD_TARGETS[marks] || 200;

    const SESSION = {
        paper,
        paperAccent,
        mode,
        marks,
        year:        activeQ.year      || year,
        question:    activeQ.question  || "",
        subparts:    activeQ.subparts  || [],
        focus:       activeQ.focus     || "",
        structure:   activeQ.structure || "Intro + 4–5 pts + Concl",
        priority:    activeQ.priority  || "",
        topicNodeId: activeQ.syllabusNodeId || syllabusNodeId || "",
    };

    // ─── Per-question state ───────────────────────────────────────────────────
    const [timerStatus, setTimerStatus]   = useState(STATUSES.IDLE);
    const [sessionStarted, setSessionStarted] = useState(false);
    const timerSectionRef = useRef(null);

    const [uploadedPages, setUploadedPages] = useState([]);
    const [isDragging, setIsDragging]       = useState(false);
    const fileInputRef = useRef();
    const hasPages = uploadedPages.length > 0;

    const [promptCopied, setPromptCopied]         = useState(false);
    const [pastedText, setPastedText]             = useState("");
    const hasPastedText = pastedText.trim().length > 20;
    const [evaluationText, setEvaluationText]     = useState("");
    const [evalPromptCopied, setEvalPromptCopied] = useState(false);
    const hasEvaluationText = evaluationText.trim().length > 20;
    const [isEvaluating, setIsEvaluating]         = useState(false);
    const [isExtracting, setIsExtracting]         = useState(false);

    const [saved, setSaved]                     = useState(false);
    const [savedAttemptData, setSavedAttemptData] = useState(null);
    const [pageStatus, setPageStatus]           = useState(STATUSES.IDLE);

    const [attemptId, setAttemptId]   = useState(null);
    const [reviewId, setReviewId]     = useState(null);

    const [answerSaveState, setAnswerSaveState] = useState("idle");
    const [answerSaveError, setAnswerSaveError] = useState("");

    const [externalReviewText, setExternalReviewText] = useState("");
    const [reviewAgreement, setReviewAgreement]       = useState("not_set");
    const [reviewAgreementNote, setReviewAgreementNote] = useState("");

    // AIR-1 JSON review paste + parse state
    const [air1JsonText, setAir1JsonText] = useState("");
    const [air1ParseResult, setAir1ParseResult] = useState(null);
    const [air1ParseError, setAir1ParseError] = useState("");
    const [analyzingAir1, setAnalyzingAir1] = useState(false);

    // AIR-1 ChatGPT review full-text paste (Step 3)
    const [air1ReviewText, setAir1ReviewText] = useState("");
    const [parsedAir1Json, setParsedAir1Json] = useState(null);
    const [air1JsonParseWarning, setAir1JsonParseWarning] = useState("");
    const [showRawReview, setShowRawReview] = useState(false);
    const [isAir1TextareaExpanded, setIsAir1TextareaExpanded] = useState(true);
    const [reviewModeActive, setReviewModeActive] = useState(false);

    // Fix Mode state
    const [fixModeActive, setFixModeActive] = useState(false);
    const [fixDraft, setFixDraft] = useState("");
    const [fixTask, setFixTask] = useState("");
    const [fixSaving, setFixSaving] = useState(false);
    const [isImproved, setIsImproved] = useState(false);
    const [fixOriginalSnippet, setFixOriginalSnippet] = useState("");
    const [lastImprovement, setLastImprovement] = useState(null);

    const [reviewSaveState, setReviewSaveState]       = useState("idle");
    const [reviewSaveError, setReviewSaveError]       = useState("");
    const [reviewProcessState, setReviewProcessState] = useState("idle");
    const [reviewProcessError, setReviewProcessError] = useState("");

    const [processedReviewResult, setProcessedReviewResult] = useState(null);
    const [reviewResultData, setReviewResultData]           = useState(null);

    // eslint-disable-next-line no-unused-vars
    const [reviewUiMessage, setReviewUiMessage] = useState("");
    const [reviewUiError, setReviewUiError]     = useState("");
    const [reviewPromptCopied, setReviewPromptCopied] = useState(false);

    // ─── Reset all per-question state when question changes ───────────────────
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        uploadedPages.forEach((p) => URL.revokeObjectURL(p.preview));
        setSessionStarted(false);
        setUploadedPages([]);
        setPastedText("");
        setSaved(false);
        setSavedAttemptData(null);
        setPromptCopied(false);
        setAttemptId(null);
        setReviewId(null);
        setAnswerSaveState("idle");
        setAnswerSaveError("");
        setExternalReviewText("");
        setReviewAgreement("not_set");
        setReviewAgreementNote("");
        setReviewSaveState("idle");
        setReviewSaveError("");
        setReviewProcessState("idle");
        setReviewProcessError("");
        setProcessedReviewResult(null);
        setReviewResultData(null);
        setReviewPromptCopied(false);
        setReviewUiMessage("");
        setReviewUiError("");
        setEvaluationText("");
        setEvalPromptCopied(false);
        setIsEvaluating(false);
        setFixOriginalSnippet("");
        setLastImprovement(null);
        setIsImproved(false);
        setAir1ReviewText("");
        setParsedAir1Json(null);
        setAir1JsonParseWarning("");
    }, [currentIndex]); // eslint-disable-line

    // ─── Derived page status ──────────────────────────────────────────────────
    useEffect(() => {
        if (saved) setPageStatus(STATUSES.SAVED);
        else if (hasPastedText) setPageStatus(STATUSES.TEXT_PASTED);
        else if (promptCopied) setPageStatus(STATUSES.PROMPT_COPIED);
        else if (hasPages) setPageStatus(STATUSES.UPLOADED);
        else setPageStatus(timerStatus);
    }, [saved, hasPastedText, promptCopied, hasPages, timerStatus]);

    // ─── Navigation ──────────────────────────────────────────────────────────
    const canPrev = currentIndex > 0;
    const canNext = currentIndex < questions.length - 1;

    const handlePrev = () => { if (canPrev) setCurrentIndex((i) => i - 1); };
    const handleNext = () => {
        if (canNext) setCurrentIndex((i) => i + 1);
        else navigate(-1);
    };

    // ─── Upload handlers ──────────────────────────────────────────────────────
    const addFiles = (files) => {
        const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
        setUploadedPages((prev) => {
            const remaining = MAX_PAGES - prev.length;
            const toAdd = images.slice(0, remaining).map((file) => ({
                file,
                preview: URL.createObjectURL(file),
            }));
            return [...prev, ...toAdd];
        });
        setSaved(false);
        setPromptCopied(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        addFiles(e.dataTransfer.files);
    };

    const handleRemovePage = (idx) => {
        setUploadedPages((prev) => {
            URL.revokeObjectURL(prev[idx].preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleClearAll = () => {
        uploadedPages.forEach((p) => URL.revokeObjectURL(p.preview));
        setUploadedPages([]);
        setPastedText("");
        setSaved(false);
        setPromptCopied(false);
    };

    // ─── Extraction prompt guard ──────────────────────────────────────────────
    const EXTRACTION_PROMPT_FINGERPRINTS = [
        "I am uploading photos of my handwritten UPSC mains answer sheets",
        "Extract the handwritten answer into clean editable text",
        "Return only the extracted answer text",
    ];
    const isExtractionPromptAccidentallyPasted = (text) =>
        EXTRACTION_PROMPT_FINGERPRINTS.some((fp) => text.includes(fp));

    // ─── extractMentorOsJson — safely parse <MENTOROS_JSON> block ─────────────
    const extractMentorOsJson = (reviewText) => {
        if (!reviewText) return null;
        const start = reviewText.indexOf("<MENTOROS_JSON>");
        const end   = reviewText.indexOf("</MENTOROS_JSON>");
        if (start === -1 || end === -1 || end <= start) return null;
        const raw = reviewText.slice(start + "<MENTOROS_JSON>".length, end).trim();
        try {
            return JSON.parse(raw);
        } catch (_) {
            return undefined; // distinct: tag found but invalid JSON
        }
    };

    // ─── Gemini Basic Review ──────────────────────────────────────────────────
    const handleBasicReview = async () => {
        // Guard: block if user accidentally pasted the extraction prompt
        if (isExtractionPromptAccidentallyPasted(pastedText)) {
            setReviewUiError(
                "Please paste the actual answer text, not the prompt. Go back and paste only the prepared text from your handwriting."
            );
            return;
        }
        setIsEvaluating(true);
        setReviewUiError("");
        try {
            const payload = {
                userId: "user_1",
                question: SESSION.question,
                answer: pastedText.trim(),
                paper: SESSION.paper,
                marks: parseInt(SESSION.marks),
                wordLimit: wordTarget,
                sourceYear: SESSION.year,
                topic: SESSION.topicNodeId || topic,
                mode: SESSION.mode
            };
            const result = await evaluateMainsAnswerApi(payload);
            
            if (result && result.success && result.evaluation) {
                const evalData = result.evaluation;
                const formattedReview = [
                    \`📊 Score: \${evalData.score} / \${evalData.max_score}\`,
                    \`\n📌 Verdict: \${evalData.verdict}\`,
                    evalData.strengths && evalData.strengths.length > 0 ? \`\n✅ Strengths:\n- \${evalData.strengths.join('\n- ')}\` : '',
                    evalData.major_weaknesses && evalData.major_weaknesses.length > 0 ? \`\n⚠️ Weaknesses:\n- \${evalData.major_weaknesses.join('\n- ')}\` : '',
                    evalData.improvement_tasks && evalData.improvement_tasks.length > 0 ? \`\n🚀 Improvement Suggestions:\n- \${evalData.improvement_tasks.join('\n- ')}\` : ''
                ].filter(Boolean).join('\n');
                
                setEvaluationText(formattedReview);
            } else {
                setReviewUiError("Evaluation failed. Please try again.");
            }
        } catch (error) {
            console.error(error);
            setReviewUiError("Evaluation failed. Please try again.");
        } finally {
            setIsEvaluating(false);
        }
    };

    // ─── Extraction (Gemini Vision) ───────────────────────────────────────────
    const handleExtractAnswer = async () => {
        if (!hasPages) return;
        setIsExtracting(true);
        setReviewUiError("");
        try {
            const files = uploadedPages.map(pg => pg.file).filter(Boolean);
            if (files.length === 0) {
                setReviewUiError("No valid image files found.");
                setIsExtracting(false);
                return;
            }
            const res = await extractAnswerFromImagesApi(files);
            if (res.ok && res.text) {
                setPastedText(res.text);
            } else {
                setReviewUiError(res.error || "Extraction failed.");
            }
        } catch (error) {
            console.error("Extraction error:", error);
            setReviewUiError("Extraction failed. Please try again or use the manual fallback.");
        } finally {
            setIsExtracting(false);
        }
    };

    // ─── Start session ────────────────────────────────────────────────────────
    const handleStartSession = () => {
        setSessionStarted(true);
        setTimeout(() => {
            timerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 80);
    };

    // ─── Save attempt ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
        const attempt = {
            id:          \`mains_attempt_\${Date.now()}\`,
            paper:       SESSION.paper,
            mode:        SESSION.mode,
            marks:       SESSION.marks,
            year:        SESSION.year,
            question:    SESSION.question,
            answerText:  pastedText,
            wordCount,
            targetWords: wordTarget,
            createdAt:   new Date().toISOString(),
            ...(air1ReviewText.trim() ? { air1ReviewText: air1ReviewText.trim() } : {}),
            ...(parsedAir1Json     ? { air1ReviewJson: parsedAir1Json }           : {}),
        };
        try {
            // Local storage fallback removed
        // eslint-disable-next-line no-unused-vars
        } catch (_) {}
        setSavedAttemptData(attempt);
        setSaved(true);
        await handleSaveAttemptWithBackend();
    };

    // ─── Backend review pipeline ──────────────────────────────────────────────
    const handleSaveAttemptWithBackend = async () => {
        setAnswerSaveState("saving");
        setAnswerSaveError("");
        try {
            const payload = {
                userId: "user_1",
                source: {
                    mode: "pyq",
                    paper: SESSION.paper,
                    examYear: SESSION.year || new Date().getFullYear(),
                    questionId: SESSION.question?.replace(/\s+/g, "_").substring(0, 10) || "unknown",
                    questionMarks: parseInt(SESSION.marks),
                    targetWords: wordTarget,
                    upscTimeMinutes: Math.floor(timeLimit / 60),
                },
                question: {
                    text: SESSION.question,
                    directiveWord: "",
                    focusLabel: SESSION.focus || "",
                    topicNodeId: SESSION.topicNodeId || "",
                    subjectTag: "general",
                },
                writingSession: {
                    startedAt: new Date().toISOString(),
                    endedAt: new Date().toISOString(),
                    timeTakenSeconds: 0,
                },
                answerUpload: {
                    pageCount: uploadedPages.length,
                    pages: uploadedPages.map((pg, idx) => ({
                        pageNo: idx + 1,
                        fileName: pg.file?.name || \`page_\${idx + 1}.jpg\`,
                        storagePath: pg.preview || "",
                    })),
                },
                extraction: {
                    method: "chatgpt_manual_paste",
                    promptVersion: "mains-answer-extraction-v1",
                    extractedText: pastedText,
                },
                ...(air1ReviewText.trim() ? {
                    air1Review: {
                        rawText: air1ReviewText.trim(),
                        parsedJson: parsedAir1Json || null,
                    },
                } : {}),
                selfReview: {
                    mistakeTypes: [],
                    severity: "medium",
                    mustRevise: false,
                    note: "",
                },
            };
            const response = await saveMainsAttempt(payload);
            if (response?.ok && response?.attemptId) {
                setAttemptId(response.attemptId);
                setAnswerSaveState("saved");
                setReviewUiMessage("Attempt saved. Ready for evaluation.");
                return response.attemptId;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error saving attempt:", error);
            setAnswerSaveState("error");
            setAnswerSaveError("Could not save attempt. Please try again.");
            return null;
        }
    };

    const handleSaveReview = async () => {
        if (!attemptId) { setReviewUiError("Save the answer attempt first."); return; }
        if (externalReviewText.trim().length < 200) { setReviewUiError("Review must be at least 200 characters."); return; }
        setReviewSaveState("saving");
        setReviewSaveError("");
        try {
            const payload = {
                attemptId,
                userId: "user_1",
                reviewSource: { type: "chatgpt_pasted", promptVersion: "mains-strict-review-v2" },
                rawReviewText: externalReviewText,
                userAgreement: { value: reviewAgreement, note: reviewAgreementNote },
            };
            const response = await saveMainsReview(payload);
            if (response?.ok && response?.reviewId) {
                setReviewId(response.reviewId);
                setReviewSaveState("saved");
                setReviewUiMessage("External review saved.");
                return response.reviewId;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error saving review:", error);
            setReviewSaveState("error");
            setReviewSaveError("Could not save external review.");
            return null;
        }
    };

    const handleProcessReview = async () => {
        if (!attemptId || !reviewId) { setReviewUiError("Save both attempt and review first."); return; }
        setReviewProcessState("processing");
        setReviewProcessError("");
        try {
            const response = await processMainsReview({ attemptId, reviewId, userId: "user_1" });
            if (response?.ok) {
                setProcessedReviewResult(response);
                setReviewProcessState("processed");
                setReviewUiMessage("Review processed and synced to mistake/revision pipeline.");
                try {
                    const fullResult = await getMainsReviewResult(attemptId, reviewId);
                    if (fullResult?.ok) setReviewResultData(fullResult);
                } catch (e) { console.error("Error fetching full result:", e); }
                return response;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error processing review:", error);
            setReviewProcessState("error");
            setReviewProcessError("Could not process review. Saved review is still safe.");
            return null;
        }
    };

    const handleCopyReviewPrompt = () => {
        setReviewPromptCopied(true);
        setTimeout(() => setReviewPromptCopied(false), 3000);
    };

    const handleOpenChatGPTReview = () => {
        // Guard: block if user accidentally pasted the extraction prompt as the answer
        if (isExtractionPromptAccidentallyPasted(pastedText)) {
            setReviewUiError(
                "Please paste the actual student answer, not the prompt."
            );
            return;
        }
        window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
    };

    // ─── Handle AIR-1 review text change: auto-parse MENTOROS_JSON ───────────
    const handleAir1ReviewChange = (text) => {
        setAir1ReviewText(text);
        setAir1JsonParseWarning("");
        setParsedAir1Json(null);
        if (!text.trim()) return;
        const result = extractMentorOsJson(text);
        if (result === null) {
            // No tag present — that's fine
            setIsAir1TextareaExpanded(true);
        } else if (result === undefined) {
            // Tag found but JSON was invalid
            setAir1JsonParseWarning(
                "AIR-1 review pasted, but the structured data block could not be read. The full review can still be saved."
            );
            setIsAir1TextareaExpanded(true);
        } else {
            setParsedAir1Json(result);
            setIsAir1TextareaExpanded(false);
            setReviewModeActive(true);
        }
    };

    const handleAnalyzeAir1Review = () => {
        setAir1ParseError("");
        setAir1ParseResult(null);
        if (!air1JsonText || !air1JsonText.trim()) {
            setAir1ParseError("Paste ChatGPT result first.");
            return;
        }
        setAnalyzingAir1(true);
        try {
            const res = parseAir1ReviewJson(air1JsonText);
            if (res.ok) {
                setAir1ParseResult(res.data);
            } else {
                setAir1ParseError(res.error || "Invalid format or schema");
            }
        } catch (e) {
            setAir1ParseError(e?.message || String(e));
        } finally {
            setAnalyzingAir1(false);
        }
    };

    // ─── Fix Mode handlers ─────────────────────────────────────────────────
    const handleStartFix = (fixNowObj) => {
        // fixNowObj may be the full object { mainTask, replacementLines, nextPracticeTask }
        const mainTaskText = fixNowObj && typeof fixNowObj === "object" && fixNowObj.mainTask ? fixNowObj.mainTask : (typeof fixNowObj === "string" ? fixNowObj : "");
        const replacementLines = fixNowObj && Array.isArray(fixNowObj.replacementLines) ? fixNowObj.replacementLines : [];
        const maxLines = 5;
        let draft = "";
        if (replacementLines && replacementLines.length > 0) {
            draft = replacementLines.slice(0, maxLines).map(r => (r || "").replace(/\r/g, "").replace(/\n/g, " ")).join("\n");
        } else if (pastedText && pastedText.trim()) {
            draft = pastedText.split(/\r?\n/).slice(0, maxLines).join("\n");
        }
        setFixTask(mainTaskText || "");
        setFixDraft(draft);
        setFixOriginalSnippet(draft);
        setFixModeActive(true);
        // Do not render the full review while fixing (UI will hide it when fixModeActive===true)
    };

    const handleCancelFix = () => {
        setFixModeActive(false);
        setFixDraft("");
        setFixTask("");
    };

    const handleSaveImprovedAttempt = async (draftText) => {
        setAnswerSaveState("saving");
        setAnswerSaveError("");
        try {
            const payload = {
                userId: "user_1",
                source: {
                    mode: "pyq",
                    paper: SESSION.paper,
                    examYear: SESSION.year || new Date().getFullYear(),
                    questionId: SESSION.question?.replace(/\s+/g, "_").substring(0, 10) || "unknown",
                    questionMarks: parseInt(SESSION.marks),
                    targetWords: wordTarget,
                    upscTimeMinutes: Math.floor(timeLimit / 60),
                },
                question: {
                    text: SESSION.question,
                    directiveWord: "",
                    focusLabel: SESSION.focus || "",
                    topicNodeId: SESSION.topicNodeId || "",
                    subjectTag: "general",
                },
                writingSession: {
                    startedAt: new Date().toISOString(),
                    endedAt: new Date().toISOString(),
                    timeTakenSeconds: 0,
                },
                answerUpload: {
                    pageCount: uploadedPages.length,
                    pages: uploadedPages.map((pg, idx) => ({
                        pageNo: idx + 1,
                        fileName: pg.file?.name || \`page_\${idx + 1}.jpg\`,
                        storagePath: pg.preview || "",
                    })),
                },
                extraction: {
                    method: "manual_fix",
                    promptVersion: "mains-fix-v1",
                    extractedText: draftText,
                },
                selfReview: {
                    mistakeTypes: [],
                    severity: "medium",
                    mustRevise: false,
                    note: "",
                },
                improved: true,
                improvedAt: new Date().toISOString(),
                originalAttemptId: attemptId || null,
            };
            const response = await saveMainsAttempt(payload);
            if (response?.ok && response?.attemptId) {
                setAttemptId(response.attemptId);
                setAnswerSaveState("saved");
                setReviewUiMessage("Improved answer saved.");
                return response.attemptId;
            } else {
                throw new Error("Invalid response");
            }
        } catch (error) {
            console.error("Error saving improved attempt:", error);
            setAnswerSaveState("error");
            setAnswerSaveError("Could not save improved answer.");
            return null;
        }
    };

    const handleSubmitFix = async () => {
        if (!fixDraft || !fixDraft.trim()) { setReviewUiError("Improved answer cannot be empty."); return; }
        setFixSaving(true);
        setReviewUiError("");
        try {
            // Update local answer text
            setPastedText(fixDraft);
            const attempt = {
                id: savedAttemptData?.id || \`mains_attempt_\${Date.now()}\`,
                paper: SESSION.paper,
                mode: SESSION.mode,
                marks: SESSION.marks,
                year: SESSION.year,
                question: SESSION.question,
                answerText: fixDraft,
                wordCount: fixDraft.trim().split(/\s+/).length,
                targetWords: wordTarget,
                createdAt: new Date().toISOString(),
                improved: true,
                improvedAt: new Date().toISOString(),
            };
            setSavedAttemptData(attempt);
            setSaved(true);
            setIsImproved(true);

            // Persist to backend
            const savedId = await handleSaveImprovedAttempt(fixDraft);

            if (savedId) {
                // compute small before/after single-line comparison
                const firstNonEmpty = (s) => {
                    if (!s) return "";
                    const lines = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    return lines.length ? lines[0] : (s.split(/\r?\n/)[0] || "");
                };
                const before = firstNonEmpty(fixOriginalSnippet || "");
                const after = firstNonEmpty(fixDraft || "");
                setLastImprovement({ before, after });

                // Mark improved and scroll to top so user sees badge/comparison
                setIsImproved(true);
                setTimeout(() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) {} }, 80);
            }

            // Exit fix mode and hide review
            setFixModeActive(false);
            setFixDraft("");
            setFixTask("");
        } catch (e) {
            console.error(e);
            setReviewUiError("Could not save improved answer.");
        } finally {
            setFixSaving(false);
        }
    };

    const handleOpenMistakeBook    = () => navigate("/mains/mistakes");
    const handleOpenRevisionTasks  = () => navigate("/revision");

    // ─── Derived values ───────────────────────────────────────────────────────
    const wordCount  = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;
    const wordPct    = Math.min(Math.round((wordCount / wordTarget) * 100), 100);
    const finalAnswerText   = pastedText.trim();
    const canCopyReviewPrompt = !!SESSION.question && !!finalAnswerText;
    const canSaveReview     = !!attemptId && externalReviewText.trim().length >= 200;
    const canProcessReview  = !!attemptId && !!reviewId && reviewSaveState === "saved";

    const compactSteps = [
        { label: "Attempt",      done: sessionStarted },
        { label: "Upload & Verify",   done: hasEvaluationText },
        { label: "Evaluate & Finalize", done: !!attemptId || saved },
    ];

    // ─────────────────────────────────────────────────────────────────────────
    
    if (reviewModeActive && parsedAir1Json) {
        return (
            <Air1ReviewMode 
                data={parsedAir1Json} 
                rawReviewText={air1ReviewText} 
                uploadedPages={uploadedPages} 
                finalAnswerText={finalAnswerText}
                onFinalize={() => { setReviewModeActive(false); handleSave(); }}
                onExit={() => setReviewModeActive(false)}
            />
        );
    }

    return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

            {/* ── Topbar ─────────────────────────────────────────────────────────── */}
            <div style={{
                borderBottom: \`1px solid \${T.border}\`,
                padding: "13px 28px",
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                background: T.bg, position: "sticky", top: 0, zIndex: 20,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: "transparent", border: "none", color: T.dim,
                            cursor: "pointer", fontSize: 13, fontFamily: T.font,
                            padding: "2px 6px 2px 0", marginRight: 4,
                        }}
                    >←</button>
                    <span style={label11(T.subtle)}>Mains</span>
                    <span style={{ color: T.muted, fontSize: 11 }}>·</span>
                    <span style={label11(T.dim)}>Answer Writing</span>
                    <span style={{ color: T.muted, fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: paperAccent, letterSpacing: "0.06em" }}>
                        {paper}
                    </span>
                    {questions.length > 1 && (
                        <>
                            <span style={{ color: T.muted, fontSize: 11 }}>·</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: T.dim }}>
                                Q{currentIndex + 1} / {questions.length}
                            </span>
                        </>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {canPrev && (
                        <button onClick={handlePrev} style={{
                            background: "transparent", color: T.dim,
                            border: \`1px solid \${T.border}\`, borderRadius: 6,
                            fontSize: 12, fontWeight: 600, padding: "5px 12px",
                            cursor: "pointer", fontFamily: T.font,
                        }}>
                            ← Prev
                        </button>
                    )}
                    {canNext && (
                        <button
                            onClick={handleNext}
                            disabled={!hasPastedText}
                            style={{
                                background: "transparent",
                                color: hasPastedText ? paperAccent : T.muted,
                                border: \`1px solid \${hasPastedText ? paperAccent + "44" : T.border}\`,
                                borderRadius: 6, fontSize: 12, fontWeight: 600, padding: "5px 12px",
                                cursor: hasPastedText ? "pointer" : "not-allowed", fontFamily: T.font,
                                opacity: hasPastedText ? 1 : 0.45,
                            }}
                            title={hasPastedText ? undefined : "Prepare answer text first"}
                        >
                            Next →
                        </button>
                    )}
                    <button
                        onClick={toggleTheme}
                        style={{
                            background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`,
                            color: T.textBright, borderRadius: 6, width: 32, height: 32,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", fontSize: 16
                        }}
                        title={\`Switch to \${theme === "dark" ? "Light" : "Dark"} Mode\`}
                    >
                        {theme === "dark" ? "☀️" : "🌙"}
                    </button>
                    <StatusChip status={pageStatus} />
                </div>
            </div>

            {/* ── Compact Progress Tracker ──────────────────────────────────────── */}
            <div style={{
                padding: "16px 28px", borderBottom: \`1px solid \${T.borderMid}\`, background: T.surfaceHigh,
                display: "flex", justifyContent: "space-between", alignItems: "center", overflow: "hidden"
            }}>
                {compactSteps.map((s, i) => {
                    const isActive = !s.done && (i === 0 || compactSteps[i - 1].done);
                    return (
                        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800,
                                background: s.done ? T.green : isActive ? T.primaryGradient : T.surface,
                                color: s.done || isActive ? "#ffffff" : T.dim,
                                border: \`1px solid \${s.done ? T.green : isActive ? "transparent" : T.border}\`,
                            }}>
                                {s.done ? "✓" : i + 1}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: s.done || isActive ? 700 : 500, color: s.done ? T.green : isActive ? T.textBright : T.subtle, whiteSpace: "nowrap" }}>
                                {s.label}
                            </span>
                            {i < compactSteps.length - 1 && (
                                <div style={{ flex: 1, height: 1, background: compactSteps[i].done ? T.green : T.border, margin: "0 12px" }} />
                            )}
                        </div>
                    );
                })}
            </div>

            {lastImprovement && (
                <div style={{ maxWidth: 960, margin: "8px auto 0", padding: "8px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: T.improvedBg, color: T.improvedText, padding: "6px 10px", borderRadius: 8, fontWeight: 800, fontSize: 12 }}>
                        Improved ✔
                    </div>
                    <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, padding: "8px 12px", borderRadius: 8, fontSize: 13, color: T.text }}>
                        <div style={{ fontSize: 12, color: T.subtle }}>Before: <span style={{ fontWeight: 800 }}>{(lastImprovement.before || "").slice(0, 140)}</span></div>
                        <div style={{ height: 6 }} />
                        <div style={{ fontSize: 12, color: T.subtle }}>After: <span style={{ fontWeight: 800 }}>{(lastImprovement.after || "").slice(0, 140)}</span></div>
                    </div>
                </div>
            )}

            <div style={{
                padding: "24px 28px 48px",
                maxWidth: 960, margin: "0 auto",
                display: "flex", flexDirection: "column", gap: 20,
            }}>

                {/* ═══ 0. MAINS INTELLIGENCE CARD ════════════════════════════════════════════ */}
                <MainsIntelligenceCard refreshTrigger={saved} />

                {/* ═══ 1. CONTEXT PILLS ════════════════════════════════════════════════ */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <InfoPill label="Paper"  value={SESSION.paper}              accent={paperAccent} />
                    <InfoPill label="Mode"   value={SESSION.mode}               accent={T.purple} />
                    <InfoPill label="Marker" value={\`\${marks}M\`}               accent={T.textBright} />
                    <InfoPill label="Year"   value={SESSION.year || "—"}        accent={T.dim} />
                    <InfoPill label="Target" value={\`\${wordTarget} words\`}      accent={T.blue} />
                    <InfoPill label="Time"   value={\`\${Math.floor(timeLimit / 60)} min\`} accent={T.amber} />
                    {topic && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            background: \`linear-gradient(145deg, \${T.surfaceHigh}, \${T.bg})\`,
                            border: \`1px solid \${T.borderMid}\`, boxShadow: \`inset 0 1px 0 \${T.innerGlow}\`,
                            borderRadius: 10, padding: "10px 16px", flex: 1, minWidth: 180,
                        }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase" }}>Topic</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: T.textBright, letterSpacing: "0.02em" }}>{topic}</span>
                        </div>
                    )}
                </div>

                {/* ═══ 2. QUESTION CARD ════════════════════════════════════════════════ */}
                <SectionCard 
                    accentTop={T.primaryAccent} 
                    style={{ 
                        borderLeft: \`3px solid \${T.primaryAccent}\`, // Left accent rail
                        background: \`linear-gradient(145deg, \${T.surfaceHigh}, \${T.surface})\` // Subtle depth gradient
                    }}
                >
                    <div style={{ padding: "18px 24px" }}>
                        {/* badges row */}
                        <div style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between", marginBottom: 16,
                            flexWrap: "wrap", gap: 12
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{
                                    fontSize: 12, fontWeight: 900, color: T.primaryAccent,
                                    background: \`\${T.primaryAccent}15\`,
                                    borderRadius: 6, padding: "4px 12px", letterSpacing: "0.06em",
                                }}>{SESSION.paper}</span>
                                <span style={{
                                    fontSize: 11, fontWeight: 800, color: T.purple,
                                    background: \`\${T.purple}15\`,
                                    borderRadius: 6, padding: "4px 10px", letterSpacing: "0.06em", textTransform: "uppercase",
                                }}>{SESSION.mode}</span>
                                <span style={{
                                    fontSize: 12, fontWeight: 800, color: T.textBright,
                                    background: T.bg,
                                    borderRadius: 6, padding: "4px 12px",
                                }}>{marks} Marks</span>
                                {(SESSION.priority && SESSION.priority.includes("High Priority")) && (
                                     <span style={{
                                        fontSize: 11, fontWeight: 800, color: T.green, // Emerald green
                                        background: \`\${T.green}26\`,
                                        borderRadius: 6, padding: "4px 10px", letterSpacing: "0.05em", textTransform: "uppercase",
                                        display: "flex", alignItems: "center", gap: 4
                                    }}>
                                        <span style={{ fontSize: 13 }}>✦</span> AIR-1 Priority
                                    </span>
                                )}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {SESSION.year && (
                                    <span style={{ 
                                        fontSize: 12, color: T.text, fontWeight: 700,
                                        background: T.bg, padding: "4px 10px", borderRadius: 6
                                    }}>
                                        UPSC {SESSION.year}
                                    </span>
                                )}
                                {questions.length > 1 && (
                                    <span style={{
                                        fontSize: 12, fontWeight: 700, color: T.subtle,
                                        background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6
                                    }}>
                                        {currentIndex + 1} / {questions.length}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* question text */}
                        <div style={{
                            fontSize: 20, fontWeight: 800, color: T.textBright,
                            lineHeight: 1.5,
                            marginBottom: SESSION.subparts.length > 0 ? 16 : 24,
                        }}>
                            {SESSION.question}
                        </div>

                        {/* subparts — (a), (b), ... */}
                        {SESSION.subparts.length > 0 && (
                            <div style={{
                                display: "flex", flexDirection: "column", gap: 10,
                                marginBottom: 20,
                                padding: "14px 16px",
                                background: \`\${T.primaryAccent}07\`,
                                border: \`1px solid \${T.primaryAccent}20\`,
                                borderRadius: 10,
                            }}>
                                {SESSION.subparts.map((sp, i) => (
                                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 800, color: T.primaryAccent,
                                            background: \`\${T.primaryAccent}15\`,
                                            border: \`1px solid \${T.primaryAccent}30\`,
                                            borderRadius: 4, padding: "2px 9px",
                                            flexShrink: 0, marginTop: 2,
                                            letterSpacing: "0.04em",
                                        }}>
                                            ({sp.label})
                                        </span>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: 14, color: T.text, lineHeight: 1.7 }}>
                                                {sp.question}
                                            </span>
                                            {(sp.marks || sp.wordLimit) && (
                                                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                                    {sp.marks && (
                                                        <span style={{ fontSize: 10, color: T.subtle, fontWeight: 600 }}>
                                                            {sp.marks}M
                                                        </span>
                                                    )}
                                                    {sp.wordLimit && (
                                                        <span style={{ fontSize: 10, color: T.subtle }}>
                                                            ~{sp.wordLimit} words
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* focus + priority */}
                        {(SESSION.focus || SESSION.priority) && (
                            <div style={{
                                display: "flex", flexDirection: "column", gap: 10,
                                paddingTop: 16, borderTop: \`1px solid \${T.borderMid}\`, marginBottom: 8,
                            }}>
                                {SESSION.focus && (
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                        <div style={{
                                            fontSize: 10, fontWeight: 800, color: T.amber,
                                            letterSpacing: "0.06em", textTransform: "uppercase",
                                            marginTop: 2, flexShrink: 0, padding: "2px 6px",
                                            background: \`\${T.amber}11\`, border: \`1px solid \${T.amber}33\`, borderRadius: 4
                                        }}>FOCUS</div>
                                        <span style={{ fontSize: 13, color: T.textBright, lineHeight: 1.5, fontWeight: 500 }}>{SESSION.focus}</span>
                                    </div>
                                )}
                                {SESSION.priority && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, flexShrink: 0, boxShadow: \`0 0 6px \${T.green}\` }} />
                                        <span style={{ fontSize: 12, color: T.text, fontWeight: 600, letterSpacing: "0.01em" }}>{SESSION.priority}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Start Writing button */}
                        {!sessionStarted && (
                            <div style={{ marginTop: 24, paddingTop: 20, borderTop: \`1px solid \${T.borderMid}\` }}>
                                <button
                                    onClick={handleStartSession}
                                    style={{
                                        ...primaryBtn(T.primaryAccent, sessionStarted),
                                        boxShadow: \`0 4px 16px \${T.primaryAccent}40\`,
                                        fontSize: 14, padding: "12px 32px"
                                    }}
                                >
                                    ✍ Start Attempt
                                </button>
                                <span style={{ fontSize: 12, color: T.dim, marginLeft: 16, fontWeight: 500 }}>
                                    Start the timer and begin writing on paper.
                                </span>
                            </div>
                        )}
                    </div>
                </SectionCard>

                {/* ═══ TIMER (Auto-starts inside writing phase) ════════════════════════ */}
                {sessionStarted && (
                    <Timer
                        key={currentIndex}
                        marks={marks}
                        accent={paperAccent}
                        autoStart={sessionStarted}
                        timerRef={timerSectionRef}
                        onStatusChange={setTimerStatus}
                    />
                )}

                {/* ═══ STEP 2: UPLOAD & EXTRACT ANSWER + BASIC REVIEW ══════════════════ */}
                {sessionStarted && (
                    <SectionCard accentTop={T.blue}>
                    <div style={{ padding: "20px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, letterSpacing: "0.02em", marginBottom: 20 }}>
                            Step 2: Upload & Verify Answer
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase" }}>Answer Sheets</div>
                            {hasPages && (
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 11, color: T.dim }}>
                                        {uploadedPages.length} / {MAX_PAGES} pages
                                    </span>
                                    <button onClick={handleClearAll} style={{
                                        background: "transparent", color: T.red,
                                        border: \`1px solid \${T.red}44\`, borderRadius: 6,
                                        fontSize: 11, fontWeight: 600, padding: "4px 10px",
                                        cursor: "pointer", fontFamily: T.font,
                                    }}>
                                        ✕ Clear All
                                    </button>
                                </div>
                            )}
                        </div>
                        <div style={{ fontSize: 13, color: T.dim, marginBottom: 18, fontWeight: 500 }}>
                            Upload clear photos of your written answer sheets in order.
                        </div>

                        {hasPages && (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                                gap: 12, marginBottom: 16,
                            }}>
                                {uploadedPages.map((pg, idx) => (
                                    <div key={idx} style={{
                                        background: T.bg, border: \`1px solid \${T.borderMid}\`,
                                        borderRadius: 10, overflow: "hidden",
                                    }}>
                                        <div style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            padding: "6px 10px", background: \`\${T.blue}10\`,
                                            borderBottom: \`1px solid \${T.border}\`,
                                        }}>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: T.blue, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                                                Page {idx + 1}
                                            </span>
                                            <button
                                                onClick={() => handleRemovePage(idx)}
                                                style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: "0 2px", fontFamily: T.font }}
                                                title="Remove"
                                            >✕</button>
                                        </div>
                                        <div style={{ padding: "10px", background: T.bg, textAlign: "center" }}>
                                            <img
                                                src={pg.preview}
                                                alt={\`Page \${idx + 1}\`}
                                                style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 6, objectFit: "contain", border: \`1px solid \${T.border}\` }}
                                            />
                                        </div>
                                        <div style={{ padding: "5px 10px 8px", fontSize: 10, color: T.subtle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {pg.file.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {uploadedPages.length < MAX_PAGES && (
                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    border: \`2px dashed \${isDragging ? T.blue : T.borderMid}\`,
                                    borderRadius: 12,
                                    background: isDragging ? \`\${T.blue}08\` : T.bg,
                                    padding: hasPages ? "16px 24px" : "32px 24px",
                                    textAlign: "center", cursor: "pointer", marginBottom: 16,
                                }}
                            >
                                <div style={{ fontSize: hasPages ? 20 : 28, marginBottom: 8 }}>📷</div>
                                <div style={{ fontSize: hasPages ? 13 : 15, fontWeight: 700, color: T.textBright, marginBottom: 5 }}>
                                    {hasPages ? \`Add more pages (\${uploadedPages.length}/\${MAX_PAGES})\` : "Upload answer pages"}
                                </div>
                                <div style={{ fontSize: 12, color: T.dim, marginBottom: hasPages ? 10 : 16, lineHeight: 1.6 }}>
                                    Drag &amp; drop or click · JPG, PNG, HEIC, WebP · Up to {MAX_PAGES} pages
                                </div>
                                {!hasPages && (
                                    <div style={{
                                        display: "inline-block", background: T.surface,
                                        border: \`1px solid \${T.borderMid}\`, borderRadius: 8,
                                        padding: "8px 20px", fontSize: 13, fontWeight: 700, color: T.text,
                                    }}>Choose Files</div>
                                )}
                                <input
                                    ref={fileInputRef} type="file" accept="image/*" multiple
                                    style={{ display: "none" }}
                                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                                />
                            </div>
                        )}



                        <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>
                            💡 Use clear lighting, avoid shadows, keep pages in order.
                        </div>

                        {/* ═══ PASTE EXTRACTED TEXT (Inside Step 2) ════════════════════════════════════════ */}
                        {hasPages && (
                            <div style={{ marginTop: 24, paddingTop: 20, borderTop: \`1px solid \${T.borderMid}\` }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Verify Answer Text</div>
                                <div style={{ fontSize: 13, color: T.dim, fontWeight: 500 }}>
                                    Review spelling, missed words, spacing, and formatting before evaluation.
                                </div>
                            </div>
                            {wordCount > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                                        <span style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>{wordCount}</span>
                                        <span style={{ fontSize: 11, color: T.subtle, fontWeight: 600 }}>/ {wordTarget} words</span>
                                    </div>
                                    {wordCount < wordTarget * 0.7 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: T.red }}>✗ Too short</span>
                                    )}
                                    {wordCount >= wordTarget * 0.7 && wordCount <= wordTarget * 1.1 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>✓ Optimal length</span>
                                    )}
                                    {wordCount > wordTarget * 1.2 && (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: T.amber }}>⚠ Too lengthy</span>
                                    )}
                                    <div style={{ width: 140, height: 3, background: T.muted, borderRadius: 3, overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", width: \`\${wordPct}%\`,
                                            background: wordCount < wordTarget * 0.7 ? T.red : wordCount > wordTarget * 1.2 ? T.amber : T.green,
                                            borderRadius: 3,
                                        }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Extraction CTA — always visible */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                            padding: "14px 16px", marginBottom: 16,
                            background: promptCopied ? \`\${T.green}08\` : \`\${T.primaryAccent}08\`,
                            border: \`1px solid \${promptCopied ? T.green + "33" : T.primaryAccent + "33"}\`,
                            borderRadius: 10,
                        }}>
                            <button
                                onClick={handleExtractAnswer}
                                disabled={!hasPages || isExtracting}
                                style={primaryBtn(T.primaryAccent, !hasPages || isExtracting)}
                            >
                                {isExtracting ? "⏳ Reading answer sheet..." : "✨ Prepare Answer Text"}
                            </button>
                            {isExtracting ? (
                                <span style={{ fontSize: 12, color: T.dim }}>Reading answer sheet... this may take a few seconds.</span>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <span style={{ fontSize: 12, color: hasPages ? T.dim : T.muted }}>
                                        {hasPages
                                            ? "MentorOS AI will instantly prepare your answer text."
                                            : "Upload your answer pages above first."}
                                    </span>
                                    {hasPages && (
                                        <div style={{ fontSize: 11, color: T.subtle, cursor: "pointer", textDecoration: "underline" }} onClick={() => {
                                            navigator.clipboard.writeText(CHATGPT_EXTRACTION_PROMPT);
                                            setPromptCopied(true);
                                            window.open("https://chat.openai.com", "_blank", "noopener,noreferrer");
                                        }}>
                                            Manual fallback: Prepare via ChatGPT
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {hasPastedText && (
                            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: \`\${T.green}15\`, border: \`1px solid \${T.green}33\`, borderRadius: 4, padding: "2px 8px", letterSpacing: "0.06em" }}>
                                    Answer Text Ready
                                </span>
                                <span style={{ fontSize: 12, color: T.dim }}>Answer text is ready. Review it once before evaluation.</span>
                            </div>
                        )}

                        <textarea
                            value={pastedText}
                            onChange={(e) => { setPastedText(e.target.value); setSaved(false); }}
                            rows={14}
                            style={{
                                width: "100%", boxSizing: "border-box",
                                background: T.bg,
                                border: \`1px solid \${hasPastedText ? T.green + "55" : T.borderMid}\`,
                                borderRadius: 10, color: T.text, fontSize: 13.5,
                                lineHeight: 1.8, padding: "16px 18px",
                                fontFamily: T.font, resize: "vertical", outline: "none",
                                letterSpacing: "0.01em", transition: "border-color 0.2s",
                            }}
                            placeholder="Your answer text will appear here. Correct missed words, spacing, and formatting before evaluation."
                        />
                        <div style={{ fontSize: 11, color: T.subtle, marginTop: 8 }}>
                            ✎ Review spelling, missed words, spacing, and formatting before evaluation.
                        </div>
                            </div>
                        )}

                        {/* ═══ EVALUATE ANSWER (Inside Step 2) ══════════════════════════════════════════ */}
                        {hasPastedText && (
                            <div style={{ marginTop: 24, paddingTop: 20, borderTop: \`1px solid \${T.borderMid}\` }}>
                                <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Evaluate Answer</div>
                            <div style={{ fontSize: 13, color: T.dim, fontWeight: 500 }}>
                                Get a strict UPSC-standard evaluation inside MentorOS.
                            </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                            <button
                                onClick={handleBasicReview}
                                disabled={!hasPastedText || isEvaluating}
                                style={primaryBtn(T.primaryAccent, !hasPastedText || isEvaluating)}
                                title={hasPastedText ? undefined : "Prepare answer text first"}
                            >
                                {isEvaluating ? "⏳ Evaluating Answer..." : "✦ Evaluate Answer"}
                            </button>
                            {evalPromptCopied && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>
                                    ✓ Evaluation prompt copied
                                </span>
                            )}
                            {!hasPastedText && (
                                <span style={{ fontSize: 12, color: T.muted }}>
                                    Prepare answer text above to enable evaluation.
                                </span>
                            )}
                        </div>

                        {hasPastedText && !hasEvaluationText && !isEvaluating && (
                            <div style={{
                                padding: "10px 14px", marginBottom: 14,
                                background: \`\${T.primaryAccent}08\`, border: \`1px solid \${T.primaryAccent}22\`,
                                borderRadius: 8, fontSize: 12, color: T.dim, lineHeight: 1.65,
                            }}>
                                <span style={{ color: T.textBright, fontWeight: 700 }}>How it works:</span>
                                {" "}Click the button — your question and answer text will be sent to the MentorOS Gemini backend for an instant strict UPSC evaluation. The report will appear below.
                            </div>
                        )}

                        <textarea
                            value={evaluationText}
                            onChange={(e) => setEvaluationText(e.target.value)}
                            disabled={!hasPastedText}
                            rows={10}
                            style={{
                                width: "100%", boxSizing: "border-box",
                                background: T.bg,
                                border: \`1px solid \${hasEvaluationText ? T.amber + "55" : T.borderMid}\`,
                                borderRadius: 10,
                                color: hasPastedText ? T.text : T.subtle,
                                fontSize: 13.5, lineHeight: 1.8,
                                padding: "16px 18px", fontFamily: T.font,
                                resize: "vertical", outline: "none",
                                letterSpacing: "0.01em", transition: "border-color 0.2s",
                                opacity: hasPastedText ? 1 : 0.45,
                                cursor: hasPastedText ? "text" : "not-allowed",
                            }}
                            placeholder={hasPastedText
                                ? (isEvaluating ? "Generating evaluation... please wait..." : "Evaluation report will appear here...")
                                : "Prepare your answer text first to enable evaluation..."}
                        />

                        {hasEvaluationText && (
                            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, color: T.amber,
                                    background: \`\${T.amber}15\`, border: \`1px solid \${T.amber}33\`,
                                    borderRadius: 4, padding: "2px 8px", letterSpacing: "0.06em",
                                }}>
                                    EVALUATION PASTED
                                </span>
                                <span style={{ fontSize: 12, color: T.dim }}>Save your attempt below to record this session.</span>
                            </div>
                        )}
                                </div>
                        )}
                    </div>
                </SectionCard>
                )}

                {/* ═══ STEP 3: AIR-1 REVIEW & SAVE ════════════════════════════════════ */}
                {hasPastedText && (
                    <SectionCard accentTop={T.green}>
                    <div style={{ padding: "20px 24px" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.textBright, letterSpacing: "0.02em", marginBottom: 16 }}>
                            Step 3: AIR-1 Review & Finalize
                        </div>
                        {finalAnswerText && (
                            <MainsReviewPromptCard
                                currentQuestion={{ 
                                    text: SESSION.question, 
                                    marks: parseInt(SESSION.marks),
                                    paper: SESSION.paper,
                                    topic: topic,
                                    syllabusNode: syllabusNodeId
                                }}
                                finalAnswerText={finalAnswerText}
                                papersAccent={paperAccent}
                                wordTarget={wordTarget}
                                onCopyPrompt={handleCopyReviewPrompt}
                                onOpenChatGPT={handleOpenChatGPTReview}
                                canCopyReviewPrompt={canCopyReviewPrompt}
                                promptCopied={reviewPromptCopied}
                            />
                        )}

                        {/* ═══ AIR-1 REVIEW PASTE AREA ════════════════════════════════════ */}
                        <div style={{ marginTop: 24, paddingTop: 20, borderTop: \`1px solid \${T.borderMid}\` }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Import AIR-1 Review</div>
                            <div style={{ fontSize: 13, color: T.dim, fontWeight: 500, marginBottom: 14 }}>
                                Paste the full ChatGPT review here. MentorOS will organize it into a clean report and attach it to this attempt.
                            </div>
                            {isAir1TextareaExpanded ? (
                                <>
                                    <textarea
                                        value={air1ReviewText}
                                        onChange={(e) => handleAir1ReviewChange(e.target.value)}
                                        rows={10}
                                        style={{
                                            width: "100%", boxSizing: "border-box",
                                            background: T.bg,
                                            border: \`1px solid \${air1ReviewText.trim() ? T.purple + "55" : T.borderMid}\`,
                                            borderRadius: 10, color: T.text, fontSize: 13.5,
                                            lineHeight: 1.8, padding: "16px 18px", fontFamily: T.font,
                                            resize: "vertical", outline: "none",
                                            letterSpacing: "0.01em", transition: "border-color 0.2s",
                                        }}
                                        placeholder="Import the AIR-1 review here, including <MENTOROS_JSON> if available..."
                                    />
                                    {!air1ReviewText.trim() && (
                                        <div style={{ fontSize: 11, color: T.dim, marginTop: 8 }}>
                                            💡 AIR-1 Review is optional, but recommended before saving.
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ background: T.bg, border: \`1px solid \${T.green}40\`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: 13, color: T.green, fontWeight: 700, display: "flex", gap: 8, alignItems: "center" }}>
                                        <span>✅</span> AIR-1 Review imported successfully
                                    </div>
                                    <button onClick={() => setIsAir1TextareaExpanded(true)} style={{ background: "transparent", border: "none", color: T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Edit Review</button>
                                </div>
                            )}
                            {air1JsonParseWarning && (
                                <div style={{ marginTop: 10, padding: "10px 14px", background: \`\${T.amber}11\`, border: \`1px solid \${T.amber}33\`, borderRadius: 8, fontSize: 12, color: T.amber, fontWeight: 600 }}>
                                    ⚠ {air1JsonParseWarning}
                                </div>
                            )}
                            {parsedAir1Json && (
                                <div style={{ marginTop: 16 }}>
                                    <button onClick={() => setReviewModeActive(true)} style={{ background: T.purple, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", fontWeight: 800, cursor: "pointer", width: "100%", fontSize: 15 }}>
                                        ✦ Open AIR-1 Review
                                    </button>
                                </div>
                            )}
                            {air1ReviewText.trim() && !parsedAir1Json && !air1JsonParseWarning && (
                                <div style={{ marginTop: 12, padding: "12px 16px", background: \`\${T.purple}08\`, border: \`1px solid \${T.purple}22\`, borderRadius: 10 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: T.purple, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>AIR-1 Review Pasted</div>
                                    <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.65 }}>{air1ReviewText.trim().slice(0, 300)}{air1ReviewText.trim().length > 300 ? "…" : ""}</div>
                                    <div style={{ marginTop: 8, fontSize: 11, color: T.subtle }}>Full review will be saved with this attempt. No structured data block detected.</div>
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 24, paddingTop: 20, borderTop: \`1px solid \${T.borderMid}\` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <button
                                disabled={!hasPastedText || saved}
                                onClick={handleSave}
                                style={primaryBtn(T.primaryAccent, !hasPastedText || saved)}
                            >
                                {saved ? "✓ Finalized" : "💾  Finalize Attempt"}
                            </button>

                            {canPrev && (
                                <button onClick={handlePrev} style={outlineBtn(T.dim)}>
                                    ← Previous
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                disabled={canNext && !hasPastedText}
                                style={outlineBtn(T.primaryAccent, canNext && !hasPastedText)}
                                title={canNext && !hasPastedText ? "Prepare answer text first" : undefined}
                            >
                                {canNext ? "→ Next Question" : "✓ Done"}
                            </button>

                            {hasPages && (
                                <button onClick={handleClearAll} style={outlineBtn(T.dim)}>
                                    ✕ Clear Pages
                                </button>
                            )}

                            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ ...label11(T.subtle), fontSize: 9, marginBottom: 2 }}>Pages</div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
                                        {uploadedPages.length} / {MAX_PAGES}
                                    </div>
                                </div>
                                <StatusChip status={pageStatus} />
                            </div>
                        </div>

                        {answerSaveState === "saving" && (
                            <div style={{ marginTop: 12, padding: "10px 14px", background: \`\${T.amber}11\`, border: \`1px solid \${T.amber}33\`, borderRadius: 8, fontSize: 12, color: T.amber, fontWeight: 600 }}>
                                ⏳ Saving to backend…
                            </div>
                        )}
                        {answerSaveState === "error" && answerSaveError && (
                            <div style={{ marginTop: 12, padding: "10px 14px", background: \`\${T.red}11\`, border: \`1px solid \${T.red}33\`, borderRadius: 8, fontSize: 12, color: T.red, fontWeight: 600 }}>
                                ⚠ {answerSaveError}
                            </div>
                        )}

                        {saved && (
                            <div style={{
                                background: \`\${T.green}11\`, border: \`1px solid \${T.green}33\`,
                                padding: "14px", borderRadius: 10, fontWeight: 700, color: T.green,
                                marginTop: 16, fontSize: 12,
                                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6,
                            }}>
                                <span>
                                    ✅ Attempt saved.
                                    {attemptId ? \` Backend ID: \${attemptId}\` : " (localStorage — backend pending)"}
                                </span>
                                {attemptId && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: T.green, opacity: 0.75 }}>
                                        Ready for evaluation ✓
                                    </span>
                                )}
                            </div>
                        )}

                        {saved && savedAttemptData && (
                            <div style={{ marginTop: 20 }}>
                                <MainsMistakeTagger
                                    attemptData={savedAttemptData}
                                    onMistakeSaved={() => {}}
                                />
                            </div>
                        )}
                    </div>
                    </div>

                {/* ═══ 8. AIR-1 JSON REVIEW (NEW) ════════════════════════════════════ */}
                {saved && finalAnswerText && (
                    <div style={{ borderTop: \`1px solid \${T.borderMid}\` }}>
                        <div style={{ padding: "20px 24px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Import AIR-1 Review</div>
                                    <div style={{ fontSize: 13, color: T.dim, fontWeight: 500 }}>Paste the output from ChatGPT (AIR-1 format). Click <strong>Analyze</strong> to render MentorOS cards.</div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                </div>
                            </div>

                            <textarea
                                value={air1JsonText}
                                onChange={(e) => setAir1JsonText(e.target.value)}
                                rows={10}
                                style={{
                                    width: "100%", boxSizing: "border-box",
                                    background: T.bg,
                                    border: \`1px solid \${air1JsonText.trim() ? T.purple + "55" : T.borderMid}\`,
                                    borderRadius: 10, color: T.text, fontSize: 13.5,
                                    lineHeight: 1.8, padding: "16px 18px", fontFamily: T.font,
                                    resize: "vertical", outline: "none",
                                    letterSpacing: "0.01em", transition: "border-color 0.2s",
                                }}
                                placeholder="Paste ChatGPT result here…"
                            />

                            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                                <button
                                    onClick={handleAnalyzeAir1Review}
                                    disabled={!air1JsonText.trim()}
                                    style={{ ...primaryBtn(T.purple, !air1JsonText.trim()) }}
                                >
                                    {analyzingAir1 ? "Analyzing…" : "Analyze Review"}
                                </button>
                                <button
                                    onClick={() => { setAir1JsonText(""); setAir1ParseResult(null); setAir1ParseError(""); }}
                                    style={{ ...outlineBtn(T.borderMid) }}
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => setShowRawReview(v => !v)}
                                    style={{ ...outlineBtn(T.dim) }}
                                >
                                    {showRawReview ? "Hide Review" : "View Review"}
                                </button>
                            </div>

                            {air1ParseError && (
                                <div style={{ marginTop: 12, color: T.red }}>{air1ParseError}</div>
                            )}

                            {air1ParseResult && (
                                <div style={{ marginTop: 12 }}>
                                    {!fixModeActive ? (
                                        <Air1PremiumReport data={air1ParseResult} rawReviewText={air1JsonText} onFinalize={handleSave} />
                                    ) : (
                                        <SectionCard accentTop={T.purple}>
                                            <div style={{ padding: "16px 18px" }}>
                                                <div style={{ fontSize: 13, fontWeight: 900, color: T.text, marginBottom: 8 }}>Fix: one task</div>
                                                <div style={{ fontSize: 13, color: T.text, marginBottom: 12 }}>{fixTask}</div>

                                                <textarea
                                                    value={fixDraft}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const maxLines = 5;
                                                        const lines = val.split(/\r?\n/);
                                                        if (lines.length > maxLines) {
                                                            setFixDraft(lines.slice(0, maxLines).join("\n"));
                                                        } else {
                                                            setFixDraft(val);
                                                        }
                                                    }}
                                                    rows={5}
                                                    style={{
                                                        width: "100%", boxSizing: "border-box",
                                                        background: T.bg,
                                                        border: \`1px solid \${T.border}\`,
                                                        borderRadius: 8, color: T.text, fontSize: 13.5,
                                                        lineHeight: 1.5, padding: "10px 12px", fontFamily: T.font,
                                                        resize: "vertical", outline: "none",
                                                    }}
                                                    placeholder="Rewrite your improved answer here"
                                                />

                                                <div style={{ fontSize: 12, color: T.subtle, marginTop: 8 }}>
                                                    Only rewrite the weak part, not full answer — max 5 lines.
                                                </div>

                                                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                                                    <button
                                                        onClick={handleSubmitFix}
                                                        disabled={fixSaving}
                                                        style={{
                                                            background: T.purple, color: T.btnText, border: "none",
                                                            borderRadius: 8, padding: "10px 14px", cursor: fixSaving ? "not-allowed" : "pointer", fontWeight: 800,
                                                        }}
                                                    >
                                                        {fixSaving ? "Saving…" : "Finalize Attempt"}
                                                    </button>
                                                    <button
                                                        onClick={handleCancelFix}
                                                        disabled={fixSaving}
                                                        style={{
                                                            background: "transparent", color: T.dim, border: \`1px solid \${T.border}\`,
                                                            borderRadius: 8, padding: "10px 14px", cursor: fixSaving ? "not-allowed" : "pointer", fontWeight: 700,
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </SectionCard>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Advanced: keep raw review area available but hidden by default */}
                {saved && finalAnswerText && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: T.dim }}>Advanced: ChatGPT review (optional)</div>
                            <button onClick={() => setShowRawReview(!showRawReview)} style={{ ...outlineBtn(T.blue, "sm") }}>
                                {showRawReview ? "Hide Review" : "View Review"}
                            </button>
                        </div>
                        {showRawReview && (
                            <MainsPasteReviewCard
                                externalReviewText={externalReviewText}
                                setExternalReviewText={setExternalReviewText}
                                reviewAgreement={reviewAgreement}
                                setReviewAgreement={setReviewAgreement}
                                reviewAgreementNote={reviewAgreementNote}
                                setReviewAgreementNote={setReviewAgreementNote}
                                onSaveReview={handleSaveReview}
                                onProcessReview={handleProcessReview}
                                canSaveReview={canSaveReview}
                                canProcessReview={canProcessReview}
                                reviewSaveState={reviewSaveState}
                                reviewProcessState={reviewProcessState}
                            />
                        )}
                    </div>
                )}

                {/* ── Pipeline banners ───────────────────────────────────────────── */}
                {saved && finalAnswerText && !attemptId && answerSaveState !== "saving" && (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: \`\${T.amber}11\`, border: \`1px solid \${T.amber}33\`, fontSize: 12, color: T.amber, fontWeight: 600 }}>
                        ⚠ Backend attempt ID not received — review pipeline unavailable. Try saving again.
                    </div>
                )}
                {reviewUiError && (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: \`\${T.red}11\`, border: \`1px solid \${T.red}33\`, fontSize: 12, color: T.red, fontWeight: 600 }}>
                        ✗ {reviewUiError}
                    </div>
                )}
                {reviewSaveState === "error" && reviewSaveError && (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: \`\${T.red}11\`, border: \`1px solid \${T.red}33\`, fontSize: 12, color: T.red, fontWeight: 600 }}>
                        ✗ Review save error: {reviewSaveError}
                    </div>
                )}
                {reviewProcessState === "error" && reviewProcessError && (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: \`\${T.red}11\`, border: \`1px solid \${T.red}33\`, fontSize: 12, color: T.red, fontWeight: 600 }}>
                        ✗ Process error: {reviewProcessError}
                    </div>
                )}
                {reviewProcessState === "processing" && (
                    <div style={{ padding: "10px 16px", borderRadius: 8, background: \`\${T.amber}11\`, border: \`1px solid \${T.amber}33\`, fontSize: 12, color: T.amber, fontWeight: 600 }}>
                        ⏳ Running review pipeline…
                    </div>
                )}

                {/* ═══ 9. REVIEW RESULT ════════════════════════════════════════════════ */}
                {processedReviewResult?.result && (
                    <MainsReviewResultCard
                        processedReviewResult={processedReviewResult.result}
                        reviewResultData={reviewResultData}
                        onOpenMistakes={handleOpenMistakeBook}
                        onOpenRevision={handleOpenRevisionTasks}
                        onNextQuestion={handleNext}
                    />
                )}
                    </SectionCard>
                )}

            </div>
        </div>
    );
}
`;
fs.writeFileSync("c:/Projects/upsc-mentor-pwa/upsc-mentor-cloud-deploy/upsc-mentor-pwa/src/pages/AnswerWritingPage.jsx", before + `
    const isDark = theme === "dark";
    
    const getNextAction = () => {
        if (!sessionStarted) return { text: "Read question and start the attempt timer.", cta: "Start Attempt", action: handleStartSession, primary: true };
        if (!hasPages) return { text: "Upload photos of your handwritten answer pages.", cta: "Upload Pages", action: () => fileInputRef.current?.click(), primary: true };
        if (!hasPastedText) return { text: "Extract text from pages or paste manually.", cta: "Prepare Text", action: handleExtractAnswer, primary: true };
        if (!hasEvaluationText) return { text: "Run basic evaluation to get initial scores.", cta: "Evaluate Answer", action: handleBasicReview, primary: true };
        if (!parsedAir1Json && !air1ReviewText) return { text: "Copy prompt, run in ChatGPT, and paste AIR-1 review.", cta: "Generate AIR-1 Prompt", action: handleCopyReviewPrompt, primary: true };
        if (!saved) return { text: "Finalize this attempt to save intelligence to your profile.", cta: "Finalize Attempt", action: handleSave, primary: true };
        return { text: "Attempt completed successfully. Great job!", cta: "Next Question", action: handleNext, primary: false };
    };

    const nextAction = getNextAction();

    return (
        <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>
            
            {/* 1. Premium Header */}
            <div style={{
                borderBottom: \`1px solid \${T.borderMid}\`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isDark ? "rgba(15, 23, 42, 0.9)" : "rgba(248, 250, 252, 0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 30
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "none", color: T.subtle, cursor: "pointer", fontSize: 20 }}>←</button>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: T.textBright }}>Mains Answer Review</div>
                        <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>Write, evaluate, improve, and save intelligence from every answer.</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <StatusChip status={pageStatus} />
                    <button onClick={toggleTheme} style={{ background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`, color: T.textBright, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                        {isDark ? "☀️ Light" : "🌙 Dark"}
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
                
                {/* 2. Hero Summary Card */}
                {sessionStarted && (
                    <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, borderRadius: 16, padding: 24, marginBottom: 32, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                        <div style={{ display: "flex", gap: 32 }}>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>Current Score</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: hasEvaluationText ? T.primaryAccent : T.dim }}>{parsedAir1Json?.score || (hasEvaluationText ? "?" : "—")}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase" }}>Target Score</div>
                                <div style={{ fontSize: 32, fontWeight: 900, color: T.textBright }}>{parsedAir1Json?.potentialScore || (hasEvaluationText ? "?" : "—")}</div>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 280, padding: "0 24px", borderLeft: \`1px solid \${T.borderMid}\`, borderRight: \`1px solid \${T.borderMid}\` }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.purple, textTransform: "uppercase", marginBottom: 8 }}>Examiner Impression</div>
                            <div style={{ fontSize: 14, color: parsedAir1Json?.examinerImpression ? T.textBright : T.dim, fontStyle: "italic", lineHeight: 1.5 }}>
                                {parsedAir1Json?.examinerImpression ? \`"\${parsedAir1Json.examinerImpression}"\` : "Awaiting detailed AIR-1 evaluation..."}
                            </div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 240 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Next Action</div>
                            <button onClick={nextAction.action} style={{ background: nextAction.primary ? T.primaryAccent : T.surfaceHigh, color: nextAction.primary ? "#fff" : T.textBright, border: \`1px solid \${nextAction.primary ? T.primaryAccent : T.borderMid}\`, padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer", width: "100%", transition: "all 0.2s" }}>
                                {nextAction.cta}
                            </button>
                            <div style={{ fontSize: 11, color: T.dim, marginTop: 8 }}>{nextAction.text}</div>
                        </div>
                    </div>
                )}

                {/* 3. Two-Column Layout */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, alignItems: "start" }}>
                    
                    {/* Left Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                        
                        {/* Question Card */}
                        <SectionCard accentTop={T.primaryAccent}>
                            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6 }}>{SESSION.paper}</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6 }}>{marks} Marks</span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: T.textBright, background: T.surfaceHigh, padding: "4px 10px", borderRadius: 6 }}>{wordTarget} Words</span>
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: T.textBright, lineHeight: 1.6 }}>{SESSION.question}</div>
                                {!sessionStarted && (
                                    <button onClick={handleStartSession} style={{ background: T.primaryAccent, color: "#fff", padding: "12px 24px", borderRadius: 8, fontWeight: 800, border: "none", cursor: "pointer", width: "fit-content", marginTop: 8 }}>
                                        Start Attempt Timer
                                    </button>
                                )}
                            </div>
                        </SectionCard>

                        {/* Candidate Answer Card */}
                        {sessionStarted && (
                            <SectionCard accentTop={T.blue}>
                                <div style={{ padding: 24 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 16 }}>Your Answer</div>
                                    
                                    {/* Uploading */}
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                            <span style={{ fontSize: 12, color: T.dim, fontWeight: 600 }}>Pages ({uploadedPages.length}/{MAX_PAGES})</span>
                                            {hasPages && <button onClick={handleClearAll} style={{ background: "none", border: "none", color: T.red, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Clear All</button>}
                                        </div>
                                        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
                                            {uploadedPages.map((pg, i) => (
                                                <div key={i} style={{ width: 100, height: 140, background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`, borderRadius: 8, overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                                    <img src={pg.preview} alt={\`Page \${i+1}\`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    <button onClick={() => handleRemovePage(i)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 10, cursor: "pointer" }}>✕</button>
                                                </div>
                                            ))}
                                            {uploadedPages.length < MAX_PAGES && (
                                                <div onClick={() => fileInputRef.current?.click()} style={{ width: 100, height: 140, background: T.surfaceHigh, border: \`2px dashed \${T.borderMid}\`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: T.subtle, fontSize: 24 }}>+</div>
                                            )}
                                        </div>
                                        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                                    </div>

                                    {/* Text Extraction */}
                                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                                        <button onClick={handleExtractAnswer} disabled={!hasPages || isExtracting} style={{ flex: 1, background: T.surfaceHigh, color: T.textBright, border: \`1px solid \${T.borderMid}\`, padding: "10px", borderRadius: 8, fontWeight: 700, cursor: hasPages ? "pointer" : "not-allowed" }}>
                                            {isExtracting ? "Extracting..." : "Auto-Extract Text"}
                                        </button>
                                    </div>
                                    <textarea
                                        value={pastedText}
                                        onChange={(e) => { setPastedText(e.target.value); setSaved(false); }}
                                        rows={8}
                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: \`1px solid \${T.borderMid}\`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                        placeholder="Your answer text..."
                                    />
                                    <div style={{ fontSize: 12, color: T.dim, marginTop: 8 }}>Words: {wordCount} / {wordTarget}</div>
                                </div>
                            </SectionCard>
                        )}

                        {/* Basic Review Card */}
                        {hasPastedText && (
                            <SectionCard accentTop={T.amber}>
                                <div style={{ padding: 24 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>Basic Evaluation</div>
                                        <button onClick={handleBasicReview} disabled={isEvaluating} style={{ background: T.surfaceHigh, border: \`1px solid \${T.borderMid}\`, color: T.textBright, padding: "6px 12px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
                                            {isEvaluating ? "Evaluating..." : "Run Evaluation"}
                                        </button>
                                    </div>
                                    <textarea
                                        value={evaluationText}
                                        onChange={(e) => setEvaluationText(e.target.value)}
                                        rows={6}
                                        style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: \`1px solid \${T.borderMid}\`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                        placeholder="Basic evaluation report..."
                                    />
                                </div>
                            </SectionCard>
                        )}

                        {/* Advanced AIR-1 Review Card */}
                        {hasEvaluationText && (
                            <SectionCard accentTop={T.purple}>
                                <div style={{ padding: 24 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 16 }}>Advanced AIR-1 Review</div>
                                    <MainsReviewPromptCard
                                        currentQuestion={{ text: SESSION.question, marks: parseInt(SESSION.marks), paper: SESSION.paper, topic: topic, syllabusNode: syllabusNodeId }}
                                        finalAnswerText={finalAnswerText}
                                        papersAccent={paperAccent}
                                        wordTarget={wordTarget}
                                        onCopyPrompt={handleCopyReviewPrompt}
                                        onOpenChatGPT={handleOpenChatGPTReview}
                                        canCopyReviewPrompt={canCopyReviewPrompt}
                                        promptCopied={reviewPromptCopied}
                                    />
                                    <div style={{ marginTop: 24 }}>
                                        <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, marginBottom: 8, textTransform: "uppercase" }}>Import AIR-1 Output</div>
                                        <textarea
                                            value={air1JsonText || air1ReviewText}
                                            onChange={(e) => handleAir1ReviewChange(e.target.value)}
                                            rows={6}
                                            style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: \`1px solid \${air1ReviewText.trim() ? T.purple : T.borderMid}\`, borderRadius: 8, color: T.text, padding: 16, fontFamily: T.font, fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none" }}
                                            placeholder="Paste ChatGPT result..."
                                        />
                                    </div>
                                    {parsedAir1Json && (
                                        <button onClick={() => setReviewModeActive(true)} style={{ background: T.purple, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", fontWeight: 800, cursor: "pointer", width: "100%", marginTop: 16, fontSize: 15 }}>
                                            View Premium Report
                                        </button>
                                    )}
                                </div>
                            </SectionCard>
                        )}
                        
                    </div>

                    {/* Right Column: Sticky Panel */}
                    <div style={{ position: "sticky", top: 100, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
                        {sessionStarted && (
                            <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, borderRadius: 16, overflow: "hidden", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                                <Timer key={currentIndex} marks={marks} accent={paperAccent} autoStart={sessionStarted} timerRef={timerSectionRef} onStatusChange={setTimerStatus} />
                            </div>
                        )}
                        <div style={{ background: T.surface, border: \`1px solid \${T.border}\`, borderRadius: 16, padding: 24, boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: saved ? T.green : T.amber }}></span>
                                Attempt Intelligence
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>Words</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{wordCount} / {wordTarget}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>Pages</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{uploadedPages.length}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: T.dim, fontSize: 13 }}>State</span>
                                    <span style={{ color: T.textBright, fontSize: 13, fontWeight: 700 }}>{saved ? "Finalized" : "Draft"}</span>
                                </div>
                            </div>
                            
                            {parsedAir1Json?.whyMarksLost && (
                                <div style={{ marginTop: 24, paddingTop: 16, borderTop: \`1px solid \${T.borderMid}\` }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: T.subtle, marginBottom: 12, textTransform: "uppercase" }}>Top Weaknesses</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {parsedAir1Json.whyMarksLost.slice(0, 3).map((w, i) => (
                                            <div key={i} style={{ fontSize: 13, color: T.textBright, lineHeight: 1.4, display: "flex", gap: 8 }}>
                                                <span style={{ color: T.red, flexShrink: 0 }}>•</span> <span>{w}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ marginTop: 24 }}>
                                <button onClick={handleSave} disabled={!hasPastedText || saved} style={{ background: saved ? T.green : T.textBright, color: saved ? "#fff" : "#000", border: "none", padding: "12px", borderRadius: 8, fontWeight: 800, cursor: hasPastedText && !saved ? "pointer" : "not-allowed", width: "100%", fontSize: 14 }}>
                                    {saved ? "✓ Finalized" : "💾 Finalize Attempt"}
                                </button>
                                {!saved && <div style={{ fontSize: 11, color: T.dim, marginTop: 8, textAlign: "center" }}>Saves answer to your timeline.</div>}
                            </div>
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>
    );
}

` + after);
