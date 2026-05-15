// src/components/mains/air1Review/AdvancedInsightDashboard.jsx
// Advanced Data — Premium Insight Dashboard
// Replaces the raw JSON accordion with a structured, human-readable report.
// Design: same MentorOS theme tokens, no backend or extractor changes.

import React, { useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hasData = (arr) => Array.isArray(arr) && arr.length > 0;

const safeParse = (val) => {
    if (typeof val === "string") return val;
    if (val == null) return "";
    try { return JSON.stringify(val); } catch { return ""; }
};

// Classify a mistake entry into a category tag
function classifyMistake(entry) {
    const t = (entry || "").toLowerCase();
    if (/factual|data|statistic|year|number|percent/.test(t)) return { label: "Factual",      color: "#ef4444" };
    if (/concept|understand|theory|principle|framework/.test(t)) return { label: "Conceptual",   color: "#f59e0b" };
    if (/structur|introduc|conclus|flow|organis|organiz/.test(t)) return { label: "Structure",    color: "#8b5cf6" };
    if (/present|diagram|map|format|heading|subhead/.test(t)) return { label: "Presentation", color: "#3b82f6" };
    return { label: "Writing", color: "#64748b" };
}

// Classify correction severity
function classifyCorrection(c) {
    const sev = (c.severity || "").toLowerCase();
    if (["critical", "high"].includes(sev)) return "critical";
    if (["medium", "moderate"].includes(sev)) return "moderate";
    if (["good", "strength"].includes(sev)) return "good";
    return "other";
}

// Sum marks impact string like "-1.5" → -1.5
function parseMarks(val) {
    const n = parseFloat(String(val || "0").replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, color, T }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: color + "20",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                }}>{icon}</span>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.textBright }}>{title}</div>
                    {subtitle && <div style={{ fontSize: 12, color: T.subtle, marginTop: 1 }}>{subtitle}</div>}
                </div>
            </div>
        </div>
    );
}

function Card({ children, T, isDark, style = {} }) {
    return (
        <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: "22px 24px",
            boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.06)",
            ...style,
        }}>
            {children}
        </div>
    );
}

// ─── Section 1: Summary Metrics ───────────────────────────────────────────────
function SummaryMetrics({ data, T, isDark }) {
    const score = parseFloat(data.score) || 0;
    const potential = parseFloat(data.potentialScore) || 0;

    const totalMarksLost = (data.lineCorrections || []).reduce((acc, c) => {
        return acc + Math.abs(parseMarks(c.marksImpact));
    }, 0);

    const criticalCount  = (data.lineCorrections || []).filter(c => classifyCorrection(c) === "critical").length;
    const totalCorrections = (data.lineCorrections || []).length;
    const missingCount   = (data.missingDimensions || []).length;
    const strengthCount  = (data.valueAdditions || []).length;

    // Derive content depth (heuristic: strengths - gaps ratio)
    const depthRaw = strengthCount > 0 ? Math.min(10, Math.round((strengthCount / (strengthCount + missingCount)) * 10)) : 4;

    // Derive analytical quality from score ratio
    const scoreRatio = potential > 0 ? score / potential : 0;
    const analyticalQ = Math.round(scoreRatio * 10);

    const metrics = [
        {
            label: "Score Achieved",
            value: score ? `${score}/${potential || "?"}` : "—",
            chip: score >= potential * 0.8 ? "Excellent" : score >= potential * 0.6 ? "Good" : "Needs Work",
            color: score >= potential * 0.8 ? T.green : score >= potential * 0.6 ? T.blue : T.amber,
        },
        {
            label: "Marks Lost",
            value: totalMarksLost > 0 ? `-${totalMarksLost.toFixed(1)}` : "0",
            chip: totalMarksLost === 0 ? "Clean" : totalMarksLost <= 2 ? "Minor" : "Significant",
            color: totalMarksLost === 0 ? T.green : totalMarksLost <= 2 ? T.amber : T.red,
        },
        {
            label: "Content Depth",
            value: `${depthRaw}/10`,
            chip: depthRaw >= 7 ? "Strong" : depthRaw >= 5 ? "Moderate" : "Shallow",
            color: depthRaw >= 7 ? T.green : depthRaw >= 5 ? T.blue : T.amber,
        },
        {
            label: "Analytical Quality",
            value: `${analyticalQ}/10`,
            chip: analyticalQ >= 7 ? "Ranker" : analyticalQ >= 5 ? "Average" : "Below Par",
            color: analyticalQ >= 7 ? T.green : analyticalQ >= 5 ? T.blue : T.amber,
        },
        {
            label: "Issues Found",
            value: totalCorrections,
            chip: criticalCount > 0 ? `${criticalCount} Critical` : "All Minor",
            color: criticalCount > 0 ? T.red : T.green,
        },
        {
            label: "Gaps Identified",
            value: missingCount,
            chip: missingCount > 3 ? "Many Gaps" : missingCount > 0 ? "Some Gaps" : "Complete",
            color: missingCount > 3 ? T.red : missingCount > 0 ? T.amber : T.green,
        },
    ];

    return (
        <Card T={T} isDark={isDark}>
            <SectionHeader icon="📊" title="Summary Metrics" subtitle="At-a-glance performance overview" color={T.purple} T={T} />
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
            }}>
                {metrics.map((m, i) => (
                    <div key={i} style={{
                        background: T.surfaceHigh,
                        borderRadius: 12,
                        padding: "14px 16px",
                        border: `1px solid ${T.border}`,
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: m.color, marginBottom: 6 }}>{m.value}</div>
                        <span style={{
                            fontSize: 10, fontWeight: 800, color: m.color,
                            background: m.color + "18",
                            padding: "2px 8px", borderRadius: 20,
                        }}>{m.chip}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ─── Section 2: Key Strengths ──────────────────────────────────────────────────
function KeyStrengths({ data, T, isDark }) {
    const items = data.valueAdditions || [];
    if (!hasData(items)) return null;

    return (
        <Card T={T} isDark={isDark}>
            <SectionHeader icon="✅" title="Key Strengths & Value Additions" subtitle="What your answer got right" color={T.green} T={T} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((item, i) => {
                    const text = typeof item === "string" ? item : item.strength || item.text || safeParse(item);
                    const why  = typeof item === "object" ? (item.why || item.reason || "") : "";
                    const gain = typeof item === "object" ? (item.marksGained || item.marks || "") : "";
                    return (
                        <div key={i} style={{
                            display: "flex", gap: 12, alignItems: "flex-start",
                            background: T.greenBg,
                            border: `1px solid ${T.green}30`,
                            borderRadius: 10, padding: "12px 16px",
                        }}>
                            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>✅</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: T.textBright, lineHeight: 1.5 }}>{text}</div>
                                {why && <div style={{ fontSize: 12, color: T.green, marginTop: 4 }}>↳ {why}</div>}
                            </div>
                            {gain && (
                                <span style={{ fontSize: 12, fontWeight: 800, color: T.green, background: T.green + "20", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>+{gain}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// ─── Section 3: Key Gaps ───────────────────────────────────────────────────────
function KeyGaps({ data, T, isDark }) {
    const items = data.missingDimensions || [];
    if (!hasData(items)) return null;

    return (
        <Card T={T} isDark={isDark}>
            <SectionHeader icon="🕳️" title="Key Gaps & Missing Dimensions" subtitle="What was expected but not addressed" color={T.red} T={T} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((item, i) => {
                    const text   = typeof item === "string" ? item : item.dimension || item.gap || safeParse(item);
                    const why    = typeof item === "object" ? (item.why || item.importance || "") : "";
                    const impact = typeof item === "object" ? (item.marksImpact || item.marks || "") : "";
                    return (
                        <div key={i} style={{
                            display: "flex", gap: 12, alignItems: "flex-start",
                            background: T.redBg,
                            border: `1px solid ${T.red}30`,
                            borderRadius: 10, padding: "12px 16px",
                        }}>
                            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>❌</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: T.textBright, lineHeight: 1.5 }}>{text}</div>
                                {why && <div style={{ fontSize: 12, color: T.red, marginTop: 4 }}>↳ {why}</div>}
                            </div>
                            {impact && (
                                <span style={{ fontSize: 12, fontWeight: 800, color: T.red, background: T.red + "20", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>{impact}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// ─── Section 4: Line Correction Summary ───────────────────────────────────────
function LineCorrectionSummary({ data, T, isDark }) {
    const corrections = data.lineCorrections || [];
    if (!hasData(corrections)) return null;

    const groups = {
        critical: { label: "Critical / Factual Errors", icon: "🔴", color: T.red,   items: [] },
        moderate: { label: "Generalisations & Vague Lines", icon: "🟠", color: T.amber, items: [] },
        other:    { label: "Improvement Opportunities", icon: "🔵", color: T.blue,  items: [] },
        good:     { label: "Lines Worth Keeping", icon: "🟢", color: T.green, items: [] },
    };

    for (const c of corrections) {
        const cls = classifyCorrection(c);
        groups[cls]?.items.push(c);
    }

    const totalLost = corrections.reduce((a, c) => a + Math.abs(parseMarks(c.marksImpact)), 0);

    return (
        <Card T={T} isDark={isDark}>
            <SectionHeader icon="✏️" title="Line Correction Summary" subtitle={`${corrections.length} corrections · ${totalLost.toFixed(1)} marks affected`} color={T.amber} T={T} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.values(groups).filter(g => g.items.length > 0).map((group, gi) => (
                    <div key={gi}>
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            fontSize: 12, fontWeight: 800, color: group.color,
                            textTransform: "uppercase", letterSpacing: "0.05em",
                            marginBottom: 8,
                        }}>
                            <span>{group.icon}</span>
                            {group.label}
                            <span style={{ marginLeft: "auto", background: group.color + "20", color: group.color, padding: "2px 10px", borderRadius: 20, fontSize: 11 }}>
                                {group.items.length}
                            </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {group.items.map((c, i) => {
                                const line    = c.userLine || c.user_line || c.original || "";
                                const problem = c.problem || c.issue || c.weakness || "";
                                const marks   = c.marksImpact || "";
                                return (
                                    <div key={i} style={{
                                        background: T.surfaceHigh,
                                        border: `1px solid ${group.color}20`,
                                        borderLeft: `3px solid ${group.color}`,
                                        borderRadius: 8, padding: "10px 14px",
                                        display: "flex", gap: 10, alignItems: "flex-start",
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            {line && <div style={{ fontSize: 13, fontStyle: "italic", color: T.dim, marginBottom: 4 }}>"{line}"</div>}
                                            {problem && <div style={{ fontSize: 13, color: T.textBright }}>{problem}</div>}
                                        </div>
                                        {marks && (
                                            <span style={{ fontSize: 12, fontWeight: 800, color: marks.includes("-") ? T.red : T.green, flexShrink: 0 }}>{marks}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ─── Section 5: Examiner Deductions ───────────────────────────────────────────
function ExaminerDeductions({ data, T, isDark }) {
    const reasons = data.whyMarksLost || [];
    if (!hasData(reasons)) return null;

    return (
        <Card T={T} isDark={isDark}>
            <SectionHeader icon="🎯" title="Examiner Deductions" subtitle="Why marks were cut — and how to avoid it next time" color={T.red} T={T} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reasons.map((reason, i) => {
                    const text  = typeof reason === "string" ? reason : reason.reason || reason.issue || safeParse(reason);
                    const marks = typeof reason === "object" ? (reason.marksImpact || reason.marks || "") : "";
                    const fix   = typeof reason === "object" ? (reason.fix || reason.howToAvoid || "") : "";

                    // Simple heuristic — if it mentions a factual marker it's critical
                    const isCritical = /factual|inaccur|wrong|error|missed key/i.test(text);
                    const color = isCritical ? T.red : T.amber;

                    return (
                        <div key={i} style={{
                            background: isCritical ? T.redBg : T.amberBg,
                            border: `1px solid ${color}30`,
                            borderLeft: `4px solid ${color}`,
                            borderRadius: 10, padding: "12px 16px",
                        }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 15, flexShrink: 0 }}>{isCritical ? "🔴" : "🟠"}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: T.textBright, lineHeight: 1.5 }}>{text}</div>
                                    {fix && <div style={{ fontSize: 12, color: color, marginTop: 4, fontStyle: "italic" }}>↳ Next time: {fix}</div>}
                                </div>
                                {marks && (
                                    <span style={{ fontSize: 12, fontWeight: 800, color, background: color + "25", padding: "2px 8px", borderRadius: 20, flexShrink: 0 }}>{marks}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// ─── Section 6: Mistake Book ───────────────────────────────────────────────────
function MistakeBook({ data, T, isDark }) {
    const entries = data.mistakeBookEntries || [];
    if (!hasData(entries)) return null;

    return (
        <Card T={T} isDark={isDark}>
            <SectionHeader icon="📓" title="Mistake Book Entries" subtitle="Patterns to fix before your next attempt" color={T.purple} T={T} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {entries.map((entry, i) => {
                    const text = typeof entry === "string" ? entry : entry.entry || entry.mistake || safeParse(entry);
                    const cat  = classifyMistake(text);
                    return (
                        <div key={i} style={{
                            background: T.surfaceHigh,
                            border: `1px solid ${cat.color}25`,
                            borderRadius: 12, padding: "12px 16px",
                            flex: "1 1 280px",
                        }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>📌</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, color: T.textBright, lineHeight: 1.5 }}>{text}</div>
                                    <span style={{
                                        display: "inline-block", marginTop: 6,
                                        fontSize: 10, fontWeight: 800,
                                        color: cat.color,
                                        background: cat.color + "18",
                                        padding: "2px 8px", borderRadius: 20,
                                        textTransform: "uppercase", letterSpacing: "0.04em",
                                    }}>{cat.label}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

// ─── Section 7: Raw Data (collapsed) ──────────────────────────────────────────
function RawDataSection({ data, rawReviewText, T, isDark }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            overflow: "hidden",
        }}>
            <div
                onClick={() => setOpen(v => !v)}
                style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "16px 20px", cursor: "pointer",
                    background: T.surfaceHigh,
                    userSelect: "none",
                }}
            >
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.subtle }}>🔧 Raw Data — For Developers Only</div>
                    <div style={{ fontSize: 11, color: T.subtle, marginTop: 2, opacity: 0.7 }}>JSON + raw review text · not intended for aspirants</div>
                </div>
                <span style={{ color: T.subtle, fontSize: 13, fontWeight: 700 }}>{open ? "▼" : "▶"}</span>
            </div>
            {open && (
                <div style={{ padding: 20, animation: "fadeIn 0.2s ease" }}>
                    {rawReviewText && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Raw Review Text</div>
                            <pre style={{
                                background: T.surfaceHigh, border: `1px solid ${T.borderMid}`,
                                padding: 16, borderRadius: 10, fontSize: 12, color: T.dim,
                                lineHeight: 1.6, whiteSpace: "pre-wrap", overflowX: "auto", margin: 0,
                                maxHeight: 300, overflowY: "auto",
                            }}>{rawReviewText}</pre>
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Parsed JSON Blob</div>
                        <pre style={{
                            background: T.surfaceHigh, border: `1px solid ${T.borderMid}`,
                            padding: 16, borderRadius: 10, fontSize: 11, color: T.dim,
                            lineHeight: 1.5, whiteSpace: "pre-wrap", overflowX: "auto", margin: 0,
                            maxHeight: 300, overflowY: "auto",
                        }}>{JSON.stringify(data, null, 2)}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Export ───────────────────────────────────────────────────────────────
export default function AdvancedInsightDashboard({ data, rawReviewText, T, isDark }) {
    const [open, setOpen] = useState(false);

    if (!data) return null;

    // The header accordion toggle — user clicks to expand the whole dashboard
    return (
        <div style={{ marginTop: 48 }}>
            {/* Accordion Toggle */}
            <div
                onClick={() => setOpen(v => !v)}
                style={{
                    background: open ? T.surfaceHigh : T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 16, padding: "20px 24px",
                    cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: "all 0.2s",
                    userSelect: "none",
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: T.textBright }}>
                        📊 Premium Insight Report
                    </div>
                    <div style={{ fontSize: 13, color: T.dim, marginTop: 4 }}>
                        See score breakdown, strengths, gaps, deductions, and extracted revision intelligence.
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                        fontSize: 11, fontWeight: 800,
                        color: T.purple, background: T.purpleBg,
                        padding: "3px 10px", borderRadius: 20,
                    }}>Deep Analysis</span>
                    <span style={{ color: T.dim, fontWeight: 800, fontSize: 14 }}>{open ? "▼" : "▶"}</span>
                </div>
            </div>

            {/* Dashboard Body */}
            {open && (
                <div style={{
                    display: "flex", flexDirection: "column", gap: 20,
                    paddingTop: 20,
                    animation: "fadeIn 0.25s ease",
                }}>
                    <SummaryMetrics    data={data} T={T} isDark={isDark} />
                    <KeyStrengths      data={data} T={T} isDark={isDark} />
                    <KeyGaps           data={data} T={T} isDark={isDark} />
                    <LineCorrectionSummary data={data} T={T} isDark={isDark} />
                    <ExaminerDeductions data={data} T={T} isDark={isDark} />
                    <MistakeBook       data={data} T={T} isDark={isDark} />
                    <RawDataSection    data={data} rawReviewText={rawReviewText} T={T} isDark={isDark} />
                </div>
            )}
        </div>
    );
}
