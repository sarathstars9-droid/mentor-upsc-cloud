/**
 * src/components/mains/BestValueAddition.jsx
 *
 * Dedicated component representing the Best Value Addition recommended for the answer,
 * including visual diagrams rendering where applicable.
 */

import React from "react";
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
  if (!bva || !bva.needed) return null;

  const isVisual = bva.mode === "VISUAL";
  const typeLabel = (bva.subtype || "Value Addition").replace(/_/g, " ");
  
  // Quantitative Safety Block
  const quantitativeSubtypes = ["BAR_CHART", "LINE_GRAPH", "PIE_CHART"];
  const isQuantitative = quantitativeSubtypes.includes(bva.subtype);
  const hasProvenance = bva.evidence_reference && ["TRUSTED_RAG", "VERIFIED_EVIDENCE", "QUESTION_PROVIDED"].includes(bva.evidence_reference.status);
  
  const blockQuantitative = isQuantitative && !hasProvenance;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.badge}>{isVisual ? "VISUAL : " : "NON-VISUAL : "}{typeLabel}</div>
      </div>

      <div style={styles.title}>{bva.title}</div>

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
          <span style={{ fontWeight: 800 }}>Safety Blocked:</span> This chart requires verified data provenance but none was found. Inventing data is prohibited.
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
  }
};
