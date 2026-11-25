import React from "react";
import { useNavigate } from "react-router-dom";
import { MainsVisualRenderer } from "./MainsVisualRenderer";

const DISPLAY_TYPES = {
  D: "Diagram / Map",
  F: "Flowchart",
  C: "Data / Chart / Table",
  CA: "Current Evidence",
  T: "Timeline",
  E: "Example / Case Study"
};

export function BestValueAddition({ bva }) {
  const navigate = useNavigate();
  if (!bva || !bva.needed) return null;

  const isVisual = bva.mode === "VISUAL";
  const typeLabel = (bva.subtype || "Value Addition").replace(/_/g, " ");
  
  // Quantitative Safety Block
  const quantitativeSubtypes = ["BAR_CHART", "LINE_GRAPH", "PIE_CHART"];
  const isQuantitative = quantitativeSubtypes.includes(bva.subtype);
  const evidenceRef = bva.evidence_reference || bva.evidence || null;
  const isVerifiedEvidence = evidenceRef && (
    evidenceRef.status === "TRUSTED_RAG" || 
    evidenceRef.status === "VERIFIED_EVIDENCE" || 
    evidenceRef.status === "VERIFIED_OFFICIAL" ||
    evidenceRef.verification_status === "verified" ||
    evidenceRef.verification_status === "verified_current" ||
    evidenceRef.verification_status === "verified_historical" ||
    evidenceRef.verification_status === "stale" ||
    evidenceRef.status === "QUESTION_PROVIDED"
  );
  
  const blockQuantitative = isQuantitative && !isVerifiedEvidence;
  const isStale = Boolean(evidenceRef?.is_stale || evidenceRef?.verification_status === "stale");
  const isOfficialSource = Boolean(evidenceRef?.is_official || evidenceRef?.authority_level === "PRIMARY_OFFICIAL" || evidenceRef?.source_tier === 1);

  const visualAssetId = bva.visual_asset_id || bva.visual_spec?.id;
  const topicId = bva.topic_id || bva.topic_slug;

  const handleOpenVisualStudio = () => {
    const params = new URLSearchParams();
    if (visualAssetId) params.set("visual", visualAssetId);
    if (topicId) params.set("topic", topicId);
    if (bva.title) params.set("q", bva.title.replace(/^Value Addition:\s*/i, ""));
    navigate(`/current-affairs/visual-studio?${params.toString()}`);
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={styles.badge}>{isVisual ? "VISUAL : " : "NON-VISUAL : "}{typeLabel}</div>
          {evidenceRef && isVerifiedEvidence && (
            <div style={isOfficialSource ? styles.officialBadge : styles.verifiedBadge}>
              🏛️ {isOfficialSource ? "OFFICIAL SOURCE" : "VERIFIED EVIDENCE"}
            </div>
          )}
          {isStale && (
            <div style={styles.staleBadge}>
              ⚠️ REFRESH REQUIRED
            </div>
          )}
        </div>

        <button 
          onClick={handleOpenVisualStudio} 
          style={styles.openVisualStudioBtn}
          title="Open this visual structure in Visual Studio for deep exam study, recall practice & official provenance"
        >
          🎨 Open in Visual Studio ↗
        </button>
      </div>

      <div style={styles.title}>{bva.title}</div>

      {/* Official Evidence Metadata Banner */}
      {evidenceRef && (evidenceRef.source_name || evidenceRef.data_period) && (
        <div style={styles.evidenceMetaBox}>
          <div style={styles.evidenceMetaItem}>
            <span style={styles.evidenceMetaKey}>Source:</span>
            <span style={styles.evidenceMetaVal}>{evidenceRef.source_name || "Official Registry"}</span>
          </div>
          {evidenceRef.data_period && (
            <div style={styles.evidenceMetaItem}>
              <span style={styles.evidenceMetaKey}>Data Period:</span>
              <span style={styles.evidenceMetaVal}>{evidenceRef.data_period}</span>
            </div>
          )}
          {evidenceRef.exam_context && (
            <div style={styles.evidenceMetaItem}>
              <span style={styles.evidenceMetaKey}>Scope:</span>
              <span style={styles.evidenceMetaVal}>{evidenceRef.exam_context.toUpperCase()} {evidenceRef.region ? `(${evidenceRef.region.replace('_', ' ')})` : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Refresh Warning Alert */}
      {isStale && (
        <div style={styles.staleWarningBox}>
          <strong>⚠️ Stale Evidence Notice:</strong> {evidenceRef?.refresh_warning || "This evidence data period is past expiration. Data should be refreshed from official portals before exam deployment."}
        </div>
      )}

      {bva.insertion_point && (
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Where to use:</span>
          <span style={styles.metaValue}>{bva.insertion_point}</span>
        </div>
      )}

      {bva.reason && (
        <div style={styles.metaRow}>
          <span style={styles.metaLabel}>Why it helps:</span>
          <span style={styles.metaValue}>{bva.reason}</span>
        </div>
      )}

      {bva.content && !isVisual && (
        <div style={styles.contentBox}>
          {bva.content}
        </div>
      )}

      {blockQuantitative ? (
        <div style={styles.avoidBox}>
          <span style={{ fontWeight: 800 }}>⛔ Official Safety Block:</span> This chart requires verified official data provenance, but candidate data was unverified. Fabricating fallback figures is prohibited by MentorOS policy.
        </div>
      ) : (
        isVisual && bva.visual_spec && (
          <div style={styles.visualWrapper}>
            <MainsVisualRenderer
              schema={bva.visual_spec}
              drawTimeSeconds={bva.estimated_draw_time_seconds}
            />
          </div>
        )
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 12,
    padding: 24,
    boxShadow: "var(--mos-shadow-soft, 0 1px 3px rgba(16, 24, 40, 0.1))",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#0A64F5",
    background: "#EAF2FF",
    padding: "4px 8px",
    borderRadius: 6,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  priorityBadge: {
    fontSize: 9,
    fontWeight: 800,
    color: "#ef4444",
    background: "rgba(239, 68, 68, 0.08)",
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.03em",
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    color: "#101828",
    lineHeight: 1.4,
    marginBottom: 16,
  },
  metaRow: {
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 8,
    display: "flex",
    gap: 6,
  },
  metaLabel: {
    fontWeight: 700,
    color: "#6B7280",
    minWidth: 100,
  },
  metaValue: {
    color: "#101828",
  },
  contentBox: {
    background: "#F7F7F9",
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#101828",
    marginTop: 14,
    whiteSpace: "pre-wrap",
  },
  avoidBox: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "#b91c1c",
    background: "rgba(239, 68, 68, 0.04)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    padding: "10px 14px",
    borderRadius: 8,
    marginTop: 12,
  },
  visualWrapper: {
    marginTop: 16
  },
  officialBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#047857",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.03em",
  },
  verifiedBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#0369a1",
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.03em",
  },
  staleBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#b45309",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.03em",
  },
  evidenceMetaBox: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "8px 12px",
    marginBottom: 12,
  },
  evidenceMetaItem: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    fontSize: 12,
  },
  evidenceMetaKey: {
    color: "#64748b",
    fontWeight: 600,
  },
  evidenceMetaVal: {
    color: "#0f172a",
    fontWeight: 700,
  },
  staleWarningBox: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fef3c7",
    borderRadius: 6,
    padding: "8px 12px",
    marginBottom: 12,
  },
  openVisualStudioBtn: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "all 0.15s ease",
  },
};
