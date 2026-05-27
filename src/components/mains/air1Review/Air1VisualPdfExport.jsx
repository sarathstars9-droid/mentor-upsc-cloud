import React from "react";

function safeText(value, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map((v) => safeText(v, "")).filter(Boolean).join("; ");
    return joined || fallback;
  }
  if (typeof value === "object") {
    const preferredKeys = [
      "dimension", "text", "content", "value", "label", "title", "point", "reason",
      "explanation", "yourLine", "air1Line", "air1Upgrade", "upgrade",
      "improvedLine", "comment", "problem", "fix"
    ];
    for (const key of preferredKeys) {
      if (value[key]) return safeText(value[key], fallback);
    }
    return fallback;
  }
  return fallback;
}

export default function Air1VisualPdfExport({ data, questionText, marks, paper, year, wordLimit }) {
  if (!data) return null;

  // ─── Schema normalization ────────────────────────────────────────────────────
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

  const rawScore =
    quickEvaluation.score !== undefined ? quickEvaluation.score :
    quickEvaluation.estimatedScore !== undefined ? quickEvaluation.estimatedScore :
    cards.score !== undefined ? cards.score :
    root.score !== undefined ? root.score :
    null;

  const rawPotential =
    quickEvaluation.potentialScore !== undefined ? quickEvaluation.potentialScore :
    cards.potentialScore !== undefined ? cards.potentialScore :
    root.potentialScore !== undefined ? root.potentialScore :
    null;

  const examinerImpression =
    quickEvaluation.examinerImpression ||
    cards.examinerImpression ||
    root.examinerImpression;

  const displayWordLimit = wordLimit || data.wordLimit || data.word_limit || data.maxWords || data.max_words || data.question?.wordLimit || data.question?.word_limit || "—";

  // Schema compatibility: old schema had score as object {awarded, total}
  const isOldSchema     = rawScore && typeof rawScore === "object";
  const displayScore    = isOldSchema ? rawScore.awarded : rawScore;
  const displayPotential = isOldSchema ? rawScore.total : rawPotential;

  // ─── Model answer ────────────────────────────────────────────────────────────
  let displayModelAnswer = modelAnswer;
  if (!displayModelAnswer && isOldSchema && data.air1Answer) {
    displayModelAnswer = `**Introduction**\n${safeText(data.air1Answer.intro, "")}\n\n**Body**\n${(
      data.air1Answer.body || []
    )
      .map((b) => `- ${safeText(b, "")}`)
      .join("\n")}\n\n**Conclusion**\n${safeText(data.air1Answer.conclusion, "")}`;
  }

  // ─── Upgrades ────────────────────────────────────────────────────────────────
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
    if (introUpgrade)        displayUpgrades.push({ section: "Intro",          yourLine: introUpgrade.yourLine || "",        air1Upgrade: introUpgrade.air1Upgrade || "",        whyBetter: introUpgrade.whyBetter || "" });
    if (bodyUpgrade) displayUpgrades.push({ section: "Body Paragraph", yourLine: bodyUpgrade.yourLine || "", air1Upgrade: bodyUpgrade.air1Upgrade || "", whyBetter: bodyUpgrade.whyBetter || "" });
    if (conclusionUpgrade)   displayUpgrades.push({ section: "Conclusion",      yourLine: conclusionUpgrade.yourLine || "",   air1Upgrade: conclusionUpgrade.air1Upgrade || "",   whyBetter: conclusionUpgrade.whyBetter || "" });
  } else if (Array.isArray(air1Upgrades)) {
    displayUpgrades = air1Upgrades;
  } else if (Array.isArray(cards.air1Upgrades)) {
    displayUpgrades = cards.air1Upgrades;
  } else if (Array.isArray(root.air1Upgrades)) {
    displayUpgrades = root.air1Upgrades;
  } else if (isOldSchema && data.mistakes && data.mistakes.length > 0) {
    displayUpgrades = data.mistakes.map((m) => ({
      section: m.tag || "Improvement",
      yourLine: m.userLine || m.problem,
      air1Upgrade: m.fix,
      whyBetter: `Resolves: ${safeText(m.problem, "")}`,
    }));
  }

  // ─── Improvements ────────────────────────────────────────────────────────────
  let displayImprovements = topImprovements;
  if ((!displayImprovements || displayImprovements.length === 0) && isOldSchema && data.lossReasons && data.lossReasons.length > 0) {
    displayImprovements = data.lossReasons;
  }

  // ─── Missing dimensions ──────────────────────────────────────────────────────
  let displayMissingDimensions = [];
  const mdFields = [
    (quickEvaluation.missingDimensionsChecklist || cards.missingDimensionsChecklist || root.missingDimensionsChecklist),
    data.missingDimensions,
    data.missing_dimensions,
    data.dimensionsLost,
    data.missingUpscDimensions,
  ];
  for (const field of mdFields) {
    if (field) {
      if (Array.isArray(field) && field.length > 0) {
        displayMissingDimensions = field;
        break;
      } else if (typeof field === "object" && Object.keys(field).length > 0) {
        displayMissingDimensions = Object.entries(field).map(([k, v]) => `${k}: ${v}`);
        break;
      }
    }
  }

  // ─── Why scores high ─────────────────────────────────────────────────────────
  const displayWhyScoresHigh = whyScoresHigh;

  // ─── Ideal structure / diagram / mnemonic / theme flowchart ─────────────────
  const idealStructure    = idealUPSCStructure;
  const diagramSuggestionsArr = diagramSuggestions;
  const memoryHook        = finalMemoryHook?.word
    ? `${finalMemoryHook.word.toUpperCase()}: ${(finalMemoryHook.meaning || []).join("; ")}`
    : (cards.memoryHook || root.memoryHook);

  // ─── Computed display values ─────────────────────────────────────────────────
  const safePaper    = safeText(paper, "GS");
  const safeYear     = safeText(year, "2024");
  const currentScore = safeText(displayScore, "-");
  const targetScore  = safeText(displayPotential, marks === 15 ? "11" : "7.5");

  // Chunking logic to prevent overflow
  const upgrades = displayUpgrades || [];
  const upgradeChunks = [];
  for (let i = 0; i < upgrades.length; i += 3) {
    upgradeChunks.push(upgrades.slice(i, i + 3));
  }

  const paragraphs = safeText(displayModelAnswer, "").split("\n").filter((p) => p.trim());
  const modelAnswerChunks = [];
  for (let i = 0; i < paragraphs.length; i += 5) {
    modelAnswerChunks.push(paragraphs.slice(i, i + 5));
  }

  const totalPages = 1 + 1 + upgradeChunks.length + modelAnswerChunks.length + 1; // Summary, Blueprint, Upgrades, ModelAnswer, Checklist

  const pageStyle = {
    width: "794px",
    minHeight: "1123px",
    backgroundColor: "#fafafc",
    padding: "32px",
    paddingBottom: "80px", // space for footer
    boxSizing: "border-box",
    fontFamily: "system-ui, -apple-system, sans-serif",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    color: "#333",
    pageBreakAfter: "always",
  };

  const cardStyle = {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    border: "1px solid #eaeaea",
  };

  const PageHeader = () => (
    <div style={{ borderBottom: "2px solid #eaeaea", paddingBottom: "12px", marginBottom: "4px" }}>
      <h1 style={{ margin: 0, fontSize: "24px", color: "#111", letterSpacing: "-0.02em" }}>
        MentorOS AIR-1 Review
      </h1>
      <div style={{ color: "#666", fontSize: "14px", marginTop: "4px" }}>
        {safePaper} | {safeYear} | {safeText(marks)} Marks | {displayWordLimit} Words
      </div>
    </div>
  );

  const PageFooter = ({ pageNum }) => (
    <div style={{ position: "absolute", bottom: "40px", left: "40px", right: "40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eaeaea", paddingTop: "16px", color: "#999", fontSize: "12px", fontWeight: "bold" }}>
      <div>MentorOS AIR-1 Review</div>
      <div>Page {pageNum} of {totalPages}</div>
    </div>
  );

  let currentPageNumber = 1;

  return (
    <div id="air1-hidden-pdf-export" style={{ position: "fixed", top: "-9999px", left: "-9999px" }}>
      
      {/* PAGE 1: Premium Summary */}
      <div className="air1-pdf-page" style={pageStyle}>
        <PageHeader />
        
        <div style={cardStyle}>
          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Question</div>
          <div style={{ fontSize: "16px", lineHeight: "1.5", fontStyle: "italic", color: "#111", fontWeight: "500" }}>
            {safeText(questionText, "Question text missing.")}
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          <div style={{ ...cardStyle, flex: 1, backgroundColor: "#fdf8f8", borderColor: "#fbe8e8", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#a04040", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current Score</div>
            <div style={{ fontSize: "48px", fontWeight: "900", color: "#c53030", marginTop: "8px" }}>
              {currentScore}<span style={{ fontSize: "24px", color: "#e53e3e" }}>/{marks}</span>
            </div>
          </div>
          <div style={{ ...cardStyle, flex: 1, backgroundColor: "#f0fdf4", borderColor: "#dcfce7", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px" }}>
            <div style={{ fontSize: "13px", fontWeight: "bold", color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>Target Score</div>
            <div style={{ fontSize: "48px", fontWeight: "900", color: "#15803d", marginTop: "8px" }}>
              {targetScore}<span style={{ fontSize: "24px", color: "#22c55e" }}>/{marks}</span>
            </div>
          </div>
        </div>

        {examinerImpression && (
          <div style={{ ...cardStyle, backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
            <div style={{ fontSize: "12px", fontWeight: "bold", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Examiner's Verdict
            </div>
            <div style={{ fontSize: "16px", lineHeight: "1.6", color: "#334155", fontStyle: "italic" }}>
              "{safeText(examinerImpression)}"
            </div>
          </div>
        )}

        {displayMissingDimensions.length > 0 && (
          <div style={{ ...cardStyle, backgroundColor: "#fff5f5", borderColor: "#fed7d7" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#c53030", marginBottom: "16px" }}>
              Missing Dimensions (Marks Lost)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {displayMissingDimensions.map((dim, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", backgroundColor: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #fee2e2" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "4px", backgroundColor: "#fecaca", display: "flex", alignItems: "center", justifyContent: "center", color: "#b91c1c", fontWeight: "bold", fontSize: "12px", flexShrink: 0, marginTop: "2px" }}>
                    ✕
                  </div>
                  <div style={{ fontSize: "14px", color: "#7f1d1d", lineHeight: "1.4" }}>{safeText(dim)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <PageFooter pageNum={currentPageNumber++} />
      </div>

      {/* PAGE 2: Improvement Blueprint */}
      <div className="air1-pdf-page" style={pageStyle}>
        <PageHeader />
        
        {displayImprovements && displayImprovements.length > 0 && (
          <div style={{ ...cardStyle, backgroundColor: "#eff6ff", borderColor: "#dbeafe" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1e40af", marginBottom: "16px" }}>
              Top Priorities for Next Attempt
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {displayImprovements.slice(0, 4).map((imp, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px", backgroundColor: "#fff", padding: "12px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                  <div style={{ width: "24px", height: "24px", borderRadius: "12px", backgroundColor: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d4ed8", fontWeight: "bold", fontSize: "13px", flexShrink: 0 }}>
                    {idx + 1}
                  </div>
                  <div style={{ fontSize: "14px", color: "#1e3a8a", lineHeight: "1.4" }}>{safeText(imp)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {idealStructure && idealStructure.length > 0 && (
          <div style={cardStyle}>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#444", marginBottom: "16px" }}>
              Ideal Answer Structure
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {idealStructure.slice(0, 5).map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                  <div style={{ fontSize: "16px", color: "#94a3b8" }}>→</div>
                  <div style={{ fontSize: "14px", color: "#334155", fontWeight: "500" }}>{safeText(item)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {normalizedThemeFlowchartSteps.length > 0 && (
          <div style={{ ...cardStyle, backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", marginBottom: "12px" }}>
              Theme Flowchart: {themeFlowchartTitle}
            </div>
            
            <div style={{ 
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gridTemplateRows: "repeat(2, auto)",
              gap: "24px 32px",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              background: "radial-gradient(circle at top left, rgba(124, 58, 237, 0.04), transparent 34%), linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(241, 245, 249, 0.95))"
            }}>
              {normalizedThemeFlowchartSteps.map((step, index) => {
                let gridColumn = "auto";
                let gridRow = "auto";
                if (index === 0) { gridColumn = "1"; gridRow = "1"; }
                else if (index === 1) { gridColumn = "2"; gridRow = "1"; }
                else if (index === 2) { gridColumn = "3"; gridRow = "1"; }
                else if (index === 3) { gridColumn = "3"; gridRow = "2"; }
                else if (index === 4) { gridColumn = "2"; gridRow = "2"; }
                else if (index === 5) { gridColumn = "1"; gridRow = "2"; }
                else if (index === 6) { gridColumn = "1 / span 3"; gridRow = "3"; }

                return (
                  <div
                    key={index}
                    style={{
                      gridColumn,
                      gridRow,
                      position: "relative",
                      minHeight: "64px",
                      padding: "10px 10px 10px 34px",
                      borderRadius: "10px",
                      background: "#ffffff",
                      border: "1px solid rgba(148, 163, 184, 0.3)",
                      display: "flex",
                      alignItems: "center",
                      boxShadow: "0 4px 10px rgba(15, 23, 42, 0.04)"
                    }}
                  >
                    <span style={{
                      position: "absolute",
                      left: "8px",
                      top: "8px",
                      width: "18px",
                      height: "18px",
                      borderRadius: "999px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: "900",
                      color: "#7c2d12",
                      background: "#fed7aa"
                    }}>
                      {index + 1}
                    </span>
                    <p style={{ margin: 0, fontSize: "11px", lineHeight: "1.35", fontWeight: "700", color: "#0f172a" }}>
                      {step}
                    </p>
                  </div>
                );
              })}

              {normalizedThemeFlowchartSteps.length >= 6 && (
                <>
                  <span style={{ position: "absolute", zIndex: 1, fontSize: "20px", fontWeight: "900", color: "#64748b", top: "36px", left: "30.5%" }}>→</span>
                  <span style={{ position: "absolute", zIndex: 1, fontSize: "20px", fontWeight: "900", color: "#64748b", top: "36px", left: "65%" }}>→</span>
                  <span style={{ position: "absolute", zIndex: 1, fontSize: "20px", fontWeight: "900", color: "#64748b", top: "82px", right: "15%" }}>↓</span>
                  <span style={{ position: "absolute", zIndex: 1, fontSize: "20px", fontWeight: "900", color: "#64748b", top: "124px", left: "65%" }}>←</span>
                  <span style={{ position: "absolute", zIndex: 1, fontSize: "20px", fontWeight: "900", color: "#64748b", top: "124px", left: "30.5%" }}>←</span>
                </>
              )}
            </div>
          </div>
        )}

        {diagramSuggestionsArr && diagramSuggestionsArr.length > 0 && (
          <div style={{ ...cardStyle, backgroundColor: "#ffffff", borderColor: "#eaeaea" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", marginBottom: "12px" }}>
              Diagram Suggestions: What to draw in the answer
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              {diagramSuggestionsArr.map((diagram, index) => {
                const labelsStr = diagram.exactLabels || diagram.labels || "";
                const labelsArr = Array.isArray(labelsStr)
                  ? labelsStr
                  : typeof labelsStr === "string"
                  ? labelsStr.split(/[,;•\-]+/).map(s => s.trim()).filter(Boolean)
                  : [];
                const reasonStr = diagram.reason || diagram.whyItHelps || "";

                return (
                  <div key={index} style={{
                    padding: "14px",
                    borderRadius: "14px",
                    background: "#fff",
                    border: "1px solid rgba(245, 158, 11, 0.28)",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.03)"
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
                      <span style={{
                        width: "fit-content",
                        padding: "3px 7px",
                        borderRadius: "999px",
                        background: "rgba(245, 158, 11, 0.13)",
                        color: "#92400e",
                        fontSize: "9px",
                        fontWeight: "800",
                        textTransform: "uppercase"
                      }}>
                        {safeText(diagram.placement)}
                      </span>
                      <strong style={{ fontSize: "13px", color: "#0f172a", fontWeight: "700" }}>
                        {safeText(diagram.type)}
                      </strong>
                    </div>

                    {labelsArr.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                        {labelsArr.map((label, labelIndex) => (
                          <span key={labelIndex} style={{
                            padding: "3px 6px",
                            borderRadius: "999px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#334155",
                            fontSize: "10px",
                            fontWeight: "600"
                          }}>
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {reasonStr && (
                      <p style={{ margin: 0, fontSize: "11.5px", lineHeight: "1.45", color: "#475569" }}>
                        {reasonStr}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <PageFooter pageNum={currentPageNumber++} />
      </div>

      {/* PAGE 3: AIR-1 Upgrades */}
      {upgradeChunks.map((chunk, chunkIdx) => (
        <div key={`upgrade-page-${chunkIdx}`} className="air1-pdf-page" style={pageStyle}>
          <PageHeader />
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#111", marginBottom: "8px" }}>
            Line-by-Line Upgrades (Part {chunkIdx + 1})
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {chunk.map((u, idx) => (
              <div key={idx} style={{ ...cardStyle, padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1, padding: "16px", backgroundColor: "#fff5f5", borderRadius: "8px", borderLeft: "4px solid #fc8181" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#c53030", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.05em" }}>Your Line</div>
                    <div style={{ fontSize: "14px", color: "#742a2a", lineHeight: "1.5" }}>{safeText(u.yourLine)}</div>
                  </div>
                  <div style={{ flex: 1, padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px", borderLeft: "4px solid #68d391" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#22c55e", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.05em" }}>AIR-1 Upgrade</div>
                    <div style={{ fontSize: "14px", color: "#14532d", lineHeight: "1.5" }}>{safeText(u.air1Upgrade)}</div>
                  </div>
                </div>
                {safeText(u.whyBetter, "") && (
                  <div style={{ padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", fontSize: "13px", color: "#475569", fontStyle: "italic", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontWeight: "bold", color: "#334155" }}>Why: </span> {safeText(u.whyBetter)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <PageFooter pageNum={currentPageNumber++} />
        </div>
      ))}

      {/* PAGE 4+: Model Answer */}
      {modelAnswerChunks.map((chunk, chunkIdx) => (
        <div key={`model-page-${chunkIdx}`} className="air1-pdf-page" style={pageStyle}>
          <PageHeader />
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#111", marginBottom: "16px" }}>
            AIR-1 Model Answer (Part {chunkIdx + 1})
          </div>
          
          <div style={{ ...cardStyle, flex: 1, padding: "32px", backgroundColor: "#fff" }}>
            {chunk.map((p, idx) => {
              const isHeading = p.match(/^(?:###|##|#|\*\*|\d+\.)\s*(.+?)(?:\*\*|:)?$/) || (p.length < 60 && p === p.toUpperCase());
              let text = p.replace(/\*\*/g, "").replace(/^(?:###|##|#)\s*/, "");
              return (
                <div key={idx} style={{ 
                  marginBottom: "16px", 
                  fontSize: isHeading ? "16px" : "15px", 
                  fontWeight: isHeading ? "bold" : "normal", 
                  color: isHeading ? "#111" : "#333",
                  lineHeight: "1.6",
                  paddingBottom: isHeading ? "4px" : "0",
                  borderBottom: isHeading ? "1px solid #f1f5f9" : "none"
                }}>
                  {safeText(text)}
                </div>
              );
            })}
            
            {chunkIdx === modelAnswerChunks.length - 1 && displayWhyScoresHigh && (
              <div style={{ marginTop: "32px", padding: "20px", backgroundColor: "#fdf8f8", borderRadius: "12px", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Why This Scores High</div>
                <div style={{ fontSize: "14px", color: "#7f1d1d", lineHeight: "1.6" }}>{safeText(displayWhyScoresHigh)}</div>
              </div>
            )}
          </div>
          <PageFooter pageNum={currentPageNumber++} />
        </div>
      ))}

      {/* FINAL PAGE: Revision Checklist */}
      <div className="air1-pdf-page" style={pageStyle}>
        <PageHeader />
        
        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#111", marginBottom: "16px" }}>
          Before Your Next Attempt
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ ...cardStyle, backgroundColor: "#f5f3ff", borderColor: "#ede9fe" }}>
            <div style={{ fontSize: "14px", fontWeight: "bold", color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px" }}>
              7-Minute Revision Drill
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                "1. Mentally map the ideal structure (Intro -> Dimensions -> Conclusion).",
                "2. Recall the Memory Hook / Flowchart provided.",
                "3. Fix the top 3 missing dimensions identified in this review.",
                "4. Envision where to draw the suggested diagram.",
                "5. Start writing."
              ].map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "12px", backgroundColor: "#fff", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "10px", backgroundColor: "#ddd6fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#6d28d9", fontWeight: "bold", fontSize: "12px", flexShrink: 0, marginTop: "2px" }}>
                    ✓
                  </div>
                  <div style={{ fontSize: "14px", color: "#4c1d95", lineHeight: "1.4" }}>{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px" }}>
            {finalMemoryHook && finalMemoryHook.word ? (
              <div style={{ ...cardStyle, flex: 1, background: "linear-gradient(135deg, rgba(124, 58, 237, 0.04), rgba(245, 158, 11, 0.04))", borderColor: "rgba(124, 58, 237, 0.16)", padding: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: "800", color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                  MEMORY HOOK
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ padding: "4px 10px", borderRadius: "8px", background: "#ffffff", border: "1px solid rgba(124, 58, 237, 0.18)", color: "#6d28d9", fontSize: "14px", fontWeight: "900", letterSpacing: "0.08em" }}>
                    {finalMemoryHook.word}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
                  {Array.isArray(finalMemoryHook.meaning) ? (
                    finalMemoryHook.meaning.map((item, index) => (
                      <div key={index} style={{ fontSize: "11.5px", color: "#334155", fontWeight: "600", lineHeight: "1.4" }}>
                        • {item}
                      </div>
                    ))
                  ) : typeof finalMemoryHook.meaning === "string" ? (
                    <div style={{ fontSize: "11.5px", color: "#334155", fontWeight: "600", gridColumn: "1 / -1" }}>
                      {finalMemoryHook.meaning}
                    </div>
                  ) : null}
                </div>
                {finalMemoryHook.whyItFits && (
                  <div style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                    {finalMemoryHook.whyItFits}
                  </div>
                )}
              </div>
            ) : memoryHook ? (
              <div style={{ ...cardStyle, flex: 1, backgroundColor: "#faf5ff", borderColor: "#f3e8ff", padding: "16px" }}>
                <div style={{ fontSize: "10px", fontWeight: "800", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
                  MEMORY HOOK
                </div>
                <div style={{ fontSize: "13px", color: "#5b21b6", fontWeight: "600", lineHeight: "1.4" }}>
                  {safeText(memoryHook)}
                </div>
              </div>
            ) : null}
            
            <div style={{ ...cardStyle, flex: 1, backgroundColor: "#f0fdf4", borderColor: "#dcfce7", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                Next Attempt Goal
              </div>
              <div style={{ fontSize: "36px", fontWeight: "900", color: "#15803d" }}>
                {targetScore}<span style={{ fontSize: "20px", color: "#22c55e" }}>/{marks}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#166534", marginTop: "4px" }}>Implement the structural upgrades above to hit this target.</div>
            </div>
          </div>

          {(diagramSuggestionsArr && diagramSuggestionsArr.length > 0) && (
             <div style={{ ...cardStyle, backgroundColor: "#fffbeb", borderColor: "#fef3c7" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", color: "#b45309", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                  Diagram to Practice
                </div>
                <div style={{ fontSize: "15px", color: "#78350f", fontWeight: "bold" }}>
                  {safeText(diagramSuggestionsArr[0].type)}
                </div>
                <div style={{ fontSize: "14px", color: "#92400e", marginTop: "4px" }}>
                  Includes: {safeText(diagramSuggestionsArr[0].labels)}
                </div>
             </div>
          )}

        </div>
        <PageFooter pageNum={currentPageNumber++} />
      </div>
    </div>
  );
}
