import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../../config.js";
import "../../styles/ethics-workspace.css";

const CATS = [
  { id: "GS4-ETH-HV", label: "Ethics & Human Interface", icon: "◉", desc: "Essence, determinants, human values" },
  { id: "GS4-ETH-ATT", label: "Attitude", icon: "◎", desc: "Structure, function, persuasion" },
  { id: "GS4-ETH-APPLIED", label: "Aptitude & Values", icon: "◇", desc: "Integrity, objectivity, empathy" },
  { id: "GS4-ETH-EI", label: "Emotional Intelligence", icon: "◌", desc: "Self-awareness and administration" },
  { id: "GS4-ETH-THINK", label: "Moral Thinkers", icon: "◫", desc: "Ideas and ethical application" },
  { id: "GS4-ETH-GOV", label: "Civil Service Values", icon: "▦", desc: "Public service and accountability" },
  { id: "GS4-ETH-PROB", label: "Probity", icon: "◇", desc: "Integrity, transparency, corruption" },
  { id: "GS4-ETH-CS", label: "Case Studies", icon: "▤", desc: "Dilemmas and administrative choices" },
];

const TYPE_LABELS = { ETHICS_THEORY: "Theory", QUOTE_BASED: "Quote", SHORT_NOTE: "Short Note", CASE_STUDY: "Case Study" };

function normalizeCategoryId(q) {
  const nid = String(q?.syllabusNodeId || q?.nodeId || "").trim();
  if (nid === "GS4-ETH-HUM" || nid === "GS4-ETH-FOUND") return "GS4-ETH-HV";
  if (nid === "GS4-ETH-ATTITUDE") return "GS4-ETH-ATT";
  if (nid === "GS4-ETH-CONFLICT") return "GS4-ETH-GOV";
  if (nid.startsWith("GS4-CASE-") || q?.type === "CASE_STUDY") return "GS4-ETH-CS";
  if (nid.startsWith("GS4-ETH-AP-")) return "GS4-ETH-APPLIED";
  return nid;
}

function wordLimitFor(q) {
  const direct = Number(q?.wordLimit || q?.word_limit || q?.words);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const marks = Number(q?.marks);
  if (marks === 10) return 150;
  if (marks >= 15) return 250;
  return null;
}

export default function EthicsPyqPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [type, setType] = useState(searchParams.get("type") || (searchParams.get("mode") === "theory" ? "ETHICS_THEORY" : "all"));
  const [marks, setMarks] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const PAGE_SIZE = 8;

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/subject-pyq?subject=ethics`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (e) { setError(e.message || "Could not load Ethics PYQs"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [category, type, marks, search, sort]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(CATS.map(c => [c.id, 0]));
    questions.forEach(q => { const id = normalizeCategoryId(q); if (id in map) map[id] += 1; });
    return map;
  }, [questions]);

  const availableMarks = useMemo(() => [...new Set(questions.map(q => Number(q.marks)).filter(Number.isFinite))].sort((a, b) => a - b), [questions]);
  const filtered = useMemo(() => {
    const list = questions.filter(q => {
      if (category !== "all" && normalizeCategoryId(q) !== category) return false;
      if (type !== "all" && q.type !== type) return false;
      if (marks !== "all" && String(q.marks) !== marks) return false;
      if (search && !String(q.question || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    return list.sort((a, b) => sort === "oldest" ? (Number(a.year) || 0) - (Number(b.year) || 0) : (Number(b.year) || 0) - (Number(a.year) || 0));
  }, [questions, category, type, marks, search, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const years = questions.map(q => Number(q.year)).filter(Number.isFinite);
  const latestYear = years.length ? Math.max(...years) : null;

  function start(q) {
    const cat = CATS.find(c => c.id === normalizeCategoryId(q));
    const normalized = {
      id: q.id,
      paper: "GS4",
      year: q.year || null,
      question: q.question,
      marks: q.marks != null ? String(q.marks) : "",
      wordLimit: wordLimitFor(q),
      structure: q.structure || TYPE_LABELS[q.type] || q.type || "",
      focus: cat?.label || "Ethics",
      priority: "UPSC Ethics PYQ · High Priority",
      subparts: Array.isArray(q.subparts) ? q.subparts : [],
      syllabusNodeId: normalizeCategoryId(q),
      nodeId: normalizeCategoryId(q),
      source: `UPSC ${q.year || ""}`.trim(),
    };
    navigate("/mains/answer-writing", { state: { paper: "GS4", mode: "PYQ", year: q.year || null, topic: cat?.label || "Ethics", syllabusNodeId: normalizeCategoryId(q), questions: [normalized], currentIndex: 0, question: normalized } });
  }

  return (
    <div className="eth-page"><div className="eth-shell">
      <header className="eth-explorer-head"><div><div className="eth-kicker">Ethics · GS Paper IV · PYQ Explorer</div><h1 className="eth-title">Ethics PYQs</h1><p className="eth-subtitle">Browse real UPSC theory, quote-based and case-study questions by GS4 syllabus area.</p></div><button className="eth-back" onClick={() => navigate("/ethics")} aria-label="Back">←</button></header>
      <div className="eth-explorer-stats"><span className="eth-meta-pill"><span className="eth-meta-dot" />{questions.length} Questions</span><span className="eth-meta-pill">{questions.filter(q => q.type === "ETHICS_THEORY").length} Theory</span><span className="eth-meta-pill">{counts["GS4-ETH-CS"] || 0} Case Studies</span>{latestYear && <span className="eth-meta-pill">Through {latestYear}</span>}</div>

      <section className="eth-section"><div className="eth-section-head"><div><h2 className="eth-section-title">Browse by Syllabus Area</h2><p className="eth-section-copy">Select a capability, then narrow by type or marks.</p></div></div><div className="eth-syllabus-grid"><button className={`eth-syllabus-card ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}><div className="eth-syllabus-icon">▦</div><div className="eth-syllabus-name">All Areas</div><div className="eth-syllabus-count">{questions.length} questions</div></button>{CATS.map(c => <button key={c.id} className={`eth-syllabus-card ${category === c.id ? "active" : ""}`} onClick={() => setCategory(category === c.id ? "all" : c.id)}><div className="eth-syllabus-icon">{c.icon}</div><div className="eth-syllabus-name">{c.label}</div><div className="eth-syllabus-count">{counts[c.id] || 0} questions</div></button>)}</div></section>

      <section className="eth-section"><div className="eth-card eth-filter-bar"><input className="eth-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ethics questions…" /><button className={`eth-filter-chip ${type === "all" ? "active" : ""}`} onClick={() => setType("all")}>All Types</button>{["ETHICS_THEORY","QUOTE_BASED","SHORT_NOTE","CASE_STUDY"].filter(t => questions.some(q => q.type === t)).map(t => <button key={t} className={`eth-filter-chip ${type === t ? "active" : ""}`} onClick={() => setType(t)}>{TYPE_LABELS[t]}</button>)}<button className={`eth-filter-chip ${marks === "all" ? "active" : ""}`} onClick={() => setMarks("all")}>All Marks</button>{availableMarks.map(m => <button key={m} className={`eth-filter-chip ${marks === String(m) ? "active" : ""}`} onClick={() => setMarks(String(m))}>{m}M</button>)}<button className="eth-filter-chip" onClick={() => setSort(s => s === "latest" ? "oldest" : "latest")}>{sort === "latest" ? "Latest Year ↓" : "Oldest Year ↑"}</button></div></section>

      <section className="eth-section"><div className="eth-section-head"><div><h2 className="eth-section-title">{loading ? "Loading questions…" : `${filtered.length} Questions`}</h2><p className="eth-section-copy">Start directly in the unified MentorOS answer-writing workspace.</p></div></div>
        {error && <div className="eth-empty"><div className="eth-empty-title">Could not load Ethics PYQs</div><div className="eth-empty-copy">{error}</div><button className="eth-btn eth-btn-primary" style={{ marginTop: 12 }} onClick={load}>Retry</button></div>}
        {!loading && !error && !visible.length && <div className="eth-empty"><div className="eth-empty-title">No questions match these filters</div><div className="eth-empty-copy">Clear one or more filters to widen the question set.</div></div>}
        <div className="eth-question-list">{visible.map(q => { const cat = CATS.find(c => c.id === normalizeCategoryId(q)); const isOpen = openId === q.id; return <article key={q.id || `${q.year}-${q.question}`} className="eth-card eth-question-card"><div className="eth-question-top"><span className="eth-badge eth-badge-blue">PYQ</span>{q.year && <span className="eth-badge">UPSC {q.year}</span>}{q.marks != null && <span className="eth-badge">{q.marks}M</span>}<span className="eth-badge">{TYPE_LABELS[q.type] || q.type || "Ethics"}</span><span className="eth-question-category">{cat?.label || "GS4"}</span></div><div className="eth-question-text">{q.question}</div>{isOpen && <div className="eth-question-details">Focus: {cat?.desc || cat?.label || "Ethical reasoning and administrative application"}.{q.structure ? ` Suggested structure: ${q.structure}.` : ""}{wordLimitFor(q) ? ` Approx. ${wordLimitFor(q)} words.` : ""}</div>}<div className="eth-question-actions"><button className="eth-btn eth-btn-primary eth-btn-small" onClick={() => start(q)}>Start Writing</button><button className="eth-btn eth-btn-small" onClick={() => setOpenId(isOpen ? null : q.id)}>{isOpen ? "Hide Details" : "View Details"}</button></div></article>; })}</div>
        {!loading && !error && totalPages > 1 && <div className="eth-pagination"><button className="eth-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>{Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1).map((n, idx, arr) => <span key={n} style={{ display: "contents" }}>{idx > 0 && n - arr[idx-1] > 1 && <span style={{ color: "var(--text-tertiary)" }}>…</span>}<button className={`eth-page-btn ${page === n ? "active" : ""}`} onClick={() => setPage(n)}>{n}</button></span>)}<button className="eth-page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button></div>}
      </section>
    </div></div>
  );
}
