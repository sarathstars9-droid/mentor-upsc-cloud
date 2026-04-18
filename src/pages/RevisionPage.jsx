import { useState, useEffect, useCallback } from "react";
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

function isDue(item) {
  if (!item.next_review_at) return true;
  return new Date(item.next_review_at) <= new Date();
}

function isOverdue(item) {
  if (!item.next_review_at) return false;
  return new Date(item.next_review_at) < new Date(Date.now() - 3600000);
}

function reviewedToday(item) {
  if (!item.last_reviewed_at) return false;
  const today = new Date();
  const rev = new Date(item.last_reviewed_at);
  return rev.toDateString() === today.toDateString();
}

const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#6b7280" };
const PRIORITY_BG = { high: "#1a0000", medium: "#1a1200", low: "#111" };
const STATUS_COLOR = { pending: "#f59e0b", reviewed: "#22c55e", snoozed: "#6366f1", skipped: "#6b7280" };

const RISK_COLOR = { low: "#6b7280", medium: "#f59e0b", high: "#f97316", critical: "#ef4444" };
const RISK_BG    = { low: "#111",    medium: "#1a1200", high: "#1a0800", critical: "#1a0000" };

/* ── lookupWeakness ──────────────────────────────────────────────────────────
 * Given an item and the weaknessMap returned by /api/weakness/map, returns
 * the matching weakness row (or null). Tries node_id::stage first, then
 * node_id alone as a fallback for items without a stage.
 * ─────────────────────────────────────────────────────────────────────────── */
function lookupWeakness(item, weaknessMap) {
  if (!item.node_id || !weaknessMap) return null;
  return (
    weaknessMap[`${item.node_id}::${item.stage || ""}`] ||
    weaknessMap[item.node_id] ||
    null
  );
}

/* ── sortByWeakness ──────────────────────────────────────────────────────────
 * Within a bucket, sort by weakness_score DESC then next_review_at ASC.
 * Items with no matching weakness node score as 0 (fall to bottom).
 * ─────────────────────────────────────────────────────────────────────────── */
function sortByWeakness(items, weaknessMap) {
  return [...items].sort((a, b) => {
    const wa = lookupWeakness(a, weaknessMap);
    const wb = lookupWeakness(b, weaknessMap);
    const sa = wa ? Number(wa.weakness_score) : 0;
    const sb = wb ? Number(wb.weakness_score) : 0;
    if (sb !== sa) return sb - sa; // higher weakness first
    const da = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
    const db = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
    return da - db; // earlier time first within same score
  });
}

/* ── Sub-components ── */
const Badge = ({ label, color, bg }) => (
  <span style={{
    background: bg || "#111", border: `1px solid ${color}44`,
    color, fontSize: 9, fontWeight: 700, borderRadius: 4,
    padding: "2px 7px", letterSpacing: "0.08em", textTransform: "uppercase",
    fontFamily: "monospace", flexShrink: 0
  }}>{label}</span>
);

const StatChip = ({ label, value, accent }) => (
  <div style={{
    background: "#0f0f0f", border: `1px solid ${accent ? "#f59e0b44" : "#1e1e1e"}`,
    borderRadius: 8, padding: "10px 16px", minWidth: 90, textAlign: "center"
  }}>
    <div style={{ fontSize: 20, fontWeight: 700, color: accent ? "#f59e0b" : "#fff", fontFamily: "monospace" }}>{value}</div>
    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
  </div>
);

const FilterPill = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? "#1a1200" : "#0a0a0a",
    border: `1px solid ${active ? "#f59e0b" : "#2a2a2a"}`,
    color: active ? "#f59e0b" : "#666",
    borderRadius: 20, padding: "5px 13px", fontSize: 11,
    cursor: "pointer", fontFamily: "monospace", transition: "all 0.15s",
    whiteSpace: "nowrap"
  }}>{label}</button>
);

/* ── WeakAreaPanel ───────────────────────────────────────────────────────────
 * Compact top-5 weak nodes display. Matches existing dark monochrome style.
 * Hidden when weaknessMap is empty (e.g. not yet computed or API unavailable).
 * ─────────────────────────────────────────────────────────────────────────── */
function WeakAreaPanel({ weaknessMap }) {
  const nodes = Object.values(weaknessMap || {})
    .sort((a, b) => Number(b.weakness_score) - Number(a.weakness_score))
    .slice(0, 5);

  if (nodes.length === 0) return null;

  return (
    <div style={{
      background: "#0f0f0f", border: "1px solid #1e1e1e",
      borderRadius: 10, padding: "16px 20px", marginBottom: 20
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#555",
        letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12
      }}>
        Top Weak Areas
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {nodes.map((node, idx) => {
          const risk = node.risk_level || "low";
          const score = Number(node.weakness_score) || 0;
          const barWidth = Math.min(100, score);
          return (
            <div key={`${node.node_id}::${node.stage || ""}`} style={{
              background: "#0c0c0c",
              border: `1px solid ${RISK_COLOR[risk]}22`,
              borderLeft: `3px solid ${RISK_COLOR[risk]}`,
              borderRadius: 7, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 12
            }}>
              {/* Rank */}
              <span style={{
                fontSize: 9, fontWeight: 700, color: "#333",
                fontFamily: "monospace", minWidth: 14, textAlign: "right"
              }}>
                {idx + 1}
              </span>

              {/* Node info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: "#aaa",
                  fontFamily: "monospace", letterSpacing: "0.03em",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                  {node.node_id}
                </div>
                {node.subject && (
                  <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", marginTop: 1 }}>
                    {node.subject}{node.stage ? ` · ${node.stage}` : ""}
                  </div>
                )}
                {/* Score bar */}
                <div style={{
                  marginTop: 5, height: 2, background: "#1a1a1a",
                  borderRadius: 2, overflow: "hidden"
                }}>
                  <div style={{
                    width: `${barWidth}%`, height: "100%",
                    background: RISK_COLOR[risk], borderRadius: 2,
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>

              {/* Score + risk badge */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{
                  fontSize: 14, fontWeight: 700, color: RISK_COLOR[risk],
                  fontFamily: "monospace", lineHeight: 1
                }}>
                  {score}
                </span>
                <span style={{
                  background: RISK_BG[risk],
                  border: `1px solid ${RISK_COLOR[risk]}44`,
                  color: RISK_COLOR[risk],
                  fontSize: 8, fontWeight: 700, borderRadius: 3,
                  padding: "1px 5px", letterSpacing: "0.08em",
                  textTransform: "uppercase", fontFamily: "monospace"
                }}>
                  {risk}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevisionCard({ item, onReview, onSnooze, loadingId, weaknessMap }) {
  const [expanded, setExpanded] = useState(false);
  const isLoading = loadingId === item.id;
  const overdue = isOverdue(item);
  const due = isDue(item);
  const revToday = reviewedToday(item);
  const weakness = lookupWeakness(item, weaknessMap);

  const urgencyBorder = overdue ? "#ef444422" : due ? "#f59e0b22" : "#1e1e1e";
  const urgencyLeft = overdue ? "#ef4444" : due ? "#f59e0b" : "#2a2a2a";

  return (
    <div style={{
      background: "#0c0c0c",
      border: `1px solid ${urgencyBorder}`,
      borderLeft: `3px solid ${urgencyLeft}`,
      borderRadius: 9, padding: "16px 18px", marginBottom: 10,
      opacity: isLoading ? 0.6 : 1, transition: "opacity 0.2s, border 0.2s",
      boxShadow: overdue
        ? "0 0 0 1px rgba(239,68,68,0.3)"
        : due
          ? "0 0 0 1px rgba(245,158,11,0.25)"
          : "none",
      position: "relative"
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", lineHeight: 1.4, marginBottom: 4 }}>
            {item.title || item.question_text || "—"}
          </div>
          {item.question_text && item.question_text !== item.title && (
            <div style={{ fontSize: 11, color: "#555", lineHeight: 1.5, marginBottom: 4 }}>
              {expanded ? item.question_text : item.question_text.length > 120 ? item.question_text.slice(0, 120) + "…" : item.question_text}
              {item.question_text.length > 120 && (
                <button onClick={() => setExpanded(v => !v)} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: 10, padding: "0 4px", fontFamily: "monospace" }}>
                  {expanded ? "collapse" : "expand"}
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
          {item.source_type === "pyq_manual" && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(6,182,212,0.12)",
              border: "1px solid rgba(6,182,212,0.35)",
              color: "#22d3ee",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              📚 PYQ
            </span>
          )}
          <Badge label={item.priority || "—"} color={PRIORITY_COLOR[item.priority || "low"]} bg={PRIORITY_BG[item.priority || "low"]} />
          <Badge label={item.status || "—"} color={STATUS_COLOR[item.status] || "#6b7280"} />
          {weakness && (
            <Badge
              label={`W:${Number(weakness.weakness_score)}`}
              color={RISK_COLOR[weakness.risk_level || "low"]}
              bg={RISK_BG[weakness.risk_level || "low"]}
            />
          )}
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          <span style={{ color: "#3a3a3a" }}>subject</span>{" "}
          <span style={{ color: "#888" }}>{item.subject || "—"}</span>
        </span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          <span style={{ color: "#3a3a3a" }}>stage</span>{" "}
          <span style={{ color: "#888" }}>{item.stage || "—"}</span>
        </span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          <span style={{ color: "#3a3a3a" }}>source</span>{" "}
          <span style={{ color: "#666" }}>{item.source_type ?? "unknown"}</span>
        </span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          <span style={{ color: "#3a3a3a" }}>reviews</span>{" "}
          <span style={{ color: "#888" }}>{item.review_count ?? item.revision_count ?? 0}</span>
        </span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
          <span style={{ color: "#3a3a3a" }}>interval</span>{" "}
          <span style={{ color: "#888" }}>{item.interval_days ?? 1}d</span>
        </span>
        {item.node_id && (
          <span style={{ fontSize: 9, color: "#333", fontFamily: "monospace", letterSpacing: "0.05em" }}>{item.node_id}</span>
        )}
        <span style={{
          fontSize: 10, fontFamily: "monospace", marginLeft: "auto",
          color: overdue ? "#ef4444" : due ? "#f59e0b" : "#555",
          fontWeight: overdue || due ? 600 : 400
        }}>
          {overdue ? "⚠ " : due ? "● " : ""}{formatDate(item.next_review_at)}
          {revToday && <span style={{ color: "#22c55e", marginLeft: 6 }}>✓ reviewed today</span>}
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => onReview(item.id)}
          disabled={isLoading}
          style={{
            background: "#0a1a0a", border: "1px solid #22c55e44", color: "#22c55e",
            borderRadius: 6, padding: "6px 14px", fontSize: 11,
            cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "monospace", fontWeight: 600
          }}
        >
          {isLoading ? "…" : "✓ Mark Reviewed"}
        </button>
        <button
          onClick={() => onSnooze(item.id, 1)}
          disabled={isLoading}
          style={{
            background: "#0a0a1a", border: "1px solid #6366f144", color: "#6366f1",
            borderRadius: 6, padding: "6px 12px", fontSize: 11,
            cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "monospace"
          }}
        >
          Snooze 1d
        </button>
        <button
          onClick={() => onSnooze(item.id, 3)}
          disabled={isLoading}
          style={{
            background: "#0a0a1a", border: "1px solid #6366f144", color: "#4f46e5",
            borderRadius: 6, padding: "6px 12px", fontSize: 11,
            cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "monospace"
          }}
        >
          Snooze 3d
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 4
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
      <span style={{
        background: "#1a1200", border: "1px solid #f59e0b44", color: "#f59e0b",
        fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 8px", fontFamily: "monospace"
      }}>{count}</span>
      <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
    </div>
  );
}

/* ── Main Page ── */
export default function RevisionPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [dueOnly, setDueOnly] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [weaknessMap, setWeaknessMap] = useState({});

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const revisionUrl = `${BASE_URL}/api/revision-items?userId=${USER_ID}${dueOnly ? "&dueOnly=true" : ""}`;
      const weaknessUrl = `${BASE_URL}/api/weakness/map?userId=${USER_ID}`;

      // Fetch both in parallel; weakness failure must never break the revision load
      const [revRes, weakRes] = await Promise.allSettled([
        fetch(revisionUrl, { cache: "no-store" }),
        fetch(weaknessUrl, { cache: "no-store" }),
      ]);

      // Handle revision items (primary — errors propagate)
      if (revRes.status === "rejected") throw revRes.reason;
      if (!revRes.value.ok) throw new Error(`HTTP ${revRes.value.status}`);
      const revData = await revRes.value.json();
      const arr = Array.isArray(revData) ? revData : (revData.items || revData.data || []);
      arr.sort((a, b) => {
        const da = a.next_review_at ? new Date(a.next_review_at).getTime() : 0;
        const db = b.next_review_at ? new Date(b.next_review_at).getTime() : 0;
        return da - db;
      });
      setItems(arr);
      setLastRefresh(new Date());

      // Handle weakness map (secondary — errors are silent)
      if (weakRes.status === "fulfilled" && weakRes.value.ok) {
        try {
          const weakData = await weakRes.value.json();
          setWeaknessMap(weakData.map || {});
        } catch (_) {
          // malformed JSON — keep existing map, don't error
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dueOnly]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleReview = async (id) => {
    setLoadingId(id);
    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? {
            ...i,
            status: "reviewed",
            review_count: (i.review_count || 0) + 1
          }
          : i
      )
    );
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

  const handleSnooze = async (id, days) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/revision-items/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTimeout(() => { fetchItems(true); }, 150);
    } catch (e) {
      alert(`Snooze failed: ${e.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  /* ── derived data ── */
  const subjects = [...new Set(items.map(i => i.subject).filter(Boolean))].sort();
  const stages = [...new Set(items.map(i => i.stage).filter(Boolean))].sort();

  const filtered = items.filter(item => {
    // Queue sections only show active items by default.
    // "reviewed" items are excluded unless the user explicitly selects the
    // "reviewed" status pill — completing a review must remove it from the queue.
    if (statusFilter === "all") {
      if (item.status !== "pending" && item.status !== "snoozed") return false;
    } else {
      if (item.status !== statusFilter) return false;
    }
    if (stageFilter !== "all" && item.stage !== stageFilter) return false;
    if (subjectFilter !== "all" && item.subject !== subjectFilter) return false;
    if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = [item.title, item.question_text, item.subject, item.node_id, item.source_type].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // Split into buckets then sort each by weakness score (DESC) → time (ASC)
  const overdueItems  = sortByWeakness(filtered.filter(i => isOverdue(i)), weaknessMap);
  const dueNowItems   = sortByWeakness(filtered.filter(i => isDue(i) && !isOverdue(i)), weaknessMap);
  const upcomingItems = sortByWeakness(filtered.filter(i => !isDue(i)), weaknessMap);

  const totalCount = items.length;
  const dueCount = items.filter(i => isDue(i)).length;
  const pendingCount = items.filter(i => i.status === "pending").length;
  const highCount = items.filter(i => i.priority === "high").length;
  const reviewedTodayCount = items.filter(i => reviewedToday(i)).length;

  const s = {
    page: { background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" },
    input: { background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6, color: "#ccc", fontSize: 12, padding: "7px 12px", fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" },
    sectionCard: { background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "18px 20px", marginBottom: 20 },
  };

  return (
    <div style={s.page}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>MENTOROS · MEMORY ENGINE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Revision Engine</h1>
          {lastRefresh && (
            <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>refreshed {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button onClick={fetchItems} disabled={loading} style={{
            background: "#111", border: "1px solid #2a2a2a", color: "#666",
            borderRadius: 5, padding: "4px 12px", fontSize: 10,
            cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace", marginLeft: "auto"
          }}>{loading ? "Loading…" : "↻ Refresh"}</button>
        </div>
        <p style={{ margin: "6px 0 18px", fontSize: 12, color: "#555", maxWidth: 560 }}>
          Spaced repetition queue — review what needs reinforcement, mark done, snooze when needed.
        </p>

        {/* Stat chips */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatChip label="Total" value={totalCount} />
          <StatChip label="Due Now" value={dueCount} accent />
          <StatChip label="Pending" value={pendingCount} />
          <StatChip label="High Priority" value={highCount} />
          <StatChip label="Reviewed Today" value={reviewedTodayCount} />
        </div>
      </div>

      {/* TOP WEAK AREAS */}
      <WeakAreaPanel weaknessMap={weaknessMap} />

      {/* FILTERS */}
      <div style={s.sectionCard}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Filters</div>

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search title, subject, node…"
            style={s.input}
          />
        </div>

        {/* Filter rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Stage */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444", minWidth: 58, textTransform: "uppercase", letterSpacing: "0.06em" }}>Stage</span>
            <FilterPill label="All" active={stageFilter === "all"} onClick={() => setStageFilter("all")} />
            {stages.map(s => <FilterPill key={s} label={s} active={stageFilter === s} onClick={() => setStageFilter(s)} />)}
          </div>

          {/* Subject */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444", minWidth: 58, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subject</span>
            <FilterPill label="All" active={subjectFilter === "all"} onClick={() => setSubjectFilter("all")} />
            {subjects.map(s => <FilterPill key={s} label={s} active={subjectFilter === s} onClick={() => setSubjectFilter(s)} />)}
          </div>

          {/* Priority */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444", minWidth: 58, textTransform: "uppercase", letterSpacing: "0.06em" }}>Priority</span>
            {["all", "high", "medium", "low"].map(p => (
              <FilterPill key={p} label={p === "all" ? "All" : p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)} />
            ))}
          </div>

          {/* Status */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444", minWidth: 58, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</span>
            {["all", "pending", "reviewed", "snoozed"].map(st => (
              <FilterPill key={st} label={st === "all" ? "All" : st} active={statusFilter === st} onClick={() => setStatusFilter(st)} />
            ))}
          </div>

          {/* Due toggle */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#444", minWidth: 58, textTransform: "uppercase", letterSpacing: "0.06em" }}>Queue</span>
            <FilterPill label="All items" active={!dueOnly} onClick={() => setDueOnly(false)} />
            <FilterPill label="Due only" active={dueOnly} onClick={() => setDueOnly(true)} />
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ background: "#1a0000", border: "1px solid #ef444433", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "#ef4444", fontFamily: "monospace" }}>
          ⚠ Failed to load revision items: {error}
          <button onClick={fetchItems} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", marginLeft: 12, fontFamily: "monospace", fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#333", fontSize: 12, fontFamily: "monospace" }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>⟳</div>
          Loading revision queue…
        </div>
      )}

      {/* EMPTY */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: "#0a0a0a", border: "1px dashed #1e1e1e", borderRadius: 10, padding: "48px 0", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 14, color: "#555", fontWeight: 600 }}>No items match current filters</div>
          <div style={{ fontSize: 11, color: "#333", marginTop: 6 }}>
            {items.length > 0 ? "Try clearing filters or switching to 'All items'." : "Your revision queue is empty."}
          </div>
        </div>
      )}

      {/* QUEUE */}
      {!loading && !error && filtered.length > 0 && (
        <div>
          {/* Overdue */}
          {overdueItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="⚠ Overdue" count={overdueItems.length} />
              {overdueItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onSnooze={handleSnooze} loadingId={loadingId} weaknessMap={weaknessMap} />
              ))}
            </div>
          )}

          {/* Due Now */}
          {dueNowItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="● Due Now" count={dueNowItems.length} />
              {dueNowItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onSnooze={handleSnooze} loadingId={loadingId} weaknessMap={weaknessMap} />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcomingItems.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader label="Upcoming" count={upcomingItems.length} />
              {upcomingItems.map(item => (
                <RevisionCard key={item.id} item={item} onReview={handleReview} onSnooze={handleSnooze} loadingId={loadingId} weaknessMap={weaknessMap} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {!loading && items.length > 0 && (
        <div style={{ borderTop: "1px solid #111", paddingTop: 16, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>
            showing {filtered.length} of {items.length} items
          </span>
          <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>
            {reviewedTodayCount > 0 && <span style={{ color: "#22c55e" }}>{reviewedTodayCount} reviewed today · </span>}
            {dueCount} due · {pendingCount} pending
          </span>
        </div>
      )}
    </div>
  );
}
