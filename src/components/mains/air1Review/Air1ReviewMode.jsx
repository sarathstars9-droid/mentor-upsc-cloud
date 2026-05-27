import React, { useState } from "react";
import { downloadAir1ReviewPdf } from "../../../utils/downloadAir1ReviewPdf";
import Air1VisualPdfExport from "./Air1VisualPdfExport";

export default function Air1ReviewMode({ data, rawReviewText, uploadedPages, finalAnswerText, marks, questionText, paper, year, wordLimit, onFinalize, onExit, appTheme }) {
    const [theme, setTheme] = useState(appTheme || "light");
    const [showDetailedReview, setShowDetailedReview] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    if (!data) return null;
    const totalMarks = Number(marks || data?.marks || data?.totalMarks || 10) || 10;
    const isDark = theme === "dark";

    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        const originalTheme = theme;
        if (originalTheme === "dark") {
            setTheme("light");
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        try {
            await downloadAir1ReviewPdf({
                data,
                questionText,
                marks: totalMarks,
                paper,
                year,
                wordLimit,
                fileName: "MentorOS-AIR1-Review.pdf",
            });
        } finally {
            if (originalTheme === "dark") {
                setTheme("dark");
            }
            setIsDownloading(false);
        }
    };
    
    const T = isDark ? {
        bg:          "#0f172a",
        surface:     "rgba(255, 255, 255, 0.03)",
        surfaceHigh: "rgba(255, 255, 255, 0.08)",
        border:      "rgba(255, 255, 255, 0.1)",
        borderMid:   "rgba(255, 255, 255, 0.2)",
        subtle:      "#94a3b8",
        dim:         "#cbd5e1",
        text:        "#f8fafc",
        textBright:  "#ffffff",
        amber:       "#fbbf24",
        amberBg:     "rgba(251, 191, 36, 0.1)",
        blue:        "#60a5fa",
        blueBg:      "rgba(96, 165, 250, 0.1)",
        green:       "#34d399",
        greenBg:     "rgba(52, 211, 153, 0.1)",
        red:         "#f87171",
        redBg:       "rgba(248, 113, 113, 0.1)",
        purple:      "#a78bfa",
        purpleBg:    "rgba(167, 139, 250, 0.1)",
        font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    } : {
        bg:          "#f8fafc",
        surface:     "#ffffff",
        surfaceHigh: "#f1f5f9",
        border:      "#e2e8f0",
        borderMid:   "#cbd5e1",
        subtle:      "#64748b",
        dim:         "#334155",
        text:        "#1e293b",
        textBright:  "#0f172a",
        amber:       "#d97706",
        amberBg:     "#fef3c7",
        blue:        "#2563eb",
        blueBg:      "#eff6ff",
        green:       "#059669",
        greenBg:     "#ecfdf5",
        red:         "#dc2626",
        redBg:       "#fee2e2",
        purple:      "#7c3aed",
        purpleBg:    "#f3e8ff",
        font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    };

    const {
        evaluationData,
        air1ParsedJson,
        parsedReview,
        reviewData,
    } = data || {};

    const root =
      evaluationData ||
      air1ParsedJson ||
      parsedReview ||
      reviewData ||
      data ||
      {};

    const cards = root.cards || {};

    const quickEvaluation =
      cards.quickEvaluation ||
      root.card1_quickEvaluation ||
      root.quickEvaluation ||
      {};

    const howToImprove =
      cards.howToImprove ||
      root.card2_howToImprove ||
      root.howToImprove ||
      {};

    const air1Upgrades =
      cards.air1Upgrades ||
      root.card3_air1Upgrades ||
      root.air1Upgrades ||
      {};

    const air1ModelAnswer =
      cards.air1ModelAnswer ||
      root.card4_air1ModelAnswer ||
      root.air1ModelAnswer ||
      {};

    const whyThisScoresHigh =
      cards.whyThisScoresHigh ||
      root.card5_whyThisScoresHigh ||
      root.whyThisScoresHigh ||
      {};

    const detailedMentorReview =
      cards.detailedMentorReview ||
      root.card6_detailedMentorReview ||
      root.detailedMentorReview ||
      {};

    const score =
      quickEvaluation.score !== undefined ? quickEvaluation.score :
      quickEvaluation.estimatedScore !== undefined ? quickEvaluation.estimatedScore :
      cards.score !== undefined ? cards.score :
      root.score !== undefined ? root.score :
      null;

    const potentialScore =
      quickEvaluation.potentialScore !== undefined ? quickEvaluation.potentialScore :
      cards.potentialScore !== undefined ? cards.potentialScore :
      root.potentialScore !== undefined ? root.potentialScore :
      null;

    const examinerImpression =
      quickEvaluation.examinerImpression ||
      cards.examinerImpression ||
      root.examinerImpression;

    const idealUPSCStructure =
      howToImprove.idealUPSCStructure ||
      howToImprove.idealStructure ||
      root.idealStructure ||
      root.idealUPSCStructure ||
      cards.idealStructure ||
      cards.idealUPSCStructure ||
      [];

    const topImprovements =
      howToImprove.top5ImprovementsOnly ||
      howToImprove.topImprovements ||
      root.topImprovements ||
      root.top5ImprovementsOnly ||
      cards.topImprovements ||
      cards.top5ImprovementsOnly ||
      [];

    const themeBasedFlowchart =
      howToImprove.themeBasedFlowchart ||
      howToImprove.themeFlowchart ||
      root.themeFlowchart ||
      root.themeBasedFlowchart ||
      cards.themeFlowchart ||
      cards.themeBasedFlowchart ||
      {};

    const themeFlowchartTitle =
      themeBasedFlowchart.title || "Answer Logic Flow";

    const themeFlowchartSteps =
      Array.isArray(themeBasedFlowchart)
        ? themeBasedFlowchart
        : Array.isArray(themeBasedFlowchart.flow)
        ? themeBasedFlowchart.flow
        : Array.isArray(themeBasedFlowchart.steps)
        ? themeBasedFlowchart.steps
        : [];

    const normalizedThemeFlowchartSteps =
      themeFlowchartSteps.length === 1 && typeof themeFlowchartSteps[0] === "string"
        ? themeFlowchartSteps[0]
            .split(/(?:->|→|➜|=>)/)
            .map((s) => s.trim())
            .filter(Boolean)
        : themeFlowchartSteps;

    const diagramSuggestions =
      Array.isArray(howToImprove.diagramSuggestions)
        ? howToImprove.diagramSuggestions
        : Array.isArray(root.diagramSuggestions)
        ? root.diagramSuggestions
        : Array.isArray(cards.diagramSuggestions)
        ? cards.diagramSuggestions
        : [];

    const finalMemoryHook =
      howToImprove.finalMemoryHook ||
      howToImprove.mnemonic ||
      root.mnemonic ||
      root.finalMemoryHook ||
      cards.mnemonic ||
      cards.finalMemoryHook ||
      null;

    const modelAnswer =
      air1ModelAnswer.answer ||
      air1ModelAnswer.modelAnswer ||
      root.modelAnswer ||
      root.model_answer ||
      cards.modelAnswer ||
      "";

    const whyScoresHigh =
      Array.isArray(whyThisScoresHigh)
        ? whyThisScoresHigh
        : Array.isArray(whyThisScoresHigh.checklist)
        ? whyThisScoresHigh.checklist
        : Array.isArray(whyThisScoresHigh.whyThisScoresHigh)
        ? whyThisScoresHigh.whyThisScoresHigh
        : Array.isArray(root.whyThisScoresHigh)
        ? root.whyThisScoresHigh
        : Array.isArray(root.whyThisScoresHigh?.checklist)
        ? root.whyThisScoresHigh.checklist
        : Array.isArray(cards.whyThisScoresHigh)
        ? cards.whyThisScoresHigh
        : Array.isArray(cards.whyThisScoresHigh?.checklist)
        ? cards.whyThisScoresHigh.checklist
        : [];

    // Backward Compatibility Mapping
    const isOldSchema = score && typeof score === 'object';
    
    const displayScore = isOldSchema ? score.awarded : score;
    const displayPotential = isOldSchema ? score.total : potentialScore;

    const introUpgrade =
      air1Upgrades.intro ||
      air1Upgrades.introComparison ||
      null;

    const bodyUpgrade =
      air1Upgrades.bodyParagraph ||
      air1Upgrades.bodyParagraphComparison ||
      null;

    const conclusionUpgrade =
      air1Upgrades.conclusion ||
      air1Upgrades.conclusionComparison ||
      null;

    let displayUpgrades = [];
    if (introUpgrade || bodyUpgrade || conclusionUpgrade) {
        if (introUpgrade) {
            displayUpgrades.push({
                section: "Intro",
                yourLine: introUpgrade.yourLine || "",
                air1Upgrade: introUpgrade.air1Upgrade || "",
                whyBetter: introUpgrade.whyBetter || ""
            });
        }
        if (bodyUpgrade) {
            displayUpgrades.push({
                section: "Body Paragraph",
                yourLine: bodyUpgrade.yourLine || "",
                air1Upgrade: bodyUpgrade.air1Upgrade || "",
                whyBetter: bodyUpgrade.whyBetter || ""
            });
        }
        if (conclusionUpgrade) {
            displayUpgrades.push({
                section: "Conclusion",
                yourLine: conclusionUpgrade.yourLine || "",
                air1Upgrade: conclusionUpgrade.air1Upgrade || "",
                whyBetter: conclusionUpgrade.whyBetter || ""
            });
        }
    } else if (Array.isArray(air1Upgrades)) {
        displayUpgrades = air1Upgrades;
    } else if (Array.isArray(air1Upgrades.air1Upgrades)) {
        displayUpgrades = air1Upgrades.air1Upgrades;
    } else if (Array.isArray(cards.air1Upgrades)) {
        displayUpgrades = cards.air1Upgrades;
    } else if (Array.isArray(root.air1Upgrades)) {
        displayUpgrades = root.air1Upgrades;
    } else if (isOldSchema && data.mistakes && data.mistakes.length > 0) {
        displayUpgrades = data.mistakes.map(m => ({
            section: m.tag || 'Improvement',
            yourLine: m.userLine || m.problem,
            air1Upgrade: m.fix,
            whyBetter: `Resolves: ${m.problem}`
        }));
    }

    let displayImprovements = topImprovements;
    if ((!displayImprovements || displayImprovements.length === 0) && isOldSchema && data.lossReasons && data.lossReasons.length > 0) {
        displayImprovements = data.lossReasons;
    }

    const displayWhyScoresHigh = whyScoresHigh;

    let displayDetailedMentorReview = "";
    if (detailedMentorReview && typeof detailedMentorReview === "object") {
        const parts = [];
        if (detailedMentorReview.strengths) {
            parts.push(`### Strengths\n${detailedMentorReview.strengths}`);
        }
        if (detailedMentorReview.majorIssues) {
            parts.push(`### Major Issues\n${detailedMentorReview.majorIssues}`);
        }
        if (detailedMentorReview.factualCorrections) {
            parts.push(`### Factual Corrections\n${detailedMentorReview.factualCorrections}`);
        }
        if (detailedMentorReview.nextAttemptStrategy) {
            parts.push(`### Next Attempt Strategy\n${detailedMentorReview.nextAttemptStrategy}`);
        }
        if (detailedMentorReview.targetScorePath) {
            parts.push(`### Target Score Path\n${detailedMentorReview.targetScorePath}`);
        }
        displayDetailedMentorReview = parts.join("\n\n");
    } else if (typeof detailedMentorReview === "string") {
        displayDetailedMentorReview = detailedMentorReview;
    } else if (typeof cards.detailedMentorReview === "string") {
        displayDetailedMentorReview = cards.detailedMentorReview;
    } else if (typeof root.detailedMentorReview === "string") {
        displayDetailedMentorReview = root.detailedMentorReview;
    }

    const getScoreColor = (s, p) => {
        if (!s || !p) return T.amber;
        const ratio = parseFloat(s) / parseFloat(p);
        if (ratio >= 0.8) return T.green;
        if (ratio >= 0.6) return T.blue;
        if (ratio >= 0.4) return T.amber;
        return T.red;
    };

    const hasData = (arr) => Array.isArray(arr) && arr.length > 0;

    const Card = ({ children, style, className }) => (
        <div className={`air1-card ${className || ""}`} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0,0,0,0.03)", ...style }}>
            {children}
        </div>
    );

    // ── helpers ──────────────────────────────────────────────────────────────
    const renderModelAnswerText = (text) => text.split('\n').map((paragraph, i) => {
        const trimmed = paragraph.trim();
        if (!trimmed) return <div key={i} style={{ height: 14 }} />;
        const headingMatch = trimmed.match(/^(?:###|##|#|\*\*|\d+\.)\s*(.+?)(?:\*\*|:)?$/);
        
        let isHeading = false;
        let title = trimmed;
        
        if (headingMatch) {
            isHeading = true;
            title = headingMatch[1].replace(/\*\*/g, '').trim();
        } else if (trimmed.length < 50 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
            isHeading = true;
            title = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        }

        if (isHeading) {
            return <div key={i} style={{ marginTop: 22, marginBottom: 10, fontSize: "15px", fontWeight: 700, color: T.purple, letterSpacing: "0.01em" }}>{title}</div>;
        }

        let pText = trimmed;
        // Sentence case for long uppercase paragraphs
        if (pText === pText.toUpperCase() && /[A-Z]/.test(pText)) {
            pText = pText.charAt(0).toUpperCase() + pText.slice(1).toLowerCase();
        }

        const formatted = pText.split(/(\*\*.*?\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} style={{ fontWeight: 700, color: T.textBright }}>{part.slice(2, -2)}</strong>
                : part
        );
        return (
            <div key={i} style={{ marginBottom: 16, display: "flex", gap: 8, fontSize: "14.5px", lineHeight: "1.75" }}>
                {pText.startsWith('-') || pText.startsWith('•')
                    ? <><span style={{ color: T.purple, userSelect: "none", flexShrink: 0 }}>•</span><span>{formatted.map(t => typeof t === 'string' ? t.replace(/^[-•]\s*/, '') : t)}</span></>
                    : <span>{formatted}</span>}
            </div>
        );
    });

    const marksGap = (displayPotential != null && displayScore != null)
        ? (parseFloat(displayPotential) - parseFloat(displayScore)).toFixed(1)
        : null;

    return (
        <div id="air1-full-page-export" style={{ background: T.bg, color: T.text, minHeight: "100vh", padding: "0 0 120px 0", fontFamily: T.font, wordBreak: "normal", overflowWrap: "break-word", whiteSpace: "normal" }}>
            <style dangerouslySetInnerHTML={{ __html: `
                .air1-visual-card {
                  padding: 24px 28px;
                }

                .visual-section {
                  margin-top: 22px;
                }

                .visual-section-head {
                  margin-bottom: 14px;
                }

                .visual-eyebrow {
                  display: inline-flex;
                  font-size: 11px;
                  font-weight: 800;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  color: #059669;
                  margin-bottom: 6px;
                }

                .visual-section-head h3 {
                  margin: 0;
                  font-size: 16.5px;
                  font-weight: 800;
                  color: ${isDark ? "#ffffff" : "#0f172a"};
                }

                .flowchart-canvas {
                  position: relative;
                  display: grid;
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                  grid-template-rows: repeat(2, auto);
                  gap: 34px 42px;
                  padding: 28px;
                  border-radius: 20px;
                  border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.10)" : "rgba(15, 23, 42, 0.10)"};
                  background: ${isDark ? 
                    "radial-gradient(circle at top left, rgba(124, 58, 237, 0.15), transparent 34%), linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))" : 
                    "radial-gradient(circle at top left, rgba(124, 58, 237, 0.08), transparent 34%), linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.95))"
                  };
                }

                .flow-node {
                  position: relative;
                  z-index: 2;
                  min-height: 90px;
                  padding: 16px 16px 16px 52px;
                  border-radius: 16px;
                  background: ${isDark ? "rgba(255, 255, 255, 0.03)" : "#ffffff"};
                  border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(148, 163, 184, 0.35)"};
                  box-shadow: ${isDark ? "none" : "0 4px 10px rgba(15, 23, 42, 0.03)"};
                  display: flex;
                  align-items: center;
                }

                .flow-node p {
                  margin: 0;
                  font-size: 13.5px;
                  line-height: 1.45;
                  font-weight: 700;
                  color: ${isDark ? "#ffffff" : "#0f172a"};
                }

                .flow-node-number {
                  position: absolute;
                  left: 16px;
                  top: 50%;
                  transform: translateY(-50%);
                  width: 24px;
                  height: 24px;
                  border-radius: 999px;
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: 900;
                  color: ${isDark ? "#fbbf24" : "#7c2d12"};
                  background: ${isDark ? "rgba(251, 191, 36, 0.15)" : "#fed7aa"};
                }

                .flow-node-last {
                  background: ${isDark ? "rgba(52, 211, 153, 0.08)" : "#ecfdf5"} !important;
                  border: 1px solid rgba(52, 211, 153, 0.4) !important;
                }

                .flow-node-1 { grid-column: 1; grid-row: 1; }
                .flow-node-2 { grid-column: 2; grid-row: 1; }
                .flow-node-3 { grid-column: 3; grid-row: 1; }
                .flow-node-4 { grid-column: 3; grid-row: 2; }
                .flow-node-5 { grid-column: 2; grid-row: 2; }
                .flow-node-6 { grid-column: 1; grid-row: 2; }
                .flow-node-7 { grid-column: 1 / span 3; grid-row: 3; }

                .flow-arrow {
                  position: absolute;
                  z-index: 1;
                  font-size: 24px;
                  font-weight: 900;
                  color: ${isDark ? "#a78bfa" : "#6d28d9"};
                  opacity: 0.8;
                }

                .arrow-1 { top: 62px; left: 31.5%; }
                .arrow-2 { top: 62px; left: 65%; }
                .arrow-3 { top: 124px; right: 15%; }
                .arrow-4 { top: 186px; left: 65%; }
                .arrow-5 { top: 186px; left: 31.5%; }
                .arrow-6 { top: 248px; left: 15%; }

                .diagram-grid {
                  display: grid;
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                  gap: 16px;
                }

                .diagram-card {
                  padding: 20px 24px;
                  border-radius: 18px;
                  background: ${isDark ? "rgba(255, 255, 255, 0.03)" : "#fff"};
                  border: 1px solid rgba(245, 158, 11, 0.28);
                  box-shadow: ${isDark ? "none" : "0 4px 12px rgba(15, 23, 42, 0.03)"};
                  display: flex;
                  flex-direction: column;
                  gap: 12px;
                }

                .diagram-card-top {
                  display: flex;
                  flex-direction: column;
                  gap: 6px;
                }

                .diagram-pill {
                  width: fit-content;
                  padding: 5px 10px;
                  border-radius: 999px;
                  background: ${isDark ? "rgba(251, 191, 36, 0.12)" : "rgba(245, 158, 11, 0.12)"};
                  color: ${isDark ? "#fbbf24" : "#92400e"};
                  font-size: 11.5px;
                  font-weight: 800;
                  text-transform: uppercase;
                  letter-spacing: 0.02em;
                }

                .diagram-card strong {
                  font-size: 16px;
                  color: ${isDark ? "#ffffff" : "#0f172a"};
                  font-weight: 800;
                }

                .diagram-labels {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 8px;
                }

                .diagram-labels span {
                  padding: 6px 12px;
                  border-radius: 999px;
                  background: ${isDark ? "rgba(255, 255, 255, 0.06)" : "#f1f5f9"};
                  border: 1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "#cbd5e1"};
                  color: ${isDark ? "#cbd5e1" : "#1e293b"};
                  font-size: 13px;
                  font-weight: 600;
                }

                .diagram-reason {
                  margin: 0;
                  padding: 10px 14px;
                  border-radius: 8px;
                  font-size: 13px;
                  line-height: 1.55;
                  background: ${isDark ? "rgba(255, 255, 255, 0.02)" : "#f8fafc"};
                  border-left: 3px solid ${isDark ? T.amber : "rgba(245, 158, 11, 0.6)"};
                  color: ${isDark ? "#cbd5e1" : "#475569"};
                }

                .memory-hook-premium {
                  margin-top: 20px;
                  display: flex;
                  flex-direction: column;
                  gap: 14px;
                  padding: 20px 24px;
                  border-radius: 18px;
                  background: ${isDark ? "rgba(255, 255, 255, 0.02)" : "#ffffff"};
                  border: 1px solid ${isDark ? "rgba(124, 58, 237, 0.3)" : "rgba(124, 58, 237, 0.2)"};
                  box-shadow: ${isDark ? "none" : "0 4px 12px rgba(124, 58, 237, 0.04)"};
                }

                .memory-hook-header {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                }

                .memory-hook-word-pill {
                  display: inline-flex;
                  padding: 6px 14px;
                  border-radius: 10px;
                  background: ${isDark ? "rgba(167, 139, 250, 0.15)" : "#f3e8ff"};
                  border: 1px solid ${isDark ? "rgba(167, 139, 250, 0.3)" : "rgba(124, 58, 237, 0.3)"};
                  color: ${isDark ? "#a78bfa" : "#6d28d9"};
                  font-size: 16px;
                  letter-spacing: 0.08em;
                  font-weight: 900;
                }

                .memory-hook-grid {
                  display: grid;
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                  gap: 8px 20px;
                }

                .memory-hook-item {
                  margin: 0;
                  font-size: 13.5px;
                  line-height: 1.5;
                  color: ${isDark ? "#e2e8f0" : "#334155"};
                  font-weight: 600;
                  display: flex;
                  gap: 6px;
                  align-items: flex-start;
                }

                .memory-hook-why-note {
                  margin: 0;
                  font-size: 12.5px;
                  line-height: 1.5;
                  color: ${isDark ? "#94a3b8" : "#64748b"};
                  font-style: italic;
                  padding-top: 8px;
                  border-top: 1px dashed ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(15, 23, 42, 0.08)"};
                }

                .why-scores-high-grid {
                  display: grid;
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                  gap: 14px;
                }

                .flow-arrow-mobile {
                  display: none;
                }

                @media (max-width: 900px) {
                  .flowchart-canvas,
                  .diagram-grid,
                  .memory-hook-premium,
                  .memory-hook-grid,
                  .why-scores-high-grid {
                    grid-template-columns: 1fr;
                  }

                  .flow-node {
                    grid-column: auto !important;
                    grid-row: auto !important;
                  }

                  .flow-arrow {
                    display: none;
                  }
                }

                @media (max-width: 768px) {
                  .mos-sidebar-v2 {
                    display: none !important;
                  }

                  .mentoros-main {
                    margin-left: 0 !important;
                    width: 100vw !important;
                    max-width: 100vw !important;
                    overflow-x: hidden !important;
                  }

                  .mentoros-content {
                    padding: 10px !important;
                  }

                  body {
                    overflow-x: hidden;
                  }

                  .air1-review-container {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    padding: 12px !important;
                  }

                  .air1-card {
                    padding: 16px !important;
                    border-radius: 16px !important;
                  }

                  .air1-topbar-outer {
                    padding: 8px 12px !important;
                  }

                  .air1-topbar {
                    display: flex !important;
                    flex-wrap: wrap !important;
                    gap: 8px !important;
                    justify-content: space-between !important;
                  }

                  .air1-topbar button {
                    font-size: 11.5px !important;
                    padding: 6px 10px !important;
                    white-space: nowrap;
                  }

                  .air1-action-bar {
                    display: flex !important;
                    gap: 6px !important;
                    justify-content: flex-end !important;
                  }

                  .air1-score-pills {
                    order: 2;
                    width: 100%;
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                  }

                  .air1-score-pills > div {
                    flex: 1 !important;
                    justify-content: center !important;
                  }

                  .air1-card-grid,
                  .air1-upgrade-row,
                  .diagram-grid,
                  .why-scores-high-grid {
                    grid-template-columns: 1fr !important;
                  }

                  .air1-upgrade-your-line {
                    border-right: none !important;
                    border-bottom: 1px solid ${T.border} !important;
                  }

                  .flowchart-canvas {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 10px !important;
                    padding: 14px !important;
                  }

                  .flow-node {
                    width: 100% !important;
                    min-height: auto !important;
                    padding: 12px 12px 12px 44px !important;
                    grid-column: auto !important;
                    grid-row: auto !important;
                  }

                  .flow-node p {
                    font-size: 13px !important;
                    line-height: 1.45 !important;
                    word-break: normal !important;
                  }

                  .flow-arrow {
                    display: none !important;
                  }

                  .flow-arrow-mobile {
                    display: block !important;
                    text-align: center !important;
                    font-size: 18px !important;
                    color: ${isDark ? "#a78bfa" : "#6d28d9"} !important;
                    margin: -2px 0 !important;
                  }

                  .diagram-card {
                    padding: 14px !important;
                  }

                  .diagram-labels span {
                    font-size: 11.5px !important;
                    padding: 5px 8px !important;
                  }

                  .diagram-reason {
                    font-size: 12.5px !important;
                  }

                  .memory-hook-premium {
                    gap: 12px !important;
                    padding: 14px !important;
                  }

                  .memory-hook-grid {
                    grid-template-columns: 1fr !important;
                  }

                  .model-answer-card,
                  .air1-model-answer {
                    width: 100% !important;
                  }

                  .model-answer-body {
                    font-size: 14px !important;
                    line-height: 1.7 !important;
                  }
                }
            ` }} />

            {/* ── STICKY TOP BAR ─────────────────────────────────────────── */}
            <div className="air1-topbar-outer" style={{ position: "sticky", top: 0, background: isDark ? "rgba(15,23,42,0.97)" : "rgba(248,250,252,0.97)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${T.border}`, zIndex: 110, padding: "12px 24px" }}>
                <div className="air1-topbar" style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>

                    {/* Back */}
                    <button onClick={onExit} style={{ background: "transparent", border: `1px solid ${T.borderMid}`, color: T.text, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>
                        ← Workspace
                    </button>

                    {/* Score chips — centre */}
                    <div className="air1-score-pills" style={{ flex: 1, display: "flex", justifyContent: "center", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: isDark ? "rgba(248,113,113,0.12)" : "#fee2e2", border: `1px solid ${T.red}40`, borderRadius: 10, padding: "6px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.red, textTransform: "uppercase", letterSpacing: "0.04em" }}>Score</span>
                            <span style={{ fontSize: 20, fontWeight: 800, color: T.red, lineHeight: 1 }}>{displayScore ?? "—"}</span>
                            <span style={{ fontSize: 13, color: T.subtle }}>/ {totalMarks}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, background: isDark ? "rgba(167,139,250,0.12)" : "#f3e8ff", border: `1px solid ${T.purple}40`, borderRadius: 10, padding: "6px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.purple, textTransform: "uppercase", letterSpacing: "0.04em" }}>Target</span>
                            <span style={{ fontSize: 20, fontWeight: 800, color: T.purple, lineHeight: 1 }}>{displayPotential ?? "—"}</span>
                            <span style={{ fontSize: 13, color: T.subtle }}>/ {totalMarks}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="air1-action-bar" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <button onClick={() => setTheme(isDark ? "light" : "dark")} style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, color: T.text, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                            {isDark ? "☀️" : "🌙"}
                        </button>
                        <button onClick={handleDownloadPdf} disabled={isDownloading} style={{ background: T.surfaceHigh, border: `1.5px solid ${T.borderMid}`, color: T.textBright, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isDownloading ? "not-allowed" : "pointer", opacity: isDownloading ? 0.7 : 1 }}>
                            {isDownloading ? "Preparing…" : "⬇ Download PDF"}
                        </button>
                        <button onClick={onFinalize} style={{ background: T.purple, color: "#fff", border: "none", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, boxShadow: "0 2px 8px rgba(124,58,237,0.25)" }}>
                            Finalize Attempt
                        </button>
                    </div>
                </div>
            </div>

            {/* ── CARDS ──────────────────────────────────────────────────── */}
            <div id="air1-review-export-area" className="air1-review-container" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px", display: "flex", flexDirection: "column", gap: 26 }}>

                {/* ── CARD 1: QUICK EVALUATION ─────────────────────────── */}
                <div data-air1-pdf-section="summary">
                <Card>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Card 1 · Quick Evaluation</div>

                    {/* Score row */}
                    <div style={{ display: "flex", gap: 10, marginBottom: examinerImpression ? 12 : 0, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 100, padding: "12px 16px", background: isDark ? "rgba(248,113,113,0.08)" : "#fff5f5", borderRadius: 12, border: `1px solid ${T.red}30` }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.red, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Current Score</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: getScoreColor(displayScore, totalMarks), lineHeight: 1 }}>{displayScore ?? "—"}</span>
                                <span style={{ fontSize: 15, fontWeight: 600, color: T.subtle }}>/{totalMarks}</span>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 100, padding: "12px 16px", background: isDark ? "rgba(167,139,250,0.08)" : "#f5f3ff", borderRadius: 12, border: `1px solid ${T.purple}30` }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.purple, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>AIR-1 Target</div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                                <span style={{ fontSize: 32, fontWeight: 800, color: T.purple, lineHeight: 1 }}>{displayPotential ?? "—"}</span>
                                <span style={{ fontSize: 15, fontWeight: 600, color: T.subtle }}>/{totalMarks}</span>
                            </div>
                        </div>
                        {marksGap !== null && (
                            <div style={{ flex: 1, minWidth: 100, padding: "12px 16px", background: isDark ? "rgba(251,191,36,0.08)" : "#fffbeb", borderRadius: 12, border: `1px solid ${T.amber}40` }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: T.amber, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Marks Gap</div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                                    <span style={{ fontSize: 32, fontWeight: 800, color: T.amber, lineHeight: 1 }}>+{marksGap}</span>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: T.subtle }}>to gain</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Examiner Impression */}
                    {examinerImpression && (
                        <div style={{ background: T.purpleBg, borderLeft: `3px solid ${T.purple}`, padding: "12px 18px", borderRadius: "0 8px 8px 0", fontSize: 14.5, color: T.textBright, fontStyle: "italic", lineHeight: 1.6, marginTop: 14 }}>
                            "{examinerImpression}"
                        </div>
                    )}
                </Card>
                </div>

                {/* ── CARD 2: IMMEDIATE FIXES ───────────────────────────── */}
                <div data-air1-pdf-section="fixes">
                <Card>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Card 2 · Immediate Fixes</div>
                    <div className="air1-card-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                        {/* Left: Ideal UPSC Structure */}
                        <div>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.textBright, marginBottom: 12 }}>Ideal UPSC Structure</div>
                            {hasData(idealUPSCStructure) ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {idealUPSCStructure.map((item, i) => (
                                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <div style={{ width: 18, height: 18, borderRadius: 9, background: T.blueBg, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                                            <div style={{ fontSize: 14, color: T.text, lineHeight: 1.55, fontWeight: 400 }}>{item}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 14, color: T.subtle, fontStyle: "italic" }}>Not available</div>
                            )}
                        </div>
                        {/* Right: Top Improvements */}
                        <div>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.textBright, marginBottom: 12 }}>Top Improvements</div>
                            {hasData(topImprovements) ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {topImprovements.map((imp, i) => (
                                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                            <span style={{ color: T.amber, fontSize: 14, flexShrink: 0, marginTop: 2 }}>⚡</span>
                                            <span style={{ fontSize: 14, color: T.text, lineHeight: 1.55, fontWeight: 400 }}>{imp}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: 14, color: T.subtle, fontStyle: "italic" }}>Not available</div>
                            )}
                        </div>
                    </div>
                </Card>
                </div>

                {/* ── CARD 3: VISUAL VALUE ADDITION ────────────────────── */}
                <div data-air1-pdf-section="visual">
                <section className="air1-card air1-visual-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: isDark ? "none" : "0 4px 6px -1px rgba(0,0,0,0.03)" }}>
                  <div className="air1-card-kicker green" style={{ fontSize: 11, fontWeight: 600, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>CARD 3 · VISUAL VALUE ADDITION</div>

                  {normalizedThemeFlowchartSteps.length > 0 && (
                    <div className="visual-section">
                      <div className="visual-section-head">
                        <span className="visual-eyebrow">Theme Flowchart</span>
                        <h3 style={{ color: T.textBright }}>{themeFlowchartTitle}</h3>
                      </div>

                      <div className="flowchart-canvas" style={{ border: `1px solid ${T.border}` }}>
                        {normalizedThemeFlowchartSteps.map((step, index) => (
                          <React.Fragment key={`${step}-${index}`}>
                            <div
                              className={`flow-node flow-node-${index + 1} ${index === normalizedThemeFlowchartSteps.length - 1 ? "flow-node-last" : ""}`}
                              style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: isDark ? "none" : undefined }}
                            >
                              <span className="flow-node-number" style={{ background: T.amberBg, color: T.amber }}>{index + 1}</span>
                              <p style={{ color: T.textBright }}>{step}</p>
                            </div>
                            {index < normalizedThemeFlowchartSteps.length - 1 && (
                              <span className="flow-arrow-mobile">↓</span>
                            )}
                          </React.Fragment>
                        ))}

                        {normalizedThemeFlowchartSteps.length >= 2 && <span className="flow-arrow arrow-1">→</span>}
                        {normalizedThemeFlowchartSteps.length >= 3 && <span className="flow-arrow arrow-2">→</span>}
                        {normalizedThemeFlowchartSteps.length >= 4 && <span className="flow-arrow arrow-3">↓</span>}
                        {normalizedThemeFlowchartSteps.length >= 5 && <span className="flow-arrow arrow-4">←</span>}
                        {normalizedThemeFlowchartSteps.length >= 6 && <span className="flow-arrow arrow-5">←</span>}
                        {normalizedThemeFlowchartSteps.length >= 7 && <span className="flow-arrow arrow-6">↓</span>}
                      </div>
                    </div>
                  )}

                  {diagramSuggestions.length > 0 && (
                    <div className="visual-section">
                      <div className="visual-section-head">
                        <span className="visual-eyebrow">Diagram Suggestions</span>
                        <h3 style={{ color: T.textBright }}>What to draw in the answer</h3>
                      </div>

                      <div className="diagram-grid">
                        {diagramSuggestions.map((diagram, index) => (
                          <div className="diagram-card" key={index} style={{ background: T.surface, border: `1px solid ${T.amber}40`, boxShadow: isDark ? "none" : undefined }}>
                            <div className="diagram-card-top">
                              <span className="diagram-pill" style={{ background: T.amberBg, color: T.amber }}>{diagram.placement}</span>
                              <strong style={{ color: T.textBright }}>{diagram.type}</strong>
                            </div>

                            {/* EXACT LABELS MAPPING */}
                            {(() => {
                              const labelsStr = diagram.exactLabels || diagram.labels || "";
                              const labelsArr = Array.isArray(labelsStr)
                                ? labelsStr
                                : typeof labelsStr === "string"
                                ? labelsStr.split(/[,;•\-]+/).map(s => s.trim()).filter(Boolean)
                                : [];
                              if (labelsArr.length > 0) {
                                return (
                                  <div className="diagram-labels">
                                    {labelsArr.map((label, labelIndex) => (
                                      <span key={labelIndex} style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text }}>{label}</span>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* REASON MAPPING */}
                            {(diagram.reason || diagram.whyItHelps) && (
                              <p className="diagram-reason">{diagram.reason || diagram.whyItHelps}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {finalMemoryHook && finalMemoryHook.word && (
                    <div className="memory-hook-premium">
                      <div className="memory-hook-header">
                        <span className="visual-eyebrow" style={{ marginBottom: 0 }}>Memory Hook</span>
                        <div className="memory-hook-word-pill">{finalMemoryHook.word}</div>
                      </div>

                      <div className="memory-hook-grid">
                        {Array.isArray(finalMemoryHook.meaning) &&
                          finalMemoryHook.meaning.map((item, index) => (
                            <div key={index} className="memory-hook-item">
                              <span style={{ color: T.purple }}>•</span>
                              <span>{item}</span>
                            </div>
                          ))}
                      </div>

                      {finalMemoryHook.whyItFits && (
                        <p className="memory-hook-why-note">{finalMemoryHook.whyItFits}</p>
                      )}
                    </div>
                  )}

                  {!hasData(themeFlowchartSteps) && !hasData(diagramSuggestions) && !(finalMemoryHook && finalMemoryHook.word) && (
                      <div style={{ fontSize: 14, color: T.subtle, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>No visual additions in this review.</div>
                  )}
                </section>
                </div>

                {/* ── CARD 4: AIR-1 UPGRADES ───────────────────────────── */}
                <div data-air1-pdf-section="upgrades">
                <Card>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.purple, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Card 4 · AIR-1 Upgrades</div>
                    {hasData(displayUpgrades) ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {displayUpgrades.map((u, i) => (
                                <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}` }}>
                                    {/* Section label bar */}
                                    <div style={{ background: T.surfaceHigh, padding: "10px 18px", borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.textBright }}>
                                        {u.section || `Upgrade ${i + 1}`}
                                    </div>
                                    <div className="air1-upgrade-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                                        <div className="air1-upgrade-your-line" style={{ padding: "16px 18px", borderRight: `1px solid ${T.border}` }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: T.amber, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                                                <span style={{ width: 6, height: 6, borderRadius: 3, background: T.amber, display: "inline-block" }} />Your Line
                                            </div>
                                            <div style={{ fontSize: 14.5, color: T.dim, fontStyle: "italic", lineHeight: 1.6, fontWeight: 400 }}>"{u.yourLine}"</div>
                                        </div>
                                        <div style={{ padding: "16px 18px", background: isDark ? "rgba(52,211,153,0.04)" : "#f0fdf4" }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: T.green, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                                                <span style={{ width: 6, height: 6, borderRadius: 3, background: T.green, display: "inline-block" }} />AIR-1 Upgrade
                                            </div>
                                            <div style={{ fontSize: 14.5, color: T.text, lineHeight: 1.6, fontWeight: 400 }}>{u.air1Upgrade}</div>
                                            {u.whyBetter && (
                                                <div style={{ marginTop: 8, fontSize: 12.5, color: T.green, fontWeight: 600, display: "flex", gap: 5, alignItems: "flex-start" }}>
                                                    <span style={{ flexShrink: 0 }}>✅</span><span style={{ lineHeight: 1.5 }}>{u.whyBetter}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 14, color: T.subtle, fontStyle: "italic" }}>No specific upgrades generated.</div>
                    )}
                </Card>
                </div>

                {/* ── CARD 5: AIR-1 MODEL ANSWER (Full Width) ── */}
                <div data-air1-pdf-section="model">
                <Card style={{ border: `1px solid ${T.purple}30` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: T.purple, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Card 5</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>AIR-1 Model Answer</div>
                        </div>
                        {modelAnswer && (
                            <button data-air1-pdf-hide="true" onClick={() => navigator.clipboard.writeText(modelAnswer)} style={{ background: T.surface, border: `1px solid ${T.purple}35`, color: T.purple, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer" }}>Copy Answer</button>
                        )}
                    </div>
                    {modelAnswer ? (
                        <div className="model-answer-body" style={{ fontSize: "14.5px", color: T.text, lineHeight: 1.75, fontWeight: 400, maxWidth: "880px" }}>
                            {renderModelAnswerText(modelAnswer)}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, color: T.subtle, fontStyle: "italic" }}>Model answer not generated.</div>
                    )}
                </Card>
                </div>

                {/* ── CARD 6: WHY THIS SCORES HIGH (Below Card 5) ── */}
                <div data-air1-pdf-section="whyscores">
                <Card style={{ border: `1px solid ${T.green}30` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Card 6</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginBottom: 16 }}>Why This Scores High</div>
                    {hasData(whyScoresHigh) ? (
                        <div className="why-scores-high-grid">
                            {whyScoresHigh.map((reason, i) => (
                                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: isDark ? "rgba(52,211,153,0.07)" : "#f0fdf4", border: `1px solid ${T.green}25`, borderRadius: 8, padding: "12px 14px" }}>
                                    <span style={{ color: T.green, fontSize: 14, flexShrink: 0, marginTop: 2 }}>✓</span>
                                    <div style={{ fontSize: 13.5, color: T.text, lineHeight: 1.5, fontWeight: 500 }}>{reason}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, color: T.subtle, fontStyle: "italic" }}>Not available.</div>
                    )}
                </Card>
                </div>

                {/* ── DETAILED MENTOR REVIEW (collapsible) ─────────────── */}
                {displayDetailedMentorReview && (
                    <div data-air1-pdf-section="details">
                    <Card style={{ padding: 0, overflow: "hidden" }}>
                        <div onClick={() => setShowDetailedReview(!showDetailedReview)} style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: showDetailedReview ? T.surfaceHigh : "transparent" }}>
                            <div>
                                <div style={{ fontSize: 10, fontWeight: 800, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>Bonus</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: T.textBright }}>Detailed Mentor Review</div>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <button data-air1-pdf-hide="true" type="button" onClick={(e) => { e.stopPropagation(); handleDownloadPdf(); }} disabled={isDownloading} style={{ border: `1px solid ${T.borderMid}`, color: T.text, background: T.surface, borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, opacity: isDownloading ? 0.7 : 1 }}>
                                    {isDownloading ? "Preparing…" : "⬇ PDF"}
                                </button>
                                <div data-air1-pdf-hide="true" style={{ fontSize: 12, color: T.subtle, fontWeight: 700 }}>{showDetailedReview ? "▲ Hide" : "▼ Show"}</div>
                            </div>
                        </div>
                        {showDetailedReview && (
                            <div style={{ padding: "0 24px 24px 24px", borderTop: `1px solid ${T.border}` }}>
                                <pre style={{ marginTop: 20, padding: "20px", borderRadius: 10, fontSize: 14, color: T.dim, whiteSpace: "pre-wrap", background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, margin: 0, fontFamily: T.font, lineHeight: 1.75 }}>
                                    {displayDetailedMentorReview}
                                </pre>
                                {rawReviewText && (
                                    <div style={{ marginTop: 20 }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 10 }}>Raw AI Output</div>
                                        <pre style={{ padding: "14px", borderRadius: 8, fontSize: 12, color: T.dim, whiteSpace: "pre-wrap", border: `1px solid ${T.borderMid}`, margin: 0, background: T.bg }}>
                                            {rawReviewText}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                    </div>
                )}

            </div>

            {/* Hidden PDF export layer */}
            <Air1VisualPdfExport
                data={data}
                questionText={questionText}
                marks={marks}
                paper={paper}
                year={year}
                wordLimit={wordLimit}
            />
        </div>
    );
}
