// src/components/mains/HandwrittenUploadModal.jsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { extractAnswerWithMetadataApi } from "../../utils/mainsReviewApi";

const T = {
  bg:          "var(--mos-bg, #09090b)",
  surface:     "var(--mos-surface, #18181b)",
  surfaceHigh: "var(--mos-surface-raised, #27272a)",
  border:      "var(--mos-border, #27272a)",
  borderMid:   "var(--mos-border-strong, #3f3f46)",
  muted:       "var(--mos-muted, #71717a)",
  subtle:      "var(--mos-text-soft, #a1a1aa)",
  dim:         "var(--mos-muted, #71717a)",
  text:        "var(--mos-text, #f4f4f5)",
  textBright:  "var(--mos-text, #f4f4f5)",
  accent:      "var(--mos-accent, #8b5cf6)",
  accentSoft:  "var(--mos-accent-soft, #7c3aed33)",
  green:       "var(--mos-success, #10b981)",
  red:         "var(--mos-danger, #ef4444)",
  font:        "var(--mos-font, sans-serif)",
};

const PAPERS = [
  { value: "GS1", label: "GS1" },
  { value: "GS2", label: "GS2" },
  { value: "GS3", label: "GS3" },
  { value: "GS4 Ethics", label: "GS4 Ethics" },
  { value: "Essay", label: "Essay" },
  { value: "Geography Optional P1", label: "Geography Optional Paper 1" },
  { value: "Geography Optional P2", label: "Geography Optional Paper 2" },
];

export default function HandwrittenUploadModal({ isOpen, onClose }) {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | processing | verified | error
  const [errorMsg, setErrorMsg] = useState("");
  const [progressStep, setProgressStep] = useState(0); // 0: uploading, 1: running OCR, 2: extracting metadata
  
  // Verification Screen State
  const [verifiedData, setVerifiedData] = useState({
    questionText: "",
    candidateAnswer: "",
    detectedPaper: "GS1",
    detectedSubject: "",
    detectedTopic: "",
    detectedMarks: "15",
    detectedWordLimit: "200",
    diagramDetected: false,
    diagramDescription: "",
  });

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;
    
    setFiles((prev) => [...prev, ...selected]);
    
    // Create previews
    const newPreviews = selected.map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemovePage = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setFiles([]);
    setPreviews([]);
    setStatus("idle");
    setErrorMsg("");
  };

  const handlePrepareAnswerText = async () => {
    if (files.length === 0) return;
    setStatus("processing");
    setProgressStep(0);

    try {
      // Step transitions simulation
      setTimeout(() => setProgressStep(1), 1000);
      setTimeout(() => setProgressStep(2), 2500);

      const res = await extractAnswerWithMetadataApi(files);
      if (res.ok) {
        setVerifiedData({
          questionText: res.questionText || "",
          candidateAnswer: res.candidateAnswer || res.extractedText || "",
          detectedPaper: res.detectedPaper || "GS1",
          detectedSubject: res.detectedSubject || "",
          detectedTopic: res.detectedTopic || "",
          detectedMarks: String(res.detectedMarks || "15"),
          detectedWordLimit: String(res.detectedWordLimit || "200"),
          diagramDetected: !!res.diagramDetected,
          diagramDescription: res.diagramDescription || "",
        });
        setStatus("verified");
      } else {
        throw new Error(res.error || "Failed to extract answer.");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "An unexpected error occurred during extraction.");
    }
  };

  const handleStartPractice = () => {
    const isOptional = verifiedData.detectedPaper.toLowerCase().includes("optional");
    const isEssay = verifiedData.detectedPaper.toLowerCase() === "essay";
    const paperVal = verifiedData.detectedPaper;

    navigate("/mains/answer-writing", {
      state: {
        question: {
          paper: paperVal,
          mode: isEssay ? "Essay Practice" : isOptional ? "Optional Practice" : "Mains Practice",
          marks: verifiedData.detectedMarks,
          year: new Date().getFullYear(),
          structure: verifiedData.detectedWordLimit === "150" ? "Intro + 3 pts + Concl" : "Intro + 4-5 pts + Concl",
          focus: verifiedData.detectedTopic || verifiedData.detectedSubject || "",
          priority: "Handwritten OCR Extraction",
          question: verifiedData.questionText || "Handwritten Answer Submission",
        },
        preloadedAnswer: {
          candidateAnswer: verifiedData.candidateAnswer,
          uploadedPages: previews.map((p, idx) => ({
            dataUrl: p.url,
            preview: p.url,
            file: files[idx]
          }))
        }
      }
    });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.75)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(8px)", padding: 20
    }}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 16, width: "100%", maxWidth: status === "verified" ? 850 : 600,
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 48px rgba(0,0,0,0.5)", overflow: "hidden",
        fontFamily: T.font, color: T.text, transition: "all 0.3s ease"
      }}>
        
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.textBright }}>
              {status === "verified" ? "Verify & Adjust Extracted Answer" : "Upload Handwritten Answer"}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: T.subtle }}>
              {status === "verified" 
                ? "Review extracted text and detected metadata before final evaluation" 
                : "Accepts multiple images of handwritten pages"}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.subtle,
            fontSize: 20, cursor: "pointer", padding: 0
          }}>✕</button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          
          {status === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Upload Drop Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${T.borderMid}`, borderRadius: 12,
                  padding: "40px 20px", textAlign: "center", cursor: "pointer",
                  background: T.surfaceHigh, transition: "border-color 0.2s"
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  Click to select pages or drag & drop files
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>
                  Supports JPEG, PNG, WebP & PDF
                </div>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,application/pdf" 
                  ref={fileInputRef} 
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>

              {/* Previews List */}
              {previews.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Uploaded Answer Pages ({previews.length})</span>
                    <button onClick={handleClearAll} style={{
                      background: "none", border: "none", color: T.red,
                      fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}>Clear All</button>
                  </div>
                  <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10 }}>
                    {previews.map((prev, idx) => (
                      <div key={idx} style={{
                        width: 90, height: 120, border: `1px solid ${T.border}`,
                        borderRadius: 8, overflow: "hidden", position: "relative",
                        flexShrink: 0, background: "#000"
                      }}>
                        <img src={prev.url} alt={`Page ${idx+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button 
                          onClick={() => handleRemovePage(idx)}
                          style={{
                            position: "absolute", top: 4, right: 4,
                            width: 20, height: 20, borderRadius: "50%",
                            background: "rgba(0,0,0,0.6)", color: "#fff",
                            border: "none", fontSize: 10, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center"
                          }}
                        >✕</button>
                        <div style={{
                          position: "absolute", bottom: 4, left: 0, right: 0,
                          textAlign: "center", fontSize: 9, fontWeight: 700, color: "#fff",
                          textShadow: "0 1px 2px rgba(0,0,0,0.8)"
                        }}>
                          Page {idx+1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Action */}
              <button
                disabled={files.length === 0}
                onClick={handlePrepareAnswerText}
                style={{
                  background: files.length > 0 ? T.accent : T.borderMid,
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "12px 24px", fontWeight: 700, fontSize: 14,
                  cursor: files.length > 0 ? "pointer" : "not-allowed",
                  transition: "all 0.2s"
                }}
              >
                ✨ Prepare Answer Text
              </button>

            </div>
          )}

          {status === "processing" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "40px 0", gap: 24
            }}>
              <div className="mos-spinner" style={{
                width: 48, height: 48, borderRadius: "50%",
                border: `3px solid ${T.accentSoft}`, borderTopColor: T.accent,
                animation: "mos-spin 1s linear infinite"
              }} />
              
              <div style={{ width: "100%", maxWidth: 320 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 700 }}>
                    {progressStep === 0 ? "Uploading pages..." : progressStep === 1 ? "Running OCR engine..." : "Detecting metadata & questions..."}
                  </span>
                  <span>{progressStep === 0 ? "35%" : progressStep === 1 ? "70%" : "95%"}</span>
                </div>
                <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", background: T.accent,
                    width: progressStep === 0 ? "35%" : progressStep === 1 ? "70%" : "95%",
                    transition: "width 0.5s ease"
                  }} />
                </div>
              </div>

              <div style={{ fontSize: 12, color: T.subtle, textAlign: "center" }}>
                Our Gemini AI Vision is extracting handwriting and mapping structure...
              </div>
            </div>
          )}

          {status === "verified" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, alignItems: "start" }}>
              
              {/* Left Column: Metadata & Settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Paper Selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                  <select 
                    value={verifiedData.detectedPaper} 
                    onChange={e => setVerifiedData({ ...verifiedData, detectedPaper: e.target.value })}
                    style={{
                      background: T.bg, border: `1px solid ${T.borderMid}`,
                      borderRadius: 8, color: T.text, padding: "8px 12px", outline: "none"
                    }}
                  >
                    {PAPERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>

                {/* Marks Selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Answer Type (Marks)</label>
                  <select 
                    value={verifiedData.detectedMarks} 
                    onChange={e => setVerifiedData({ ...verifiedData, detectedMarks: e.target.value })}
                    style={{
                      background: T.bg, border: `1px solid ${T.borderMid}`,
                      borderRadius: 8, color: T.text, padding: "8px 12px", outline: "none"
                    }}
                  >
                    <option value="10">10 Marker (~150 words)</option>
                    <option value="15">15 Marker (~200 words)</option>
                    <option value="20">20 Marker (~250 words)</option>
                  </select>
                </div>

                {/* Subject & Topic */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Subject</label>
                    <input 
                      type="text" 
                      value={verifiedData.detectedSubject}
                      onChange={e => setVerifiedData({ ...verifiedData, detectedSubject: e.target.value })}
                      style={{
                        background: T.bg, border: `1px solid ${T.borderMid}`,
                        borderRadius: 8, color: T.text, padding: "8px 12px", outline: "none"
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Topic</label>
                    <input 
                      type="text" 
                      value={verifiedData.detectedTopic}
                      onChange={e => setVerifiedData({ ...verifiedData, detectedTopic: e.target.value })}
                      style={{
                        background: T.bg, border: `1px solid ${T.borderMid}`,
                        borderRadius: 8, color: T.text, padding: "8px 12px", outline: "none"
                      }}
                    />
                  </div>
                </div>

                {/* Diagram Info */}
                <div style={{
                  background: T.surfaceHigh, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input 
                      type="checkbox" 
                      id="diag_check"
                      checked={verifiedData.diagramDetected}
                      onChange={e => setVerifiedData({ ...verifiedData, diagramDetected: e.target.checked })}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <label htmlFor="diag_check" style={{ fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Diagram/Flowchart Detected
                    </label>
                  </div>
                  {verifiedData.diagramDetected && (
                    <textarea 
                      rows={2}
                      value={verifiedData.diagramDescription}
                      onChange={e => setVerifiedData({ ...verifiedData, diagramDescription: e.target.value })}
                      placeholder="e.g. Map of South India displaying Chola maritime trade routes..."
                      style={{
                        width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`,
                        borderRadius: 6, color: T.text, padding: 8, outline: "none", fontSize: 12,
                        resize: "vertical", boxSizing: "border-box"
                      }}
                    />
                  )}
                </div>

              </div>

              {/* Right Column: Question & Candidate Answer */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Detected Question */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Detected Question</label>
                  <textarea 
                    rows={3}
                    value={verifiedData.questionText}
                    onChange={e => setVerifiedData({ ...verifiedData, questionText: e.target.value })}
                    style={{
                      width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`,
                      borderRadius: 8, color: T.text, padding: "10px 12px", outline: "none",
                      resize: "vertical", fontSize: 13, lineHeight: 1.5, boxSizing: "border-box"
                    }}
                  />
                </div>

                {/* Candidate Answer Text */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Candidate Answer (Extracted Text)</label>
                  <textarea 
                    rows={10}
                    value={verifiedData.candidateAnswer}
                    onChange={e => setVerifiedData({ ...verifiedData, candidateAnswer: e.target.value })}
                    style={{
                      width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`,
                      borderRadius: 8, color: T.text, padding: "10px 12px", outline: "none",
                      resize: "vertical", fontSize: 13, lineHeight: 1.6, boxSizing: "border-box"
                    }}
                  />
                </div>

              </div>

            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <h4 style={{ color: T.red, margin: "0 0 8px" }}>Extraction Failed</h4>
              <p style={{ fontSize: 13, color: T.subtle, margin: "0 0 20px" }}>{errorMsg}</p>
              <button onClick={() => setStatus("idle")} style={{
                background: T.accent, color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", cursor: "pointer", fontWeight: 700
              }}>Retry Upload</button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: "16px 24px", borderTop: `1px solid ${T.border}`,
          display: "flex", justifyContent: "flex-end", gap: 12, background: T.surfaceHigh
        }}>
          {status === "verified" ? (
            <>
              <button onClick={() => setStatus("idle")} style={{
                background: "transparent", color: T.subtle, border: `1px solid ${T.borderMid}`,
                borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer"
              }}>
                Back
              </button>
              <button onClick={handleStartPractice} style={{
                background: T.green, color: "#fff", border: "none",
                borderRadius: 8, padding: "10px 22px", fontWeight: 800, cursor: "pointer"
              }}>
                🚀 Start Verification & Evaluation
              </button>
            </>
          ) : (
            <button onClick={onClose} style={{
              background: "transparent", color: T.subtle, border: `1px solid ${T.borderMid}`,
              borderRadius: 8, padding: "10px 20px", fontWeight: 700, cursor: "pointer"
            }}>
              Cancel
            </button>
          )}
        </div>

      </div>

      <style>{`
        @keyframes mos-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
