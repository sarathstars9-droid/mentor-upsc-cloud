// src/pages/RevisionPage.jsx
// MentorOS Revision Dashboard — Apple-style spaced recall workspace.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL as BASE_URL } from "../config";

const USER_ID = "user_1";
const BLUE = "#0A64F5";
const GREEN = "#22C55E";
const RED = "#EF4444";
const AMBER = "#F59E0B";
const PURPLE = "#8B5CF6";

function detectTheme() {
  const html = document.documentElement;
  const body = document.body;
  const explicit = (
    html.getAttribute("data-theme") ||
    body?.getAttribute("data-theme") ||
    localStorage.getItem("theme") ||
    localStorage.getItem("mentor-theme") ||
    ""
  ).toLowerCase();

  if (explicit.includes("dark")) return "dark";
  if (explicit.includes("light")) return "light";
  if (html.classList.contains("dark") || body?.classList.contains("dark")) return "dark";

  try {
    const bg = getComputedStyle(body).backgroundColor;
    const nums = bg.match(/\d+/g)?.map(Number);
    if (nums?.length >= 3) {
      const luminance = (nums[0] * 299 + nums[1] * 587 + nums[2] * 114) / 1000;
      return luminance < 120 ? "dark" : "light";
    }
  } catch (_) {}

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useMentorTheme() {
  const [mode, setMode] = useState(() => detectTheme());

  useEffect(() => {
    const update = () => setMode(detectTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    window.addEventListener("storage", update);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", update);
      media?.removeEventListener?.("change", update);
    };
  }, []);

  return mode;
}

function palette(mode) {
  const dark = mode === "dark";
  return {
    dark,
    bg: dark ? "#080A0F" : "#F6F8FB",
    surface: dark ? "#0E131B" : "#FFFFFF",
    surface2: dark ? "#131A24" : "#F8FAFC",
    surface3: dark ? "#18212E" : "#EEF3F9",
    border: dark ? "#202B3A" : "#E3E8F0",
    borderStrong: dark ? "#2B3849" : "#D4DCE8",
    text: dark ? "#F8FAFC" : "#0F172A",
    text2: dark ? "#D4DCE7" : "#344054",
    muted: dark ? "#8A97A9" : "#667085",
    faint: dark ? "#5F6B7A" : "#98A2B3",
    primary: BLUE,
    primarySoft: dark ? "rgba(10,100,245,.14)" : "rgba(10,100,245,.075)",
    green: GREEN,
    greenSoft: dark ? "rgba(34,197,94,.12)" : "rgba(34,197,94,.08)",
    red: RED,
    redSoft: dark ? "rgba(239,68,68,.13)" : "rgba(239,68,68,.07)",
    amber: AMBER,
    amberSoft: dark ? "rgba(245,158,11,.13)" : "rgba(245,158,11,.09)",
    purple: PURPLE,
    purpleSoft: dark ? "rgba(139,92,246,.14)" : "rgba(139,92,246,.08)",
    shadow: dark ? "none" : "0 10px 30px rgba(15,23,42,.055)",
  };
}

function formatDueDate(iso) {
  if (!iso) return "No date";
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
    return `${Math.max(1, days)}d overdue`;
  }
  if (mins < 60) return `in ${mins}m`;
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
    let startIdx = 0;
    if (lines[0]?.startsWith("Source:")) {
      source = lines[0].substring(7).trim() || source;
      startIdx = 1;
    }
    if (lines[1]?.startsWith("Score:")) {
      const parsedScore = lines[1].substring(6).trim();
      score = parsedScore === "—" ? null : parsedScore;
      startIdx = 2;
    }
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

function cleanTaskTitle(item) {
  return (item.mistake_text || item.title || "Revision item")
    .trim()
    .replace(/^(weakness|missing dimension):\s*/i, "");
}

function matchesPaperFilter(item, filter) {
  if (filter === "all") return true;
  const paper = String(item.mistake_paper || item.subject || item.stage || "").toLowerCase();
  const stage = String(item.stage || "").toLowerCase();
  if (filter === "gs1") return (paper.includes("gs1") || paper.includes("gs 1") || paper.includes("general studies i") || paper.includes("gs i")) && !paper.includes("essay") && !paper.includes("ethics") && !paper.includes("studies iv");
  if (filter === "gs2") return paper.includes("gs2") || paper.includes("gs 2") || paper.includes("general studies ii") || paper.includes("gs ii");
  if (filter === "gs3") return paper.includes("gs3") || paper.includes("gs 3") || paper.includes("general studies iii") || paper.includes("gs iii");
  if (filter === "essay") return paper.includes("essay") || stage.includes("essay");
  if (filter === "ethics") return paper.includes("ethics") || paper.includes("gs4") || paper.includes("gs 4") || paper.includes("general studies iv") || paper.includes("gs iv") || stage.includes("ethics");
  if (filter === "geography") return paper.includes("geography") || paper.includes("optional") || stage.includes("optional");
  return true;
}

function inferWeaknessType(item) {
  const text = [item.mistake_text, item.title, item.mistake_notes, item.content, item.notes]
    .filter(Boolean).join(" ").toLowerCase();
  if (/diagram|map|flowchart|presentation|schematic/.test(text)) return { label: "Presentation", color: PURPLE };
  if (/data|report|committee|case|example|evidence|quote|article/.test(text)) return { label: "Evidence", color: BLUE };
  if (/directive|critically|analyse|analyze|discuss|demand|off-topic/.test(text)) return { label: "Demand", color: RED };
  if (/structure|intro|conclusion|coherence|framework|dimension/.test(text)) return { label: "Structure", color: AMBER };
  if (/fact|date|name|term|definition|chronology/.test(text)) return { label: "Fact Recall", color: GREEN };
  return { label: "Conceptual", color: BLUE };
}

function severityOf(item) {
  const raw = String(item.mistake_severity || item.priority || "").toLowerCase();
  if (["high", "medium", "low"].includes(raw)) return raw;
  if (item.mistake_must_revise || item.must_revise) return "high";
  return "medium";
}

function Card({ P, children, style = {} }) {
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, boxShadow: P.shadow, ...style }}>
      {children}
    </div>
  );
}

function Button({ P, children, onClick, primary = false, disabled = false, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${primary ? P.primary : P.borderStrong}`,
        background: primary ? P.primary : P.surface2,
        color: primary ? "#fff" : P.text2,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ P, label, active, onClick, tone = "blue" }) {
  const accent = tone === "green" ? P.green : tone === "amber" ? P.amber : tone === "red" ? P.red : P.primary;
  const soft = tone === "green" ? P.greenSoft : tone === "amber" ? P.amberSoft : tone === "red" ? P.redSoft : P.primarySoft;
  return (
    <button onClick={onClick} style={{ border: `1px solid ${active ? accent : P.border}`, background: active ? soft : P.surface2, color: active ? accent : P.muted, borderRadius: 999, padding: "7px 11px", fontSize: 10.5, fontWeight: active ? 850 : 700, cursor: "pointer", fontFamily: "inherit" }}>
      {label}
    </button>
  );
}

function StatCard({ P, label, value, sub, icon, tone = "blue" }) {
  const accent = tone === "green" ? P.green : tone === "amber" ? P.amber : tone === "red" ? P.red : tone === "purple" ? P.purple : P.primary;
  const soft = tone === "green" ? P.greenSoft : tone === "amber" ? P.amberSoft : tone === "red" ? P.redSoft : tone === "purple" ? P.purpleSoft : P.primarySoft;
  return (
    <Card P={P} style={{ padding: 16, borderRadius: 15 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: soft, color: accent, fontSize: 16, fontWeight: 900, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ color: P.text, fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{value}</div>
          <div style={{ color: P.text2, fontSize: 10.5, fontWeight: 800, marginTop: 5 }}>{label}</div>
          {sub ? <div style={{ color: P.faint, fontSize: 9.5, marginTop: 3 }}>{sub}</div> : null}
        </div>
      </div>
    </Card>
  );
}

function RevisionTaskCard({ P, item, onReview, onResolve, loadingId }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const isLoading = loadingId === item.id;
  const { whyItMatters, fixText, score } = parseRevisionItem(item);
  const title = cleanTaskTitle(item);
  const paperName = item.mistake_paper || item.subject || item.stage || "Mains";
  const attemptId = item.mistake_attempt_id || item.source_ref || null;
  const isMustRevise = Boolean(item.mistake_must_revise || item.must_revise);
  const dueLabel = formatDueDate(item.next_review_at || item.due_date);
  const completed = ["completed", "revised", "reviewed"].includes(item.status);
  const overdue = !completed && dueLabel.includes("overdue");
  const sev = severityOf(item);
  const type = inferWeaknessType(item);
  const borderColor = completed ? P.green : isMustRevise ? P.amber : overdue ? P.red : P.primary;
  const clamp = 220;
  const displayFix = expanded || fixText.length <= clamp ? fixText : `${fixText.slice(0, clamp)}…`;

  return (
    <Card P={P} style={{ padding: 16, borderLeft: `4px solid ${borderColor}`, opacity: isLoading ? 0.55 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: P.primary, fontSize: 9.5, fontWeight: 850 }}>{paperName}</span>
            <span style={{ color: sev === "high" ? P.red : sev === "medium" ? P.amber : P.green, background: sev === "high" ? P.redSoft : sev === "medium" ? P.amberSoft : P.greenSoft, borderRadius: 999, padding: "3px 7px", fontSize: 8.5, fontWeight: 850 }}>
              {sev === "high" ? "High Priority" : sev.charAt(0).toUpperCase() + sev.slice(1)}
            </span>
            <span style={{ color: type.color, background: `${type.color}14`, borderRadius: 999, padding: "3px 7px", fontSize: 8.5, fontWeight: 800 }}>{type.label}</span>
            {isMustRevise ? <span style={{ color: P.amber, background: P.amberSoft, borderRadius: 999, padding: "3px 7px", fontSize: 8.5, fontWeight: 800 }}>Must revise</span> : null}
            {overdue ? <span style={{ color: P.red, background: P.redSoft, borderRadius: 999, padding: "3px 7px", fontSize: 8.5, fontWeight: 800 }}>Overdue</span> : null}
            <span style={{ color: P.faint, fontSize: 9 }}>{dueLabel}</span>
          </div>

          <div style={{ color: P.text, fontSize: 13, fontWeight: 850, lineHeight: 1.45 }}>{title}</div>

          {whyItMatters ? (
            <div style={{ color: P.muted, fontSize: 10, lineHeight: 1.55, marginTop: 6 }}>
              <span style={{ color: P.amber, fontWeight: 800 }}>Why this improves marks: </span>{whyItMatters}
            </div>
          ) : null}

          {fixText ? (
            <div style={{ marginTop: 9, background: P.greenSoft, border: `1px solid ${P.green}20`, borderRadius: 9, padding: "9px 11px", color: P.text2, fontSize: 10, lineHeight: 1.5 }}>
              <span style={{ color: P.green, fontWeight: 850 }}>✦ Do this: </span>{displayFix}
              {fixText.length > clamp ? (
                <button onClick={() => setExpanded(v => !v)} style={{ border: "none", background: "transparent", color: P.primary, fontSize: 9.5, fontWeight: 800, cursor: "pointer", padding: "0 0 0 5px" }}>
                  {expanded ? "Show less" : "Expand"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ minWidth: 175 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, flexWrap: "wrap" }}>
            {!completed ? <Button P={P} onClick={() => onReview(item.id)} disabled={isLoading}>Mark Revised</Button> : null}
            {attemptId ? <Button P={P} primary onClick={() => navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } })}>Open Answer →</Button> : null}
            {item.mistake_id && item.mistake_status !== "resolved" ? (
              <button onClick={() => onResolve(item.mistake_id)} style={{ border: "none", background: "transparent", color: P.muted, fontSize: 9.5, fontWeight: 750, cursor: "pointer", padding: "8px 4px" }}>Resolve</button>
            ) : null}
          </div>
          <div style={{ color: P.faint, fontSize: 8.5, textAlign: "right", marginTop: 8 }}>Reviews: {item.review_count ?? 0} · Interval: {item.interval_days ?? 1}d</div>
          {score ? <div style={{ color: P.green, fontSize: 9, fontWeight: 800, textAlign: "right", marginTop: 4 }}>Score: {score}</div> : null}
        </div>
      </div>
    </Card>
  );
}

function Section({ P, title, count, items, renderCard, initialShow = 5, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setExpanded(defaultExpanded), [defaultExpanded]);
  if (!items.length) return null;
  const visible = showAll ? items : items.slice(0, initialShow);
  const hidden = Math.max(0, items.length - initialShow);
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ color: P.text, fontSize: 16, fontWeight: 900 }}>{title}</div>
        <span style={{ color: P.muted, background: P.surface3, borderRadius: 999, padding: "2px 7px", fontSize: 9, fontWeight: 850 }}>{count}</span>
        <div style={{ flex: 1, height: 1, background: P.border }} />
        <button onClick={() => setExpanded(v => !v)} style={{ border: "none", background: "transparent", color: P.primary, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>{expanded ? "Hide" : "Show"}</button>
      </div>
      {expanded ? (
        <>
          <div style={{ display: "grid", gap: 9 }}>{visible.map(renderCard)}</div>
          {!showAll && hidden > 0 ? <Button P={P} onClick={() => setShowAll(true)} style={{ width: "100%", marginTop: 9, borderStyle: "dashed" }}>Show {hidden} more {title.toLowerCase()} tasks</Button> : null}
        </>
      ) : null}
    </section>
  );
}

export default function RevisionPage() {
  const navigate = useNavigate();
  const mode = useMentorTheme();
  const P = useMemo(() => palette(mode), [mode]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [search, setSearch] = useState("");
  const [paperFilter, setPaperFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mustReviseOnly, setMustReviseOnly] = useState(false);

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_URL}/api/revision-items?userId=${USER_ID}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : (data.items || data.data || []));
      setLastRefresh(new Date());
    } catch (e) {
      setError(e?.message || "Failed to load revision items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const isCompleted = item => ["completed", "revised", "reviewed"].includes(item.status);
  const isOverdue = item => {
    if (isCompleted(item)) return false;
    const due = new Date(item.next_review_at || item.due_date || new Date());
    const now = new Date();
    return due < now && due.toDateString() !== now.toDateString();
  };
  const isToday = item => {
    if (isCompleted(item)) return false;
    const due = new Date(item.next_review_at || item.due_date || new Date());
    const now = new Date();
    return due.toDateString() === now.toDateString() || (due < now && !isOverdue(item));
  };
  const isUpcoming = item => {
    if (isCompleted(item)) return false;
    const due = new Date(item.next_review_at || item.due_date || new Date());
    const now = new Date();
    return due > now && due.toDateString() !== now.toDateString();
  };

  const handleReview = async id => {
    setLoadingId(id);
    try {
      const res = await fetch(`${BASE_URL}/api/revision-items/${id}/review`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTimeout(() => fetchItems(true), 150);
    } catch (e) {
      alert(`Review failed: ${e.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleResolveMistake = async mistakeId => {
    try {
      const res = await fetch(`${BASE_URL}/api/mistakes/${mistakeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "resolved" }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchItems(true);
    } catch (e) {
      alert(`Failed to resolve mistake: ${e.message}`);
    }
  };

  const filtered = useMemo(() => items.filter(item => {
    if (!matchesPaperFilter(item, paperFilter)) return false;
    if (severityFilter !== "all" && severityOf(item) !== severityFilter) return false;
    if (mustReviseOnly && !Boolean(item.mistake_must_revise || item.must_revise)) return false;
    if (statusFilter === "today" && !isToday(item)) return false;
    if (statusFilter === "overdue" && !isOverdue(item)) return false;
    if (statusFilter === "upcoming" && !isUpcoming(item)) return false;
    if (statusFilter === "completed" && !isCompleted(item)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [item.title, item.mistake_text, item.question_text, item.subject, item.mistake_paper, item.mistake_notes, item.content].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [items, paperFilter, severityFilter, mustReviseOnly, statusFilter, search]);

  const mustReviseItems = filtered.filter(i => Boolean(i.mistake_must_revise || i.must_revise) && !isCompleted(i));
  const overdueItems = filtered.filter(isOverdue);
  const todayItems = filtered.filter(isToday);
  const upcomingItems = filtered.filter(isUpcoming);
  const completedItems = filtered.filter(isCompleted);

  const top3PriorityTasks = useMemo(() => {
    const selected = [];
    const pushUnique = item => { if (selected.length < 3 && !selected.some(x => x.id === item.id)) selected.push(item); };
    items.filter(i => Boolean(i.mistake_must_revise || i.must_revise) && !isCompleted(i)).forEach(pushUnique);
    items.filter(isOverdue).forEach(pushUnique);
    items.filter(isToday).forEach(pushUnique);
    return selected;
  }, [items]);

  const overdueCount = items.filter(isOverdue).length;
  const todayCount = items.filter(isToday).length;
  const upcomingCount = items.filter(isUpcoming).length;
  const completedCount = items.filter(isCompleted).length;
  const mustRevCount = items.filter(i => Boolean(i.must_revise || i.mistake_must_revise) && !isCompleted(i)).length;

  const startRevision = () => {
    const item = top3PriorityTasks[0];
    if (!item) return;
    const attemptId = item.mistake_attempt_id || item.source_ref;
    if (attemptId) navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } });
    else document.getElementById("revision-tasks")?.scrollIntoView({ behavior: "smooth" });
  };

  const renderCard = item => (
    <div key={item.id} id={`revision-item-${item.id}`}>
      <RevisionTaskCard P={P} item={item} onReview={handleReview} onResolve={handleResolveMistake} loadingId={loadingId} />
    </div>
  );

  return (
    <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box", background: P.bg, color: P.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", boxSizing: "border-box", padding: "24px 26px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 17, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: P.primary, fontSize: 10, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase" }}>Revision · Spaced Recall</div>
            <h1 style={{ margin: "5px 0 0", color: P.text, fontSize: 30, fontWeight: 900, letterSpacing: "-.035em" }}>Revision Dashboard</h1>
            <div style={{ color: P.muted, fontSize: 12, marginTop: 5 }}>Today’s spaced recall tasks from your Mains mistakes.</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {lastRefresh ? <div style={{ color: P.faint, fontSize: 9.5, textAlign: "right" }}>Last refreshed<br />{lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div> : null}
            <Button P={P} onClick={() => fetchItems()} disabled={loading}>↻ {loading ? "Refreshing" : "Refresh"}</Button>
          </div>
        </div>

        {!loading && !error ? (
          <Card P={P} style={{ padding: 18, marginBottom: 14, background: P.dark ? "linear-gradient(135deg, rgba(245,158,11,.11), rgba(10,100,245,.09))" : "linear-gradient(135deg, rgba(255,247,237,.95), rgba(239,246,255,.95))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: P.amberSoft, color: P.amber, fontSize: 18, fontWeight: 900 }}>⚡</div>
                <div>
                  <div style={{ color: P.text, fontSize: 16, fontWeight: 900 }}>Today’s Revision Priority</div>
                  <div style={{ color: P.muted, fontSize: 10.5, marginTop: 3 }}>{top3PriorityTasks.length ? `${top3PriorityTasks.length} high-impact task${top3PriorityTasks.length > 1 ? "s" : ""} from recent mistakes` : "No high-priority tasks scheduled"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button P={P} primary disabled={!top3PriorityTasks.length} onClick={startRevision}>Start Revision →</Button>
                <Button P={P} onClick={() => document.getElementById("revision-tasks")?.scrollIntoView({ behavior: "smooth" })}>View All Tasks</Button>
              </div>
            </div>

            {top3PriorityTasks[0] ? (
              <div style={{ marginTop: 14, background: P.surface, border: `1px solid ${P.border}`, borderRadius: 13, padding: 14, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ color: P.primary, fontSize: 9, fontWeight: 850 }}>{top3PriorityTasks[0].mistake_paper || top3PriorityTasks[0].subject || "Mains"}</span>
                    <span style={{ color: P.red, background: P.redSoft, borderRadius: 999, padding: "2px 7px", fontSize: 8.5, fontWeight: 850 }}>High Priority</span>
                  </div>
                  <div style={{ color: P.text, fontSize: 12.5, fontWeight: 850, lineHeight: 1.45 }}>{cleanTaskTitle(top3PriorityTasks[0])}</div>
                  <div style={{ color: P.faint, fontSize: 9.5, marginTop: 6 }}>Marked weak · {formatDueDate(top3PriorityTasks[0].next_review_at || top3PriorityTasks[0].due_date)}</div>
                </div>
                {(top3PriorityTasks[0].mistake_attempt_id || top3PriorityTasks[0].source_ref) ? <Button P={P} onClick={() => { const attemptId = top3PriorityTasks[0].mistake_attempt_id || top3PriorityTasks[0].source_ref; navigate("/mains/answer-writing", { state: { attemptId, mode: "review" } }); }}>Open Answer →</Button> : null}
              </div>
            ) : null}
          </Card>
        ) : null}

        <div className="revision-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
          <StatCard P={P} icon="⌁" tone="red" value={overdueCount} label="Overdue tasks" sub="Need immediate attention" />
          <StatCard P={P} icon="◷" tone="blue" value={todayCount} label="Tasks due today" sub="Keep up the momentum" />
          <StatCard P={P} icon="▣" tone="blue" value={upcomingCount} label="Upcoming tasks" sub="Next scheduled recalls" />
          <StatCard P={P} icon="★" tone="amber" value={mustRevCount} label="Must revise first" sub="Highest priority" />
          <StatCard P={P} icon="✓" tone="green" value={completedCount} label="Completed revisions" sub="This cycle" />
        </div>

        <Card P={P} style={{ padding: 14, marginBottom: 20 }}>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: P.faint, fontSize: 13 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by subject, topic, or weakness…" style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${P.border}`, background: P.surface2, color: P.text, borderRadius: 10, padding: "10px 12px 10px 34px", outline: "none", fontSize: 11.5, fontFamily: "inherit" }} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 62, color: P.muted, fontSize: 9.5, fontWeight: 800 }}>Paper</div>
              {[['all','All'],['gs1','GS1'],['gs2','GS2'],['gs3','GS3'],['ethics','GS4'],['essay','Essay'],['geography','Geography']].map(([id,label]) => <Pill key={id} P={P} label={label} active={paperFilter===id} onClick={() => setPaperFilter(id)} />)}
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 62, color: P.muted, fontSize: 9.5, fontWeight: 800 }}>Severity</div>
              {[['all','All','blue'],['high','High','red'],['medium','Medium','amber'],['low','Low','green']].map(([id,label,tone]) => <Pill key={id} P={P} label={label} tone={tone} active={severityFilter===id} onClick={() => setSeverityFilter(id)} />)}
            </div>
            <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: 62, color: P.muted, fontSize: 9.5, fontWeight: 800 }}>Show</div>
              {[['all','All Tasks'],['today','Due Today'],['overdue','Overdue'],['upcoming','Upcoming'],['completed','Completed']].map(([id,label]) => <Pill key={id} P={P} label={label} active={statusFilter===id} onClick={() => setStatusFilter(id)} />)}
              <Pill P={P} label="Must revise first" tone="amber" active={mustReviseOnly} onClick={() => setMustReviseOnly(v => !v)} />
            </div>
          </div>
        </Card>

        {error ? <Card P={P} style={{ padding: 14, marginBottom: 16, borderColor: `${P.red}55` }}><div style={{ color: P.red, fontSize: 11, fontWeight: 800 }}>Failed to load revision queue: {error}<button onClick={() => fetchItems()} style={{ border: "none", background: "transparent", color: P.primary, fontSize: 10, fontWeight: 850, cursor: "pointer", marginLeft: 8 }}>Retry</button></div></Card> : null}
        {loading ? <Card P={P} style={{ padding: 42, textAlign: "center" }}><div style={{ color: P.primary, fontSize: 22, marginBottom: 8 }}>◌</div><div style={{ color: P.muted, fontSize: 11 }}>Loading your revision queue…</div></Card> : null}
        {!loading && !error && filtered.length === 0 ? <Card P={P} style={{ padding: 42, textAlign: "center", borderStyle: "dashed" }}><div style={{ fontSize: 24, marginBottom: 8 }}>✓</div><div style={{ color: P.text, fontSize: 16, fontWeight: 900 }}>{items.length ? "No tasks match these filters" : "You’re all caught up"}</div><div style={{ color: P.muted, fontSize: 10.5, marginTop: 5 }}>{items.length ? "Try widening your search or filter selection." : "Write and review Mains answers to build your revision queue."}</div></Card> : null}

        {!loading && !error && filtered.length > 0 ? (
          <div id="revision-tasks">
            {top3PriorityTasks.length && statusFilter === "all" && paperFilter === "all" && severityFilter === "all" && !search && !mustReviseOnly ? <Section P={P} title="Priority Today" count={top3PriorityTasks.length} items={top3PriorityTasks} renderCard={renderCard} initialShow={3} /> : null}
            <Section P={P} title="Overdue" count={overdueItems.length} items={overdueItems} renderCard={renderCard} initialShow={5} />
            <Section P={P} title="Due Today" count={todayItems.length} items={todayItems} renderCard={renderCard} initialShow={5} />
            <Section P={P} title="Upcoming" count={upcomingItems.length} items={upcomingItems} renderCard={renderCard} initialShow={5} defaultExpanded={upcomingItems.length <= 5} />
            <Section P={P} title="Completed" count={completedItems.length} items={completedItems} renderCard={renderCard} initialShow={5} defaultExpanded={false} />
          </div>
        ) : null}
      </div>

      <style>{`
        @media (max-width: 1050px) {
          .revision-kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
        @media (max-width: 680px) {
          .revision-kpi-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
