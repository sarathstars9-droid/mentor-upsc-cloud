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
  dim:         "#71717a",
  subtle:      "#52525b",
  text:        "#d4d4d8",
  textBright:  "#f4f4f5",
  amber:       "#f59e0b",
  amberMuted:  "#78350f",
  green:       "#22c55e",
  red:         "#ef4444",
  blue:        "#3b82f6",
  indigo:      "#6366f1",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
  mono:        "'JetBrains Mono', 'Fira Code', monospace",
};

const SEV_COLOR = { low: T.green, medium: T.amber, high: T.red };
const SEV_BG    = { low: "#0a1f0a", medium: "#1c1400", high: "#1c0505" };

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

function parseNotes(item) {
  const rawNotes = item.mistake_notes || item.content || item.notes || "";
  let whyItMatters = "";
  let fixText      = rawNotes;
  if (rawNotes.includes("Why it matters:") && rawNotes.includes("Fix:")) {
    const match = rawNotes.match(/Why it matters:\s*([\s\S]*?)\nFix:\s*([\s\S]*)/i);
    if (match) {
      whyItMatters = match[1].trim();
      fixText      = match[2].trim();
    }
  }
  // Strip any residual raw metadata strings that leaked into the text
  fixText = fixText
    .replace(/\[Source:\s*[^\]]+\]/gi, "")
    .replace(/\[Score:\s*[^\]]+\]/gi, "")
    .trim();
  return { whyItMatters, fixText };
}

function humanizeSource(notes, fallback) {
  if (!notes && !fallback) return "Spaced Repetition";
  const raw = (notes || "") + (fallback || "");
  if (raw.includes("chatgpt_air1"))  return "AIR-1 Review";
  if (raw.includes("gemini_basic"))  return "Gemini Basic";
  if (raw.includes("gemini"))        return "Gemini";
  return fallback || "Spaced Repetition";
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

function Badge({ label, color, bg, style: extra }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: bg || T.surfaceHigh,
      border: `1px solid ${color}44`,
      color, fontSize: 10, fontWeight: 700,
      borderRadius: 6, padding: "2px 8px",
      letterSpacing: "0.04em", flexShrink: 0,
      fontFamily: T.font,
      ...extra,
    }}>{label}</span>
  );
}

function ActionButton({ onClick, disabled, variant = "ghost", children, style: extra }) {
  const variantStyles = {
    primary: { background: `${T.amber}18`, border: `1px solid ${T.amber}55`, color: T.amber },
    green:   { background: `${T.green}12`, border: `1px solid ${T.green}44`, color: T.green },
    blue:    { background: `${T.blue}12`,  border: `1px solid ${T.blue}44`,  color: T.blue  },
    red:     { background: `${T.red}10`,   border: `1px solid ${T.red}33`,   color: "#f87171" },
    ghost:   { background: "transparent",  border: `1px solid ${T.borderMid}`, color: T.dim },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 32, padding: "0 14px",
      borderRadius: 8, fontSize: 13, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      fontFamily: T.font,
      transition: "opacity 0.15s",
      whiteSpace: "nowrap",
      ...variantStyles[variant],
      ...extra,
    }}>{children}</button>
  );
}

function Chip({ label, value, accent = T.amber }) {
  return (
    <div style={{
      flex: "1 1 100px", minWidth: 90,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 10, padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: value > 0 ? accent : T.textBright, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: T.dim, fontWeight: 600, letterSpacing: "0.03em" }}>{label}</div>
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      height: 30, padding: "0 14px",
      borderRadius: 20, fontSize: 12, fontWeight: 600,
      fontFamily: T.font,
      cursor: "pointer",
      border: `1px solid ${active ? T.amber + "66" : T.borderMid}`,
      background: active ? `${T.amber}18` : "transparent",
      color: active ? T.amber : T.dim,
      transition: "all 0.15s",
      whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

function SectionDivider({ label, count, color = T.amber, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, color,
        background: `${color}18`, border: `1px solid ${color}33`,
        borderRadius: 10, padding: "1px 8px",
      }}>{count}</span>
      <div style={{ flex: 1, height: 1, background: T.border }} />
      {right}
    </div>
  );
}

function EmptyState({ icon = "✓", title, subtitle }) {
  return (
    <div style={{
      background: T.surface, border: `1px dashed ${T.borderMid}`,
      borderRadius: 14, padding: "40px 24px", textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.textBright, marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>{subtitle}</div>}
    </div>
  );
}

// ── RevisionTaskCard ──────────────────────────────────────────────────────────

function RevisionTaskCard({ item, onReview, onResolve, loadingId }) {
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

  const { whyItMatters, fixText } = parseNotes(item);
  const sourceLabel = humanizeSource(item.mistake_notes, item.source_type);
  const dueLabel    = formatDueDate(item.next_review_at || item.due_date);
  const isOverdue   = dueLabel.includes("overdue");

  const CLAMP = 180;
  const needsExpand = fixText.length > CLAMP;
  const displayFix  = textExpanded || !needsExpand ? fixText : fixText.slice(0, CLAMP) + "…";

  const leftBorderColor = isMustRevise ? T.amber
    : severity === "high" ? T.red
    : SEV_COLOR[severity] || T.borderMid;

  const handleOpenWorkspace = () => {
    if (!attemptId) return;
    navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } });
  };

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${leftBorderColor}`,
      borderRadius: 12,
      padding: "18px 20px",
      marginBottom: 10,
      opacity: isLoading ? 0.5 : 1,
      transition: "opacity 0.2s",
      fontFamily: T.font,
    }}>
      {/* ── Top row: badges + due date ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Badge label={paperName} color={T.amber} bg="#1c1400" />
          {severity === "high" && <Badge label="High" color={T.red} bg="#1c0505" />}
          {isMustRevise && <Badge label="Must Revise" color={T.amber} bg={`${T.amber}14`} />}
          <span style={{ fontSize: 11, color: T.subtle, fontFamily: T.font }}>{sourceLabel}</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, flexShrink: 0,
          color: isOverdue ? T.red : T.dim,
          fontFamily: T.font,
        }}>
          {dueLabel}
        </span>
      </div>

      {/* ── Main title ── */}
      {cleanTitle && (
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: T.textBright,
          margin: "0 0 10px 0", lineHeight: 1.5,
          fontFamily: T.font,
        }}>
          {cleanTitle}
        </h3>
      )}

      {/* ── Why it matters ── */}
      {whyItMatters && (
        <div style={{
          fontSize: 13, color: T.text, lineHeight: 1.6,
          marginBottom: 10, paddingLeft: 14,
          borderLeft: `2px solid ${T.amber}44`,
        }}>
          <span style={{ color: T.amber, fontWeight: 700 }}>Why it matters: </span>
          {whyItMatters}
        </div>
      )}

      {/* ── Fix ── */}
      {fixText && (
        <div style={{
          fontSize: 13, color: T.textBright, lineHeight: 1.6,
          background: T.bg, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 14,
        }}>
          <span style={{ color: T.green, fontWeight: 700 }}>Fix: </span>
          {displayFix}
          {needsExpand && (
            <button onClick={() => setTextExpanded(e => !e)} style={{
              background: "none", border: "none", color: T.amber,
              fontSize: 12, cursor: "pointer", marginLeft: 6, padding: 0,
              fontFamily: T.font, fontWeight: 600,
            }}>
              {textExpanded ? "Show less" : "Expand"}
            </button>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 10,
        borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 2,
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.status !== "completed" && item.status !== "revised" && (
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
        <div style={{ fontSize: 11, color: T.subtle, fontFamily: T.mono }}>
          Reviews: {item.review_count ?? 0} · Interval: {item.interval_days ?? 1}d
        </div>
      </div>
    </div>
  );
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({ label, count, color, items, renderCard, defaultExpanded = true, initialShow = null, showMoreLabel }) {
  const [expanded, setExpanded]   = useState(defaultExpanded);
  const [showAll, setShowAll]     = useState(false);

  if (!items.length) return null;

  const limit   = initialShow ?? items.length;
  const visible = showAll ? items : items.slice(0, limit);
  const hidden  = items.length - limit;

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionDivider
        label={label}
        count={count ?? items.length}
        color={color}
        right={
          <button onClick={() => setExpanded(e => !e)} style={{
            background: "none", border: "none", color: T.dim,
            fontSize: 12, cursor: "pointer", fontFamily: T.font, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {expanded ? "▲ Hide" : "▼ Show"}
          </button>
        }
      />
      {expanded && (
        <>
          {visible.map(item => renderCard(item))}
          {hidden > 0 && !showAll && (
            <button onClick={() => setShowAll(true)} style={{
              width: "100%", padding: "10px 0",
              background: "none", border: `1px solid ${T.borderMid}`,
              borderRadius: 8, color: T.dim, fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: T.font, marginTop: 4,
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
  const mustRevCount   = items.filter(i => Boolean(i.mistake_must_revise || i.must_revise) && !isCompleted(i)).length;

  const renderCard = (item) => (
    <RevisionTaskCard
      key={item.id}
      item={item}
      onReview={handleReview}
      onResolve={handleResolveMistake}
      loadingId={loadingId}
    />
  );

  const refreshLabel = lastRefresh
    ? lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{
      background: T.bg, minHeight: "100vh",
      padding: "32px 28px 60px",
      fontFamily: T.font, color: T.text,
      maxWidth: 920, margin: "0 auto",
    }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: T.subtle, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          MentorOS · Memory Engine
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: T.textBright, letterSpacing: "-0.02em" }}>
            Revision Dashboard
          </h1>
          <button onClick={() => fetchItems()} disabled={loading} style={{
            marginLeft: "auto", height: 32, padding: "0 16px",
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.dim, fontSize: 12, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: T.font,
          }}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: T.dim, lineHeight: 1.6, maxWidth: 520 }}>
          Today's spaced recall tasks from your Mains mistakes.
          {refreshLabel && (
            <span style={{ marginLeft: 10, fontSize: 12, color: T.subtle }}>Refreshed at {refreshLabel}</span>
          )}
        </p>
      </div>

      {/* ── KPI Grid ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        <Chip label="Overdue"    value={overdueCount}   accent={overdueCount > 0 ? T.red : T.subtle} />
        <Chip label="Due Today"  value={todayCount}     accent={todayCount > 0 ? T.amber : T.subtle} />
        <Chip label="Upcoming"   value={upcomingCount}  accent={T.blue} />
        <Chip label="Must Revise" value={mustRevCount}  accent={mustRevCount > 0 ? T.amber : T.subtle} />
        <Chip label="Completed"  value={completedCount} accent={T.green} />
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 12, padding: "18px 20px", marginBottom: 24,
      }}>
        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by subject, topic, or weakness…"
          style={{
            display: "block", width: "100%", boxSizing: "border-box",
            background: T.bg, border: `1px solid ${T.borderMid}`,
            borderRadius: 8, color: T.textBright, fontSize: 14,
            padding: "9px 14px", fontFamily: T.font,
            outline: "none", marginBottom: 14,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Paper */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, letterSpacing: "0.04em", textTransform: "uppercase" }}>Paper</span>
            {["all","gs1","gs2","gs3","essay","ethics","geography"].map(v => (
              <FilterPill key={v} label={v === "all" ? "All" : v.toUpperCase()} active={paperFilter === v} onClick={() => setPaperFilter(v)} />
            ))}
          </div>
          {/* Severity */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, letterSpacing: "0.04em", textTransform: "uppercase" }}>Severity</span>
            {["all","high","medium","low"].map(v => (
              <FilterPill key={v} label={v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)} active={severityFilter === v} onClick={() => setSeverityFilter(v)} />
            ))}
          </div>
          {/* Priority */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.subtle, minWidth: 60, letterSpacing: "0.04em", textTransform: "uppercase" }}>Show</span>
            <FilterPill label="All Items"        active={!mustReviseOnly} onClick={() => setMustReviseOnly(false)} />
            <FilterPill label="Must Revise Only" active={mustReviseOnly}  onClick={() => setMustReviseOnly(true)} />
          </div>
        </div>
      </div>

      {/* ── Error ── */}
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

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: "center", padding: "56px 0", color: T.dim, fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>◌</div>
          Loading your revision queue…
        </div>
      )}

      {/* ── Empty ── */}
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

      {/* ── Content ── */}
      {!loading && !error && filtered.length > 0 && (
        <div>
          {/* Must Revise — amber, top 5 */}
          {mustReviseItems.length > 0 && (
            <div style={{
              background: `${T.amber}07`, border: `1px solid ${T.amber}22`,
              borderRadius: 12, padding: "18px 20px", marginBottom: 28,
            }}>
              <SectionDivider
                label="⚑ Must Revise"
                count={mustReviseItems.length}
                color={T.amber}
              />
              {mustReviseItems.slice(0, 5).map(item => renderCard(item))}
              {mustReviseItems.length > 5 && (
                <div style={{ textAlign: "center", paddingTop: 4 }}>
                  <button onClick={() => setMustReviseOnly(true)} style={{
                    background: "none", border: `1px solid ${T.borderMid}`,
                    borderRadius: 8, color: T.dim, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: T.font, padding: "8px 20px",
                  }}>
                    View all {mustReviseItems.length} must-revise items →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Overdue — red left accent, top 5 */}
          {overdueItems.length > 0 && (
            <CollapsibleSection
              label="⏰ Overdue"
              count={overdueItems.length}
              color={T.red}
              items={overdueItems}
              renderCard={renderCard}
              defaultExpanded={true}
              initialShow={5}
              showMoreLabel={`Show ${overdueItems.length - 5} more overdue items`}
            />
          )}

          {/* Due Today — always open */}
          {todayItems.length > 0 ? (
            <CollapsibleSection
              label="● Due Today"
              count={todayItems.length}
              color={T.amber}
              items={todayItems}
              renderCard={renderCard}
              defaultExpanded={true}
            />
          ) : !loading && (
            <div style={{ marginBottom: 28 }}>
              <SectionDivider label="● Due Today" count={0} color={T.amber} />
              <EmptyState
                icon="🌅"
                title="Nothing due today"
                subtitle="Good work — your next revision is scheduled for upcoming days."
              />
            </div>
          )}

          {/* Upcoming — collapsed if >5 */}
          {upcomingItems.length > 0 && (
            <CollapsibleSection
              label="Upcoming"
              count={upcomingItems.length}
              color={T.indigo}
              items={upcomingItems}
              renderCard={renderCard}
              defaultExpanded={upcomingItems.length <= 5}
              initialShow={upcomingItems.length <= 5 ? undefined : 5}
              showMoreLabel={`Show ${upcomingItems.length - 5} more upcoming items`}
            />
          )}

          {/* Completed — always collapsed by default */}
          {completedItems.length > 0 && (
            <CollapsibleSection
              label="✓ Completed / Revised"
              count={completedItems.length}
              color={T.green}
              items={completedItems}
              renderCard={renderCard}
              defaultExpanded={false}
              initialShow={5}
              showMoreLabel={`Show ${completedItems.length - 5} more completed items`}
            />
          )}
        </div>
      )}
    </div>
  );
}
