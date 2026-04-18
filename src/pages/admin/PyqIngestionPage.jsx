// src/pages/admin/PyqIngestionPage.jsx
// PYQ Ingestion — Step 1 (Upload) + Step 2 (Extract) + Step 3 (Review & Edit)
// Internal admin-only utility. Future steps (tag, merge) added here progressively.
//
// Step 3 UX v2: bulk actions, compact/expanded mode, search, extended filters,
// problematic detection, unsaved-changes tracking.

import { useState, useRef, useCallback, useMemo } from "react";
import {
  uploadPyqPdf,
  extractPyqPdf,
  loadPyqReview,
  savePyqReview,
} from "../../api/pyqIngestionApi";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function formatBytes(b) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${u[i]}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function truncate(s, n = 90) {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Flags a row as "problematic" — parse quality issues likely present.
 */
function isProblematic(row) {
  const text = (row.editedQuestionText || "").trim();
  if (!text || text.length < 15) return true;
  // Surviving answer-leakage in the question text
  if (/\bans[:.]/i.test(text)) return true;
  // Fewer than 2 options properly filled
  const opts = [row.optionA, row.optionB, row.optionC, row.optionD];
  const filled = opts.filter((o) => o && o.trim().length > 1).length;
  if (filled < 2) return true;
  // Option text suspiciously mixed (contains "(b)" mid-string — parse bleed)
  const optBleed = opts.some((o) => /\([abcd]\)/i.test(o || ""));
  if (optBleed) return true;
  return false;
}

function isEdited(row) {
  return (row.editedQuestionText || "") !== (row.rawQuestionText || "");
}

const STATUS_COLORS = {
  pending:  { bg: "rgba(200,180,80,0.12)",  border: "rgba(200,180,80,0.35)",  text: "#c8b44d" },
  approved: { bg: "rgba(100,195,120,0.12)", border: "rgba(100,195,120,0.35)", text: "#5dbf76" },
  rejected: { bg: "rgba(220,90,80,0.12)",   border: "rgba(220,90,80,0.35)",   text: "#dc6050" },
};

const ALL_FILTERS = ["all", "pending", "approved", "rejected", "edited", "problematic"];

/* ═══════════════════════════════════════════════════════════════
   FILTER + SEARCH LOGIC
   ═══════════════════════════════════════════════════════════════ */

function applySearch(rows, query) {
  if (!query || !query.trim()) return rows;
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (String(r.questionNumber).startsWith(q)) return true;
    const text = (r.editedQuestionText || r.rawQuestionText || "").toLowerCase();
    return text.includes(q);
  });
}

function applyFilter(rows, filter) {
  switch (filter) {
    case "pending":     return rows.filter((r) => r.reviewStatus === "pending");
    case "approved":    return rows.filter((r) => r.reviewStatus === "approved");
    case "rejected":    return rows.filter((r) => r.reviewStatus === "rejected");
    case "edited":      return rows.filter(isEdited);
    case "problematic": return rows.filter(isProblematic);
    default:            return rows;
  }
}

function buildCounts(rows) {
  const counts = { all: rows.length, pending: 0, approved: 0, rejected: 0, edited: 0, problematic: 0 };
  for (const r of rows) {
    counts[r.reviewStatus] = (counts[r.reviewStatus] || 0) + 1;
    if (isEdited(r))      counts.edited++;
    if (isProblematic(r)) counts.problematic++;
  }
  return counts;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function PyqIngestionPage() {
  /* ── Step 1 ─────────────────────────────────────────────────── */
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver]         = useState(false);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError]   = useState("");
  const inputRef = useRef(null);

  /* ── Step 2 ─────────────────────────────────────────────────── */
  const [extractStatus, setExtractStatus] = useState("idle");
  const [extractResult, setExtractResult] = useState(null);
  const [extractError, setExtractError]   = useState("");

  /* ── Step 3: core ───────────────────────────────────────────── */
  const [reviewLoadStatus, setReviewLoadStatus] = useState("idle");
  const [reviewLoadError, setReviewLoadError]   = useState("");
  const [reviewRows, setReviewRows]             = useState([]);
  const [reviewSource, setReviewSource]         = useState(null);
  const [expandedQno, setExpandedQno]           = useState(null);

  /* ── Step 3: controls ───────────────────────────────────────── */
  const [viewMode, setViewMode]       = useState("compact");   // compact | expanded
  const [reviewFilter, setReviewFilter] = useState("all");
  const [searchQuery, setSearchQuery]   = useState("");

  /* ── Step 3: save ───────────────────────────────────────────── */
  const [reviewSaveStatus, setReviewSaveStatus] = useState("idle");
  const [reviewSaveError, setReviewSaveError]   = useState("");
  const [reviewSaveResult, setReviewSaveResult] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt]             = useState(null);

  /* ═══════════════════════════════════════════════════════════════
     STEP 1 HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  function applyFile(file) {
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      setUploadStatus("error");
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setUploadStatus("idle"); setUploadResult(null); setUploadError("");
    setExtractStatus("idle"); setExtractResult(null); setExtractError("");
    setReviewLoadStatus("idle"); setReviewRows([]); setExpandedQno(null);
    setReviewSaveStatus("idle"); setReviewSaveResult(null);
    setHasUnsavedChanges(false); setLastSavedAt(null);
    setSearchQuery(""); setReviewFilter("all");
  }

  function handleFileChange(e) { const f = e.target.files?.[0]; if (f) applyFile(f); }
  function handleDragOver(e)   { e.preventDefault(); setDragOver(true); }
  function handleDragLeave()   { setDragOver(false); }
  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) applyFile(f);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadStatus("uploading");
    try {
      const meta = await uploadPyqPdf(selectedFile);
      setUploadResult(meta); setUploadStatus("done");
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
      setUploadStatus("error");
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 2 HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  async function handleExtract() {
    if (!uploadResult) return;
    setExtractStatus("extracting"); setExtractResult(null); setExtractError("");
    setReviewLoadStatus("idle"); setReviewRows([]); setExpandedQno(null);
    setHasUnsavedChanges(false); setLastSavedAt(null);
    try {
      const data = await extractPyqPdf({
        fileId: uploadResult.fileId,
        storedFileName: uploadResult.storedFileName,
      });
      setExtractResult(data); setExtractStatus("done");
    } catch (err) {
      setExtractError(err.message || "Extraction failed.");
      setExtractStatus("error");
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     STEP 3 HANDLERS
     ═══════════════════════════════════════════════════════════════ */

  async function handleLoadReview() {
    if (!uploadResult?.fileId) return;
    setReviewLoadStatus("loading");
    setReviewLoadError(""); setReviewRows([]); setExpandedQno(null);
    setReviewSaveStatus("idle"); setReviewSaveResult(null);
    setHasUnsavedChanges(false); setLastSavedAt(null);
    try {
      const data = await loadPyqReview(uploadResult.fileId);
      setReviewRows(data.questions || []);
      setReviewSource(data.source);
      setReviewLoadStatus("loaded");
    } catch (err) {
      setReviewLoadError(err.message || "Failed to load review data.");
      setReviewLoadStatus("error");
    }
  }

  /** Update a single field on a row. Marks dirty. */
  const handleFieldChange = useCallback((qno, field, value) => {
    setReviewRows((prev) =>
      prev.map((r) => r.questionNumber === qno ? { ...r, [field]: value } : r)
    );
    setHasUnsavedChanges(true);
    setReviewSaveStatus((s) => s === "saved" ? "idle" : s);
  }, []);

  /** Set reviewStatus on a single row. Marks dirty. */
  const handleSetStatus = useCallback((qno, status) => {
    setReviewRows((prev) =>
      prev.map((r) => r.questionNumber === qno ? { ...r, reviewStatus: status } : r)
    );
    if (status !== "pending") setExpandedQno((prev) => prev === qno ? null : prev);
    setHasUnsavedChanges(true);
    setReviewSaveStatus((s) => s === "saved" ? "idle" : s);
  }, []);

  function toggleExpand(qno) {
    setExpandedQno((prev) => (prev === qno ? null : qno));
  }

  /** Apply a status to an explicit array of question numbers. */
  function applyBulkStatus(targetQnos, status) {
    if (!targetQnos.length) return;
    const targetSet = new Set(targetQnos);
    setReviewRows((prev) =>
      prev.map((r) => targetSet.has(r.questionNumber) ? { ...r, reviewStatus: status } : r)
    );
    setHasUnsavedChanges(true);
    setReviewSaveStatus((s) => s === "saved" ? "idle" : s);
    // Collapse expanded row if it was bulk-actioned away from pending
    if (status !== "pending") setExpandedQno(null);
  }

  async function handleSaveReview() {
    if (!uploadResult?.fileId || !reviewRows.length) return;
    setReviewSaveStatus("saving"); setReviewSaveError(""); setReviewSaveResult(null);
    try {
      const data = await savePyqReview(uploadResult.fileId, reviewRows);
      setReviewSaveResult(data);
      setReviewSaveStatus("saved");
      setHasUnsavedChanges(false);
      setLastSavedAt(data.savedAt || new Date().toISOString());
    } catch (err) {
      setReviewSaveError(err.message || "Save failed.");
      setReviewSaveStatus("error");
    }
  }

  function handleReset() {
    setSelectedFile(null); setUploadStatus("idle"); setUploadResult(null); setUploadError("");
    setExtractStatus("idle"); setExtractResult(null); setExtractError("");
    setReviewLoadStatus("idle"); setReviewLoadError(""); setReviewRows([]);
    setExpandedQno(null); setReviewFilter("all"); setSearchQuery(""); setViewMode("compact");
    setReviewSaveStatus("idle"); setReviewSaveError(""); setReviewSaveResult(null);
    setHasUnsavedChanges(false); setLastSavedAt(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  /* ── Derived / memoised ─────────────────────────────────────── */
  const isUploading    = uploadStatus === "uploading";
  const isUploadDone   = uploadStatus === "done";
  const isExtracting   = extractStatus === "extracting";
  const isExtractDone  = extractStatus === "done";
  const isReviewLoaded = reviewLoadStatus === "loaded";

  const reviewCounts  = useMemo(() => buildCounts(reviewRows), [reviewRows]);
  const searchedRows  = useMemo(() => applySearch(reviewRows, searchQuery), [reviewRows, searchQuery]);
  const filteredRows  = useMemo(() => applyFilter(searchedRows, reviewFilter), [searchedRows, reviewFilter]);
  const visibleQnos   = useMemo(() => filteredRows.map((r) => r.questionNumber), [filteredRows]);
  const pendingQnos   = useMemo(() => reviewRows.filter((r) => r.reviewStatus === "pending").map((r) => r.questionNumber), [reviewRows]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="page-shell">
      <div className="page-wrap" style={{ maxWidth: 1020 }}>

        {/* Header */}
        <div className="page-header">
          <div>
            <div style={S.eyebrow}>Admin · Internal Tool</div>
            <h1 className="page-title">PYQ Ingestion</h1>
            <p className="page-subtitle">
              Step 1: Upload → Step 2: Extract → Step 3: Review &amp; Edit
            </p>
          </div>
        </div>

        {/* ═══ STEP 1: Upload ═══════════════════════════════════════ */}
        <div className="surface-card">
          <div style={S.stepLabel}>Step 1 — Upload PDF</div>

          <div
            style={{
              ...S.dropZone,
              borderColor: dragOver ? "rgba(163,167,246,0.55)"
                : isUploadDone ? "rgba(100,195,120,0.45)"
                : "rgba(255,255,255,0.10)",
              background: dragOver ? "rgba(163,167,246,0.06)" : "rgba(255,255,255,0.02)",
              cursor: isUploadDone ? "default" : "pointer",
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploadDone && inputRef.current?.click()}
            role="button" tabIndex={0} aria-label="Drop PDF here or click to select"
            onKeyDown={(e) => e.key === "Enter" && !isUploadDone && inputRef.current?.click()}
          >
            <input ref={inputRef} id="pyq-pdf-input" type="file" accept="application/pdf,.pdf"
              style={{ display: "none" }} onChange={handleFileChange} />
            <div style={S.dropIcon}>{isUploadDone ? "✅" : selectedFile ? "📄" : "⬆️"}</div>
            {selectedFile ? (
              <>
                <div style={S.dropFileLabel}>{selectedFile.name}</div>
                <div style={S.dropMeta}>{formatBytes(selectedFile.size)} · PDF</div>
              </>
            ) : (
              <>
                <div style={S.dropLabel}>Drag &amp; drop a PDF, or click to browse</div>
                <div style={S.dropMeta}>Maximum 25 MB · PDF only</div>
              </>
            )}
          </div>

          <div style={S.actionRow}>
            <button id="pyq-upload-btn" onClick={handleUpload}
              disabled={!selectedFile || isUploading || isUploadDone}
              style={{ ...S.primaryBtn, opacity: !selectedFile || isUploading || isUploadDone ? 0.5 : 1 }}>
              {isUploading && <span style={S.spinner} />}
              {isUploading ? "Uploading…" : isUploadDone ? "Uploaded ✓" : "Upload PDF"}
            </button>
            {(selectedFile || isUploadDone) && (
              <button id="pyq-reset-btn" onClick={handleReset} style={S.ghostBtn}>
                Clear &amp; Start Over
              </button>
            )}
          </div>

          {isUploading && <ProgressBar label="Saving file to server…" />}
          {uploadStatus === "error" && <ErrorBox msg={uploadError} />}

          {isUploadDone && uploadResult && (
            <div style={S.miniMeta}>
              <MiniRow label="File ID"     value={uploadResult.fileId}        mono />
              <MiniRow label="Stored as"   value={uploadResult.storedFileName} mono />
              <MiniRow label="Size"        value={formatBytes(uploadResult.size)} />
              <MiniRow label="Uploaded at" value={formatDate(uploadResult.uploadedAt)} />
            </div>
          )}
        </div>

        {/* ═══ STEP 2: Extract ══════════════════════════════════════ */}
        {isUploadDone && uploadResult && (
          <div className="surface-card">
            <div style={S.stepLabel}>Step 2 — Extract Questions</div>
            <p style={S.stepDesc}>
              Parses the uploaded PDF and splits it into rough question blocks.
              Saves a temporary preview JSON. No live data is modified.
            </p>

            <div style={S.actionRow}>
              <button id="pyq-extract-btn" onClick={handleExtract}
                disabled={isExtracting || isExtractDone}
                style={{ ...S.primaryBtn, opacity: isExtracting || isExtractDone ? 0.5 : 1 }}>
                {isExtracting && <span style={S.spinner} />}
                {isExtracting ? "Extracting…" : isExtractDone ? "Extracted ✓" : "Extract Questions"}
              </button>
            </div>

            {isExtracting && <ProgressBar label="Parsing PDF and splitting into question blocks…" />}
            {extractStatus === "error" && <ErrorBox msg={extractError} />}

            {isExtractDone && extractResult && (
              <div style={S.pillRow}>
                <SummaryPill label="Questions found" value={extractResult.questionCount} />
                <SummaryPill label="Text extracted"  value={`${(extractResult.rawTextLength / 1000).toFixed(1)} KB`} />
                <SummaryPill label="Extracted at"    value={formatDate(extractResult.extractedAt)} />
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 3: Review ═══════════════════════════════════════ */}
        {isExtractDone && extractResult && (
          <div className="surface-card">
            <div style={S.stepLabel}>Step 3 — Review &amp; Edit</div>
            <p style={S.stepDesc}>
              Inspect each extracted question. Edit text and options. Mark as approved or rejected.
              Save when done — no master data is affected.
            </p>

            {/* Load trigger */}
            {reviewLoadStatus === "idle" && (
              <div style={S.actionRow}>
                <button id="pyq-review-load-btn" onClick={handleLoadReview} style={S.primaryBtn}>
                  Load Questions for Review
                </button>
              </div>
            )}

            {reviewLoadStatus === "loading" && <ProgressBar label="Loading review records…" />}
            {reviewLoadStatus === "error"   && <ErrorBox msg={reviewLoadError} />}

            {/* ── Review interface ──────────────────────────────── */}
            {isReviewLoaded && (
              <>
                {/* ── Sticky Bulk Actions Bar ─────────────────────── */}
                <div style={S.bulkBar}>
                  {/* Left: bulk ops */}
                  <div style={S.bulkLeft}>
                    <button
                      id="pyq-bulk-approve-visible"
                      onClick={() => applyBulkStatus(visibleQnos, "approved")}
                      disabled={!visibleQnos.length}
                      style={{ ...S.bulkBtn, ...S.bulkApprove }}
                      title="Approve all rows currently visible"
                    >
                      ✓ Approve Visible
                    </button>
                    <button
                      id="pyq-bulk-reject-visible"
                      onClick={() => applyBulkStatus(visibleQnos, "rejected")}
                      disabled={!visibleQnos.length}
                      style={{ ...S.bulkBtn, ...S.bulkReject }}
                      title="Reject all rows currently visible"
                    >
                      ✗ Reject Visible
                    </button>
                    <button
                      id="pyq-bulk-reset-visible"
                      onClick={() => applyBulkStatus(visibleQnos, "pending")}
                      disabled={!visibleQnos.length}
                      style={{ ...S.bulkBtn, ...S.bulkReset }}
                      title="Reset all visible rows to pending"
                    >
                      ↺ Reset Visible
                    </button>
                    <div style={S.bulkDivider} />
                    <button
                      id="pyq-bulk-approve-all-pending"
                      onClick={() => applyBulkStatus(pendingQnos, "approved")}
                      disabled={!pendingQnos.length}
                      style={{ ...S.bulkBtn, ...S.bulkApproveAll }}
                      title={`Approve all ${pendingQnos.length} pending questions`}
                    >
                      ✓✓ Approve All Pending ({pendingQnos.length})
                    </button>
                  </div>

                  {/* Right: save + dirty indicator */}
                  <div style={S.bulkRight}>
                    {hasUnsavedChanges && (
                      <span style={S.dirtyBadge}>● Unsaved changes</span>
                    )}
                    {!hasUnsavedChanges && lastSavedAt && (
                      <span style={S.savedBadge}>✓ Saved · {formatTime(lastSavedAt)}</span>
                    )}
                    <button
                      id="pyq-review-save-btn"
                      onClick={handleSaveReview}
                      disabled={reviewSaveStatus === "saving"}
                      style={{
                        ...S.saveBtn,
                        opacity: reviewSaveStatus === "saving" ? 0.6 : 1,
                        boxShadow: hasUnsavedChanges
                          ? "0 0 0 2px rgba(100,195,120,0.45), 0 6px 16px rgba(0,0,0,0.24)"
                          : "0 6px 16px rgba(0,0,0,0.24)",
                      }}
                    >
                      {reviewSaveStatus === "saving" && <span style={S.spinner} />}
                      {reviewSaveStatus === "saving" ? "Saving…" : "Save Review"}
                    </button>
                  </div>
                </div>

                {/* Save feedback */}
                {reviewSaveStatus === "error" && <ErrorBox msg={reviewSaveError} />}

                {/* ── Controls row: search + view toggle ─────────── */}
                <div style={S.controlsRow}>
                  {/* Search */}
                  <div style={S.searchWrap}>
                    <span style={S.searchIcon}>🔍</span>
                    <input
                      id="pyq-search"
                      type="text"
                      placeholder="Search by Q# or keyword…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={S.searchInput}
                      autoComplete="off"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} style={S.searchClear} title="Clear search">✕</button>
                    )}
                  </div>

                  {/* View mode toggle */}
                  <div style={S.viewToggle}>
                    <button
                      id="pyq-view-compact"
                      onClick={() => setViewMode("compact")}
                      style={{ ...S.viewToggleBtn, ...(viewMode === "compact" ? S.viewToggleBtnActive : {}) }}
                      title="Compact rows"
                    >
                      ☰ Compact
                    </button>
                    <button
                      id="pyq-view-expanded"
                      onClick={() => setViewMode("expanded")}
                      style={{ ...S.viewToggleBtn, ...(viewMode === "expanded" ? S.viewToggleBtnActive : {}) }}
                      title="Show all forms expanded"
                    >
                      ⊞ Expanded
                    </button>
                  </div>
                </div>

                {/* ── Filter chips ─────────────────────────────────── */}
                <div style={S.filterTabRow}>
                  {ALL_FILTERS.map((f) => {
                    const count = reviewCounts[f] ?? 0;
                    const isSpecial = f === "problematic";
                    const isEdited  = f === "edited";
                    return (
                      <button
                        key={f}
                        id={`pyq-filter-${f}`}
                        onClick={() => setReviewFilter(f)}
                        style={{
                          ...S.filterTab,
                          ...(reviewFilter === f ? S.filterTabActive : {}),
                          ...(isSpecial && count > 0 ? S.filterTabProblematic : {}),
                          ...(isEdited  && count > 0 ? S.filterTabEdited : {}),
                        }}
                      >
                        {f === "problematic" && "⚠ "}
                        {f === "edited" && "✎ "}
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span style={{
                          ...S.filterTabCount,
                          ...(isSpecial && count > 0 ? { background: "rgba(255,150,50,0.25)", color: "#ff9632" } : {}),
                        }}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                  {/* Result count */}
                  <span style={S.resultCount}>
                    {filteredRows.length} of {reviewRows.length} shown
                  </span>
                </div>

                {/* ── Review rows ──────────────────────────────────── */}
                <div style={S.reviewList}>
                  {filteredRows.length === 0 ? (
                    <div style={S.emptyState}>
                      {searchQuery
                        ? `No questions match "${searchQuery}".`
                        : "No questions match this filter."}
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <ReviewRow
                        key={row.questionNumber}
                        row={row}
                        isExpanded={viewMode === "expanded" || expandedQno === row.questionNumber}
                        onToggle={() => toggleExpand(row.questionNumber)}
                        onFieldChange={handleFieldChange}
                        onSetStatus={handleSetStatus}
                        isProblematic={isProblematic(row)}
                        isEdited={isEdited(row)}
                        viewMode={viewMode}
                      />
                    ))
                  )}
                </div>

                {/* Source note */}
                <div style={S.nextStepNote}>
                  {reviewSource === "reviewed" && <span style={{ color: "var(--text-muted)", marginRight: 8 }}>Previously saved ·</span>}
                  Reviewed records → <code style={{ fontSize: 12 }}>data/ingestion/reviewed/{uploadResult.fileId}_reviewed.json</code>.
                  Tagging and merge will be added here next.
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REVIEW ROW
   Renders compact header always; expanded edit form conditionally.
   ═══════════════════════════════════════════════════════════════ */

function ReviewRow({ row, isExpanded, onToggle, onFieldChange, onSetStatus, isProblematic, isEdited, viewMode }) {
  const sc = STATUS_COLORS[row.reviewStatus] || STATUS_COLORS.pending;

  return (
    <div
      style={{
        ...S.reviewCard,
        borderColor: isExpanded ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
        borderLeft: isProblematic
          ? "3px solid rgba(255,150,50,0.65)"
          : isEdited
            ? "3px solid rgba(163,167,246,0.55)"
            : "3px solid transparent",
      }}
    >
      {/* ── Compact header row (always shown) ── */}
      <div style={S.reviewCardHeader}>
        <div style={S.reviewCardLeft}>
          <span style={S.qnoBadge}>Q.{row.questionNumber}</span>
          <span style={{
            ...S.statusChip,
            background: sc.bg,
            borderColor: sc.border,
            color: sc.text,
          }}>
            {row.reviewStatus}
            {isEdited && <span style={{ marginLeft: 4, opacity: 0.75 }}>✎</span>}
          </span>
          {isProblematic && (
            <span style={S.problemTag} title="Possible parse quality issue">⚠ issue</span>
          )}
          {!isExpanded && (
            <span style={S.qPreviewText}>{truncate(row.editedQuestionText, 95)}</span>
          )}
        </div>

        <div style={S.reviewCardActions}>
          {row.reviewStatus !== "approved" && (
            <button
              id={`pyq-approve-${row.questionNumber}`}
              onClick={() => onSetStatus(row.questionNumber, "approved")}
              style={S.approveBtn}
              title="Approve"
            >
              ✓
            </button>
          )}
          {row.reviewStatus !== "rejected" && (
            <button
              id={`pyq-reject-${row.questionNumber}`}
              onClick={() => onSetStatus(row.questionNumber, "rejected")}
              style={S.rejectBtn}
              title="Reject"
            >
              ✗
            </button>
          )}
          {row.reviewStatus !== "pending" && (
            <button
              onClick={() => onSetStatus(row.questionNumber, "pending")}
              style={S.pendingBtn}
              title="Reset to pending"
            >
              ↺
            </button>
          )}
          {/* Edit toggle only shown in compact mode */}
          {viewMode === "compact" && (
            <button
              id={`pyq-edit-${row.questionNumber}`}
              onClick={onToggle}
              style={{
                ...S.editBtn,
                background: isExpanded ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
              }}
            >
              {isExpanded ? "▲ Close" : "▼ Edit"}
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded edit form ── */}
      {isExpanded && (
        <EditForm row={row} onFieldChange={onFieldChange} onSetStatus={onSetStatus} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function EditForm({ row, onFieldChange, onSetStatus }) {
  return (
    <div style={S.editForm}>
      {/* Q number */}
      <div style={S.formRow}>
        <label style={S.formLabel}>Question #</label>
        <input
          type="number"
          value={row.questionNumber}
          onChange={(e) => onFieldChange(row.questionNumber, "questionNumber", Number(e.target.value))}
          style={{ ...S.formInput, maxWidth: 100 }}
        />
      </div>

      {/* Question text */}
      <div style={S.formRow}>
        <label style={S.formLabel}>Question Text</label>
        <textarea
          value={row.editedQuestionText}
          onChange={(e) => onFieldChange(row.questionNumber, "editedQuestionText", e.target.value)}
          rows={4}
          style={S.formTextarea}
        />
      </div>

      {/* Raw text reference (read-only, shown only when diverged) */}
      {row.rawQuestionText !== row.editedQuestionText && (
        <div style={S.formRow}>
          <label style={{ ...S.formLabel, color: "var(--text-muted)" }}>Raw (original)</label>
          <div style={S.rawRef}>{row.rawQuestionText || "—"}</div>
        </div>
      )}

      {/* Options */}
      <div style={S.optionGrid}>
        {["A", "B", "C", "D"].map((letter) => (
          <div key={letter} style={S.formRow}>
            <label style={S.formLabel}>Option {letter}</label>
            <input
              value={row[`option${letter}`] || ""}
              onChange={(e) => onFieldChange(row.questionNumber, `option${letter}`, e.target.value)}
              style={S.formInput}
              placeholder={`Option ${letter}`}
            />
          </div>
        ))}
      </div>

      {/* Correct answer + Notes */}
      <div style={S.formRowInline}>
        <div style={{ flex: "0 0 200px" }}>
          <label style={S.formLabel}>Correct Answer (optional)</label>
          <select
            value={row.correctAnswer || ""}
            onChange={(e) => onFieldChange(row.questionNumber, "correctAnswer", e.target.value)}
            style={{ ...S.formInput, width: "auto", minWidth: 120 }}
          >
            <option value="">— unknown —</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.formLabel}>Notes</label>
          <input
            value={row.notes || ""}
            onChange={(e) => onFieldChange(row.questionNumber, "notes", e.target.value)}
            style={S.formInput}
            placeholder="Optional reviewer notes"
          />
        </div>
      </div>

      {/* Status buttons */}
      <div style={S.formStatusRow}>
        <span style={S.formLabel}>Status</span>
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => onSetStatus(row.questionNumber, s)}
            style={{
              ...S.statusBtn,
              background: row.reviewStatus === s ? STATUS_COLORS[s].bg  : "rgba(255,255,255,0.04)",
              border:     `1px solid ${row.reviewStatus === s ? STATUS_COLORS[s].border : "rgba(255,255,255,0.07)"}`,
              color:      row.reviewStatus === s ? STATUS_COLORS[s].text : "var(--text-muted)",
              fontWeight: row.reviewStatus === s ? 700 : 500,
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function ProgressBar({ label }) {
  return (
    <div style={S.statusRow}>
      <div style={S.progressBar}><div style={S.progressFill} /></div>
      <span style={S.statusText}>{label}</span>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={S.errorBox}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
      <span>{msg}</span>
    </div>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div style={S.summaryPill}>
      <div style={S.pillLabel}>{label}</div>
      <div style={S.pillValue}>{value}</div>
    </div>
  );
}

function MiniRow({ label, value, mono = false }) {
  return (
    <div style={S.miniRow}>
      <span style={S.miniLabel}>{label}</span>
      <span style={{ ...S.miniValue, fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */

const S = {
  eyebrow: {
    display: "inline-block", padding: "5px 11px", borderRadius: 999,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
    color: "var(--text-muted)", fontSize: 12, fontWeight: 700,
    letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 10,
  },
  stepLabel: {
    fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14,
  },
  stepDesc: { margin: "0 0 16px", fontSize: 14, color: "var(--text-soft)", lineHeight: 1.6 },

  /* Drop zone */
  dropZone: {
    border: "1.5px dashed", borderRadius: "var(--radius-lg)", padding: "34px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    transition: "border-color 0.2s ease, background 0.2s ease",
    userSelect: "none", outline: "none",
  },
  dropIcon: { fontSize: 34, lineHeight: 1 },
  dropLabel: { fontSize: 15, fontWeight: 600, color: "var(--text-soft)" },
  dropMeta:  { fontSize: 13, color: "var(--text-muted)" },
  dropFileLabel: { fontSize: 15, fontWeight: 700, color: "var(--text)", wordBreak: "break-all", textAlign: "center" },

  /* Buttons */
  actionRow: { display: "flex", gap: 12, marginTop: 18, alignItems: "center" },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "11px 24px", fontSize: 14, fontWeight: 700,
    background: "linear-gradient(180deg, #7c8796, #697382)", color: "#fff",
    border: "none", borderRadius: 14, cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,0.28)",
  },
  ghostBtn: {
    padding: "11px 18px", fontSize: 13, fontWeight: 600,
    background: "rgba(255,255,255,0.07)", color: "var(--text-soft)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, cursor: "pointer",
  },
  saveBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "9px 22px", fontSize: 13, fontWeight: 700,
    background: "linear-gradient(180deg, #4a8c5c, #3d7a4e)", color: "#fff",
    border: "none", borderRadius: 12, cursor: "pointer",
    transition: "box-shadow 0.25s ease",
  },
  spinner: {
    display: "inline-block", width: 13, height: 13,
    border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
    borderRadius: "50%", animation: "spin 0.7s linear infinite",
  },

  /* Progress / error */
  statusRow: { marginTop: 14, display: "flex", flexDirection: "column", gap: 8 },
  progressBar: { height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
  progressFill: {
    height: "100%", width: "60%",
    background: "linear-gradient(90deg, #858c95, #a3a7f6)", borderRadius: 999,
    animation: "progressPulse 1.2s ease-in-out infinite",
  },
  statusText: { fontSize: 13, color: "var(--text-muted)" },
  errorBox: {
    marginTop: 14, display: "flex", alignItems: "center", gap: 10,
    padding: "12px 16px", borderRadius: 12,
    background: "rgba(223,117,109,0.12)", border: "1px solid rgba(223,117,109,0.30)",
    color: "#e89090", fontSize: 14, fontWeight: 500,
  },

  /* Mini meta */
  miniMeta: { marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" },
  miniRow: { display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  miniLabel: { width: 110, flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: 2 },
  miniValue: { flex: 1, fontSize: 13, color: "var(--text-soft)", wordBreak: "break-all" },

  /* Pill row */
  pillRow: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 },
  summaryPill: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12, padding: "10px 16px", minWidth: 130,
  },
  pillLabel: { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
  pillValue: { fontSize: 14, fontWeight: 600, color: "var(--text-soft)" },

  /* ── Bulk actions bar ─────────────────────────────────────────── */
  bulkBar: {
    position: "sticky", top: 0, zIndex: 20,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 10, flexWrap: "wrap",
    padding: "10px 14px",
    background: "rgba(22,24,30,0.92)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    marginBottom: 14,
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
  },
  bulkLeft: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  bulkRight: { display: "flex", gap: 10, alignItems: "center", flexShrink: 0 },
  bulkBtn: {
    fontSize: 12, fontWeight: 700, padding: "7px 13px",
    borderRadius: 10, cursor: "pointer", border: "1px solid",
    transition: "opacity 0.15s",
    lineHeight: 1.2,
  },
  bulkApprove: {
    background: "rgba(100,195,120,0.12)", borderColor: "rgba(100,195,120,0.30)", color: "#5dbf76",
  },
  bulkReject: {
    background: "rgba(220,90,80,0.12)", borderColor: "rgba(220,90,80,0.28)", color: "#dc6050",
  },
  bulkReset: {
    background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.10)", color: "var(--text-muted)",
  },
  bulkApproveAll: {
    background: "rgba(100,195,120,0.07)", borderColor: "rgba(100,195,120,0.22)", color: "#5dbf76",
    fontStyle: "italic",
  },
  bulkDivider: {
    width: 1, height: 22, background: "rgba(255,255,255,0.10)", flexShrink: 0, margin: "0 4px",
  },

  /* Dirty / saved state badges */
  dirtyBadge: {
    fontSize: 12, fontWeight: 700, color: "#c8b44d",
    background: "rgba(200,180,80,0.12)", border: "1px solid rgba(200,180,80,0.30)",
    padding: "5px 11px", borderRadius: 999,
  },
  savedBadge: {
    fontSize: 12, fontWeight: 700, color: "#5dbf76",
    background: "rgba(100,195,120,0.10)", border: "1px solid rgba(100,195,120,0.25)",
    padding: "5px 11px", borderRadius: 999,
  },

  /* Controls row */
  controlsRow: {
    display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap",
  },
  searchWrap: {
    flex: 1, minWidth: 200,
    display: "flex", alignItems: "center", gap: 8,
    background: "var(--surface-2)", border: "1px solid var(--border)",
    borderRadius: 12, padding: "0 12px", height: 38,
  },
  searchIcon: { fontSize: 14, flexShrink: 0, opacity: 0.5 },
  searchInput: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    fontSize: 13, color: "var(--text)", fontFamily: "inherit",
  },
  searchClear: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 12, color: "var(--text-muted)", padding: "2px 4px", borderRadius: 6,
  },
  viewToggle: {
    display: "flex", borderRadius: 10, overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  viewToggleBtn: {
    padding: "7px 14px", fontSize: 12, fontWeight: 700,
    background: "rgba(255,255,255,0.04)", border: "none",
    cursor: "pointer", color: "var(--text-muted)",
    transition: "background 0.15s, color 0.15s",
  },
  viewToggleBtnActive: {
    background: "rgba(255,255,255,0.13)", color: "var(--text)",
  },

  /* Filter chips */
  filterTabRow: {
    display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap", alignItems: "center",
  },
  filterTab: {
    display: "flex", alignItems: "center", gap: 5,
    padding: "6px 13px", fontSize: 12, fontWeight: 600,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10, cursor: "pointer", color: "var(--text-muted)",
    transition: "background 0.12s, border-color 0.12s, color 0.12s",
  },
  filterTabActive: {
    background: "rgba(255,255,255,0.11)", border: "1px solid rgba(255,255,255,0.18)",
    color: "var(--text)",
  },
  filterTabProblematic: {
    borderColor: "rgba(255,150,50,0.30)", color: "#ff9632",
  },
  filterTabEdited: {
    borderColor: "rgba(163,167,246,0.30)", color: "#a3a7f6",
  },
  filterTabCount: {
    background: "rgba(255,255,255,0.10)", borderRadius: 999,
    padding: "1px 7px", fontSize: 11, fontWeight: 700,
  },
  resultCount: {
    marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontStyle: "italic",
  },

  /* Review list */
  reviewList: { display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 },
  emptyState: {
    padding: "28px 0", fontSize: 14, color: "var(--text-muted)",
    textAlign: "center", fontStyle: "italic",
  },

  /* Review card */
  reviewCard: {
    border: "1px solid",
    borderRadius: 13,
    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
    overflow: "hidden",
    transition: "border-color 0.15s ease",
  },
  reviewCardHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 10, padding: "10px 14px", flexWrap: "wrap",
  },
  reviewCardLeft: { display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  reviewCardActions: { display: "flex", gap: 5, alignItems: "center", flexShrink: 0 },
  qnoBadge: {
    flexShrink: 0, fontFamily: "monospace", fontSize: 11, fontWeight: 800,
    color: "var(--text-muted)", background: "rgba(255,255,255,0.07)",
    padding: "3px 8px", borderRadius: 7,
  },
  statusChip: {
    flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "3px 9px",
    borderRadius: 999, border: "1px solid", textTransform: "capitalize",
    display: "flex", alignItems: "center",
  },
  problemTag: {
    flexShrink: 0, fontSize: 10, fontWeight: 700,
    color: "#ff9632", background: "rgba(255,150,50,0.12)",
    border: "1px solid rgba(255,150,50,0.30)",
    padding: "2px 7px", borderRadius: 999,
  },
  qPreviewText: {
    fontSize: 13, color: "var(--text-soft)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    flex: 1, minWidth: 0,
  },

  /* Row action buttons */
  approveBtn: { padding: "4px 11px", fontSize: 13, fontWeight: 800, background: "rgba(100,195,120,0.14)", border: "1px solid rgba(100,195,120,0.30)", borderRadius: 8, cursor: "pointer", color: "#5dbf76" },
  rejectBtn:  { padding: "4px 11px", fontSize: 13, fontWeight: 800, background: "rgba(220,90,80,0.12)",   border: "1px solid rgba(220,90,80,0.28)",   borderRadius: 8, cursor: "pointer", color: "#dc6050"  },
  pendingBtn: { padding: "4px 11px", fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, cursor: "pointer", color: "var(--text-muted)" },
  editBtn:    { padding: "4px 12px", fontSize: 11, fontWeight: 700, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, cursor: "pointer", color: "var(--text-soft)" },

  /* Edit form */
  editForm: {
    padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex", flexDirection: "column", gap: 12,
    background: "rgba(255,255,255,0.02)",
  },
  formRow: { display: "flex", flexDirection: "column", gap: 5 },
  formRowInline: { display: "flex", gap: 16, flexWrap: "wrap" },
  formLabel: { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" },
  formInput: {
    background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "9px 12px", outline: "none", fontSize: 13, width: "100%",
  },
  formTextarea: {
    background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "9px 12px", outline: "none", fontSize: 13,
    width: "100%", resize: "vertical", lineHeight: 1.55, fontFamily: "inherit",
  },
  rawRef: {
    fontSize: 12, color: "var(--text-muted)", padding: "8px 12px",
    background: "rgba(0,0,0,0.15)", borderRadius: 8, fontStyle: "italic", lineHeight: 1.5,
  },
  optionGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" },
  formStatusRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  statusBtn: {
    padding: "6px 14px", fontSize: 12, fontWeight: 500,
    borderRadius: 10, cursor: "pointer", textTransform: "capitalize",
  },

  nextStepNote: { marginTop: 10, fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.6 },
};
