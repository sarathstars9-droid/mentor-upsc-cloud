import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL as BASE_URL } from "../config";

const USER_ID = "user_1";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          "#09090b",
  surface:     "#111113",
  surfaceHigh: "#18181b",
  border:      "#1f1f23",
  borderMid:   "#27272a",
  dim:         "#a1a1aa",
  subtle:      "#71717a",
  text:        "#d4d4d8",
  textBright:  "#f4f4f5",
  amber:       "#f59e0b",
  amberMuted:  "#78350f",
  green:       "#10b981",
  red:         "#ef4444",
  blue:        "#3b82f6",
  indigo:      "#6366f1",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
  mono:        "'JetBrains Mono', 'Fira Code', monospace",
};

// ── Utility functions ─────────────────────────────────────────────────────────

function formatDueDate(iso) {
  if (!iso) return "—";
  const d   = new Date(iso);
  const now = new Date();
  const diff    = d - now;
  const absDiff = Math.abs(diff);
  const mins    = Math.floor(absDiff / 60000);
  const hours   = Math.floor(absDiff / 3600000);
  const days    = Math.floor(absDiff / 86400000);
  if (diff < 0) {
    if (mins  < 60) return `${mins}m overdue`;
    if (hours < 24) return `${hours}h overdue`;
    return `${days}d overdue`;
  }
  if (mins  < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function parseRevisionItem(item) {
  const rawNotes = item.mistake_notes || item.content || item.notes || "";
  let score = item.score ?? null;
  let source = item.source_type ?? null;
  let cleanNotes = rawNotes;

  // Parse source and score if embedded in notes (matches MainsMistakeBookPage)
  if (rawNotes.startsWith("[Source:")) {
    const match = rawNotes.match(/^\[Source:\s*([^\]]+)\]\s*\[Score:\s*([^\]]+)\]\n([\s\S]*)$/);
    if (match) {
      source = match[1];
      score = match[2] === "—" ? null : match[2];
      cleanNotes = match[3];
    }
  } else if (rawNotes.startsWith("Source:")) {
    const lines = rawNotes.split("\n");
    let parsedSource = null;
    let parsedScore = null;
    let startIdx = 0;
    if (lines[0] && lines[0].startsWith("Source:")) {
      parsedSource = lines[0].substring(7).trim();
      startIdx = 1;
    }
    if (lines[1] && lines[1].startsWith("Score:")) {
      parsedScore = lines[1].substring(6).trim();
      startIdx = 2;
    }
    source = parsedSource || source;
    score = (parsedScore === "—" || parsedScore === null) ? null : parsedScore;
    cleanNotes = lines.slice(startIdx).join("\n").trim();
  }

  let whyItMatters = "";
  let fixText = cleanNotes;
  if (cleanNotes.includes("Why it matters:") && cleanNotes.includes("Fix:")) {
    const match = cleanNotes.match(/Why it matters:\s*([\s\S]*?)\nFix:\s*([\s\S]*)/i);
    if (match) {
      whyItMatters = match[1].trim();
      fixText = match[2].trim();
    }
  }

  // Strip residual raw metadata strings
  fixText = fixText
    .replace(/\[Source:\s*[^\]]+\]/gi, "")
    .replace(/\[Score:\s*[^\]]+\]/gi, "")
    .trim();

  return { whyItMatters, fixText, score, source };
}

function humanizeSource(notes, fallback) {
  if (!notes && !fallback) return "Basic Review";
  const raw = (notes || "") + (fallback || "");
  if (raw.includes("chatgpt_air1") || raw.includes("chatgpt-air1") || raw.includes("AIR-1")) return "AIR-1 Review";
  if (raw.includes("gemini_basic") || raw.includes("basic")) return "Basic Review";
  if (raw.includes("gemini")) return "Gemini Review";
  return fallback || "Basic Review";
}

function matchesPaperFilter(item, filter) {
  if (filter === "all") return true;
  const paper = String(item.mistake_paper || item.subject || item.stage || "").toLowerCase();
  const stage = String(item.stage || "").toLowerCase();
  if (filter === "gs1")      return (paper.includes("gs1") || paper.includes("gs 1") || paper.includes("general studies i") || paper.includes("gs i")) && !paper.includes("essay") && !paper.includes("ethics") && !paper.includes("studies iv");
  if (filter === "gs2")      return paper.includes("gs2") || paper.includes("gs 2") || paper.includes("general studies ii") || paper.includes("gs ii");
  if (filter === "gs3")      return paper.includes("gs3") || paper.includes("gs 3") || paper.includes("general studies iii") || paper.includes("gs iii");
  if (filter === "essay")    return paper.includes("essay") || stage.includes("essay");
  if (filter === "ethics")   return paper.includes("ethics") || paper.includes("gs4") || paper.includes("gs 4") || paper.includes("general studies iv") || paper.includes("gs iv") || stage.includes("ethics");
  if (filter === "geography") return paper.includes("geography") || paper.includes("optional") || stage.includes("optional");
  return true;
}

// ── Small shared components ───────────────────────────────────────────────────

export function Badge({ label, variant = "neutral", style: extra }) {
  const styles = {
    amber: { background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", color: "#f59e0b" },
    red:   { background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#f87171" },
    green: { background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" },
    blue:  { background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#60a5fa" },
    neutral: { background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)", color: "#a1a1aa" },
  };
  const activeStyle = styles[variant] || styles.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      borderRadius: 6, padding: "2px 8px",
      fontSize: 11, fontWeight: 600,
      letterSpacing: "0.02em",
      fontFamily: T.font,
      ...activeStyle,
      ...extra,
    }}>{label}</span>
  );
}

export function ActionButton({ onClick, disabled, variant = "ghost", children, style: extra }) {
  const [hover, setHover] = useState(false);

  const variantStyles = {
    primary: { background: "#f59e0b", color: "#09090b", border: "1px solid #f59e0b" },
    green:   { background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "#34d399" },
    blue:    { background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", color: "#60a5fa" },
    red:     { background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" },
    ghost:   { background: "transparent", border: "1px solid #27272a", color: "#a1a1aa" },
  };

  const hoverStyles = {
    primary: { background: "#d97706", border: "1px solid #d97706" },
    green:   { background: "rgba(16, 185, 129, 0.16)", border: "1px solid rgba(16, 185, 129, 0.45)" },
    blue:    { background: "rgba(59, 130, 246, 0.16)", border: "1px solid rgba(59, 130, 246, 0.45)" },
    red:     { background: "rgba(239, 68, 68, 0.14)", border: "1px solid rgba(239, 68, 68, 0.3)" },
    ghost:   { background: "rgba(255, 255, 255, 0.04)", border: "1px solid #3f3f46", color: "#f4f4f5" },
  };

  const activeStyle = hover ? { ...variantStyles[variant], ...hoverStyles[variant] } : variantStyles[variant];

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 34, padding: "0 16px",
        borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: T.font,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        ...activeStyle,
        ...extra,
      }}>{children}</button>
  );
}

export function KPIGrid({ stats }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 12,
      marginBottom: 28,
    }}>
      {stats.map((s, idx) => (
        <div key={idx} style={{
          background: "#111113",
          border: "1px solid #1f1f23",
          borderTop: `3px solid ${s.accent}`,
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: s.value > 0 ? s.accent : "#f4f4f5", lineHeight: 1 }}>
            {s.value}
          </span>
          <span style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 600, letterSpacing: "0.01em" }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilterPill({ label, active, onClick, accent = "#f59e0b" }) {
  const [hover, setHover] = useState(false);
  return (
    <button 
      onClick={onClick} 
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 32, padding: "0 14px",
        borderRadius: 20, fontSize: 12, fontWeight: 600,
        fontFamily: T.font,
        cursor: "pointer",
        border: `1px solid ${active ? accent + "66" : hover ? "#3f3f46" : "#27272a"}`,
        background: active ? `${accent}18` : hover ? "rgba(255, 255, 255, 0.02)" : "transparent",
        color: active ? accent : "#a1a1aa",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}>{label}</button>
  );
}

export function FilterBar({ 
  search, setSearch,
  paperFilter, setPaperFilter,
  severityFilter, setSeverityFilter,
  mustReviseOnly, setMustReviseOnly
}) {
  return (
    <div style={{
      background: "#111113", border: "1px solid #1f1f23",
      borderRadius: 12, padding: "18px 20px", marginBottom: 24,
    }}>
      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by subject, topic, or weakness…"
        style={{
          display: "block", width: "100%", boxSizing: "border-box",
          background: "#09090b", border: "1px solid #27272a",
          borderRadius: 8, color: "#f4f4f5", fontSize: 14,
          padding: "10px 14px", fontFamily: T.font,
          outline: "none", marginBottom: 16,
          transition: "border-color 0.15s ease",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Paper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#71717a", minWidth: 70, letterSpacing: "0.05em", textTransform: "uppercase" }}>Paper</span>
          {["all","gs1","gs2","gs3","essay","ethics","geography"].map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v.toUpperCase()} active={paperFilter === v} onClick={() => setPaperFilter(v)} />
          ))}
        </div>
        {/* Severity */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#71717a", minWidth: 70, letterSpacing: "0.05em", textTransform: "uppercase" }}>Severity</span>
          {["all","high","medium","low"].map(v => (
            <FilterPill key={v} label={v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)} active={severityFilter === v} onClick={() => setSeverityFilter(v)} />
          ))}
        </div>
        {/* Priority */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#71717a", minWidth: 70, letterSpacing: "0.05em", textTransform: "uppercase" }}>Show</span>
          <FilterPill label="All Items"        active={!mustReviseOnly} onClick={() => setMustReviseOnly(false)} />
          <FilterPill label="Must Revise Only" active={mustReviseOnly}  onClick={() => setMustReviseOnly(true)} />
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = "✓", title, subtitle }) {
  return (
    <div style={{
      background: "#111113", border: "1px dashed #27272a",
      borderRadius: 14, padding: "48px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#f4f4f5", marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>{subtitle}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, loading, onRefresh, lastRefresh }) {
  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ marginBottom: 28, fontFamily: T.font }}>
      <div style={{ fontSize: 11, color: "#71717a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 700 }}>
        MentorOS · Memory Engine
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#f4f4f5", letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        <button onClick={onRefresh} disabled={loading} style={{
          marginLeft: "auto", height: 34, padding: "0 16px",
          background: "#111113", border: "1px solid #27272a",
          borderRadius: 8, color: "#a1a1aa", fontSize: 13, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer", fontFamily: T.font,
          transition: "all 0.15s ease",
        }}>
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: "#a1a1aa", lineHeight: 1.6 }}>
        {subtitle}
        {refreshLabel && (
          <span style={{ marginLeft: 10, fontSize: 12, color: "#71717a" }}>Refreshed at {refreshLabel}</span>
        )}
      </p>
    </div>
  );
}

// ── RevisionTaskCard ──────────────────────────────────────────────────────────

export function RevisionTaskCard({ item, onReview, onResolve, loadingId }) {
  const navigate  = useNavigate();
  const [textExpanded, setTextExpanded] = useState(false);
  const isLoading = loadingId === item.id;

  const paperName     = item.mistake_paper || item.subject || item.stage || "Prelims";
  const severity      = item.mistake_severity || item.priority || "medium";
  const isMustRevise  = Boolean(item.mistake_must_revise || item.must_revise);
  const attemptId     = item.mistake_attempt_id || item.source_ref || null;
  const mistakeStatus = item.mistake_status || "open";

  const cleanTitle = (item.mistake_text || item.title || "")
    .trim()
    .replace(/^(weakness|missing dimension):\s*/i, "");

  const { whyItMatters, fixText, score, source } = parseRevisionItem(item);
  const sourceLabel = humanizeSource(source, item.source_type);
  const dueLabel    = formatDueDate(item.next_review_at || item.due_date);
  const isOverdue   = dueLabel.includes("overdue");

  const CLAMP = 180;
  const needsExpand = fixText.length > CLAMP;
  const displayFix  = textExpanded || !needsExpand ? fixText : fixText.slice(0, CLAMP) + "…";

  // Card border styling based on rules:
  // Must Revise = amber/gold accent
  // High severity = small red badge only (card border remains neutral)
  // Overdue = subtle red left border
  // Completed = subtle green left border
  // Normal cards = calm charcoal/neutral border
  let leftBorderColor = "transparent";
  let cardBorder = "1px solid #27272a";
  
  const isCompletedItem = ["completed","revised","reviewed"].includes(item.status);
  
  if (isCompletedItem) {
    leftBorderColor = "#10b981";
  } else if (isMustRevise) {
    leftBorderColor = "#f59e0b";
    cardBorder = "1px solid rgba(245, 158, 11, 0.25)";
  } else if (isOverdue) {
    leftBorderColor = "#ef4444";
  }

  const handleOpenWorkspace = () => {
    if (!attemptId) return;
    navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } });
  };

  return (
    <div style={{
      background: "#111113",
      border: cardBorder,
      borderLeft: leftBorderColor !== "transparent" ? `4px solid ${leftBorderColor}` : cardBorder,
      borderRadius: 12,
      padding: "20px 22px",
      opacity: isLoading ? 0.5 : 1,
      transition: "opacity 0.2s",
      fontFamily: T.font,
    }}>
      {/* Top row: badges + due date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge label={paperName} variant="amber" />
          
          {score && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: "#10b981",
              background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)",
              borderRadius: 6, padding: "2px 8px",
            }}>
              Score: {score}
            </span>
          )}

          {severity === "high" && <Badge label="High Severity" variant="red" />}
          {isMustRevise && <Badge label="Must Revise" variant="amber" />}
          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 500 }}>{sourceLabel}</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600, flexShrink: 0,
          color: isOverdue ? "#ef4444" : "#a1a1aa",
        }}>
          {dueLabel}
        </span>
      </div>

      {/* Main title */}
      {cleanTitle && (
        <h3 style={{
          fontSize: 16, fontWeight: 700, color: "#f4f4f5",
          margin: "0 0 12px 0", lineHeight: 1.5,
        }}>
          {cleanTitle}
        </h3>
      )}

      {/* Why it matters */}
      {whyItMatters && (
        <div style={{
          fontSize: 14, color: "#d4d4d8", lineHeight: 1.65,
          marginBottom: 12, paddingLeft: 14,
          borderLeft: `2px solid rgba(245, 158, 11, 0.3)`,
        }}>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>Why it matters: </span>
          {whyItMatters}
        </div>
      )}

      {/* Fix */}
      {fixText && (
        <div style={{
          fontSize: 14, color: "#f4f4f5", lineHeight: 1.65,
          background: "#09090b", border: "1px solid #1f1f23",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
        }}>
          <span style={{ color: "#10b981", fontWeight: 700 }}>Fix: </span>
          {displayFix}
          {needsExpand && (
            <button onClick={() => setTextExpanded(e => !e)} style={{
              background: "none", border: "none", color: "#f59e0b",
              fontSize: 12, cursor: "pointer", marginLeft: 6, padding: 0,
              fontFamily: T.font, fontWeight: 600,
            }}>
              {textExpanded ? "Show less" : "Expand"}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10,
        borderTop: "1px solid #1f1f23", paddingTop: 14, marginTop: 4,
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isCompletedItem && (
            <ActionButton variant="green" onClick={() => onReview(item.id)} disabled={isLoading}>
              ✓ Mark Revised
            </ActionButton>
          )}
          {attemptId && (
            <ActionButton variant="blue" onClick={handleOpenWorkspace}>
              Open Workspace
            </ActionButton>
          )}
          {item.mistake_id && mistakeStatus !== "resolved" && (
            <ActionButton variant="ghost" onClick={() => onResolve(item.mistake_id)}>
              Mark Resolved
            </ActionButton>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#71717a", fontWeight: 500 }}>
          Reviews: <span style={{ fontFamily: T.mono, color: "#a1a1aa" }}>{item.review_count ?? 0}</span> · Interval: <span style={{ fontFamily: T.mono, color: "#a1a1aa" }}>{item.interval_days ?? 1}d</span>
        </div>
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

export function RevisionSection({ label, count, color, items, renderCard, defaultExpanded = true, initialShow = null, showMoreLabel }) {
  const [expanded, setExpanded]   = useState(defaultExpanded);
  const [showAll, setShowAll]     = useState(false);

  // Sync expanded status when defaultExpanded changes (e.g. filter changes)
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  if (!items.length) return null;

  const limit   = initialShow ?? items.length;
  const visible = showAll ? items : items.slice(0, limit);
  const hidden  = items.length - limit;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Section Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color,
          background: `${color}18`, border: `1px solid ${color}33`,
          borderRadius: 10, padding: "1px 8px",
        }}>{count ?? items.length}</span>
        <div style={{ flex: 1, height: 1, background: "#1f1f23" }} />
        <button onClick={() => setExpanded(e => !e)} style={{
          background: "none", border: "none", color: "#71717a",
          fontSize: 12, cursor: "pointer", fontFamily: T.font, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4,
          transition: "color 0.15s ease",
        }}>
          {expanded ? "▲ Hide" : "▼ Show"}
        </button>
      </div>

      {expanded && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map(item => renderCard(item))}
          </div>
          {hidden > 0 && !showAll && (
            <button onClick={() => setShowAll(true)} style={{
              width: "100%", padding: "10px 0",
              background: "none", border: "1px dashed #27272a",
              borderRadius: 8, color: "#a1a1aa", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: T.font, marginTop: 12,
              transition: "all 0.15s ease",
            }}>
              {showMoreLabel || `Show ${hidden} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Revision Dashboard ───────────────────────────────────────────────────

export default function RevisionPage() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [loadingId,  setLoadingId]  = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Filters
  const [paperFilter,    setPaperFilter]    = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [mustReviseOnly, setMustReviseOnly] = useState(false);
  const [search,         setSearch]         = useState("");

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${BASE_URL}/api/revision-items?userId=${USER_ID}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : (data.items || data.data || []);
      setItems(arr);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleReview = async (id) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/revision-items/${id}/review`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTimeout(() => { fetchItems(true); }, 150);
    } catch (e) {
      alert(`Review failed: ${e.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleResolveMistake = async (mistakeId) => {
    try {
      const res = await fetch(`${BASE_URL}/api/mistakes/${mistakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchItems(true);
    } catch (e) {
      alert(`Failed to resolve mistake: ${e.message}`);
    }
  };

  // ── Date logic ──
  const now = new Date();

  const isOverdue    = (item) => {
    if (["completed","revised","reviewed"].includes(item.status)) return false;
    const due = new Date(item.next_review_at || item.due_date || now);
    return due < now && due.toDateString() !== now.toDateString();
  };
  const isToday      = (item) => {
    if (["completed","revised","reviewed"].includes(item.status)) return false;
    const due = new Date(item.next_review_at || item.due_date || now);
    return due.toDateString() === now.toDateString() || (due < now && !isOverdue(item));
  };
  const isUpcoming   = (item) => {
    if (["completed","revised","reviewed"].includes(item.status)) return false;
    const due = new Date(item.next_review_at || item.due_date || now);
    return due > now && due.toDateString() !== now.toDateString();
  };
  const isCompleted  = (item) => ["completed","revised","reviewed"].includes(item.status);

  // ── Filters ──
  const filtered = items.filter(item => {
    if (!matchesPaperFilter(item, paperFilter)) return false;
    if (severityFilter !== "all") {
      const sev = (item.mistake_severity || item.priority || "").toLowerCase();
      if (sev !== severityFilter) return false;
    }
    if (mustReviseOnly && !Boolean(item.mistake_must_revise || item.must_revise)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const text = [item.title, item.mistake_text, item.question_text, item.subject, item.mistake_paper].join(" ").toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  // ── Buckets ──
  const mustReviseItems = filtered.filter(i => Boolean(i.mistake_must_revise || i.must_revise) && !isCompleted(i));
  const overdueItems    = filtered.filter(i => isOverdue(i));
  const todayItems      = filtered.filter(i => isToday(i));
  const upcomingItems   = filtered.filter(i => isUpcoming(i));
  const completedItems  = filtered.filter(i => isCompleted(i));

  // Stats (from full items, not filtered)
  const overdueCount   = items.filter(i => isOverdue(i)).length;
  const todayCount     = items.filter(i => isToday(i)).length;
  const upcomingCount  = items.filter(i => isUpcoming(i)).length;
  const completedCount = items.filter(i => isCompleted(i)).length;
  const mustRevCount   = items.filter(i => Boolean(i.must_revise || i.mistake_must_revise) && !isCompleted(i)).length;

  const renderCard = (item) => (
    <RevisionTaskCard
      key={item.id}
      item={item}
      onReview={handleReview}
      onResolve={handleResolveMistake}
      loadingId={loadingId}
    />
  );

  const stats = [
    { label: "Overdue",    value: overdueCount,   accent: overdueCount > 0 ? T.red : T.subtle },
    { label: "Due Today",  value: todayCount,     accent: todayCount > 0 ? T.amber : T.subtle },
    { label: "Upcoming",   value: upcomingCount,  accent: T.indigo },
    { label: "Must Revise", value: mustRevCount,  accent: mustRevCount > 0 ? T.amber : T.subtle },
    { label: "Completed",  value: completedCount, accent: T.green },
  ];

  return (
    <div style={{
      background: T.bg, minHeight: "100vh",
      padding: "32px 24px 60px",
      fontFamily: T.font, color: T.text,
      maxWidth: 920, margin: "0 auto",
    }}>

      {/* Page Header */}
      <PageHeader 
        title="Revision Dashboard" 
        subtitle="Today's spaced recall tasks from your Mains mistakes."
        loading={loading}
        onRefresh={() => fetchItems()}
        lastRefresh={lastRefresh}
      />

      {/* KPI Grid */}
      <KPIGrid stats={stats} />

      {/* Filters Bar */}
      <FilterBar 
        search={search}
        setSearch={setSearch}
        paperFilter={paperFilter}
        setPaperFilter={setPaperFilter}
        severityFilter={severityFilter}
        setSeverityFilter={setSeverityFilter}
        mustReviseOnly={mustReviseOnly}
        setMustReviseOnly={setMustReviseOnly}
      />

      {/* Error Info */}
      {error && (
        <div style={{
          background: "#1a0505", border: `1px solid ${T.red}33`,
          borderRadius: 10, padding: "14px 18px", marginBottom: 20,
          fontSize: 13, color: T.red, fontFamily: T.font,
        }}>
          Failed to load revision queue: {error}
          <button onClick={() => fetchItems()} style={{
            background: "none", border: "none", color: T.amber,
            cursor: "pointer", marginLeft: 12, fontSize: 12, fontWeight: 600, fontFamily: T.font,
          }}>Retry</button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "56px 0", color: "#71717a", fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>◌</div>
          Loading your revision queue…
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon="🎉"
          title="You're all caught up!"
          subtitle={items.length === 0
            ? "No revision items yet. Write and review Mains answers to build your revision queue."
            : "No items match your current filters. Try adjusting the search or filters above."
          }
        />
      )}

      {/* Main Content Sections */}
      {!loading && !error && filtered.length > 0 && (
        <div>
          {/* Must Revise Section — amber accent, top 3 (per instruction: Must Revise show only top 3-5 items, then Show More) */}
          {mustReviseItems.length > 0 && (
            <div style={{
              background: "rgba(245, 158, 11, 0.02)", border: "1px solid rgba(245, 158, 11, 0.12)",
              borderRadius: 12, padding: "20px", marginBottom: 28,
            }}>
              <RevisionSection
                label="⚑ Must Revise"
                count={mustReviseItems.length}
                color={T.amber}
                items={mustReviseItems}
                renderCard={renderCard}
                defaultExpanded={true}
                initialShow={3}
                showMoreLabel={`Show ${mustReviseItems.length - 3} more Must Revise items`}
              />
            </div>
          )}

          {/* Overdue Section — red accent, top 5, then Show More */}
          {overdueItems.length > 0 && (
            <RevisionSection
              label="⏰ Overdue"
              count={overdueItems.length}
              color={T.red}
              items={overdueItems}
              renderCard={renderCard}
              defaultExpanded={true}
              initialShow={5}
              showMoreLabel={`Show ${overdueItems.length - 5} more Overdue items`}
            />
          )}

          {/* Due Today Section — expanded by default */}
          {todayItems.length > 0 ? (
            <RevisionSection
              label="● Due Today"
              count={todayItems.length}
              color={T.amber}
              items={todayItems}
              renderCard={renderCard}
              defaultExpanded={true}
            />
          ) : !loading && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.amber, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
                  ● Due Today
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: T.amber,
                  background: `${T.amber}18`, border: `1px solid ${T.amber}33`,
                  borderRadius: 10, padding: "1px 8px",
                }}>0</span>
                <div style={{ flex: 1, height: 1, background: "#1f1f23" }} />
              </div>
              <EmptyState
                icon="🌅"
                title="Nothing due today"
                subtitle="Good work — your next revision is scheduled for upcoming days."
              />
            </div>
          )}

          {/* Upcoming Section — collapsed by default if > 5 items */}
          {upcomingItems.length > 0 && (
            <RevisionSection
              label="Upcoming"
              count={upcomingItems.length}
              color={T.indigo}
              items={upcomingItems}
              renderCard={renderCard}
              defaultExpanded={upcomingItems.length <= 5}
              initialShow={5}
              showMoreLabel={`Show ${upcomingItems.length - 5} more Upcoming items`}
            />
          )}

          {/* Completed Section — always collapsed by default */}
          {completedItems.length > 0 && (
            <RevisionSection
              label="✓ Completed / Revised"
              count={completedItems.length}
              color={T.green}
              items={completedItems}
              renderCard={renderCard}
              defaultExpanded={false}
              initialShow={5}
              showMoreLabel={`Show ${completedItems.length - 5} more Completed items`}
            />
          )}
        </div>
      )}
    </div>
  );
}
