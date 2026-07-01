import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { extractQuestionAnswerFromImagesApi } from "../utils/mainsReviewApi.js";

// ─── Theme tokens (consistent with MentorOS dark theme) ──────────────────────
const T = {
  bg: "#09090b",
  surface: "#111113",
  surfaceHigh: "#18181b",
  border: "#1f1f23",
  borderMid: "#27272a",
  muted: "#3f3f46",
  subtle: "#52525b",
  dim: "#71717a",
  text: "#e4e4e7",
  textBright: "#f4f4f5",
  amber: "#f59e0b",
  amberDim: "#d97706",
  blue: "#3b82f6",
  blueDim: "#2563eb",
  green: "#22c55e",
  greenDim: "#16a34a",
  red: "#ef4444",
  purple: "#8b5cf6",
  font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const label11 = (color = T.subtle) => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  color,
});

export default function HandwrittenSheetReviewPanel({
  workspace = null,
  subject = "",
  paper: defaultPaper = "GS1",
  answerType = "",
  defaultMarks = 15,
}) {
  const navigate = useNavigate();
  const [sourceOption, setSourceOption] = useState("pyq"); // pyq | institute | custom
  const [paper, setPaper] = useState(defaultPaper);
  const [year, setYear] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [marks, setMarks] = useState(String(defaultMarks));
  const [wordLimit, setWordLimit] = useState(workspace === "essay" ? "1000" : "250");
  const [instituteName, setInstituteName] = useState("");
  const [testName, setTestName] = useState("");
  const [subjectTopic, setSubjectTopic] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [uploadedPages, setUploadedPages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  // Keep paper in sync if props update
  useEffect(() => {
    setPaper(defaultPaper);
  }, [defaultPaper]);

  // Keep marks in sync if props update
  useEffect(() => {
    setMarks(String(defaultMarks));
  }, [defaultMarks]);

  const handleMarksChange = (val) => {
    setMarks(val);
    if (workspace === "essay") {
      setWordLimit("1000");
    } else if (val === "10") {
      setWordLimit("150");
    } else if (val === "15" || val === "20") {
      setWordLimit("250");
    }
  };

  const addFiles = (files) => {
    const valid = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    const toAdd = valid.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      name: file.name,
    }));
    setUploadedPages((prev) => {
      const remaining = 5 - prev.length;
      return [...prev, ...toAdd.slice(0, remaining)];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleRemovePage = (idx) => {
    setUploadedPages((prev) => {
      if (prev[idx].preview) {
        URL.revokeObjectURL(prev[idx].preview);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleExtract = async () => {
    if (uploadedPages.length === 0) {
      setError("Please upload at least one image or PDF page.");
      return;
    }
    setIsExtracting(true);
    setError("");
    try {
      const files = uploadedPages.map((pg) => pg.file).filter(Boolean);
      const res = await extractQuestionAnswerFromImagesApi(files);
      if (res.success) {
        const newAttemptId = `mains_upload_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}`;
        
        // Use props or detected metadata
        const finalPaper = workspace ? defaultPaper : (res.detectedMetadata?.paper || paper);
        const finalSubjectTopic =
          workspace && subject
            ? subject
            : res.detectedMetadata?.topic || res.detectedMetadata?.subject || subjectTopic;

        let finalWordLimit = res.detectedMetadata?.wordLimit;
        if (!finalWordLimit) {
          if (finalPaper === "Essay" || workspace === "essay") {
            finalWordLimit = "1000";
          } else if (marks === "10") {
            finalWordLimit = "150";
          } else {
            finalWordLimit = "250";
          }
        } else {
          finalWordLimit = String(finalWordLimit);
        }

        const finalMeta = {
          sourceOption: res.detectedMetadata?.sourceType || sourceOption,
          paper: finalPaper,
          year: res.detectedMetadata?.year || year,
          questionNumber: res.detectedMetadata?.questionNumber || questionNumber,
          marks: marks,
          wordLimit: finalWordLimit,
          instituteName: res.detectedMetadata?.instituteName || instituteName,
          testName: res.detectedMetadata?.testName || testName,
          subjectTopic: finalSubjectTopic,
          detectedSubject: res.detectedMetadata?.subject || "",
          detectedTopic: res.detectedMetadata?.topic || "",
          detectedMicrotheme: res.detectedMetadata?.microtheme || "",
          confidence: res.confidence || null,
          // Propagate workspace parameters for tagging
          workspace: workspace,
          subject: workspace && subject ? subject : "",
          answerType: workspace && answerType ? answerType : "",
        };

        const uploadedPagesMeta = uploadedPages.map((pg, idx) => ({
          pageNo: idx + 1,
          fileName: pg.name || `page_${idx + 1}.jpg`,
        }));

        navigate("/mains/answer-writing", {
          state: {
            practiceMode: "upload",
            ocrExtracted: true,
            verifiedQuestionText: res.questionText || "",
            pastedText: res.answerText || "",
            uploadMeta: finalMeta,
            attemptId: newAttemptId,
            sessionStarted: true,
            uploadedPagesMeta: uploadedPagesMeta,
          },
        });
      } else {
        setError(res.error || "Failed to extract text from the sheet.");
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Extraction failed. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const [winWidth, setWinWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWinWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = winWidth < 768;

  const containerGridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
    gap: 24,
    marginTop: 20,
  };

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 28,
        fontFamily: T.font,
        color: T.text,
      }}
    >
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${T.purple}, ${T.purple}44, transparent)`,
        }}
      />
      <div style={{ padding: "26px 28px 28px" }}>
        <div>
          <div
            style={{
              ...label11(T.purple),
              marginBottom: 7,
              letterSpacing: "0.14em",
            }}
          >
            HANDWRITTEN SHEET REVIEW
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: T.textBright,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            Upload Answer Sheet for Review
          </div>
          <div
            style={{
              fontSize: 13,
              color: T.dim,
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Upload one image/PDF containing both the question and your written answer.
            MentorOS will extract, split, verify, evaluate, and generate AIR-1 review.
          </div>
        </div>

        <div style={containerGridStyle}>
          {/* Left Panel: Metadata */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div
                style={{
                  ...label11(T.subtle),
                  marginBottom: 8,
                  fontSize: 10,
                }}
              >
                Marks
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["10", "15", "20"].map((m) => {
                  const isActive = marks === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMarksChange(m)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: isActive
                          ? `1.5px solid ${T.purple}`
                          : `1px solid ${T.borderMid}`,
                        background: isActive ? `${T.purple}18` : T.bg,
                        color: isActive ? T.purple : T.dim,
                        fontWeight: isActive ? 800 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: T.font,
                      }}
                    >
                      {m} Marks
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.purple,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 0",
                  outline: "none",
                }}
              >
                {showAdvanced
                  ? "▼ Hide Advanced details"
                  : "▶ Show Advanced details"}
              </button>
            </div>

            {showAdvanced && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  padding: 16,
                  background: T.bg,
                  border: `1px solid ${T.borderMid}`,
                  borderRadius: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      ...label11(T.subtle),
                      marginBottom: 8,
                      fontSize: 10,
                    }}
                  >
                    Source Type
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "UPSC PYQ", value: "pyq" },
                      { label: "Institute Test", value: "institute" },
                      { label: "Custom Practice", value: "custom" },
                    ].map((opt) => {
                      const isActive = sourceOption === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSourceOption(opt.value)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            border: isActive
                              ? `1.5px solid ${T.purple}`
                              : `1px solid ${T.borderMid}`,
                            background: isActive ? `${T.purple}18` : T.bg,
                            color: isActive ? T.purple : T.dim,
                            fontWeight: isActive ? 800 : 500,
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: T.font,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  {sourceOption === "pyq" && (
                    <>
                      <div>
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Paper
                        </label>
                        <select
                          value={paper}
                          disabled={workspace !== null}
                          onChange={(e) => setPaper(e.target.value)}
                          style={{
                            width: "100%",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        >
                          {workspace ? (
                            <option value={defaultPaper}>{defaultPaper}</option>
                          ) : (
                            ["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map(
                              (p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              )
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Year
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 2023"
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Question No.
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 3a"
                          value={questionNumber}
                          onChange={(e) => setQuestionNumber(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        />
                      </div>
                    </>
                  )}

                  {sourceOption === "institute" && (
                    <>
                      <div
                        style={{
                          gridColumn: isMobile ? "span 1" : "span 2",
                        }}
                      >
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Institute Name
                        </label>
                        <input
                          type="text"
                          placeholder="Vision IAS, Forum IAS..."
                          value={instituteName}
                          onChange={(e) => setInstituteName(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          gridColumn: isMobile ? "span 1" : "span 2",
                        }}
                      >
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Test Name / Code
                        </label>
                        <input
                          type="text"
                          placeholder="Mains Test 4..."
                          value={testName}
                          onChange={(e) => setTestName(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Paper
                        </label>
                        <select
                          value={paper}
                          disabled={workspace !== null}
                          onChange={(e) => setPaper(e.target.value)}
                          style={{
                            width: "100%",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        >
                          {workspace ? (
                            <option value={defaultPaper}>{defaultPaper}</option>
                          ) : (
                            ["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map(
                              (p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              )
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Question No.
                        </label>
                        <input
                          type="text"
                          value={questionNumber}
                          onChange={(e) => setQuestionNumber(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        />
                      </div>
                    </>
                  )}

                  {sourceOption === "custom" && (
                    <>
                      <div
                        style={{
                          gridColumn: isMobile ? "span 1" : "span 2",
                        }}
                      >
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Subject / Topic
                        </label>
                        <input
                          type="text"
                          placeholder={workspace ? subject : "e.g. Art & Culture, Internal Security"}
                          disabled={workspace !== null}
                          value={workspace ? subject : subjectTopic}
                          onChange={(e) => setSubjectTopic(e.target.value)}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.subtle,
                            textTransform: "uppercase",
                          }}
                        >
                          Paper
                        </label>
                        <select
                          value={paper}
                          disabled={workspace !== null}
                          onChange={(e) => setPaper(e.target.value)}
                          style={{
                            width: "100%",
                            background: T.bg,
                            border: `1px solid ${T.borderMid}`,
                            borderRadius: 8,
                            color: T.text,
                            padding: 8,
                            marginTop: 4,
                            outline: "none",
                          }}
                        >
                          {workspace ? (
                            <option value={defaultPaper}>{defaultPaper}</option>
                          ) : (
                            ["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map(
                              (p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              )
                            )
                          )}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: T.subtle,
                        textTransform: "uppercase",
                      }}
                    >
                      Word Limit
                    </label>
                    <select
                      value={wordLimit}
                      onChange={(e) => setWordLimit(e.target.value)}
                      style={{
                        width: "100%",
                        background: T.bg,
                        border: `1px solid ${T.borderMid}`,
                        borderRadius: 8,
                        color: T.text,
                        padding: 8,
                        marginTop: 4,
                        outline: "none",
                      }}
                    >
                      {["150", "250", "1000", "2000"].map((w) => (
                        <option key={w} value={w}>
                          {w} Words
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Uploader & Button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label
                style={{
                  ...label11(T.subtle),
                  marginBottom: 8,
                  fontSize: 10,
                  display: "block",
                }}
              >
                Upload Question + Answer Sheet
              </label>
              <div
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? T.purple : T.borderMid}`,
                  borderRadius: 12,
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: isDragging ? `${T.purple}08` : T.bg,
                  transition: "all 0.2s",
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => addFiles(e.target.files)}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.textBright,
                  }}
                >
                  Drag & drop image/PDF here or click to select
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                  Supports multiple pages (max 5 pages)
                </div>
              </div>
            </div>

            {uploadedPages.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: T.subtle,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Uploaded Pages ({uploadedPages.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {uploadedPages.map((pg, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: "relative",
                        width: 70,
                        height: 70,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: `1px solid ${T.borderMid}`,
                      }}
                    >
                      {pg.file?.type === "application/pdf" ? (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: T.surfaceHigh,
                            fontSize: 12,
                            fontWeight: 800,
                            color: T.red,
                          }}
                        >
                          PDF
                        </div>
                      ) : (
                        <img
                          src={pg.preview}
                          alt={`Page ${idx + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePage(idx);
                        }}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          background: T.red,
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: `${T.red}15`,
                  border: `1px solid ${T.red}33`,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 13,
                  color: T.red,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <button
              type="button"
              disabled={isExtracting || uploadedPages.length === 0}
              onClick={handleExtract}
              style={{
                width: "100%",
                background: isExtracting
                  ? T.muted
                  : `linear-gradient(135deg, ${T.purple} 0%, #4f46e5 100%)`,
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontWeight: 950,
                fontSize: 14,
                padding: "14px 20px",
                cursor:
                  isExtracting || uploadedPages.length === 0
                    ? "not-allowed"
                    : "pointer",
                boxShadow:
                  uploadedPages.length > 0 && !isExtracting
                    ? `0 4px 14px ${T.purple}40`
                    : "none",
                transition: "all 0.2s",
              }}
            >
              {isExtracting
                ? "🔍 Extracting Question & Answer (Gemini OCR)..."
                : "🔍 Extract & Verify"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
