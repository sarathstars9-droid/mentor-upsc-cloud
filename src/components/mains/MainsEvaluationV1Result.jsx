/**
 * src/components/mains/MainsEvaluationV1Result.jsx
 *
 * Evolved Mains Evaluation V1 structured layout container.
 * Displays evaluation components in natural executive order using progressive disclosure.
 */

import React from "react";
import { BestValueAddition } from "./BestValueAddition";

export function MainsEvaluationV1Result({
  evaluation,
  candidateAnswer,
  onOpenMistakes,
  onOpenRevision
}) {
  if (!evaluation) return null;

  const {
    isV1,
    question_intelligence: qi = {},
    score = {},
    examiner_impact: imp = {},
    ideal_blueprint: bp = {},
    strengths = [],
    dimension_coverage: dc = {},
    subject_language: sl = {},
    factual_issues = [],
    evidence_analysis: ea = {},
    structure_analysis: sa = {},
    best_value_addition: bva = {},
    model_answer: ma = {},
    mistakes = []
  } = evaluation;

  // Deduplicate weaknesses for "Your 3 Priorities"
  const costMarksList = [];
  if (dc.missing && dc.missing.length > 0) {
    dc.missing.forEach(m => {
      costMarksList.push({
        title: `${m.dimension || "General"} dimension missing`,
        desc: m.how_to_add
      });
    });
  }
  if (ea.missing && ea.missing.length > 0) {
    ea.missing.forEach(e => {
      costMarksList.push({
        title: "Missing evidence",
        desc: e
      });
    });
  }
  if (imp.what_prevents_next_level && imp.what_prevents_next_level.length > 0) {
    imp.what_prevents_next_level.forEach(p => {
      costMarksList.push({
        title: "Prevents next level",
        desc: p
      });
    });
  }
  if (factual_issues && factual_issues.length > 0) {
    factual_issues.forEach(f => {
      costMarksList.push({
        title: "Factual discrepancy",
        desc: f
      });
    });
  }

  // Deduplicate by description
  const uniqueCostMarks = [];
  const seenDescs = new Set();
  costMarksList.forEach(item => {
    const key = String(item.desc || "").toLowerCase().trim();
    if (!seenDescs.has(key)) {
      seenDescs.add(key);
      uniqueCostMarks.push(item);
    }
  });

  const top3Priorities = uniqueCostMarks.slice(0, 3);

  // Metadata label
  const metaParts = [
    qi.paper,
    qi.subject,
    qi.topic,
    qi.marks ? `${qi.marks} marks` : null,
    qi.word_limit ? `${qi.word_limit} words` : null
  ].filter(Boolean);
  const metaLabel = metaParts.join(" · ");

  const hasEvidenceGap = ea.unverified_claims?.length > 0 || ea.missing?.length > 0;
  
  const candidateWordCount = candidateAnswer ? String(candidateAnswer).trim().split(/\s+/).length : 0;
  const authoritativeWordLimit = qi.word_limit || 150;
  const wordCountVerdict = candidateWordCount > authoritativeWordLimit 
      ? `${candidateWordCount} / ${authoritativeWordLimit} (Exceeded by ${candidateWordCount - authoritativeWordLimit} words)`
      : `${candidateWordCount} / ${authoritativeWordLimit} (Within range)`;

  return (
    <div style={styles.outerContainer}>
      
      {/* 1. QUESTION HEADER */}
      <div style={styles.headerSection}>
        <div style={styles.preTitle}>ANSWER EVALUATION</div>
        <div style={styles.metaLine}>{metaLabel}</div>
      </div>

      {/* 2. SCORE & VERDICT */}
      <div style={styles.scoreRow}>
        <div style={styles.scoreVal}>
          {score.awarded} <span style={{ color: "#9CA3AF", fontSize: 24, fontWeight: 700 }}>/ {score.maximum}</span>
        </div>
        <div style={{ flex: 1 }}>
            <div style={styles.impactBadge}>{imp.level}</div>
            {imp.reason && <div style={styles.impactReason}>{imp.reason}</div>}
        </div>
      </div>

      {/* 3. YOUR 3 PRIORITIES */}
      {top3Priorities.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>YOUR 3 PRIORITIES</div>
          <div style={styles.costMarksGrid}>
            {top3Priorities.map((item, i) => (
              <div key={i} style={styles.costMarkCard}>
                <div style={styles.costMarkTitle}>• {item.title}</div>
                <div style={styles.costMarkDesc}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. BEST VALUE ADDITION */}
      {bva.needed && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>★ BEST VALUE ADDITION</div>
          <BestValueAddition bva={bva} />
        </div>
      )}

      {/* 5. EVIDENCE GAP */}
      {hasEvidenceGap && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>EVIDENCE GAP</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ea.unverified_claims?.map((claim, i) => (
                <div key={i} style={styles.claimCard}>
                  <span style={styles.claimLabel}>Needs verification</span>
                  <span style={styles.claimText}>{claim}</span>
                </div>
              ))}
              {ea.missing?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={styles.demandLabel}>Suggested reference evidence</div>
                  <ul style={styles.list}>
                    {ea.missing.map((e, i) => (
                      <li key={i} style={styles.listItem}>• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}

      {/* 6. NEXT ACTIONS */}
      {(onOpenMistakes || onOpenRevision) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>NEXT ACTIONS</div>
          <div style={styles.actionRow}>
            {onOpenMistakes && (
              <button onClick={onOpenMistakes} style={styles.actionBtn}>
                📔 Add to Mistake Book
              </button>
            )}
            {onOpenRevision && (
              <button onClick={onOpenRevision} style={styles.actionBtn}>
                🔁 Add to Revision
              </button>
            )}
          </div>
        </div>
      )}

      <hr style={{ border: "none", borderTop: "1px solid var(--mos-border, #EAECF0)", margin: "32px 0 16px 0" }} />

      {/* 7. COLLAPSED DETAIL SECTIONS */}
      <div style={styles.accordionsContainer}>
        
        {/* DETAILED EVALUATION */}
        <details style={styles.detailsBlock}>
          <summary style={styles.summaryText}>Detailed Evaluation</summary>
          <div style={styles.detailsContent}>
              {/* QUESTION DEMAND */}
              <div style={styles.subSection}>
                <div style={styles.sectionTitle}>QUESTION DEMAND</div>
                <div style={styles.demandGrid}>
                  <div>
                    <div style={styles.demandLabel}>Directive</div>
                    <div style={styles.demandValue}>{qi.directive || "Discuss"}</div>
                  </div>
                  <div>
                    <div style={styles.demandLabel}>What UPSC is asking</div>
                    <div style={styles.demandValue}>{bp.core_demand}</div>
                  </div>
                  {bp.core_argument && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={styles.demandLabel}>Core argument expected</div>
                      <div style={styles.demandValue}>{bp.core_argument}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* WHAT WORKED */}
              {strengths.length > 0 && (
                <div style={styles.subSection}>
                  <div style={styles.sectionTitle}>WHAT WORKED</div>
                  <ul style={styles.list}>
                    {strengths.map((str, i) => (
                      <li key={i} style={styles.listItem}>
                        <span style={styles.checkIcon}>✓</span> {str}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* DIMENSION COVERAGE */}
              {dc.expected_count > 0 && (
                <div style={styles.subSection}>
                  <div style={styles.sectionTitle}>DIMENSION COVERAGE</div>
                  <div style={styles.subText}>
                    {dc.covered_count} of {dc.expected_count} major dimensions covered
                  </div>
                  
                  <div style={styles.dimSplitGrid}>
                    {/* Covered */}
                    {dc.covered && dc.covered.length > 0 && (
                      <div>
                        <div style={styles.dimHeader}>Covered</div>
                        <div style={styles.dimList}>
                          {dc.covered.map((dim, i) => (
                            <div key={i} style={styles.dimCoveredItem}>
                              <span style={{ color: "#10b981", marginRight: 6 }}>✓</span> {dim}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing (Amber) */}
                    {dc.missing && dc.missing.length > 0 && (
                      <div>
                        <div style={styles.dimHeader}>Missing</div>
                        <div style={styles.dimList}>
                          {dc.missing.map((dim, i) => (
                            <div key={i} style={styles.dimMissingItem}>
                              <div style={styles.dimMissingName}>{dim.dimension}</div>
                              <div style={styles.dimMissingDesc}>{dim.how_to_add}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBJECT LANGUAGE */}
              <div style={styles.subSection}>
                <div style={styles.sectionTitle}>SUBJECT LANGUAGE</div>
                <div style={{ marginBottom: 12 }}>
                  <span style={styles.demandLabel}>Disciplinary Level:</span>{" "}
                  <span style={{ fontWeight: 700, color: "#101828" }}>{sl.level}</span>
                </div>

                {sl.jargon_dumping_detected && (
                  <div style={styles.warningBox}>
                    ⚠️ Use terminology to sharpen analysis, not decorate the answer.
                  </div>
                )}

                {sl.effective_terms_used && sl.effective_terms_used.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={styles.demandLabel}>Effective terminology used</div>
                    <div style={styles.termsFlex}>
                      {sl.effective_terms_used.map((t, i) => (
                        <span key={i} style={styles.termBadge}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {sl.better_replacements && sl.better_replacements.length > 0 && (
                  <div>
                    <div style={styles.demandLabel}>Sharpen these phrases</div>
                    <div style={styles.table}>
                      {sl.better_replacements.map((r, i) => (
                        <div key={i} style={styles.tableRow}>
                          <div style={styles.tableCellLeft}>"{r.original}"</div>
                          <div style={styles.tableCellArrow}>→</div>
                          <div style={styles.tableCellRight}>"{r.improved}"</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* STRUCTURE */}
              <div style={styles.subSection}>
                <div style={styles.sectionTitle}>STRUCTURE</div>
                <div style={styles.structureGrid}>
                  <div style={styles.structureRow}>
                    <div style={styles.structureLabel}>Introduction</div>
                    <div style={styles.structureVal}>{sa.introduction}</div>
                  </div>
                  <div style={styles.structureRow}>
                    <div style={styles.structureLabel}>Body</div>
                    <div style={styles.structureVal}>{sa.body}</div>
                  </div>
                  <div style={styles.structureRow}>
                    <div style={styles.structureLabel}>Headings</div>
                    <div style={styles.structureVal}>{sa.headings}</div>
                  </div>
                  <div style={styles.structureRow}>
                    <div style={styles.structureLabel}>Conclusion</div>
                    <div style={styles.structureVal}>{sa.conclusion}</div>
                  </div>
                  <div style={styles.structureRow}>
                    <div style={styles.structureLabel}>Word Limit</div>
                    <div style={styles.structureVal}>
                        <div style={{ fontWeight: 700, color: candidateWordCount > authoritativeWordLimit ? "#ef4444" : "#101828" }}>
                            {wordCountVerdict}
                        </div>
                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                            {sa.word_limit}
                        </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* MISTAKES (Corrections) */}
              {mistakes.length > 0 && (
                <div style={styles.subSection}>
                  <div style={styles.sectionTitle}>CORRECTIONS</div>
                  <div style={styles.mistakesGrid}>
                    {mistakes.map((m, i) => (
                      <div key={i} style={styles.mistakeItem}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={styles.mistakeCategory}>{m.category}</span>
                          <span style={m.severity === "HIGH" ? styles.sevHigh : styles.sevMed}>
                            {m.severity}
                          </span>
                        </div>
                        <div style={styles.mistakeDesc}>{m.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

          </div>
        </details>

        {/* MODEL ANSWER */}
        <details style={styles.detailsBlock}>
          <summary style={styles.summaryText}>Model Answer</summary>
          <div style={styles.detailsContent}>
            <div style={styles.modelHeader}>MODEL ANSWER ({ma.word_target || authoritativeWordLimit} WORDS)</div>
            {ma.answer ? (
              <div style={styles.modelAnswerText}>{ma.answer}</div>
            ) : (
              <div style={styles.modelAnswerText}>Model answer unavailable for this older evaluation.</div>
            )}
          </div>
        </details>

        {/* EXTRACTED ANSWER */}
        {candidateAnswer && (
          <details style={styles.detailsBlock}>
            <summary style={styles.summaryText}>Your Answer</summary>
            <div style={styles.detailsContent}>
              <div style={styles.modelAnswerText}>
                {candidateAnswer}
              </div>
            </div>
          </details>
        )}

      </div>
    </div>
  );
}

const styles = {
  outerContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    maxWidth: 800,
    margin: "0 auto",
    color: "#101828",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"
  },
  headerSection: {
    paddingBottom: 8,
  },
  preTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6B7280",
    letterSpacing: "0.06em",
  },
  metaLine: {
    fontSize: 16,
    fontWeight: 700,
    color: "#101828",
    marginTop: 4,
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    marginBottom: 8,
  },
  scoreVal: {
    fontSize: 48,
    fontWeight: 900,
    color: "#0A64F5",
    lineHeight: 1,
  },
  impactBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#0A64F5",
    background: "#EAF2FF",
    padding: "4px 10px",
    borderRadius: 12,
    textTransform: "uppercase",
    display: "inline-block",
    marginBottom: 8,
  },
  impactReason: {
    fontSize: 15,
    color: "#101828",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  section: {
    marginTop: 8,
  },
  subSection: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottom: "1px solid var(--mos-border, #EAECF0)",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6B7280",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  costMarksGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  costMarkCard: {
    background: "#ffffff",
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 8,
    padding: 14,
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
  },
  costMarkTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#d97706", /* Amber for priorities by default */
  },
  costMarkDesc: {
    fontSize: 14,
    color: "#101828",
    lineHeight: 1.5,
    marginTop: 4,
  },
  claimCard: {
    background: "rgba(239, 68, 68, 0.03)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: 6,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  claimLabel: {
    fontSize: 9,
    fontWeight: 900,
    color: "#ef4444",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  claimText: {
    fontSize: 13,
    color: "#101828",
    lineHeight: 1.45,
  },
  actionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  actionBtn: {
    background: "#ffffff",
    border: "1px solid var(--mos-border, #EAECF0)",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    color: "#101828",
    cursor: "pointer",
    boxShadow: "var(--mos-shadow-soft, 0 1px 3px rgba(16, 24, 40, 0.05))",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  accordionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  detailsBlock: {
    background: "#ffffff",
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 8,
    overflow: "hidden",
  },
  summaryText: {
    padding: "14px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: "#101828",
    cursor: "pointer",
    userSelect: "none",
    outline: "none",
  },
  detailsContent: {
    padding: "16px",
    borderTop: "1px solid var(--mos-border, #EAECF0)",
    background: "#F9FAFB",
  },
  demandGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
  },
  demandLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  demandValue: {
    fontSize: 14,
    color: "#101828",
    lineHeight: 1.5,
    fontWeight: 500,
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  listItem: {
    fontSize: 14,
    color: "#101828",
    lineHeight: 1.5,
  },
  checkIcon: {
    color: "#10b981",
    fontWeight: "bold",
    marginRight: 6,
  },
  subText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 16,
    fontWeight: 500,
  },
  dimSplitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
  },
  dimHeader: {
    fontSize: 12,
    fontWeight: 800,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 12,
    borderBottom: "1px solid var(--mos-border, #EAECF0)",
    paddingBottom: 6,
  },
  dimList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  dimCoveredItem: {
    fontSize: 14,
    fontWeight: 600,
    color: "#101828",
  },
  dimMissingItem: {
    background: "rgba(245, 158, 11, 0.03)",
    border: "1px solid rgba(245, 158, 11, 0.15)",
    borderRadius: 6,
    padding: 12,
  },
  dimMissingName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#d97706",
  },
  dimMissingDesc: {
    fontSize: 13,
    color: "#101828",
    lineHeight: 1.4,
    marginTop: 4,
  },
  warningBox: {
    background: "rgba(245, 158, 11, 0.05)",
    border: "1px solid rgba(245, 158, 11, 0.2)",
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    color: "#b45309",
    fontWeight: 600,
    marginBottom: 16,
  },
  termsFlex: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  termBadge: {
    fontSize: 12,
    color: "#0A64F5",
    background: "#EAF2FF",
    border: "1px solid #CFE0FF",
    padding: "3px 8px",
    borderRadius: 12,
    fontWeight: 600,
  },
  table: {
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8,
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid var(--mos-border, #EAECF0)",
    background: "#ffffff",
    padding: 12,
  },
  tableCellLeft: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
  },
  tableCellArrow: {
    padding: "0 12px",
    color: "#0A64F5",
    fontWeight: "bold",
  },
  tableCellRight: {
    flex: 1.2,
    fontSize: 13,
    color: "#101828",
    fontWeight: 600,
  },
  structureGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  structureRow: {
    display: "flex",
    gap: 12,
    borderBottom: "1px solid var(--mos-border, #EAECF0)",
    paddingBottom: 8,
  },
  structureLabel: {
    width: 110,
    fontSize: 13,
    fontWeight: 700,
    color: "#6B7280",
    flexShrink: 0,
  },
  structureVal: {
    fontSize: 13,
    color: "#101828",
    lineHeight: 1.45,
  },
  modelHeader: {
    fontSize: 12,
    fontWeight: 800,
    color: "#6B7280",
    letterSpacing: "0.05em",
    marginBottom: 12,
  },
  modelAnswerText: {
    fontSize: 14.5,
    lineHeight: 1.7,
    color: "#101828",
    whiteSpace: "pre-wrap",
    maxWidth: "680px",
  },
  mistakesGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  mistakeItem: {
    border: "1px solid var(--mos-border, #EAECF0)",
    borderRadius: 8,
    padding: 14,
    background: "#ffffff",
  },
  mistakeCategory: {
    fontSize: 11,
    fontWeight: 800,
    color: "#6B7280",
  },
  sevHigh: {
    fontSize: 9,
    fontWeight: 800,
    color: "#ef4444",
    background: "rgba(239, 68, 68, 0.08)",
    padding: "2px 6px",
    borderRadius: 4,
  },
  sevMed: {
    fontSize: 9,
    fontWeight: 800,
    color: "#d97706",
    background: "rgba(245, 158, 11, 0.08)",
    padding: "2px 6px",
    borderRadius: 4,
  },
  mistakeDesc: {
    fontSize: 13,
    color: "#101828",
    lineHeight: 1.45,
    marginTop: 6,
  }
};
