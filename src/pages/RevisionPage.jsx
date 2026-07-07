import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL as BASE_URL } from "../config";
const USER_ID = "user_1";

/* ── Utility ── */
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = d - now;
  const absDiff = Math.abs(diff);
  const mins = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);
  if (diff < 0) {
    if (mins < 60) return `${mins}m overdue`;
    if (hours < 24) return `${hours}h overdue`;
    return `${days}d overdue`;
  }
  if (mins < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function parseNotes(item) {
  const rawNotes = item.mistake_notes || item.content || item.notes || "";
  let whyItMatters = "";
  let fixText = rawNotes;

  if (rawNotes.includes("Why it matters:") && rawNotes.includes("Fix:")) {
    const match = rawNotes.match(/Why it matters:\s*([\s\S]*?)\nFix:\s*([\s\S]*)/i);
    if (match) {
      whyItMatters = match[1].trim();
      fixText = match[2].trim();
    }
  }
  return { whyItMatters, fixText };
}

function matchesPaperFilter(item, filter) {
  if (filter === "all") return true;
  const paper = String(item.mistake_paper || item.subject || item.stage || "").toLowerCase();
  const stage = String(item.stage || "").toLowerCase();

  if (filter === "gs1") {
    return (paper.includes("gs1") || paper.includes("gs 1") || paper.includes("general studies i") || paper.includes("gs i")) && 
           !paper.includes("essay") && !paper.includes("ethics") && !paper.includes("studies iv");
  }
  if (filter === "gs2") {
    return paper.includes("gs2") || paper.includes("gs 2") || paper.includes("general studies ii") || paper.includes("gs ii");
  }
  if (filter === "gs3") {
    return paper.includes("gs3") || paper.includes("gs 3") || paper.includes("general studies iii") || paper.includes("gs iii");
  }
  if (filter === "essay") {
    return paper.includes("essay") || stage.includes("essay");
  }
  if (filter === "ethics") {
    return paper.includes("ethics") || paper.includes("gs4") || paper.includes("gs 4") || paper.includes("general studies iv") || paper.includes("gs iv") || stage.includes("ethics");
  }
  if (filter === "geography") {
    return paper.includes("geography") || paper.includes("optional") || stage.includes("optional");
  }
  return true;
}

const T = {
  bg: "#060606",
  cardBg: "#0c0c0c",
  border: "#1c1c1c",
  text: "#a0a0a0",
  textBright: "#e5e7eb",
  dim: "#666",
  amber: "#f59e0b",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#2563eb",
  indigo: "#6366f1",
  purple: "#8b5cf6"
};

const SEVERITY_COLOR = { low: T.green, medium: T.amber, high: T.red };
const SEVERITY_BG = { low: "#0a1a0a", medium: "#1a1200", high: "#1a0000" };

/* ── Badge Component ── */
const Badge = ({ label, color, bg }) => (
  <span style={{
    background: bg || "#111", border: `1px solid ${color}44`,
    color, fontSize: 9, fontWeight: 700, borderRadius: 4,
    padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase",
    fontFamily: "monospace", flexShrink: 0
  }}>{label}</span>
);

/* ── StatChip Component ── */
const StatChip = ({ label, value, accent }) => (
  <div style={{
    background: "#0c0c0c", border: `1px solid ${accent ? `${T.amber}44` : T.border}`,
    borderRadius: 8, padding: "10px 16px", minWidth: 90, textAlign: "center", flex: 1
  }}>
    <div style={{ fontSize: 20, fontWeight: 700, color: accent ? T.amber : "#fff", fontFamily: "monospace" }}>{value}</div>
    <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
  </div>
);

/* ── FilterPill Component ── */
const FilterPill = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? "#1a1200" : "#0c0c0c",
    border: `1px solid ${active ? T.amber : T.border}`,
    color: active ? T.amber : T.text,
    borderRadius: 20, padding: "5px 13px", fontSize: 11,
    cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s",
    whiteSpace: "nowrap"
  }}>{label}</button>
);

/* ── SectionHeader Component ── */
const SectionHeader = ({ label, count, color = T.amber }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 18 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
    <span style={{
      background: `${color}11`, border: `1px solid ${color}44`, color,
      fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 8px", fontFamily: "monospace"
    }}>{count}</span>
    <div style={{ flex: 1, height: 1, background: T.border }} />
  </div>
);

/* ── RevisionCard Component ── */
function RevisionCard({ item, onReview, onResolve, loadingId }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const isLoading = loadingId === item.id;

  // Extract custom fields from mistake join
  const paperName = item.mistake_paper || item.subject || item.stage || "Prelims";
  const severity = item.mistake_severity || item.priority || "medium";
  const isMustRevise = Boolean(item.mistake_must_revise || item.must_revise);
  const attemptId = item.mistake_attempt_id || item.source_ref || null;
  const mistakeStatus = item.mistake_status || "open";

  const cleanMistakeText = (item.mistake_text || item.title || "").trim().replace(/^(weakness|missing dimension):\s*/i, "");

  const { whyItMatters, fixText } = parseNotes(item);

  const sourceLabel = item.mistake_notes?.includes("Source: chatgpt_air1") 
    ? "ChatGPT AIR-1" 
    : item.mistake_notes?.includes("Source: gemini_basic") 
    ? "Gemini Basic"
    : item.source_type || "Spaced Repetition";

  const handleOpenWorkspace = () => {
    if (!attemptId) return;
    navigate("/mains/answer-writing", {
      state: {
        attemptId: attemptId,
        mode: "review"
      }
    });
  };

  return (
    <div style={{
      background: T.cardBg,
      border: `1px solid ${isMustRevise ? `${T.red}33` : T.border}`,
      borderLeft: `4px solid ${isMustRevise ? T.red : SEVERITY_COLOR[severity] || T.dim}`,
      borderRadius: 10, padding: "16px 18px", marginBottom: 12,
      opacity: isLoading ? 0.6 : 1, transition: "opacity 0.2s, border 0.2s",
      boxShadow: isMustRevise ? `0 0 8px ${T.red}11` : "none"
    }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <Badge label={paperName} color={T.amber} bg="#1a1200" />
            <Badge label={severity} color={SEVERITY_COLOR[severity]} bg={SEVERITY_BG[severity]} />
            {isMustRevise && <Badge label="MUST REVISE" color={T.red} bg="#1a0000" />}
            <span style={{ fontSize: 10, color: T.dim, fontFamily: "monospace" }}>{sourceLabel}</span>
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.textBright, margin: "0 0 6px 0", lineHeight: 1.4 }}>
            {cleanMistakeText}
          </h3>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: T.dim }}>
            Due: {formatDate(item.next_review_at || item.due_date)}
          </span>
        </div>
      </div>

      {/* Structured why and fix sections */}
      {whyItMatters && (
        <div style={{
          fontSize: 12, color: T.text, lineHeight: 1.5,
          marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${T.amber}33`
        }}>
          <span style={{ color: T.amber, fontWeight: 600 }}>Why it matters: </span>
          {whyItMatters}
        </div>
      )}

      {fixText && (
        <div style={{
          fontSize: 12, color: T.textBright, lineHeight: 1.5,
          background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "8px 12px", marginBottom: 12
        }}>
          <span style={{ color: T.green, fontWeight: 600 }}>✓ Fix: </span>
          {fixText}
        </div>
      )}

      {/* Footer Info & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.status !== "completed" && item.status !== "revised" && (
            <button
              onClick={() => onReview(item.id)}
              disabled={isLoading}
              style={{
                background: "#0a1a0a", border: `1px solid ${T.green}44`, color: T.green,
                borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "monospace"
              }}
            >
              ✓ Mark Revised
            </button>
          )}

          {attemptId && (
            <button
              onClick={handleOpenWorkspace}
              style={{
                background: "#0c1a2d", border: `1px solid ${T.blue}44`, color: "#60a5fa",
                borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "monospace"
              }}
            >
              📂 Open Workspace
            </button>
          )}

          {item.mistake_id && mistakeStatus !== "resolved" && (
            <button
              onClick={() => onResolve(item.mistake_id)}
              style={{
                background: "#1a0f0f", border: `1px solid ${T.red}44`, color: "#f87171",
                borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: "monospace"
              }}
            >
              ⚠️ Mark Resolved
            </button>
          )}
        </div>

        <div style={{ fontSize: 9, color: T.dim, fontFamily: "monospace" }}>
          Reviews: {item.review_count ?? 0} | Interval: {item.interval_days ?? 1}d
        </div>
      </div>
    </div>
  );
}

/* ── Main Revision Dashboard Page ── */
export default function RevisionPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  
  // Filters
  const [paperFilter, setPaperFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [mustReviseOnly, setMustReviseOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/revision-items?userId=${USER_ID}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.items || data.data || []);
      
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
        body: JSON.stringify({ status: "resolved" })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchItems(true);
    } catch (e) {
      alert(`Failed to resolve mistake: ${e.message}`);
    }
  };

  // Helper date logic
  const now = new Date();
  const isOverdue = (item) => {
    if (item.status === "completed" || item.status === "revised" || item.status === "reviewed") return false;
    const due = new Date(item.next_review_at || item.due_date || now);
    return due < now && due.toDateString() !== now.toDateString();
  };

  const isToday = (item) => {
    if (item.status === "completed" || item.status === "revised" || item.status === "reviewed") return false;
    const due = new Date(item.next_review_at || item.due_date || now);
    return due.toDateString() === now.toDateString() || (due < now && !isOverdue(item));
  };

  const isUpcoming = (item) => {
    if (item.status === "completed" || item.status === "revised" || item.status === "reviewed") return false;
    const due = new Date(item.next_review_at || item.due_date || now);
    return due > now && due.toDateString() !== now.toDateString();
  };

  const isCompleted = (item) => {
    return item.status === "completed" || item.status === "revised" || item.status === "reviewed";
  };

  // Applying Filters
  const filtered = items.filter(item => {
    // 1. Paper Filter
    if (!matchesPaperFilter(item, paperFilter)) return false;

    // 2. Severity/Priority Filter
    if (severityFilter !== "all") {
      const sev = (item.mistake_severity || item.priority || "").toLowerCase();
      if (sev !== severityFilter) return false;
    }

    // 3. Must Revise Only
    if (mustReviseOnly) {
      const mustRev = Boolean(item.mistake_must_revise || item.must_revise);
      if (!mustRev) return false;
    }

    // 4. Search text
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchText = [
        item.title,
        item.mistake_text,
        item.question_text,
        item.subject,
        item.mistake_paper
      ].join(" ").toLowerCase();
      if (!matchText.includes(q)) return false;
    }

    return true;
  });

  // Highlight Section: Must Revise cards
  const mustReviseHighlights = filtered.filter(item => Boolean(item.mistake_must_revise || item.must_revise) && !isCompleted(item));

  // Buckets
  const overdueItems = filtered.filter(item => isOverdue(item));
  const todayItems = filtered.filter(item => isToday(item));
  const upcomingItems = filtered.filter(item => isUpcoming(item));
  const completedItems = filtered.filter(item => isCompleted(item));

  // Stats Counters
  const totalCount = items.length;
  const overdueCount = items.filter(i => isOverdue(i)).length;
  const todayCount = items.filter(i => isToday(i)).length;
  const upcomingCount = items.filter(i => isUpcoming(i)).length;
  const completedCount = items.filter(i => isCompleted(i)).length;
  const mustReviseCount = items.filter(i => Boolean(i.mistake_must_revise || i.must_revise) && !isCompleted(i)).length;

  const s = {
    page: { background: T.bg, minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: T.text },
    input: { background: "#0c0c0c", border: `1px solid ${T.border}`, borderRadius: 6, color: T.textBright, fontSize: 12, padding: "7px 12px", fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" },
    sectionCard: { background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "18px 20px", marginBottom: 20 },
  };

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>MENTOROS · MEMORY ENGINE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Revision Dashboard</h1>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: T.dim, fontFamily: "monospace" }}>refreshed {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button onClick={() => fetchItems()} disabled={loading} style={{
            background: "#111", border: `1px solid ${T.border}`, color: T.dim,
            borderRadius: 5, padding: "4px 12px", fontSize: 10,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace", marginLeft: "auto"
          }}>{loading ? "Loading…" : "↻ Refresh"}</button>
        </div>
        <p style={{ margin: "6px 0 18px", fontSize: 12, color: T.dim, maxWidth: 560 }}>
          Transforming Mains mistakes into daily revision tasks using Spaced Repetition.
        </p>

        {/* Stats Panel */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatChip label="Overdue" value={overdueCount} accent={overdueCount > 0} />
          <StatChip label="Due Today" value={todayCount} />
          <StatChip label="Upcoming" value={upcomingCount} />
          <StatChip label="Must Revise" value={mustReviseCount} />
          <StatChip label="Completed" value={completedCount} />
        </div>
      </div>

      {/* FILTERS */}
      <div style={s.sectionCard}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Filter Options</div>

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, weakness, question, topic..."
            style={s.input}
          />
        </div>

        {/* Filter Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Subject / Paper */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.06em" }}>Paper</span>
            <FilterPill label="All" active={paperFilter === "all"} onClick={() => setPaperFilter("all")} />
            <FilterPill label="GS1" active={paperFilter === "gs1"} onClick={() => setPaperFilter("gs1")} />
            <FilterPill label="GS2" active={paperFilter === "gs2"} onClick={() => setPaperFilter("gs2")} />
            <FilterPill label="GS3" active={paperFilter === "gs3"} onClick={() => setPaperFilter("gs3")} />
            <FilterPill label="Essay" active={paperFilter === "essay"} onClick={() => setPaperFilter("essay")} />
            <FilterPill label="Ethics" active={paperFilter === "ethics"} onClick={() => setPaperFilter("ethics")} />
            <FilterPill label="Geography" active={paperFilter === "geography"} onClick={() => setPaperFilter("geography")} />
          </div>

          {/* Severity */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.06em" }}>Severity</span>
            <FilterPill label="All" active={severityFilter === "all"} onClick={() => setSeverityFilter("all")} />
            <FilterPill label="High" active={severityFilter === "high"} onClick={() => setSeverityFilter("high")} />
            <FilterPill label="Medium" active={severityFilter === "medium"} onClick={() => setSeverityFilter("medium")} />
            <FilterPill label="Low" active={severityFilter === "low"} onClick={() => setSeverityFilter("low")} />
          </div>

          {/* Must Revise Toggle */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.dim, minWidth: 70, textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority</span>
            <FilterPill label="All Items" active={!mustReviseOnly} onClick={() => setMustReviseOnly(false)} />
            <FilterPill label="Must Revise Only ⚠️" active={mustReviseOnly} onClick={() => setMustReviseOnly(true)} />
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ background: "#1a0000", border: `1px solid ${T.red}33`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: T.red, fontFamily: "monospace" }}>
          ⚠ Failed to load revision queue: {error}
          <button onClick={() => fetchItems()} style={{ background: "none", border: "none", color: T.amber, cursor: "pointer", marginLeft: 12, fontFamily: "monospace", fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: T.dim, fontSize: 12, fontFamily: "monospace" }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⟳</div>
          Loading revision items...
        </div>
      )}

      {/* EMPTY LIST */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: T.cardBg, border: `1px dashed ${T.border}`, borderRadius: 10, padding: "48px 0", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>No revision items found matching filters.</div>
        </div>
      )}

      {/* TIMELINE QUEUE */}
      {!loading && !error && filtered.length > 0 && (
        <div>
          {/* MUST REVISE HIGHLIGHT (TOP LEVEL) */}
          {mustReviseHighlights.length > 0 && (
            <div style={{
              background: "#120505", border: `1px solid ${T.red}22`,
              borderRadius: 10, padding: "16px 20px", marginBottom: 24
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.red, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                ⚠️ CRITICAL MUST REVISE HIGHLIGHTS
              </div>
              <div>
                {mustReviseHighlights.map(item => (
                  <RevisionCard key={`highlight-${item.id}`} item={item} onReview={handleReview} onResolve={handleResolveMistake} loadingId={loadingId} />
                ))}
              </div>
            </div>
          )}

          {/* Overdue */}
          {overdueItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="⚠ Overdue" count={overdueItems.length} color={T.red} />
              {overdueItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onResolve={handleResolveMistake} loadingId={loadingId} />
              ))}
            </div>
          )}

          {/* Today */}
          {todayItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="● Due Today" count={todayItems.length} color={T.amber} />
              {todayItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onResolve={handleResolveMistake} loadingId={loadingId} />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcomingItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="Upcoming" count={upcomingItems.length} color={T.indigo} />
              {upcomingItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onResolve={handleResolveMistake} loadingId={loadingId} />
              ))}
            </div>
          )}

          {/* Completed */}
          {completedItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="✓ Completed / Revised" count={completedItems.length} color={T.green} />
              {completedItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onResolve={handleResolveMistake} loadingId={loadingId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
