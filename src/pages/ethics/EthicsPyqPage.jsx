import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:          "#09090b",
  surface:     "#111113",
  surfaceHigh: "#18181b",
  border:      "#1f1f23",
  borderMid:   "#27272a",
  muted:       "#3f3f46",
  subtle:      "#52525b",
  dim:         "#71717a",
  text:        "#e4e4e7",
  textBright:  "#f4f4f5",
  amber:       "#f59e0b",
  green:       "#22c55e",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  blue:        "#3b82f6",
};
const ACCENT = T.purple;

// ── Category definitions ──────────────────────────────────────────────────────
const ETHICS_CATS = [
  { id: "GS4-ETH-GOV",     label: "Public Service",    icon: "🏛️", desc: "Civil servant values, governance, accountability" },
  { id: "GS4-ETH-HV",      label: "Human Values",      icon: "🌿", desc: "Ethics, integrity, family, social values" },
  { id: "GS4-ETH-PROB",    label: "Probity",           icon: "⚖️", desc: "Integrity, transparency, whistle-blowing" },
  { id: "GS4-ETH-EI",      label: "Emotional Intel.",  icon: "💡", desc: "EI in administration, empathy, self-awareness" },
  { id: "GS4-ETH-ATT",     label: "Attitude",          icon: "🧭", desc: "Content, structure, function, role in life" },
  { id: "GS4-ETH-APPLIED", label: "Applied Ethics",    icon: "⚙️", desc: "Contemporary, digital, governance dilemmas" },
  { id: "GS4-ETH-THINK",   label: "Thinkers",          icon: "📚", desc: "Gandhi, Aristotle, Kant, Rawls" },
  { id: "GS4-ETH-CS",      label: "Case Studies",      icon: "🔍", desc: "Administrative dilemmas, ethical conflicts" },
];
const TYPE_LABELS = { ETHICS_THEORY: "Theory", QUOTE_BASED: "Quote", SHORT_NOTE: "Short Note" }

// Maps raw dataset syllabusNodeId values → canonical UI category ids.
// All ids emitted here MUST match one of the ETHICS_CATS[].id values above.
const CARD_IDS = new Set(["GS4-ETH-GOV","GS4-ETH-HV","GS4-ETH-PROB","GS4-ETH-EI","GS4-ETH-ATT","GS4-ETH-APPLIED","GS4-ETH-THINK","GS4-ETH-CS"]);

function normalizeCategoryId(q) {
  const nid = (q?.syllabusNodeId || "").trim();
  // Alias map: raw dataset node → canonical card id
  if (nid === "GS4-ETH-HUM")      return "GS4-ETH-HV";      // Human Values (legacy alias)
  if (nid === "GS4-ETH-FOUND")    return "GS4-ETH-HV";      // Foundations of Ethics → Human Values
  if (nid === "GS4-ETH-ATTITUDE") return "GS4-ETH-ATT";     // Attitude
  if (nid === "GS4-ETH-CONFLICT") return "GS4-ETH-GOV";     // Conflict of interest → Public Service
  if (nid.startsWith("GS4-CASE-") || q?.type === "CASE_STUDY") return "GS4-ETH-CS"; // Case Studies
  if (nid.startsWith("GS4-ETH-AP-")) return "GS4-ETH-APPLIED"; // Applied Ethics
  return nid; // Pass-through for already-canonical ids (GS4-ETH-GOV, GS4-ETH-PROB, GS4-ETH-EI, GS4-ETH-THINK)
}
const TYPE_FILTERS = [
  { v: "all",           l: "All Types" },
  { v: "ETHICS_THEORY", l: "Theory" },
  { v: "QUOTE_BASED",   l: "Quote" },
  { v: "SHORT_NOTE",    l: "Short Note" },
];
const MARKS_FILTERS = [{ v: "all", l: "All" }, { v: "10", l: "10M" }, { v: "2", l: "2M" }];

// ── Prompts ───────────────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `You are a UPSC GS Paper IV (Ethics, Integrity & Aptitude) expert.

TASK: Deep analysis of the provided ethics question.

RETURN:
1. QUESTION TYPE — Theory / Case Study / Hybrid / Thinker-based / Contemporary application
2. QUESTION DEMAND — What exactly is being asked? What ethical dimensions are embedded?
3. ETHICAL DIMENSIONS — Identify all relevant ethical angles: integrity, empathy, objectivity, conflict of interest, public service values, etc.
4. STAKEHOLDERS — Who are the affected parties? What are their competing interests?
5. TOPPER THINKING — How should a top scorer structure their thinking? What is the ethical reasoning chain?
6. IDEAL STRUCTURE — Give a specific outline: Introduction → ethical dimensions → dilemmas → resolution → conclusion
7. THINKERS / CONCEPTS — Which ethical thinkers or concepts are most relevant? (Gandhi, Kant, Aristotle, Rawls, etc.)
8. COMMON MISTAKES — What do average candidates typically miss?
9. ANSWER STRATEGY — Final advice on tone, balance, and practical-administrative grounding.

QUESTION: [paste question here]`;

const SOURCE_PROMPT = `You are a UPSC question forensics expert specializing in GS Paper IV.

TASK: Identify the likely SOURCE TRADITION of the given Ethics/GS4 question.

ANALYZE AND CLASSIFY:
1. LIKELY SOURCE — Which tradition does it most resemble?
   - Standard UPSC GS4 theory (ARC reports, ethics committee frameworks)
   - Philosophical tradition (Kantian, Utilitarian, Virtue ethics framing)
   - Public administration / governance framing
   - Contemporary dilemma / news-event driven
   - Case study bank / coaching module style
   - PYQ-derived reframe from past UPSC papers
   - Generic compilation / model test style

2. SOURCE CLUES — Which features indicate this?
3. CONFIDENCE — How confident? If uncertain, rank top 2-3 likely traditions.
4. PREPARATION IMPLICATION — What material / approach should be prioritized?

QUESTION: [paste question here]`;

// ── Shared workspace components ───────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ background: copied ? "#1a3a1a" : "#1a1a1a", border: `1px solid ${copied ? "#22c55e" : "#333"}`, color: copied ? "#22c55e" : "#aaa", borderRadius: 5, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s" }}>
      {copied ? "✓ Copied" : "Copy Prompt"}
    </button>
  );
};
const PromptPanel = ({ title, prompt, visible }) => {
  if (!visible) return null;
  return (
    <div style={{ background: "#0a1a0a", border: "1px solid #1e3a1e", borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</span>
        <CopyButton text={prompt} />
      </div>
      <pre style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, background: "#050f05", borderRadius: 6, padding: 14, border: "1px solid #1a2e1a", maxHeight: 280, overflowY: "auto" }}>{prompt}</pre>
    </div>
  );
};
const SectionCard = ({ title, subtitle, children }) => (
  <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "20px 22px", marginBottom: 20 }}>
    {title && <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{title}</div>}
    {subtitle && <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>{subtitle}</div>}
    {children}
  </div>
);
const TogglePill = ({ label, active, onToggle }) => (
  <button onClick={onToggle} style={{ background: active ? "#1a1200" : "#0a0a0a", border: `1px solid ${active ? "#f59e0b" : "#2a2a2a"}`, color: active ? "#f59e0b" : "#555", borderRadius: 20, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s" }}>{active ? "✓ " : ""}{label}</button>
);

// ── Explorer UI components ────────────────────────────────────────────────────
function StatPill({ label, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>{label}</span>;
}
function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 7, border: active ? `1.5px solid ${ACCENT}` : `1px solid ${T.borderMid}`, background: active ? `${ACCENT}18` : T.surface, color: active ? ACCENT : T.dim, fontWeight: active ? 800 : 500, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
      {label}
    </button>
  );
}
function CategoryCard({ cat, active, count, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: "1 1 130px", background: active ? `${ACCENT}12` : T.surface, border: active ? `1.5px solid ${ACCENT}55` : `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", fontFamily: "monospace", textAlign: "left", transition: "all 0.12s" }}>
      <div style={{ fontSize: 18, marginBottom: 5 }}>{cat.icon}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: active ? ACCENT : T.textBright, marginBottom: 3 }}>{cat.label}</div>
      <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.4, marginBottom: 5 }}>{cat.desc}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: active ? ACCENT : T.subtle }}>{count} Qs</div>
    </button>
  );
}

// ── Focus card (primary selection display) ────────────────────────────────────
function FocusCard({ selectedQ, onClear }) {
  if (!selectedQ) {
    return (
      <div style={{ background: T.surfaceHigh, border: `1px dashed ${T.borderMid}`, borderRadius: 12, padding: "18px 22px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 18, opacity: 0.3, flexShrink: 0 }}>←</div>
        <div>
          <div style={{ fontSize: 13, color: T.dim, fontWeight: 700 }}>Select a question from the list</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>It will appear here and populate the workspace below</div>
        </div>
      </div>
    );
  }
  const typeLabel = TYPE_LABELS[selectedQ.type] || selectedQ.type || "";
  const catLabel = ETHICS_CATS.find(c => c.id === normalizeCategoryId(selectedQ))?.label || "";
  return (
    <div style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${ACCENT}22, ${ACCENT}0a)`, border: `2px solid ${ACCENT}77`, borderLeft: `4px solid ${ACCENT}`, borderRadius: 12, padding: "24px 28px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: "0.12em", textTransform: "uppercase" }}>✓ Selected Question</span>
            {selectedQ.year && <span style={{ fontSize: 10, fontWeight: 800, color: T.amber, background: `${T.amber}14`, border: `1px solid ${T.amber}30`, borderRadius: 5, padding: "2px 8px" }}>UPSC {selectedQ.year}</span>}
            {typeLabel && <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}16`, border: `1px solid ${ACCENT}35`, borderRadius: 5, padding: "2px 8px" }}>{typeLabel}</span>}
            {selectedQ.marks && <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: `${T.green}10`, border: `1px solid ${T.green}28`, borderRadius: 5, padding: "2px 8px" }}>{selectedQ.marks}M</span>}
            {catLabel && <span style={{ fontSize: 10, color: T.subtle }}>{catLabel}</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.textBright, lineHeight: 1.75 }}>{selectedQ.question}</div>
        </div>
        <button onClick={onClear} style={{ background: "none", border: `1px solid ${T.borderMid}`, borderRadius: 6, color: T.dim, fontSize: 12, cursor: "pointer", padding: "4px 10px", fontFamily: "monospace", flexShrink: 0 }}>Clear ×</button>
      </div>
    </div>
  );
}

// ── Question row ──────────────────────────────────────────────────────────────
function QuestionRow({ q, onSelect, selected }) {
  const typeLabel = TYPE_LABELS[q.type] || q.type || "";
  const catLabel = ETHICS_CATS.find(c => c.id === normalizeCategoryId(q))?.label || "";
  return (
    <div
      onClick={() => onSelect(q)}
      style={{
        background: selected ? `${ACCENT}14` : T.surface,
        border: `${selected ? "1.5px" : "1px"} solid ${selected ? ACCENT : T.border}`,
        borderRadius: 8,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.12s",
        marginBottom: 6,
        boxShadow: selected ? `0 0 0 1px ${ACCENT}33` : "none",
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor = `${ACCENT}55`; e.currentTarget.style.background = `${ACCENT}08`; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; } }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${ACCENT}${selected ? "cc" : "55"}, transparent)` }} />
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          {q.year && <span style={{ fontSize: 10, fontWeight: 800, color: T.amber }}>{q.year}</span>}
          {typeLabel && <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700 }}>{typeLabel}</span>}
          {q.marks && <span style={{ fontSize: 10, color: T.green }}>{q.marks}M</span>}
          {catLabel && <span style={{ fontSize: 10, color: T.subtle, marginLeft: "auto" }}>{catLabel}</span>}
          {selected && <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT }}>✓</span>}
        </div>
        <div style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: selected ? T.textBright : T.text, lineHeight: 1.6 }}>
          {(q.question || "").slice(0, 140)}{(q.question || "").length > 140 ? "…" : ""}
        </div>
      </div>
    </div>
  );
}

// ── Action bar ────────────────────────────────────────────────────────────────
function ActionBar({ selectedQ, weak, onWeakToggle, revision, onRevisionToggle }) {
  const navigate = useNavigate();
  const [promptCopied, setPromptCopied] = useState(false);
  const hasQ = !!selectedQ;

  function handleStartWriting() {
    if (!hasQ) return;
    navigate("/mains/answer-writing", {
      state: {
        question: {
          paper:    "GS4",
          mode:     "PYQ",
          marks:    selectedQ.marks != null ? String(selectedQ.marks) : "",
          year:     selectedQ.year || null,
          priority: selectedQ.year ? `UPSC ${selectedQ.year} · GS4 Ethics` : "GS4 Ethics · PYQ",
          question: selectedQ.question,
          focus:    "",
          structure: "",
        },
      },
    });
  }

  function handleOpenChatGPT() {
    if (!hasQ) return;
    const full = ANALYZE_PROMPT.replace("[paste question here]", selectedQ.question || "");
    navigator.clipboard.writeText(full).catch(() => {});
    window.open("https://chatgpt.com", "_blank", "noopener,noreferrer");
  }

  function handleCopyPrompt() {
    if (!hasQ) return;
    const full = ANALYZE_PROMPT.replace("[paste question here]", selectedQ.question || "");
    navigator.clipboard.writeText(full);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 1800);
  }

  const base = {
    borderRadius: 7, padding: "7px 14px", fontSize: 11, cursor: "pointer",
    fontFamily: "monospace", fontWeight: 600, transition: "all 0.15s",
    border: `1px solid ${T.borderMid}`, whiteSpace: "nowrap",
  };
  const primary = {
    ...base,
    background: hasQ ? ACCENT : T.muted,
    border: `1px solid ${hasQ ? ACCENT : T.muted}`,
    color: hasQ ? "#fff" : T.dim,
    opacity: hasQ ? 1 : 0.45,
    cursor: hasQ ? "pointer" : "not-allowed",
  };
  const secondary = (active) => ({
    ...base,
    background: active ? `${ACCENT}18` : T.surface,
    border: `1px solid ${active ? `${ACCENT}55` : T.borderMid}`,
    color: active ? ACCENT : (hasQ ? T.text : T.dim),
    opacity: hasQ || active ? 1 : 0.45,
    cursor: "pointer",
  });
  const toggle = (active, activeColor) => ({
    ...base,
    background: active ? `${activeColor}18` : T.surface,
    border: `1px solid ${active ? `${activeColor}55` : T.borderMid}`,
    color: active ? activeColor : T.dim,
    cursor: "pointer",
  });

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center",
      background: T.surfaceHigh, border: `1px solid ${T.borderMid}`,
      borderRadius: 10, padding: "10px 14px", marginBottom: 20,
    }}>
      <button onClick={handleStartWriting} disabled={!hasQ} style={primary}>
        ✏️ Start Writing
      </button>
      <button onClick={handleOpenChatGPT} disabled={!hasQ} style={secondary(false)}>
        ↗ Open ChatGPT
      </button>
      <button onClick={handleCopyPrompt} disabled={!hasQ} style={secondary(promptCopied)}>
        {promptCopied ? "✓ Copied" : "⎘ Copy Prompt"}
      </button>
      <div style={{ width: 1, height: 20, background: T.borderMid, alignSelf: "center", margin: "0 2px" }} />
      <button onClick={onWeakToggle} style={toggle(weak, T.red)}>
        {weak ? "✓ Weak" : "⚑ Mark Weak"}
      </button>
      <button onClick={onRevisionToggle} style={toggle(revision, T.amber)}>
        {revision ? "✓ Revision" : "⟳ Add to Revision"}
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ height: 8, width: "22%", borderRadius: 4, background: `${T.muted}30`, marginBottom: 8 }} />
          <div style={{ height: 11, width: "90%", borderRadius: 4, background: `${T.muted}30` }} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PAPERS = ["GS Paper IV - Section A", "GS Paper IV - Section B (Case Studies)"];
const QUESTION_TYPES = ["Theory", "Case Study", "Thinker-Based", "Contemporary", "Hybrid"];

export default function EthicsPyqPage() {
  // workspace state
  const [question, setQuestion] = useState("");
  const [source,   setSource]   = useState("");
  const [year,     setYear]     = useState("");
  const [paper,    setPaper]    = useState("");
  const [qtype,    setQtype]    = useState("");
  const [showAnalyze,     setShowAnalyze]     = useState(false);
  const [showSource,      setShowSource]      = useState(false);
  const [savedAnalysis,   setSavedAnalysis]   = useState("");
  const [savedSourceNote, setSavedSourceNote] = useState("");
  const [weak,     setWeak]     = useState(false);
  const [review,   setReview]   = useState(false);
  const [revision, setRevision] = useState(false);

  // explorer state
  const [pyqList,   setPyqList]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [typeFilter,     setTypeFilter]     = useState("all");
  const [marksFilter,    setMarksFilter]    = useState("all");
  const [searchText,     setSearchText]     = useState("");
  const [selectedId,     setSelectedId]     = useState(null);
  const [selectedQ,      setSelectedQ]      = useState(null);

  // responsive
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const workspaceRef = useRef(null);

  function fetchQuestions() {
    setLoading(true); setError(null);
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=ethics`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { console.log("[ethics-pyq]", data); setPyqList(Array.isArray(data?.questions) ? data.questions : []); })
      .catch(err => { console.error("[ethics-pyq]", err); setError(err.message || "Backend error"); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { fetchQuestions(); }, []);

  const catCounts = useMemo(() => {
    const m = {};
    ETHICS_CATS.forEach(c => { m[c.id] = 0; }); // seed all to 0
    const uncategorized = [];
    pyqList.forEach(q => {
      const key = normalizeCategoryId(q);
      if (key in m) {
        m[key]++;
      } else {
        uncategorized.push({ id: q.id, syllabusNodeId: q.syllabusNodeId, resolvedKey: key });
      }
    });
    if (uncategorized.length > 0) {
      console.warn("[ethics-pyq] uncategorized questions (not shown in UI):", uncategorized);
    }
    return m;
  }, [pyqList]);

  const filtered = useMemo(() => pyqList.filter(q => {
    if (activeCategory !== "all" && normalizeCategoryId(q) !== activeCategory) return false;
    if (typeFilter     !== "all" && q.type !== typeFilter) return false;
    if (marksFilter    !== "all" && String(q.marks) !== marksFilter) return false;
    if (searchText) { const s = searchText.toLowerCase(); if (!(q.question || "").toLowerCase().includes(s)) return false; }
    return true;
  }), [pyqList, activeCategory, typeFilter, marksFilter, searchText]);

  function handleSelect(q) {
    setQuestion(q.question || "");
    setYear(String(q.year || ""));
    setSource(`UPSC ${q.year || ""}`);
    if (q.section) setPaper(`GS Paper IV - Section ${q.section}`);
    if (q.type) setQtype(TYPE_LABELS[q.type] || q.type);
    setSelectedId(q.id);
    setSelectedQ(q);
    // on mobile scroll workspace into view; on desktop it's already visible
    if (isMobile) workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function handleClear() {
    setSelectedId(null); setSelectedQ(null);
    setQuestion(""); setYear(""); setSource(""); setPaper(""); setQtype("");
  }

  const s = {
    page:     { background: "#080808", minHeight: "100vh", padding: "24px 28px", fontFamily: "monospace", color: "#e5e7eb" },
    textarea: { width: "100%", background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6, color: "#ccc", fontSize: 12, padding: "10px 12px", fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box" },
    label:    { fontSize: 11, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" },
    select:   { background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "8px 10px", fontFamily: "monospace", outline: "none" },
    input:    { background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 6, color: "#aaa", fontSize: 12, padding: "8px 10px", fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" },
    btn:      (ac) => ({ background: ac ? "#f59e0b" : "#111", border: `1px solid ${ac ? "#f59e0b" : "#2a2a2a"}`, color: ac ? "#000" : "#aaa", borderRadius: 6, padding: "8px 16px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: ac ? 700 : 500 }),
    grid2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  };

  // ── Header height offset for sticky calc ─────────────────────────────────────
  // Page header + hero + category cards + filters ≈ 260px
  const LIST_HEIGHT = "calc(100vh - 260px)";

  return (
    <div style={s.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 5 }}>ETHICS · GS PAPER IV · PYQ</div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Ethics PYQ</h1>
      </div>

      {/* ── Hero stats ─────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, #0d0a1a, #0a0a12)`, border: `1px solid ${ACCENT}22`, borderRadius: 12, padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {loading ? <span style={{ fontSize: 11, color: T.dim }}>Loading…</span> : error ? <span style={{ fontSize: 11, color: T.red }}>Failed to load</span> : (
            <>
              <StatPill label={`${pyqList.length} Questions`} color={T.textBright} />
              <StatPill label={`${pyqList.filter(q => q.type === "ETHICS_THEORY").length} Theory`} color={ACCENT} />
              <StatPill label={`${pyqList.filter(q => q.type === "QUOTE_BASED").length} Quote`} color={T.blue} />
              <StatPill label={`${pyqList.filter(q => q.marks === 10).length} × 10M`} color={T.green} />
            </>
          )}
          <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search questions…"
            style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 7, color: T.text, fontSize: 11, padding: "6px 10px", fontFamily: "monospace", outline: "none", width: 200, marginLeft: "auto" }} />
        </div>
      </div>

      {/* ── Category cards ─────────────────────────────────────────────────── */}
      <div style={{ fontSize: 10, color: T.subtle, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>Filter by Category</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => setActiveCategory("all")} style={{ flex: "0 0 auto", background: activeCategory === "all" ? `${ACCENT}12` : T.surface, border: activeCategory === "all" ? `1.5px solid ${ACCENT}55` : `1px solid ${T.border}`, borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontFamily: "monospace", fontSize: 11, fontWeight: activeCategory === "all" ? 800 : 500, color: activeCategory === "all" ? ACCENT : T.dim }}>
          All
        </button>
        {ETHICS_CATS.map(cat => (
          <CategoryCard key={cat.id} cat={cat} active={activeCategory === cat.id} count={catCounts[cat.id] || 0}
            onClick={() => setActiveCategory(prev => prev === cat.id ? "all" : cat.id)} />
        ))}
      </div>

      {/* ── Filter pills ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 5 }}>{TYPE_FILTERS.map(f => <FilterPill key={f.v} label={f.l} active={typeFilter === f.v} onClick={() => setTypeFilter(f.v)} />)}</div>
        <div style={{ width: 1, height: 14, background: T.borderMid }} />
        <div style={{ display: "flex", gap: 5 }}>{MARKS_FILTERS.map(f => <FilterPill key={f.v} label={f.l} active={marksFilter === f.v} onClick={() => setMarksFilter(f.v)} />)}</div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SPLIT VIEW — Question List (left) + Workspace (right)
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={isMobile
        ? { display: "flex", flexDirection: "column", gap: 20 }
        : { display: "grid", gridTemplateColumns: "400px 1fr", gap: 20, alignItems: "start" }
      }>

        {/* ── LEFT: Question List Panel ──────────────────────────────────── */}
        <div style={isMobile ? {} : { position: "sticky", top: 24 }}>
          {/* Panel header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Question Bank</div>
              <div style={{ fontSize: 11, color: T.muted }}>
                {loading ? "Loading…" : `${filtered.length} question${filtered.length !== 1 ? "s" : ""}`}
              </div>
            </div>
            {selectedId && (
              <button onClick={handleClear} style={{ background: "none", border: `1px solid ${T.borderMid}`, borderRadius: 6, color: T.dim, fontSize: 11, cursor: "pointer", padding: "3px 10px", fontFamily: "monospace" }}>Clear ×</button>
            )}
          </div>

          {/* Scrollable list */}
          <div style={{ height: isMobile ? "auto" : LIST_HEIGHT, overflowY: isMobile ? "visible" : "auto", paddingRight: isMobile ? 0 : 4 }}>
            {loading && <LoadingSkeleton />}
            {!loading && error && (
              <div style={{ padding: "28px", textAlign: "center", border: `1px solid ${T.red}33`, borderRadius: 10, background: `${T.red}08` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 8 }}>{error}</div>
                <button onClick={fetchQuestions} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, padding: "6px 16px", cursor: "pointer", fontFamily: "monospace" }}>Retry</button>
              </div>
            )}
            {!loading && !error && filtered.length === 0 && pyqList.length > 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", border: `1px dashed ${T.borderMid}`, borderRadius: 10 }}>
                <div style={{ fontSize: 13, color: T.subtle, fontWeight: 600 }}>No questions match this filter</div>
              </div>
            )}
            {!loading && !error && filtered.map(q => (
              <QuestionRow key={q.id} q={q} onSelect={handleSelect} selected={q.id === selectedId} />
            ))}
          </div>
        </div>

        {/* ── RIGHT: Workspace ──────────────────────────────────────────────── */}
        <div ref={workspaceRef}>

          {/* Focus card — sticky on desktop, normal flow on mobile */}
          <div style={isMobile ? {} : {
            position: "sticky",
            top: 24,
            zIndex: 20,
            background: "rgba(7, 7, 9, 0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 14,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${ACCENT}22, 0 1px 0 rgba(255,255,255,0.03)`,
          }}>
            <FocusCard selectedQ={selectedQ} onClear={handleClear} />
          </div>

          {/* Action bar */}
          <ActionBar
            selectedQ={selectedQ}
            weak={weak}       onWeakToggle={() => setWeak(v => !v)}
            revision={revision} onRevisionToggle={() => setRevision(v => !v)}
          />

          {/* Workspace zone header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT, letterSpacing: "0.15em", textTransform: "uppercase" }}>Workspace</div>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${ACCENT}44, transparent)` }} />
          </div>

          {/* Workspace grid */}
          <div style={isMobile ? { display: "flex", flexDirection: "column" } : s.grid2}>
            <div>
              <SectionCard title="Question Workspace" subtitle="Paste question + optional metadata">
                <span style={s.label}>Question Text</span>
                <textarea rows={5} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Paste ethics / GS4 question here…" style={{ ...s.textarea, marginBottom: 12 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div><span style={s.label}>Year</span><input value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2022" style={s.input} /></div>
                  <div><span style={s.label}>Source</span><input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. UPSC 2022" style={s.input} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><span style={s.label}>Paper / Section</span>
                    <select value={paper} onChange={e => setPaper(e.target.value)} style={{ ...s.select, width: "100%" }}>
                      <option value="">Select</option>{PAPERS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><span style={s.label}>Question Type</span>
                    <select value={qtype} onChange={e => setQtype(e.target.value)} style={{ ...s.select, width: "100%" }}>
                      <option value="">Select</option>{QUESTION_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </SectionCard>
              <SectionCard title="ChatGPT Analysis" subtitle="Reveal copy-ready prompts for ChatGPT">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => { setShowAnalyze(v => !v); setShowSource(false); }} style={s.btn(true)}>⚡ Evaluate / Analyze This Question</button>
                  <button onClick={() => { setShowSource(v => !v); setShowAnalyze(false); }} style={s.btn(false)}>🔍 Find Question Source Tradition</button>
                </div>
                <PromptPanel title="Ethics Question Analysis Prompt" prompt={ANALYZE_PROMPT} visible={showAnalyze} />
                <PromptPanel title="Source Tradition Prompt" prompt={SOURCE_PROMPT} visible={showSource} />
              </SectionCard>
              <SectionCard title="Question Flags" subtitle="Tag this question for tracking">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <TogglePill label="Mark as Weak"           active={weak}     onToggle={() => setWeak(v => !v)} />
                  <TogglePill label="Add to Mistake Review"  active={review}   onToggle={() => setReview(v => !v)} />
                  <TogglePill label="Add to Future Revision" active={revision} onToggle={() => setRevision(v => !v)} />
                </div>
              </SectionCard>
            </div>
            <div>
              <SectionCard title="Saved ChatGPT Analysis" subtitle="Paste ChatGPT output here to save locally">
                <textarea rows={9} value={savedAnalysis} onChange={e => setSavedAnalysis(e.target.value)} placeholder="Paste ChatGPT ethics question analysis here…" style={s.textarea} />
                {savedAnalysis && <div style={{ marginTop: 8 }}><CopyButton text={savedAnalysis} /></div>}
              </SectionCard>
              <SectionCard title="Saved Source-Fit Note" subtitle="Paste source tradition output here">
                <textarea rows={9} value={savedSourceNote} onChange={e => setSavedSourceNote(e.target.value)} placeholder="Paste source-fit analysis from ChatGPT here…" style={s.textarea} />
                {savedSourceNote && <div style={{ marginTop: 8 }}><CopyButton text={savedSourceNote} /></div>}
              </SectionCard>
              <div style={{ background: "#0a0f0a", border: "1px solid #1a2a1a", borderRadius: 8, padding: "12px 16px", fontSize: 11, color: "#444" }}>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>Tip: </span>
                GS4 case studies demand stakeholder identification + ethical framework + practical administrative resolution.
              </div>
            </div>
          </div>

        </div>
        {/* end RIGHT */}

      </div>
      {/* end split view */}

    </div>
  );
}
