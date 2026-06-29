import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import parseAir1ReviewJson from "../lib/mains/parseAir1ReviewJson.js";
import { BACKEND_URL } from "../config";

// ─── Design Theme & Style Tokens ──────────────────────────────────────────────
const T = {
  bg: "#080D1A",
  surface: "rgba(17, 24, 39, 0.7)",
  surfaceHigh: "rgba(31, 41, 55, 0.85)",
  border: "rgba(55, 65, 81, 0.4)",
  borderGlow: "rgba(79, 124, 255, 0.25)",
  text: "#E2E8F0",
  textBright: "#F8FAFC",
  textMuted: "#94A3B8",
  primary: "#4F7CFF",
  secondary: "#10B981",
  accent: "#8B5CF6",
  danger: "#EF4444",
  warning: "#F59E0B",
  gradientBg: "linear-gradient(135deg, #1E1B4B 0%, #0F172A 50%, #020617 100%)",
  glowGradient: "linear-gradient(90deg, #4F7CFF, #8B5CF6)",
  innerGlow: "rgba(255, 255, 255, 0.05)",
  font: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
};

export default function AnswerWriting() {
  const { paperType, sourceType } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Read location state with sessionStorage fallback for refresh protection
  const stateData = React.useMemo(() => {
    const locState = location.state;
    if (locState && Object.keys(locState).length > 0) {
      sessionStorage.setItem("mains_pyq_metadata", JSON.stringify(locState));
      return locState;
    }
    const saved = sessionStorage.getItem("mains_pyq_metadata");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error("[AnswerWriting] Failed to parse mains_pyq_metadata from sessionStorage:", err);
      }
    }
    return {};
  }, [location.state]);

  // State Management
  const [questionText, setQuestionText] = useState(stateData.questionText || "");
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [air1Prompt, setAir1Prompt] = useState("");
  const [notification, setNotification] = useState(null);

  // Custom metadata from state
  const [customMarks, setCustomMarks] = useState(stateData.marks || null);
  const [customPaper, setCustomPaper] = useState(stateData.paper || null);
  const [customTopic, setCustomTopic] = useState(stateData.topic || null);
  const [pastedReview, setPastedReview] = useState("");

  // Dynamic Metadata based on URL Params
  const getPaperMeta = (type) => {
    switch (type) {
      case "essay":
        return {
          title: "Essay Answer Workspace",
          paperName: "Essay",
          marks: 125,
          wordLimit: 1000,
          color: T.accent
        };
      case "ethics":
        return {
          title: "Ethics Answer Workspace",
          paperName: "GS4 (Ethics)",
          marks: 10,
          wordLimit: 150,
          color: T.primary
        };
      case "geography-optional":
        return {
          title: "Geography Optional Workspace",
          paperName: "Geography Optional",
          marks: 15,
          wordLimit: 250,
          color: T.secondary
        };
      default:
        return {
          title: "Mains Answer Workspace",
          paperName: "General Studies",
          marks: 10,
          wordLimit: 150,
          color: T.primary
        };
    }
  };

  const meta = getPaperMeta(paperType);
  const sourceModeText = sourceType === "pyq" ? "UPSC PYQ Mode" : "Institutional Test Mode";

  // File Handling
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Toast / Notification helper
  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // 1. Submit for Basic Evaluation
  const handleBasicEvaluation = async () => {
    if (!questionText && selectedFiles.length === 0) {
      showToast("Please provide a question (type it or upload answer sheets containing it).", "error");
      return;
    }

    setLoading(true);
    setEvaluation(null);
    setAir1Prompt("");

    const displayMarks = customMarks || meta.marks;
    const displayPaper = customPaper || meta.paperName;

    const formData = new FormData();
    formData.append("questionText", questionText);
    formData.append("candidateAnswer", candidateAnswer);
    formData.append("paper", displayPaper);
    formData.append("marks", displayMarks);
    formData.append("wordLimit", stateData.wordLimit || meta.wordLimit);
    formData.append("userId", "user_1");
    if (customTopic) {
      formData.append("subject", customTopic);
    }

    if (selectedFiles.length > 0) {
      setLoadingPhase("Analyzing uploads & running OCR...");
      selectedFiles.forEach((file) => {
        formData.append("pages", file);
      });
    } else {
      setLoadingPhase("Sending to AI Evaluator...");
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/answer-writing/basic-evaluation`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setEvaluation(data.evaluation);
        if (data.questionText) setQuestionText(data.questionText);
        if (data.candidateAnswer) setCandidateAnswer(data.candidateAnswer);
        showToast("Evaluation generated successfully!");
      } else {
        showToast(data.error || "Evaluation failed. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Connection error. Ensure the backend server is running.", "error");
    } finally {
      setLoading(false);
      setLoadingPhase("");
    }
  };

  // 2. Generate AIR-1 Prompt & copy to clipboard
  const handleAir1PromptGeneration = async () => {
    if (!questionText && selectedFiles.length === 0) {
      showToast("Please provide a question first.", "error");
      return;
    }

    setLoading(true);
    setLoadingPhase("Building standard AIR-1 review prompt...");

    const displayMarks = customMarks || meta.marks;
    const displayPaper = customPaper || meta.paperName;

    const formData = new FormData();
    formData.append("questionText", questionText);
    formData.append("candidateAnswer", candidateAnswer);
    formData.append("paper", displayPaper);
    formData.append("marks", displayMarks);
    formData.append("wordLimit", stateData.wordLimit || meta.wordLimit);
    if (customTopic) {
      formData.append("subject", customTopic);
    }
    
    if (evaluation) {
      formData.append("basicReview", JSON.stringify(evaluation));
    }

    if (selectedFiles.length > 0) {
      selectedFiles.forEach((file) => {
        formData.append("pages", file);
      });
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/answer-writing/air1-chatgpt-prompt`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        setAir1Prompt(data.prompt);
        if (data.questionText) setQuestionText(data.questionText);
        if (data.candidateAnswer) setCandidateAnswer(data.candidateAnswer);
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(data.prompt);
          showToast("AIR-1 prompt copied to clipboard! Opening ChatGPT...", "success");
        } catch (clipboardErr) {
          console.warn("[AnswerWriting] Clipboard write blocked by browser:", clipboardErr);
          showToast("AIR-1 prompt ready! (Clipboard copy blocked)", "success");
        }
        
        // Open ChatGPT in a new tab
        setTimeout(() => {
          window.open("https://chat.openai.com", "_blank");
        }, 1200);
      } else {
        showToast(data.error || "Failed to generate prompt.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Connection error. Ensure the backend server is running.", "error");
    } finally {
      setLoading(false);
      setLoadingPhase("");
    }
  };

  const handleSavePastedReview = async () => {
    if (!pastedReview.trim()) return;
    setLoading(true);
    setLoadingPhase("Parsing & importing ChatGPT report...");

    try {
      const parseResult = parseAir1ReviewJson(pastedReview);
      
      let finalJson = {};
      let score = null;
      let level = "Pasted Review";
      let weaknessTags = [];

      if (parseResult.ok && parseResult.data) {
        finalJson = parseResult.data;
        score = parseResult.data.score || null;
        if (typeof score === "object") {
          score = score.awarded || null;
        }
        level = parseResult.data.finalVerdict || "Ranker Grade";
        weaknessTags = parseResult.data.autoTags || [];
      } else {
        finalJson = { rawText: pastedReview };
      }

      let parsedScore = Number(score);
      if (isNaN(parsedScore)) parsedScore = null;

      const displayMarks = customMarks || meta.marks;
      const displayPaper = customPaper || meta.paperName;

      const payload = {
        userId: "user_1",
        questionText,
        candidateAnswer,
        paper: displayPaper,
        marks: displayMarks,
        wordLimit: stateData.wordLimit || meta.wordLimit,
        evaluationJson: {
          score: parsedScore ? `${parsedScore}/${displayMarks}` : null,
          level,
          examinerImpression: finalJson.examinerImpression || finalJson.rawText || "Imported review report",
          topFixes: finalJson.topImprovements || finalJson.air1Upgrades || [],
          missingDimensions: finalJson.missingDimensionsChecklist || [],
          upscStructure: finalJson.idealStructure || [],
          finalAdvice: finalJson.detailedMentorReview || null,
          rawReviewText: pastedReview
        },
        score: parsedScore,
        weaknessTags
      };

      const response = await fetch(`${BACKEND_URL}/api/answer-writing/save-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (resData.success) {
        setEvaluation(payload.evaluationJson);
        showToast("ChatGPT review saved & imported successfully!");
      } else {
        showToast(resData.error || "Failed to save the report.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error processing report.", "error");
    } finally {
      setLoading(false);
      setLoadingPhase("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: T.gradientBg,
      fontFamily: T.font,
      color: T.text,
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 9999,
          background: notification.type === "error" ? T.danger : T.secondary,
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "slideIn 0.3s ease"
        }}>
          <span>{notification.type === "error" ? "⚠️" : "🚀"}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div style={{
        width: "100%",
        maxWidth: 1200,
        display: "flex",
        flexDirection: "column",
        gap: 24
      }}>
        
        {/* Workspace Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          background: T.surface,
          padding: "20px 24px",
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 ${T.innerGlow}`
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button 
                onClick={() => navigate(-1)}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  color: T.textMuted,
                  borderRadius: 8,
                  padding: "4px 12px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.textMuted; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}
              >
                ← Back
              </button>
              <span style={{
                fontSize: 11,
                fontWeight: 900,
                color: meta.color,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                background: `${meta.color}15`,
                padding: "4px 10px",
                borderRadius: 20,
                border: `1px solid ${meta.color}33`
              }}>
                {meta.paperName}
              </span>
            </div>
            <h1 style={{
              fontSize: 26,
              fontWeight: 900,
              color: T.textBright,
              margin: "8px 0 2px 0",
              letterSpacing: "-0.02em"
            }}>{meta.title}</h1>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
              Practice and get immediate mentor evaluation & toppers upgrading logs.
            </p>
            { (customMarks || stateData.year || customTopic || stateData.caseStudy) && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {stateData.year && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textBright, background: "rgba(255, 255, 255, 0.08)", border: `1px solid ${T.border}`, padding: "3px 8px", borderRadius: 6 }}>
                    UPSC {stateData.year}
                  </span>
                )}
                {customMarks && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textBright, background: "rgba(255, 255, 255, 0.08)", border: `1px solid ${T.border}`, padding: "3px 8px", borderRadius: 6 }}>
                    Marks: {customMarks}M
                  </span>
                )}
                {customTopic && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, background: "rgba(0, 0, 0, 0.2)", border: `1px solid ${T.border}`, padding: "3px 8px", borderRadius: 6 }}>
                    Topic: {customTopic}
                  </span>
                )}
                {stateData.caseStudy && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, background: "rgba(139, 92, 246, 0.15)", border: `1px solid rgba(139, 92, 246, 0.3)`, padding: "3px 8px", borderRadius: 6 }}>
                    Case Study
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{
            background: "rgba(0, 0, 0, 0.2)",
            border: `1px solid ${T.border}`,
            padding: "8px 16px",
            borderRadius: 12,
            textAlign: "right"
          }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase" }}>Source mode</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: T.warning }}>{sourceModeText}</div>
          </div>
        </div>

        {/* Workspace Layout Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
          width: "100%",
          "@media (max-width: 900px)": {
            gridTemplateColumns: "1fr"
          }
        }} className="workspace-grid">
          
          {/* Left Hand: Inputs & Uploads */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 20
          }}>
            
            {/* Input card */}
            <div style={{
              background: T.surface,
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              padding: 24,
              boxShadow: `0 8px 32px rgba(0, 0, 0, 0.2)`
            }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: T.textBright, marginTop: 0, marginBottom: 16 }}>
                ✍️ Write or Upload Answer Sheets
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Question Area */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Question text
                  </label>
                  <textarea
                    placeholder="Enter the UPSC exam question here (or leave blank if uploading sheets that contain the question)..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 80,
                      background: "rgba(0, 0, 0, 0.25)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      color: T.textBright,
                      padding: 12,
                      fontSize: 14,
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: T.font
                    }}
                  />
                </div>

                {/* Answer Area */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Your Answer
                  </label>
                  <textarea
                    placeholder="Type your answer here (or leave blank if uploading handwritten answer pages)..."
                    value={candidateAnswer}
                    onChange={(e) => setCandidateAnswer(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 220,
                      background: "rgba(0, 0, 0, 0.25)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      color: T.textBright,
                      padding: 12,
                      fontSize: 14,
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: T.font
                    }}
                  />
                </div>

                {/* Multi File Upload Area */}
                <div style={{
                  border: `2px dashed ${T.border}`,
                  borderRadius: 12,
                  padding: 20,
                  textAlign: "center",
                  background: "rgba(0, 0, 0, 0.15)",
                  transition: "border-color 0.2s"
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright }}>Upload Hand-written Pages</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, marginBottom: 12 }}>
                    Support PNG, JPG, or PDF (Max 10 files)
                  </div>
                  <label style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: `1px solid ${T.border}`,
                    color: T.textBright,
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-block"
                  }}>
                    Select Files
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                {/* Selected File List */}
                {selectedFiles.length > 0 && (
                  <div style={{
                    background: "rgba(0, 0, 0, 0.1)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    padding: 12
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
                      Attached Files ({selectedFiles.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: T.surfaceHigh,
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: `1px solid ${T.border}`
                        }}>
                          <span style={{ fontSize: 12, color: T.textBright, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "80%" }}>
                            📄 {file.name}
                          </span>
                          <button 
                            onClick={() => removeFile(idx)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: T.danger,
                              cursor: "pointer",
                              fontSize: 14,
                              fontWeight: "bold"
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state indicator */}
                {loading && (
                  <div style={{
                    background: "rgba(79, 124, 255, 0.1)",
                    border: `1px solid ${T.borderGlow}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 16
                  }}>
                    <div className="spinner" style={{
                      width: 20,
                      height: 20,
                      border: `3px solid rgba(255, 255, 255, 0.1)`,
                      borderTop: `3px solid ${T.primary}`,
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite"
                    }} />
                    <span style={{ fontSize: 13, color: T.textBright, fontWeight: 600 }}>{loadingPhase}</span>
                  </div>
                )}

                {/* Evaluation triggers */}
                <div style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 8
                }}>
                  <button
                    onClick={handleBasicEvaluation}
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: T.primary,
                      border: "none",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "14px 20px",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                      transition: "transform 0.2s"
                    }}
                    onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1.02)"; }}
                    onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    🔍 Basic Evaluation
                  </button>

                  <button
                    onClick={handleAir1PromptGeneration}
                    disabled={loading}
                    style={{
                      flex: 1,
                      background: `linear-gradient(135deg, ${T.accent}, #6D28D9)`,
                      border: "none",
                      color: "#fff",
                      borderRadius: 10,
                      padding: "14px 20px",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                      transition: "transform 0.2s"
                    }}
                    onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1.02)"; }}
                    onMouseLeave={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    🏆 AIR-1 Review (ChatGPT)
                  </button>
                </div>

              </div>
            </div>

          </div>

          {/* Right Hand: Output Panel (Evaluation Results) */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 20
          }}>
            
            {/* Show instructions or loading if no evaluation result yet */}
            {!evaluation && !air1Prompt && (
              <div style={{
                background: T.surface,
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                padding: "48px 24px",
                textAlign: "center",
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.2)`
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textBright, margin: "0 0 8px 0" }}>
                  Mentor Evaluation Dashboard
                </h3>
                <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
                  Submit your typed answer or upload images/PDF scan of your answer sheet to get immediate AI evaluations and score analysis.
                </p>
              </div>
            )}

            {/* AIR-1 Prompt Generation Card */}
            {air1Prompt && (
              <div style={{
                background: T.surface,
                borderRadius: 16,
                border: `1px solid ${T.borderGlow}`,
                padding: 24,
                boxShadow: `0 12px 40px rgba(139, 92, 246, 0.15)`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>📋</span>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: T.textBright, margin: 0 }}>AIR-1 Review Prompt Ready</h3>
                  </div>
                  <span style={{ fontSize: 11, background: `${T.accent}20`, color: T.accent, padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.accent}33`, fontWeight: 700 }}>COPIED</span>
                </div>
                
                <p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: "0 0 16px 0" }}>
                  The standard topper review instructions prompt was generated and copied to your clipboard. You can paste it into ChatGPT (which has been opened in a separate tab) alongside any images to complete the AIR-1 deep review.
                </p>

                <textarea
                  readOnly
                  value={air1Prompt}
                  style={{
                    width: "100%",
                    height: 180,
                    background: "rgba(0, 0, 0, 0.3)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    color: T.textMuted,
                    padding: 12,
                    fontSize: 12,
                    resize: "none",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: "monospace"
                  }}
                />

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(air1Prompt);
                      showToast("Prompt copied again!");
                    }}
                    style={{
                      flex: 1,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${T.border}`,
                      color: T.textBright,
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    Copy Again
                  </button>
                  <button
                    onClick={() => window.open("https://chat.openai.com", "_blank")}
                    style={{
                      flex: 1.5,
                      background: T.accent,
                      border: "none",
                      color: "#fff",
                      padding: "10px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer"
                    }}
                  >
                    Open ChatGPT Tab ↗
                  </button>
                </div>
              </div>
            )}

            {/* Paste ChatGPT Review Card */}
            {air1Prompt && (
              <div style={{
                background: T.surface,
                borderRadius: 16,
                border: `1px solid ${T.borderGlow}`,
                padding: 24,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.2)`
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: T.textBright, margin: "0 0 8px 0" }}>
                  📥 Import ChatGPT Review Report
                </h3>
                <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, margin: "0 0 16px 0" }}>
                  Paste the response report received from ChatGPT here. We will parse it and save it to your dashboard.
                </p>
                <textarea
                  placeholder="Paste the complete response text from ChatGPT here..."
                  value={pastedReview}
                  onChange={(e) => setPastedReview(e.target.value)}
                  style={{
                    width: "100%",
                    height: 150,
                    background: "rgba(0, 0, 0, 0.25)",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    color: T.textBright,
                    padding: 12,
                    fontSize: 13,
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: T.font
                  }}
                />
                <button
                  onClick={handleSavePastedReview}
                  disabled={loading || !pastedReview.trim()}
                  style={{
                    width: "100%",
                    background: T.secondary,
                    border: "none",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "12px 20px",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: loading || !pastedReview.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !pastedReview.trim() ? 0.6 : 1,
                    marginTop: 14,
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => { if (!loading && pastedReview.trim()) e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={(e) => { if (!loading && pastedReview.trim()) e.currentTarget.style.transform = "scale(1)"; }}
                >
                  💾 Save & Import ChatGPT Report
                </button>
              </div>
            )}

            {/* Basic Evaluation Result dashboard */}
            {evaluation && (
              <div style={{
                background: T.surface,
                borderRadius: 16,
                border: `1px solid ${T.border}`,
                padding: 24,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 ${T.innerGlow}`,
                display: "flex",
                flexDirection: "column",
                gap: 20
              }}>
                
                {/* Score Section */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "linear-gradient(90deg, rgba(79, 124, 255, 0.1), rgba(16, 185, 129, 0.05))",
                  border: `1px solid ${T.border}`,
                  padding: "16px 20px",
                  borderRadius: 12
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Estimated Marks</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: T.primary }}>{evaluation.score || "N/A"}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Overall Level</div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: evaluation.level === "Excellent" || evaluation.level === "Good" ? T.secondary : T.warning,
                      background: "rgba(0, 0, 0, 0.2)",
                      padding: "4px 10px",
                      borderRadius: 6,
                      display: "inline-block",
                      marginTop: 4
                    }}>{evaluation.level || "Average"}</span>
                  </div>
                </div>

                {/* Examiner Impression */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: T.textBright, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px 0" }}>
                    🕵️ Examiner Impression
                  </h4>
                  <p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: 0 }}>
                    {evaluation.examinerImpression}
                  </p>
                </div>

                {/* Strengths / Key Fixes */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: T.textBright, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px 0" }}>
                    ⚡ Top Actionable Fixes
                  </h4>
                  <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {evaluation.topFixes && evaluation.topFixes.map((fix, idx) => (
                      <li key={idx} style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>{fix}</li>
                    ))}
                  </ul>
                </div>

                {/* Missing Dimensions */}
                {evaluation.missingDimensions && evaluation.missingDimensions.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 800, color: T.textBright, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px 0" }}>
                      🔍 Missing Dimensions
                    </h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {evaluation.missingDimensions.map((dim, idx) => (
                        <span key={idx} style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: "rgba(239, 68, 68, 0.1)",
                          color: T.danger,
                          border: `1px solid rgba(239, 68, 68, 0.25)`,
                          padding: "4px 10px",
                          borderRadius: 8
                        }}>
                          {dim}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ideal Structure */}
                {evaluation.upscStructure && evaluation.upscStructure.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 12, fontWeight: 800, color: T.textBright, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px 0" }}>
                      🗺️ Ideal UPSC Answer Structure
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {evaluation.upscStructure.map((step, idx) => (
                        <div key={idx} style={{
                          fontSize: 12,
                          color: T.text,
                          background: T.surfaceHigh,
                          border: `1px solid ${T.border}`,
                          padding: "8px 12px",
                          borderRadius: 8
                        }}>
                          <span style={{ fontWeight: 800, color: T.primary, marginRight: 6 }}>Step {idx + 1}:</span>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improved Intro / Conclusion */}
                {(evaluation.improvedIntro || evaluation.improvedConclusion) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {evaluation.improvedIntro && (
                      <div style={{ background: "rgba(16, 185, 129, 0.05)", border: `1px solid rgba(16, 185, 129, 0.15)`, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: T.secondary, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>UPSC-Ready Introduction (Upgraded)</div>
                        <p style={{ fontSize: 12, color: T.textBright, margin: 0, fontStyle: "italic" }}>"{evaluation.improvedIntro}"</p>
                      </div>
                    )}
                    {evaluation.improvedConclusion && (
                      <div style={{ background: "rgba(16, 185, 129, 0.05)", border: `1px solid rgba(16, 185, 129, 0.15)`, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, color: T.secondary, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>UPSC-Ready Conclusion (Upgraded)</div>
                        <p style={{ fontSize: 12, color: T.textBright, margin: 0, fontStyle: "italic" }}>"{evaluation.improvedConclusion}"</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Final advice */}
                {evaluation.finalAdvice && (
                  <div style={{
                    background: "rgba(245, 158, 11, 0.08)",
                    border: `1px solid rgba(245, 158, 11, 0.25)`,
                    padding: 12,
                    borderRadius: 10
                  }}>
                    <span style={{ fontSize: 11, color: T.warning, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>💡 Next Action Drill</span>
                    <p style={{ fontSize: 12, color: T.textBright, margin: 0 }}>{evaluation.finalAdvice}</p>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </div>

      {/* Embedded CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 900px) {
          .workspace-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
