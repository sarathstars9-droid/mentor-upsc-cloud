import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config";

const PRIMARY = "#0A64F5";
const GREEN = "#16A34A";
const AMBER = "#F59E0B";

const GEO_CATS = [
  { id: "Geomorphology", label: "Geomorphology", paper: 1 },
  { id: "Climatology", label: "Climatology", paper: 1 },
  { id: "Oceanography", label: "Oceanography", paper: 1 },
  { id: "Biogeography", label: "Biogeography", paper: 1 },
  { id: "Perspectives in Human Geography", label: "Human Geography", paper: 1 },
  { id: "Models, Theories and Laws", label: "Models & Theories", paper: 1 },
  { id: "Economic Geography", label: "Economic Geography", paper: 1 },
  { id: "Population and Settlement Geography", label: "Population", paper: 1 },
  { id: "Regional Planning", label: "Regional Planning", paper: 1 },
  { id: "Physical Setting and Resources", label: "Physical India", paper: 2 },
  { id: "Agriculture", label: "Agriculture", paper: 2 },
  { id: "Industry", label: "Industry", paper: 2 },
  { id: "Settlements and Demography", label: "Settlements", paper: 2 },
  { id: "Regional Development and Planning", label: "Regional Development", paper: 2 },
  { id: "Contemporary Issues", label: "Contemporary Issues", paper: 2 },
  { id: "Transport, Communication and Trade", label: "Transport & Trade", paper: 2 },
  { id: "Cultural Setting", label: "Cultural Setting", paper: 2 },
  { id: "Political Aspects", label: "Political Aspects", paper: 2 },
];

const CATEGORY_RULES = {
  Geomorphology: { nodes: ["OPT-P1-GEOM"] },
  Climatology: { nodes: ["OPT-P1-CLIM"] },
  Oceanography: { nodes: ["OPT-P1-OCEAN"] },
  Biogeography: { nodes: ["OPT-P1-BIOGEO"] },
  "Perspectives in Human Geography": { nodes: ["OPT-P1-HG-PERSPECTIVES"] },
  "Models, Theories and Laws": { themes: ["Models, Theories and Laws"] },
  "Economic Geography": { themes: ["Economic Geography"] },
  "Population and Settlement Geography": { nodes: ["OPT-P1-SETTLEMENT"] },
  "Regional Planning": { nodes: ["OPT-P1-REGIONAL-PLANNING"] },
  "Physical Setting and Resources": { nodes: ["OPT-P2-INDIA-PHYS", "OPT-P2-RESOURCES"] },
  Agriculture: { nodes: ["OPT-P2-AGRI"] },
  Industry: { nodes: ["OPT-P2-INDUSTRY"] },
  "Settlements and Demography": { nodes: ["OPT-P2-SETTLEMENTS"] },
  "Regional Development and Planning": { nodes: ["OPT-P2-REGIONAL-DEV"] },
  "Contemporary Issues": { nodes: ["OPT-P2-CONTEMP"] },
  "Transport, Communication and Trade": { nodes: ["OPT-P2-TRANSPORT-TRADE"] },
  "Cultural Setting": { nodes: ["OPT-P2-CULTURAL"] },
  "Political Aspects": { nodes: ["OPT-P2-POLITICAL"] },
};

function detectTheme() {
  const html = document.documentElement;
  const body = document.body;
  const explicit = (html.getAttribute("data-theme") || body?.getAttribute("data-theme") || localStorage.getItem("theme") || localStorage.getItem("mentor-theme") || "").toLowerCase();
  if (explicit.includes("dark")) return "dark";
  if (explicit.includes("light")) return "light";
  if (html.classList.contains("dark") || body?.classList.contains("dark")) return "dark";
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
    return () => { observer.disconnect(); window.removeEventListener("storage", update); };
  }, []);
  return mode;
}

function makePalette(mode) {
  const dark = mode === "dark";
  return {
    dark,
    bg: dark ? "#07090D" : "#F6F8FB",
    surface: dark ? "#0D1117" : "#FFFFFF",
    surface2: dark ? "#111720" : "#F8FAFC",
    surface3: dark ? "#171E29" : "#EEF3F9",
    border: dark ? "#202A36" : "#E1E7EF",
    border2: dark ? "#2A3544" : "#CFD8E5",
    text: dark ? "#F7F9FC" : "#111827",
    text2: dark ? "#D5DCE7" : "#344054",
    muted: dark ? "#8A96A8" : "#667085",
    faint: dark ? "#5E6978" : "#98A2B3",
    primary: PRIMARY,
    primarySoft: dark ? "rgba(10,100,245,.14)" : "rgba(10,100,245,.075)",
    shadow: dark ? "none" : "0 12px 36px rgba(15,23,42,.055)",
  };
}

function normalize(v) { return String(v || "").trim(); }
function belongsToCategory(q, catId) {
  const rule = CATEGORY_RULES[catId] || { nodes: [], themes: [] };
  const node = normalize(q.syllabusNodeId);
  const theme = normalize(q.theme);
  return Boolean((rule.nodes || []).includes(node) || (rule.themes || []).includes(theme));
}
function belongsToPaper(q, paper) {
  if (paper === "all") return true;
  if (q.paperNumber) return String(q.paperNumber) === String(paper);
  return normalize(q.syllabusNodeId).startsWith(`OPT-P${paper}-`);
}

function answerState(q) {
  return {
    questionText: q?.question || q?.topic || "",
    year: q?.year || "",
    paper: "Geography Optional",
    marks: q?.marks || 15,
    topic: q?.theme || q?.sourceTopicBucket || "",
    subject: "Geography Optional",
    source: "PYQ",
    pyqId: q?.id || null,
  };
}

export default function GeographyOptionalPyqPage() {
  const navigate = useNavigate();
  const mode = useMentorTheme();
  const P = useMemo(() => makePalette(mode), [mode]);
  const [pyqs, setPyqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paper, setPaper] = useState("all");
  const [marks, setMarks] = useState("all");
  const [year, setYear] = useState("all");
  const [theme, setTheme] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedQ, setSelectedQ] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=geography_optional`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => setPyqs(Array.isArray(data?.questions) ? data.questions : []))
      .catch((e) => setError(e?.message || "Could not load Geography Optional PYQs"))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => [...new Set(pyqs.map((q) => q.year).filter(Boolean))].sort((a, b) => b - a), [pyqs]);
  const p1 = useMemo(() => pyqs.filter((q) => belongsToPaper(q, "1")).length, [pyqs]);
  const p2 = useMemo(() => pyqs.filter((q) => belongsToPaper(q, "2")).length, [pyqs]);
  const catCounts = useMemo(() => Object.fromEntries(GEO_CATS.map((c) => [c.id, pyqs.filter((q) => belongsToCategory(q, c.id)).length])), [pyqs]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pyqs.filter((q) => {
      if (!belongsToPaper(q, paper)) return false;
      if (marks !== "all" && String(q.marks) !== marks) return false;
      if (year !== "all" && String(q.year) !== year) return false;
      if (theme !== "all" && !belongsToCategory(q, theme)) return false;
      if (s) {
        const hay = [q.question, q.theme, q.directive, q.syllabusNodeId, q.year].join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    }).sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [pyqs, paper, marks, year, theme, search]);

  function openAnswer(q) {
    const state = answerState(q);
    sessionStorage.setItem("mains_pyq_metadata", JSON.stringify(state));
    navigate("/answer-writing/geography-optional/pyq", { state });
  }
  function openAnalysis(q) {
    navigate("/geography-optional/pyq-analysis", { state: { selectedPyqId: q?.id || null, selectedQuestion: q || null } });
  }

  const chip = (active) => ({ border: `1px solid ${active ? P.primary : P.border}`, background: active ? P.primarySoft : P.surface, color: active ? P.primary : P.muted, borderRadius: 8, padding: "7px 11px", cursor: "pointer", fontSize: 11, fontWeight: active ? 800 : 650, fontFamily: "inherit" });

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 28px 42px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: P.muted, fontSize: 10, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase" }}>Geography Optional · PYQs</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 31, fontWeight: 900, letterSpacing: "-.035em" }}>Geography Optional PYQs</h1>
            <div style={{ color: P.muted, fontSize: 12, marginTop: 5 }}>Find the question fast. Analyse the pattern. Write through the common MentorOS workspace.</div>
          </div>
          <button onClick={() => navigate("/geography-optional/pyq-analysis")} style={{ border: "none", background: P.primary, color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>PYQ Analysis →</button>
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 14, boxShadow: P.shadow, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 999, padding: "6px 11px", color: P.text2, fontSize: 11, fontWeight: 800 }}>{pyqs.length} Total</span>
            <span style={{ background: P.primarySoft, borderRadius: 999, padding: "6px 11px", color: P.primary, fontSize: 11, fontWeight: 800 }}>{p1} Paper 1</span>
            <span style={{ background: "rgba(245,158,11,.10)", borderRadius: 999, padding: "6px 11px", color: AMBER, fontSize: 11, fontWeight: 800 }}>{p2} Paper 2</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions, themes, directives..." style={{ marginLeft: "auto", minWidth: 260, flex: "0 1 360px", border: `1px solid ${P.border}`, background: P.surface2, color: P.text, borderRadius: 9, padding: "9px 11px", outline: "none" }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
          {[['all','All Papers'],['1','Paper 1'],['2','Paper 2']].map(([v,l]) => <button key={v} onClick={() => { setPaper(v); setTheme("all"); }} style={chip(paper === v)}>{l}</button>)}
          <span style={{ width: 1, background: P.border, margin: "0 3px" }} />
          {['all','10','15','20','25'].map((v) => <button key={v} onClick={() => setMarks(v)} style={chip(marks === v)}>{v === 'all' ? 'All Marks' : `${v}M`}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <button onClick={() => setYear('all')} style={chip(year === 'all')}>All Years</button>
          {years.map((y) => <button key={y} onClick={() => setYear(String(y))} style={chip(year === String(y))}>{y}</button>)}
        </div>

        <div style={{ color: P.muted, fontSize: 10, fontWeight: 850, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 8 }}>Browse by syllabus area</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTheme('all')} style={{ ...chip(theme === 'all'), textAlign: "left", padding: 13, minHeight: 72 }}><strong style={{ display: "block", color: theme === 'all' ? P.primary : P.text }}>All Themes</strong><span style={{ display: "block", marginTop: 5, color: P.muted }}>{pyqs.length} questions</span></button>
          {GEO_CATS.filter((c) => paper === 'all' || String(c.paper) === paper).map((c) => <button key={c.id} onClick={() => setTheme(c.id)} style={{ ...chip(theme === c.id), textAlign: "left", padding: 13, minHeight: 72 }}><strong style={{ display: "block", color: theme === c.id ? P.primary : P.text }}>{c.label}</strong><span style={{ display: "block", marginTop: 5, color: P.muted }}>P{c.paper} · {catCounts[c.id] || 0} questions</span></button>)}
        </div>

        {selectedQ ? (
          <div style={{ background: P.surface, border: `1px solid ${P.primary}55`, borderLeft: `4px solid ${P.primary}`, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: P.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ color: P.primary, fontSize: 10, fontWeight: 850 }}>SELECTED</span>
                  {selectedQ.year ? <span style={{ color: P.muted, fontSize: 10 }}>UPSC {selectedQ.year}</span> : null}
                  {selectedQ.paperNumber ? <span style={{ color: P.muted, fontSize: 10 }}>Paper {selectedQ.paperNumber}</span> : null}
                  {selectedQ.marks ? <span style={{ color: GREEN, fontSize: 10, fontWeight: 800 }}>{selectedQ.marks}M</span> : null}
                </div>
                <div style={{ color: P.text, fontSize: 15, lineHeight: 1.6, fontWeight: 750 }}>{selectedQ.question}</div>
                {selectedQ.theme ? <div style={{ color: P.muted, fontSize: 11, marginTop: 7 }}>{selectedQ.theme}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openAnalysis(selectedQ)} style={{ border: `1px solid ${P.border2}`, background: P.surface2, color: P.text2, borderRadius: 9, padding: "9px 13px", fontWeight: 800, cursor: "pointer" }}>Analyse</button>
                <button onClick={() => openAnswer(selectedQ)} style={{ border: "none", background: P.primary, color: "#fff", borderRadius: 9, padding: "9px 13px", fontWeight: 800, cursor: "pointer" }}>Write Answer →</button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 14, boxShadow: P.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 9 }}><div><strong style={{ fontSize: 15 }}>Question Bank</strong><div style={{ color: P.muted, fontSize: 10, marginTop: 2 }}>Select a question, analyse it or write immediately.</div></div><span style={{ color: P.muted, fontSize: 10 }}>{filtered.length} shown</span></div>
          {loading ? <div style={{ padding: 24, color: P.muted }}>Loading Geography Optional PYQs…</div> : null}
          {error ? <div style={{ padding: 24, color: "#EF4444" }}>{error}</div> : null}
          {!loading && !error && filtered.slice(0, 220).map((q) => {
            const active = selectedQ?.id === q.id;
            return <div key={q.id || `${q.year}-${q.question}`} style={{ border: `1px solid ${active ? P.primary : P.border}`, background: active ? P.primarySoft : P.surface2, borderRadius: 11, padding: "13px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <button onClick={() => setSelectedQ(q)} style={{ flex: 1, minWidth: 0, textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {q.year ? <span style={{ color: AMBER, fontSize: 10, fontWeight: 850 }}>{q.year}</span> : null}
                    {q.paperNumber ? <span style={{ color: P.primary, fontSize: 10, fontWeight: 800 }}>P{q.paperNumber}</span> : null}
                    {q.marks ? <span style={{ color: GREEN, fontSize: 10, fontWeight: 800 }}>{q.marks}M</span> : null}
                    {q.directive ? <span style={{ color: P.muted, fontSize: 10 }}>{q.directive}</span> : null}
                    {q.theme ? <span style={{ color: P.faint, fontSize: 10, marginLeft: "auto" }}>{q.theme}</span> : null}
                  </div>
                  <div style={{ color: P.text2, fontSize: 12.5, lineHeight: 1.55, fontWeight: active ? 750 : 600 }}>{q.question}</div>
                </button>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openAnalysis(q)} style={{ border: `1px solid ${P.border2}`, background: P.surface, color: P.text2, borderRadius: 8, padding: "7px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Analyse</button>
                  <button onClick={() => openAnswer(q)} style={{ border: "none", background: P.primary, color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Write Answer →</button>
                </div>
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
