// src/pages/RevisionPage.jsx
// Revision Dashboard — spaced recall interface for UPSC learning loops.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL as BASE_URL } from "../config";
import "../styles/mentorosPremium.css";

const USER_ID = "user_1";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:          "#0E1117",
  surface:     "#171B23",
  surfaceHigh: "#1C2230",
  border:      "rgba(255,255,255,0.08)",
  text:        "#F5F7FB",
  textMuted:   "#7F8897",
  textSec:     "#B8C0CC",
  accent:      "#D6B56D",
  success:     "#2FBF71",
  danger:      "#E05252",
  font:        "Inter, Manrope, Aptos, system-ui, sans-serif",
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

  fixText = fixText
    .replace(/\[Source:\s*[^\]]+\]/gi, "")
    .replace(/\[Score:\s*[^\]]+\]/gi, "")
    .trim();

  return { whyItMatters, fixText, score, source };
}

function humanizeSource(notes, fallback) {
  if (!notes && !fallback) return "Review";
  const raw = (notes || "") + (fallback || "");
  if (raw.includes("chatgpt_air1") || raw.includes("chatgpt-air1") || raw.includes("AIR-1")) return "Review";
  return "Review";
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

// ── Shared UI Components ─────────────────────────────────────────────────────

export function Badge({ label, variant = "neutral", style: extra }) {
  const cName = variant === "amber" ? "premium-badge-paper" : 
                variant === "red" ? "premium-badge-danger" : 
                variant === "green" ? "premium-badge-success" : 
                "premium-badge-neutral";
  return (
    <span className={`premium-badge ${cName}`} style={extra}>
      {label}
    </span>
  );
}

export function ActionButton({ onClick, disabled, variant = "ghost", children, style: extra }) {
  const className = variant === "primary" ? "premium-button-primary" : "premium-button-secondary";
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={className}
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...extra
      }}
    >
      {children}
    </button>
  );
}

export function KPIGrid({ stats }) {
  return (
    <div className="premium-kpi-grid">
      {stats.map((s, idx) => (
        <div key={idx} className="premium-kpi-card">
          <span className="premium-kpi-val" style={{ color: s.value > 0 ? s.accent : T.text }}>
            {s.value}
          </span>
          <span className="premium-kpi-lbl">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`premium-pill-button ${active ? "active" : ""}`}
    >
      {label}
    </button>
  );
}

export function FilterBar({ 
  search, setSearch,
  paperFilter, setPaperFilter,
  severityFilter, setSeverityFilter,
  mustReviseOnly, setMustReviseOnly
}) {
  return (
    <div className="premium-surface-card" style={{ padding: "24px", marginBottom: "36px" }}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by subject, topic, or weakness…"
        style={{
          display: "block", width: "100%", boxSizing: "border-box",
          background: "#0E1117", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, color: "#F5F7FB", fontSize: 14.5,
          padding: "12px 16px", fontFamily: T.font,
          outline: "none", marginBottom: 20,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="premium-metadata" style={{ minWidth: 80 }}>Paper</span>
          <div className="premium-pill-group">
            {["all","gs1","gs2","gs3","essay","ethics","geography"].map(v => (
              <FilterPill key={v} label={v === "all" ? "All" : v.toUpperCase()} active={paperFilter === v} onClick={() => setPaperFilter(v)} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="premium-metadata" style={{ minWidth: 80 }}>Severity</span>
          <div className="premium-pill-group">
            {["all","high","medium","low"].map(v => (
              <FilterPill key={v} label={v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)} active={severityFilter === v} onClick={() => setSeverityFilter(v)} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="premium-metadata" style={{ minWidth: 80 }}>Show</span>
          <div className="premium-pill-group">
            <FilterPill label="All Tasks" active={!mustReviseOnly} onClick={() => setMustReviseOnly(false)} />
            <FilterPill label="Must revise first" active={mustReviseOnly} onClick={() => setMustReviseOnly(true)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = "✓", title, subtitle }) {
  return (
    <div className="premium-surface-card" style={{ borderStyle: "dashed", padding: "48px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h4 className="premium-card-title" style={{ margin: "0 0 8px 0" }}>{title}</h4>
      <p className="premium-body" style={{ margin: 0, color: "#7F8897" }}>{subtitle}</p>
    </div>
  );
}

export function PageHeader({ title, subtitle, loading, onRefresh, lastRefresh }) {
  const refreshLabel = lastRefresh
    ? `${String(lastRefresh.getHours()).padStart(2, "0")}:${String(lastRefresh.getMinutes()).padStart(2, "0")}`
    : null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
      <div>
        <h1 className="premium-page-title">{title}</h1>
        <p className="premium-page-subtitle" style={{ margin: 0 }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {refreshLabel && (
          <span className="premium-metadata" style={{ color: "#7F8897" }}>Refreshed at {refreshLabel}</span>
        )}
        <button 
          onClick={onRefresh} 
          disabled={loading}
          className="premium-button-secondary"
          style={{ height: 38, padding: "0 16px", fontSize: 13 }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}

// ── RevisionTaskCard ──────────────────────────────────────────────────────────

export function RevisionTaskCard({ item, onReview, onResolve, loadingId }) {
  const navigate  = useNavigate();
  const [textExpanded, setTextExpanded] = useState(false);
  const isLoading = loadingId === item.id;

  const paperName     = item.mistake_paper || item.subject || item.stage || "Mains";
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

  let leftBorderColor = "transparent";
  let cardBorder = "1px solid rgba(255,255,255,0.08)";
  const isCompletedItem = ["completed","revised","reviewed"].includes(item.status);
  
  if (isCompletedItem) {
    leftBorderColor = T.success;
  } else if (isMustRevise) {
    leftBorderColor = T.accent;
  } else if (isOverdue) {
    leftBorderColor = "transparent";
  }

  const handleOpenWorkspace = () => {
    if (!attemptId) return;
    navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } });
  };

  return (
    <div 
      className="premium-surface-card" 
      style={{
        border: cardBorder,
        borderLeft: leftBorderColor !== "transparent" ? `4px solid ${leftBorderColor}` : cardBorder,
        opacity: isLoading ? 0.5 : 1,
        padding: "22px 28px",
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="premium-metadata" style={{ color: T.textSec, fontWeight: 600 }}>
          {paperName} • <span style={{ color: isOverdue ? T.danger : T.textMuted }}>{dueLabel}</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {score && (
            <span style={{ fontSize: 11, color: T.success, background: "rgba(47, 191, 113, 0.08)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
              {score}
            </span>
          )}
          {isMustRevise && (
            <span style={{ fontSize: 11, color: T.accent, background: "rgba(214, 181, 109, 0.08)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
              Must revise
            </span>
          )}
          {isOverdue && (
            <span style={{ fontSize: 11, color: T.danger, background: "rgba(224, 82, 82, 0.08)", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
              Overdue
            </span>
          )}
          <span style={{ fontSize: 11.5, color: T.textMuted }}>{sourceLabel}</span>
        </div>
      </div>

      {/* Action Title */}
      {cleanTitle && (
        <h3 className="premium-card-title" style={{ fontSize: 17, margin: "0 0 14px 0", color: T.text }}>
          Task: {cleanTitle}
        </h3>
      )}

      {/* Why it improves marks */}
      {whyItMatters && (
        <div style={{
          fontSize: 14.5, color: T.textSec, lineHeight: 1.6,
          marginBottom: 12, paddingLeft: 12,
          borderLeft: `2px solid rgba(214, 181, 109, 0.3)`,
        }}>
          <span style={{ color: T.accent, fontWeight: 600 }}>Why this improves marks: </span>
          {whyItMatters}
        </div>
      )}

      {/* Do this */}
      {fixText && (
        <div className="premium-surface-card-inner" style={{ padding: "14px 16px", marginBottom: 16 }}>
          <div className="premium-body" style={{ color: T.text, fontSize: 14.5 }}>
            <span style={{ color: T.success, fontWeight: 600 }}>Do this: </span>
            {displayFix}
            {needsExpand && (
              <button 
                onClick={() => setTextExpanded(e => !e)} 
                className="premium-text-link"
                style={{ marginLeft: 6, padding: 0, textDecoration: "none", color: T.accent }}
              >
                {textExpanded ? "Show less" : "Expand"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, marginTop: 4
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {!isCompletedItem && (
            <button 
              onClick={() => onReview(item.id)} 
              disabled={isLoading}
              className="premium-button-primary"
              style={{ fontSize: 13, padding: "8px 16px", height: "auto" }}
            >
              Mark revised
            </button>
          )}
          {attemptId && (
            <button 
              onClick={handleOpenWorkspace}
              className="premium-button-secondary"
              style={{ fontSize: 13, padding: "8px 16px", height: "auto" }}
            >
              Open answer
            </button>
          )}
          {item.mistake_id && mistakeStatus !== "resolved" && (
            <button 
              onClick={() => onResolve(item.mistake_id)}
              className="premium-text-link"
              style={{ fontSize: 13, border: "none", background: "none" }}
            >
              Resolve
            </button>
          )}
        </div>
        <div className="premium-metadata" style={{ color: T.textMuted }}>
          Reviews: {item.review_count ?? 0} · Interval: {item.interval_days ?? 1}d
        </div>
      </div>
    </div>
  );
}

// ── RevisionSection ──────────────────────────────────────────────────────────

export function RevisionSection({ label, count, color, items, renderCard, defaultExpanded = true, initialShow = null, showMoreLabel }) {
  const [expanded, setExpanded]   = useState(defaultExpanded);
  const [showAll, setShowAll]     = useState(false);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  if (!items.length) return null;

  const limit   = initialShow ?? items.length;
  const visible = showAll ? items : items.slice(0, limit);
  const hidden  = items.length - limit;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.text, whiteSpace: "nowrap" }}>
          {label}
        </span>
        <span style={{
          fontSize: 11.5, fontWeight: 700, color: T.textSec,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10, padding: "2px 8px",
        }}>{count ?? items.length}</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        <button 
          onClick={() => setExpanded(e => !e)} 
          className="premium-text-link"
          style={{ textDecoration: "none", fontSize: 13, fontWeight: 600, color: T.textMuted }}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {visible.map(item => renderCard(item))}
          </div>
          {hidden > 0 && !showAll && (
            <button 
              onClick={() => setShowAll(true)} 
              className="premium-button-secondary"
              style={{ width: "100%", borderStyle: "dashed", marginTop: 16, padding: "12px 0", justifyContent: "center" }}
            >
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

  // Filter logic
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

  const mustReviseItems = filtered.filter(i => Boolean(i.mistake_must_revise || i.must_revise) && !isCompleted(i));
  const overdueItems    = filtered.filter(i => isOverdue(i));
  const todayItems      = filtered.filter(i => isToday(i));
  const upcomingItems   = filtered.filter(i => isUpcoming(i));
  const completedItems  = filtered.filter(i => isCompleted(i));

  // Determine top 3 priority tasks
  const top3PriorityTasks = [];
  mustReviseItems.forEach(item => {
    if (top3PriorityTasks.length < 3) top3PriorityTasks.push(item);
  });
  if (top3PriorityTasks.length < 3) {
    overdueItems.forEach(item => {
      if (top3PriorityTasks.length < 3 && !top3PriorityTasks.find(x => x.id === item.id)) {
        top3PriorityTasks.push(item);
      }
    });
  }
  if (top3PriorityTasks.length < 3) {
    todayItems.forEach(item => {
      if (top3PriorityTasks.length < 3 && !top3PriorityTasks.find(x => x.id === item.id)) {
        top3PriorityTasks.push(item);
      }
    });
  }

  // Handle guided start revision
  const handleStartRevision = () => {
    if (top3PriorityTasks.length > 0) {
      const firstTask = top3PriorityTasks[0];
      const attemptId = firstTask.mistake_attempt_id || firstTask.source_ref;
      if (attemptId) {
        navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } });
      }
    }
  };

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
    { label: "Overdue tasks",        value: overdueCount,   accent: T.danger },
    { label: "Tasks due today",      value: todayCount,     accent: T.accent },
    { label: "Upcoming tasks",       value: upcomingCount,  accent: T.textSec },
    { label: "Must revise first",    value: mustRevCount,  accent: T.accent },
    { label: "Completed revisions",  value: completedCount, accent: T.success },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: T.font }}>
      <div className="premium-container">
        {/* Page Header */}
        <PageHeader 
          title="Revision Dashboard" 
          subtitle="Today's spaced recall tasks from your Mains mistakes."
          loading={loading}
          onRefresh={() => fetchItems()}
          lastRefresh={lastRefresh}
        />

        {/* Top Directive Panel */}
        {!loading && !error && (
          <div className="premium-directive-hero">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2 className="premium-section-title" style={{ margin: "0 0 6px 0", color: T.accent }}>
                  Today’s Revision Priority
                </h2>
                <p className="premium-body" style={{ margin: 0, color: T.textSec }}>
                  Complete these 3 tasks first. They are the highest-impact corrections from your recent answers.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button 
                  onClick={handleStartRevision} 
                  disabled={top3PriorityTasks.length === 0}
                  className="premium-button-primary"
                >
                  Start revision
                </button>
                <button 
                  onClick={() => {
                    const el = document.getElementById("all-tasks-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="premium-button-secondary"
                >
                  View all tasks
                </button>
              </div>
            </div>

            {top3PriorityTasks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {top3PriorityTasks.map(item => {
                  const cleanT = (item.mistake_text || item.title || "")
                    .trim()
                    .replace(/^(weakness|missing dimension):\s*/i, "");
                  const paperName = item.mistake_paper || item.subject || item.stage || "Mains";
                  return (
                    <div 
                      key={item.id}
                      className="premium-surface-card-inner"
                      style={{ 
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.04)"
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className="premium-metadata" style={{ color: T.textMuted }}>{paperName}</span>
                        <span className="premium-body" style={{ fontWeight: 600, color: T.text }}>Task: {cleanT}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const attemptId = item.mistake_attempt_id || item.source_ref;
                          if (attemptId) {
                            navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } });
                          }
                        }}
                        className="premium-text-link"
                        style={{ textDecoration: "none", color: T.accent }}
                      >
                        Open answer →
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="premium-body" style={{ color: T.textMuted, fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                No priority tasks scheduled. You are all caught up!
              </div>
            )}
          </div>
        )}

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
            background: "rgba(224, 82, 82, 0.06)", border: `1px solid ${T.danger}33`,
            borderRadius: 10, padding: "14px 18px", marginBottom: 20,
            fontSize: 13.5, color: T.danger, fontFamily: T.font,
          }}>
            Failed to load revision queue: {error}
            <button onClick={() => fetchItems()} className="premium-text-link" style={{ marginLeft: 12, color: T.accent }}>Retry</button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ textAlign: "center", padding: "56px 0", color: T.textMuted, fontSize: 14.5 }}>
            <div style={{ fontSize: 28, marginBottom: 12, color: T.accent }}>◌</div>
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
          <div id="all-tasks-section">
            {/* Priority Today Section */}
            {top3PriorityTasks.length > 0 && (
              <RevisionSection
                label="Priority Today"
                count={top3PriorityTasks.length}
                color={T.accent}
                items={top3PriorityTasks}
                renderCard={renderCard}
                defaultExpanded={true}
              />
            )}

            {/* Overdue Section */}
            {overdueItems.length > 0 && (
              <RevisionSection
                label="Overdue"
                count={overdueItems.length}
                color={T.danger}
                items={overdueItems}
                renderCard={renderCard}
                defaultExpanded={true}
                initialShow={5}
                showMoreLabel={`Show ${overdueItems.length - 5} more overdue tasks`}
              />
            )}

            {/* Due Today Section */}
            {todayItems.length > 0 && (
              <RevisionSection
                label="Due Today"
                count={todayItems.length}
                color={T.accent}
                items={todayItems}
                renderCard={renderCard}
                defaultExpanded={true}
              />
            )}

            {/* Upcoming Section */}
            {upcomingItems.length > 0 && (
              <RevisionSection
                label="Upcoming"
                count={upcomingItems.length}
                color={T.textSec}
                items={upcomingItems}
                renderCard={renderCard}
                defaultExpanded={upcomingItems.length <= 5}
                initialShow={5}
                showMoreLabel={`Show ${upcomingItems.length - 5} more upcoming tasks`}
              />
            )}

            {/* Completed Section */}
            {completedItems.length > 0 && (
              <RevisionSection
                label="Completed"
                count={completedItems.length}
                color={T.success}
                items={completedItems}
                renderCard={renderCard}
                defaultExpanded={false}
                initialShow={5}
                showMoreLabel={`Show ${completedItems.length - 5} more completed tasks`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
