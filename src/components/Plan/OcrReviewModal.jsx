/**
 * src/components/Plan/OcrReviewModal.jsx
 *
 * Production-safe OCR Review UI for MentorOS.
 * Sits between OCR classification and final save.
 *
 * Props:
 *   open          {boolean}
 *   onClose       {() => void}
 *   ocrResult     {OcrResult}
 *   onConfirm     {(finalMapping) => void}
 *   onRetryOcr    {() => void}
 *   onRemap       {({ subject, section }) => void}
 */

import { useState, useEffect, useCallback } from "react";
import {
  confidenceToColor,
  confidenceToBgColor,
  confidenceToBorder,
  confidenceToLabel,
  confidenceToIcon,
  normalizeAlternatives,
  getAllSubjects,
  getSectionOptionsForSubject,
  mappingStatusLabel,
  mappingStatusColor,
  fmtPct,
} from "./ocrReviewUtils.js";

// ─── Style tokens (all inline so no CSS-file coupling) ───────────────────────

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    background: "rgba(8, 10, 16, 0.55)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    animation: "ocrFadeIn 0.18s ease",
  },
  modal: {
    width: "min(1060px, 95vw)",
    maxHeight: "92vh",
    overflowY: "auto",
    background: "linear-gradient(180deg, #353943 0%, #2d3038 100%)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "26px",
    boxShadow: "0 36px 100px rgba(0,0,0,0.55)",
    padding: "28px 30px 26px",
    color: "#f4f4f5",
    fontFamily: "'Inter', sans-serif",
    animation: "ocrZoomIn 0.22s ease",
    position: "relative",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },
  headerLeft: { flex: 1 },
  kicker: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#858c95",
    marginBottom: "8px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#f4f4f5",
    lineHeight: 1.1,
  },
  subtitle: {
    marginTop: "6px",
    fontSize: "14px",
    color: "#cfcfd4",
  },
  closeBtn: {
    width: "38px",
    height: "38px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "12px",
    cursor: "pointer",
    color: "#a9abb3",
    fontSize: "18px",
    flexShrink: 0,
    padding: 0,
    boxShadow: "none",
    transition: "background 0.15s ease, color 0.15s ease",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  card: {
    background: "linear-gradient(180deg, #40434d 0%, #383b44 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  cardTitle: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: "#858c95",
    marginBottom: "2px",
  },
  cardValue: {
    fontSize: "17px",
    fontWeight: 600,
    color: "#f4f4f5",
    lineHeight: 1.3,
  },
  textArea: {
    width: "100%",
    minHeight: "140px",
    maxHeight: "220px",
    overflowY: "auto",
    padding: "14px",
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    fontSize: "13px",
    lineHeight: "1.7",
    color: "#cfcfd4",
    fontFamily: "monospace",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    margin: 0,
    boxSizing: "border-box",
  },
  toggle: {
    display: "flex",
    gap: "6px",
    marginBottom: "8px",
  },
  toggleBtn: (active) => ({
    padding: "5px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.09)",
    background: active
      ? "linear-gradient(180deg, #5f6067, #4a4c53)"
      : "rgba(255,255,255,0.04)",
    color: active ? "#fff" : "#858c95",
    boxShadow: active ? "0 4px 12px rgba(0,0,0,0.25)" : "none",
    transition: "all 0.15s ease",
  }),
  confBadge: (band) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 14px",
    borderRadius: "999px",
    background: confidenceToBgColor(band),
    border: `1px solid ${confidenceToBorder(band)}`,
    fontSize: "13px",
    fontWeight: 700,
    color: confidenceToColor(band),
    whiteSpace: "nowrap",
  }),
  confBar: {
    width: "100%",
    height: "6px",
    background: "rgba(255,255,255,0.08)",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "4px",
  },
  confBarFill: (band, pct) => ({
    height: "100%",
    width: `${Math.round(pct * 100)}%`,
    background: confidenceToColor(band),
    borderRadius: "999px",
    transition: "width 0.4s ease",
  }),
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    marginTop: "6px",
  },
  chip: (active) => ({
    padding: "5px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    border: "1px solid rgba(255,255,255,0.10)",
    background: active
      ? "rgba(93, 227, 160, 0.12)"
      : "rgba(255,255,255,0.05)",
    color: active ? "#5de3a0" : "#cfcfd4",
    cursor: "pointer",
    transition: "all 0.14s ease",
  }),
  altChip: {
    padding: "5px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 500,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#a9abb3",
    cursor: "pointer",
    transition: "background 0.15s ease",
  },
  warningBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "14px 18px",
    background: "rgba(240,112,112,0.10)",
    border: "1px solid rgba(240,112,112,0.28)",
    borderLeft: "4px solid #f07070",
    borderRadius: "14px",
    marginBottom: "16px",
    fontSize: "14px",
    color: "#f4c5c5",
    lineHeight: 1.5,
  },
  divider: {
    height: "1px",
    background: "rgba(255,255,255,0.07)",
    margin: "18px 0",
  },
  selectWrapper: {
    width: "100%",
    background: "rgba(20,22,30,0.55)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    padding: "10px 14px",
    color: "#f4f4f5",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none",
    appearance: "none",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#858c95",
    marginBottom: "6px",
    display: "block",
  },
  nodeId: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "7px 13px",
    background: "rgba(0,0,0,0.3)",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "13px",
    fontWeight: 700,
    color: "#c4c8d4",
    border: "1px solid rgba(255,255,255,0.10)",
    letterSpacing: "0.03em",
  },
  actionBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "22px",
    paddingTop: "20px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  btnPrimary: (disabled) => ({
    flex: "1 1 auto",
    minWidth: "130px",
    padding: "13px 20px",
    borderRadius: "13px",
    fontWeight: 700,
    fontSize: "15px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    border: "none",
    background: disabled
      ? "rgba(255,255,255,0.08)"
      : "linear-gradient(180deg, #4e9a7e, #3d7d64)",
    color: "#ffffff",
    boxShadow: disabled ? "none" : "0 8px 22px rgba(78,154,126,0.30)",
    transition: "all 0.18s ease",
  }),
  btnSecondary: {
    flex: "1 1 auto",
    minWidth: "110px",
    padding: "13px 20px",
    borderRadius: "13px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, #4d535f, #41464f)",
    color: "#e8eaef",
    boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
    transition: "all 0.18s ease",
  },
  btnDanger: {
    flex: "1 1 auto",
    minWidth: "110px",
    padding: "13px 20px",
    borderRadius: "13px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    border: "1px solid rgba(240,112,112,0.22)",
    background: "rgba(240,112,112,0.10)",
    color: "#f07070",
    boxShadow: "none",
    transition: "all 0.18s ease",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    flexWrap: "wrap",
  },
  kwRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
    marginTop: "8px",
  },
  kwTag: {
    padding: "3px 9px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 600,
    background: "rgba(255,255,255,0.06)",
    color: "#a9abb3",
    border: "1px solid rgba(255,255,255,0.07)",
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function ConfidenceBadge({ band }) {
  return (
    <span style={S.confBadge(band)}>
      <span style={{ fontSize: "13px" }}>{confidenceToIcon(band)}</span>
      {confidenceToLabel(band)}
    </span>
  );
}

function ConfidenceRow({ confidence, band }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#a9abb3", marginBottom: "4px" }}>
        <span>Confidence</span>
        <span style={{ fontWeight: 700, color: confidenceToColor(band) }}>{fmtPct(confidence)}</span>
      </div>
      <div style={S.confBar}>
        <div style={S.confBarFill(band, confidence)} />
      </div>
    </div>
  );
}

function AltsRow({ alts, onSelect }) {
  if (!alts || alts.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#858c95", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
        Alternatives
      </div>
      <div style={S.chipRow}>
        {alts.map((a) => (
          <button
            key={a.label}
            style={S.altChip}
            title={`Confidence: ${fmtPct(a.confidence)}`}
            onClick={() => onSelect && onSelect(a.label)}
          >
            {a.label}
            <span style={{ marginLeft: "5px", opacity: 0.6, fontSize: "11px" }}>
              {fmtPct(a.confidence)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function KeywordTags({ keywords, max = 8 }) {
  if (!keywords || keywords.length === 0) return null;
  const sorted = [...keywords]
    .filter((k) => k.type !== "context")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
  return (
    <div style={S.kwRow}>
      {sorted.map((k, i) => (
        <span key={i} style={S.kwTag} title={`type: ${k.type}, weight: ${k.weight}`}>
          {k.term}
        </span>
      ))}
    </div>
  );
}

function SectionBadge({ status }) {
  const color = mappingStatusColor(status);
  return (
    <span style={{
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 700,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      color,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
    }}>
      {mappingStatusLabel(status)}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   ocrResult: object,
 *   onConfirm: (mapping: object) => void,
 *   onRetryOcr: () => void,
 *   onRemap: ({ subject: string, section: string }) => void
 * }} props
 */
export default function OcrReviewModal({
  open,
  onClose,
  ocrResult,
  onConfirm,
  onRetryOcr,
  onRemap,
}) {
  // ── Guard ────────────────────────────────────────────────────────────────
  if (!open || !ocrResult) return null;

  const {
    rawText = "",
    cleanText = "",
    subject: subjectData = {},
    section: sectionData = {},
    resolver: resolverData = {},
    reviewRequired = false,
    confidenceBand = "low",
  } = ocrResult;

  // ── State ────────────────────────────────────────────────────────────────
  const [textView, setTextView] = useState("clean"); // "raw" | "clean"
  const [editMode, setEditMode] = useState(false);
  const [editedSubject, setEditedSubject] = useState(subjectData.value || "");
  const [editedSection, setEditedSection] = useState(
    sectionData.normalizedValue || sectionData.value || ""
  );
  const [remapPending, setRemapPending] = useState(false);
  const [manuallyReviewed, setManuallyReviewed] = useState(false);

  // When ocrResult changes (e.g. after remap), sync edited state
  useEffect(() => {
    setEditedSubject(subjectData.value || "");
    setEditedSection(sectionData.normalizedValue || sectionData.value || "");
    setRemapPending(false);
  }, [subjectData.value, sectionData.normalizedValue, sectionData.value]);

  const subjectAlts = normalizeAlternatives(subjectData.alternatives, "subject", 3);
  const sectionAlts = normalizeAlternatives(sectionData.alternatives, "section", 3);

  // ── Edit mode handlers ────────────────────────────────────────────────────
  const handleSubjectChange = useCallback((val) => {
    setEditedSubject(val);
    const opts = getSectionOptionsForSubject(val);
    setEditedSection(opts[0] || "");
    setRemapPending(true);
    setManuallyReviewed(true);
  }, []);

  const handleSectionChange = useCallback((val) => {
    setEditedSection(val);
    setRemapPending(true);
    setManuallyReviewed(true);
  }, []);

  const handleApplyRemap = useCallback(() => {
    if (editedSubject && editedSection) {
      onRemap?.({ subject: editedSubject, section: editedSection });
      setRemapPending(false);
    }
  }, [editedSubject, editedSection, onRemap]);

  // ── Alt selection shortcut ────────────────────────────────────────────────
  const handleSelectSubjectAlt = useCallback((label) => {
    setEditMode(true);
    handleSubjectChange(label);
  }, [handleSubjectChange]);

  const handleSelectSectionAlt = useCallback((label) => {
    setEditMode(true);
    const opts = getSectionOptionsForSubject(editedSubject);
    if (opts.includes(label)) {
      handleSectionChange(label);
    }
  }, [editedSubject, handleSectionChange]);

  // ── Confirm ───────────────────────────────────────────────────────────────
  const isConfirmDisabled =
    !resolverData?.syllabusNodeId ||
    (confidenceBand === "low" && !manuallyReviewed);

  const handleConfirm = useCallback(() => {
    onConfirm?.({
      subject: editedSubject || subjectData.value,
      section: editedSection || sectionData.normalizedValue || sectionData.value,
      syllabusNodeId: resolverData.syllabusNodeId,
      topic: resolverData.topic,
      mappingStatus: resolverData.mappingStatus,
      manuallyReviewed,
    });
  }, [editedSubject, editedSection, resolverData, subjectData, sectionData, manuallyReviewed, onConfirm]);

  // ── Section options for dropdown ──────────────────────────────────────────
  const sectionOptions = getSectionOptionsForSubject(editedSubject);
  const allSubjects = getAllSubjects();

  const displayText = textView === "raw" ? rawText : (cleanText || rawText);

  // ── Responsive 2-col detection via CSS media is not available inline;
  //    use a simple window.innerWidth check with a fallback of 2-col default.
  //    We use a CSS class approach via a style tag injected once.
  // ────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Keyframe injection */}
      <style>{`
        @keyframes ocrFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes ocrZoomIn {
          from { opacity:0; transform:scale(0.96) translateY(8px) }
          to   { opacity:1; transform:scale(1) translateY(0) }
        }
        .ocr-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ocr-alt-chip:hover { background: rgba(255,255,255,0.09) !important; color: #f4f4f5 !important; }
        .ocr-close-btn:hover { background: rgba(255,255,255,0.12) !important; color: #f4f4f5 !important; }
        .ocr-btn-secondary:hover:not(:disabled) { background: linear-gradient(180deg,#565c6a,#474c58) !important; }
        .ocr-btn-danger:hover:not(:disabled) { background: rgba(240,112,112,0.18) !important; }
        .ocr-btn-primary:hover:not(:disabled) { background: linear-gradient(180deg,#5aad8e,#468f74) !important; box-shadow: 0 10px 26px rgba(78,154,126,0.38) !important; }
        @media (max-width: 680px) {
          .ocr-two-col { grid-template-columns: 1fr !important; }
          .ocr-modal-inner { padding: 20px 16px 18px !important; }
        }
      `}</style>

      {/* Overlay */}
      <div style={S.overlay} onClick={onClose}>
        <div
          className="ocr-modal-inner"
          style={S.modal}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div style={S.header}>
            <div style={S.headerLeft}>
              <div style={S.kicker}>MentorOS · OCR Resolution</div>
              <h2 style={S.title}>Review OCR Mapping</h2>
              <p style={S.subtitle}>
                Verify extracted text and syllabus mapping before saving.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flexShrink: 0 }}>
              <ConfidenceBadge band={confidenceBand} />
              <button
                className="ocr-close-btn"
                style={S.closeBtn}
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── WARNING BANNER ───────────────────────────────────────── */}
          {reviewRequired && (
            <div style={S.warningBanner}>
              <span style={{ fontSize: "18px", flexShrink: 0 }}>⚠</span>
              <div>
                <strong style={{ color: "#f07070" }}>Manual review required.</strong>{" "}
                The classifier confidence is too low to auto-save. Please verify the
                subject, section, and resolved node below before confirming.
              </div>
            </div>
          )}

          {/* ── 2-COLUMN BODY ───────────────────────────────────────── */}
          <div className="ocr-two-col">

            {/* ═══════════ LEFT — EXTRACTED TEXT ═══════════ */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={S.card}>
                <div style={{ ...S.row, marginBottom: "2px" }}>
                  <div style={S.cardTitle}>Extracted Text</div>
                  <div style={S.toggle}>
                    <button
                      style={S.toggleBtn(textView === "clean")}
                      onClick={() => setTextView("clean")}
                    >
                      Clean
                    </button>
                    <button
                      style={S.toggleBtn(textView === "raw")}
                      onClick={() => setTextView("raw")}
                    >
                      Raw
                    </button>
                  </div>
                </div>
                <pre style={S.textArea}>
                  {displayText || "(empty)"}
                </pre>
                {cleanText && cleanText !== rawText && textView === "clean" && (
                  <p style={{ margin: 0, fontSize: "11px", color: "#5f6067" }}>
                    Showing sanitized text. Switch to Raw to see original OCR output.
                  </p>
                )}
              </div>

              {/* Edit Mode controls */}
              {editMode && (
                <div style={{ ...S.card, border: "1px solid rgba(93,227,160,0.20)", gap: "14px" }}>
                  <div style={S.cardTitle}>✎  Edit Mapping</div>

                  <div>
                    <label style={S.label}>Subject</label>
                    <select
                      style={S.selectWrapper}
                      value={editedSubject}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                    >
                      <option value="">— Select subject —</option>
                      {allSubjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={S.label}>Section</label>
                    <select
                      style={S.selectWrapper}
                      value={editedSection}
                      onChange={(e) => handleSectionChange(e.target.value)}
                      disabled={!editedSubject}
                    >
                      <option value="">— Select section —</option>
                      {sectionOptions.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  {remapPending && editedSubject && editedSection && (
                    <button
                      style={{
                        padding: "10px 16px",
                        borderRadius: "11px",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        border: "1px solid rgba(93,227,160,0.30)",
                        background: "rgba(93,227,160,0.12)",
                        color: "#5de3a0",
                        boxShadow: "none",
                        width: "100%",
                      }}
                      onClick={handleApplyRemap}
                    >
                      Fetch Updated Mapping →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ═══════════ RIGHT — CLASSIFICATION & RESOLVER ═══════════ */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

              {/* Subject card */}
              <div style={S.card}>
                <div style={S.cardTitle}>Subject</div>
                {editMode ? (
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#5de3a0" }}>
                    {editedSubject || "—"}
                  </div>
                ) : (
                  <div style={S.cardValue}>{subjectData.value || "Unresolved"}</div>
                )}

                <ConfidenceRow
                  confidence={subjectData.confidence || 0}
                  band={subjectData.confidenceBand || "low"}
                />

                {subjectData.confidenceGap != null && (
                  <div style={{ fontSize: "12px", color: "#858c95" }}>
                    Gap to #2:{" "}
                    <span style={{ fontWeight: 700, color: "#a9abb3" }}>
                      {fmtPct(subjectData.confidenceGap)}
                    </span>
                  </div>
                )}

                <AltsRow alts={subjectAlts} onSelect={handleSelectSubjectAlt} />

                {subjectData.matchedKeywords?.length > 0 && (
                  <div>
                    <div style={{ fontSize: "11px", color: "#5f6067", marginBottom: "4px" }}>
                      Matched keywords
                    </div>
                    <KeywordTags keywords={subjectData.matchedKeywords} max={8} />
                  </div>
                )}
              </div>

              {/* Section card */}
              <div style={S.card}>
                <div style={S.cardTitle}>Section</div>
                {editMode ? (
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#5de3a0" }}>
                    {editedSection || "—"}
                  </div>
                ) : (
                  <div style={S.cardValue}>
                    {sectionData.normalizedValue || sectionData.value || "Unresolved"}
                  </div>
                )}

                <ConfidenceRow
                  confidence={sectionData.confidence || 0}
                  band={sectionData.confidenceBand || "low"}
                />

                {sectionData.confidenceGap != null && (
                  <div style={{ fontSize: "12px", color: "#858c95" }}>
                    Gap to #2:{" "}
                    <span style={{ fontWeight: 700, color: "#a9abb3" }}>
                      {fmtPct(sectionData.confidenceGap)}
                    </span>
                  </div>
                )}

                <AltsRow alts={sectionAlts} onSelect={handleSelectSectionAlt} />

                {sectionData.matchedKeywords?.length > 0 && (
                  <div>
                    <div style={{ fontSize: "11px", color: "#5f6067", marginBottom: "4px" }}>
                      Matched keywords
                    </div>
                    <KeywordTags keywords={sectionData.matchedKeywords} max={8} />
                  </div>
                )}
              </div>

              {/* Resolved mapping card */}
              <div style={{
                ...S.card,
                background: "linear-gradient(180deg, #2e3240 0%, #292d38 100%)",
                border: `1px solid ${resolverData.syllabusNodeId ? "rgba(93,227,160,0.18)" : "rgba(240,112,112,0.18)"}`,
              }}>
                <div style={{ ...S.row }}>
                  <div style={S.cardTitle}>Resolved Mapping</div>
                  {resolverData.mappingStatus && (
                    <SectionBadge status={resolverData.mappingStatus} />
                  )}
                </div>

                {/* Topic */}
                <div>
                  <div style={S.label}>Topic</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#f4f4f5" }}>
                    {resolverData.topic || "—"}
                  </div>
                </div>

                {/* Node ID */}
                <div>
                  <div style={S.label}>Syllabus Node ID</div>
                  <div style={S.nodeId}>
                    <span style={{ opacity: 0.5, fontSize: "11px" }}>#</span>
                    {resolverData.syllabusNodeId || "Unresolved"}
                  </div>
                </div>

                {/* Reason */}
                {resolverData.reason && (
                  <div style={{ fontSize: "12px", color: "#5f6067", marginTop: "4px" }}>
                    Reason: <span style={{ color: "#858c95" }}>{resolverData.reason}</span>
                  </div>
                )}

                {!resolverData.syllabusNodeId && (
                  <div style={{
                    marginTop: "6px",
                    padding: "10px 13px",
                    background: "rgba(240,112,112,0.08)",
                    border: "1px solid rgba(240,112,112,0.18)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    color: "#f07070",
                  }}>
                    No node ID resolved. Use Edit Mapping to manually remap.
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── ACTION BAR ──────────────────────────────────────────────── */}
          <div style={S.actionBar}>
            {/* Confirm */}
            <button
              className="ocr-btn-primary"
              style={S.btnPrimary(isConfirmDisabled)}
              disabled={isConfirmDisabled}
              onClick={handleConfirm}
              title={
                isConfirmDisabled
                  ? "Low confidence — please review or edit the mapping first"
                  : "Save this mapping"
              }
            >
              {isConfirmDisabled ? "⚠ Review First" : "✓  Confirm & Save"}
            </button>

            {/* Edit toggle */}
            <button
              className="ocr-btn-secondary"
              style={{
                ...S.btnSecondary,
                ...(editMode ? {
                  border: "1px solid rgba(93,227,160,0.25)",
                  background: "rgba(93,227,160,0.08)",
                  color: "#5de3a0",
                } : {}),
              }}
              onClick={() => {
                setEditMode((v) => !v);
                setManuallyReviewed(true);
              }}
            >
              {editMode ? "✕  Close Editor" : "✎  Edit Mapping"}
            </button>

            {/* Retry OCR */}
            <button
              className="ocr-btn-secondary"
              style={S.btnSecondary}
              onClick={onRetryOcr}
            >
              ↻  Retry OCR
            </button>

            {/* Cancel */}
            <button
              className="ocr-btn-danger"
              style={S.btnDanger}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>

          {/* Manual review notice */}
          {manuallyReviewed && (
            <div style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "#5de3a0",
              textAlign: "center",
              opacity: 0.8,
            }}>
              ✓ Manual review recorded — Confirm & Save is enabled.
            </div>
          )}

        </div>
      </div>
    </>
  );
}
