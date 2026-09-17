import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config";

const PRIMARY = "#0A64F5";

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
function palette(mode) {
  const dark = mode === "dark";
  return {
    bg: dark ? "#07090D" : "#F6F8FB", surface: dark ? "#0D1117" : "#FFFFFF", surface2: dark ? "#111720" : "#F8FAFC",
    border: dark ? "#202A36" : "#E1E7EF", border2: dark ? "#2A3544" : "#CFD8E5", text: dark ? "#F7F9FC" : "#111827",
    text2: dark ? "#D5DCE7" : "#344054", muted: dark ? "#8A96A8" : "#667085", faint: dark ? "#5E6978" : "#98A2B3",
    primary: PRIMARY, primarySoft: dark ? "rgba(10,100,245,.14)" : "rgba(10,100,245,.075)", shadow: dark ? "none" : "0 12px 36px rgba(15,23,42,.055)"
  };
}
function directiveFamily(q) {
  const d = String(q?.directive || "").toLowerCase();
  const text = String(q?.question || "").toLowerCase();
  const all = `${d} ${text}`;
  if (all.includes("critically")) return "Critical / Evaluate";
  if (all.includes("compare") || all.includes("contrast") || all.includes("distinguish")) return "Compare";
  if (all.includes("analyse") || all.includes("analyze") || all.includes("examine")) return "Analytical";
  if (all.includes("discuss")) return "Discuss";
  if (all.includes("explain") || all.includes("elucidate")) return "Explain";
  if (all.includes("comment")) return "Comment";
  return "Other";
}
function answerState(q) {
  return { questionText: q?.question || "", year: q?.year || "", paper: "Geography Optional", marks: q?.marks || 15, topic: q?.theme || "", subject: "Geography Optional", source: "PYQ", pyqId: q?.id || null };
}
function avgGap(years) {
  const ys = [...new Set(years.map(Number).filter(Boolean))].sort((a,b)=>a-b);
  if (ys.length < 2) return null;
  let total = 0;
  for (let i=1;i<ys.length;i++) total += ys[i]-ys[i-1];
  return total/(ys.length-1);
}
function demandText(q) {
  const family = directiveFamily(q);
  if (family === "Critical / Evaluate") return "Build the concept first, then weigh relevance, limitations and a balanced judgement.";
  if (family === "Compare") return "Use a common basis of comparison rather than writing two disconnected descriptions.";
  if (family === "Analytical") return "Break the issue into causes, processes, relationships and implications; avoid a purely descriptive answer.";
  if (family === "Discuss") return "Cover the major dimensions with explanation, evidence and a balanced synthesis.";
  if (family === "Explain") return "Clarify the concept and mechanism with a clean causal sequence, diagrams or maps where useful.";
  return "Identify the core concept, directive and spatial or theoretical value-add before writing.";
}
function valueAdd(q) {
  const text = `${q?.question || ""} ${q?.theme || ""}`.toLowerCase();
  const items = [];
  if (/geomorph|cycle|slope|plate|river|landform|monsoon|climate|ocean|population|settlement|agricultur|industry/.test(text)) items.push("Diagram / schematic can add value");
  if (/india|indian|region|state|river|transport|agriculture|industry|settlement/.test(text)) items.push("India map may strengthen spatial presentation");
  if (/world|global|ocean|climate|trade|geopolit/.test(text)) items.push("World map may be useful");
  if (/model|theory|davis|penck|christaller|weber|malthus|hartshorne|mackinder|von thunen|rostow/.test(text)) items.push("Use the relevant thinker / model explicitly");
  if (/contemporary|recent|climate|disaster|urban|industry|agriculture/.test(text)) items.push("Add a contemporary example or case study");
  return items.length ? items : ["Use one precise concept anchor and one relevant example"];
}

export default function GeographyOptionalPyqAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useMentorTheme();
  const P = useMemo(() => palette(mode), [mode]);
  const incomingId = location.state?.selectedPyqId;
  const incomingQuestion = location.state?.selectedQuestion;
  const [pyqs, setPyqs] = useState([]);
  const [selectedQ, setSelectedQ] = useState(incomingQuestion || null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=geography_optional`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((data) => {
        const list = Array.isArray(data?.questions) ? data.questions : [];
        setPyqs(list);
        if (incomingId) setSelectedQ(list.find((q) => q.id === incomingId) || incomingQuestion || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [incomingId, incomingQuestion]);

  const directiveCounts = useMemo(() => {
    const m = new Map(); pyqs.forEach((q) => m.set(directiveFamily(q), (m.get(directiveFamily(q)) || 0) + 1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }, [pyqs]);
  const themeStats = useMemo(() => {
    const map = new Map();
    pyqs.forEach((q) => {
      const t = String(q.theme || "Unmapped").trim() || "Unmapped";
      const item = map.get(t) || { theme: t, count: 0, years: [] };
      item.count += 1; if (q.year) item.years.push(q.year); map.set(t,item);
    });
    return [...map.values()].filter((x)=>x.theme !== "Unmapped").sort((a,b)=>b.count-a.count);
  }, [pyqs]);
  const selectedRelated = useMemo(() => selectedQ ? pyqs.filter((q) => q.theme && q.theme === selectedQ.theme && q.id !== selectedQ.id).sort((a,b)=>(b.year||0)-(a.year||0)).slice(0,6) : [], [pyqs, selectedQ]);
  const questionResults = useMemo(() => {
    const s = search.trim().toLowerCase(); if (!s) return pyqs.slice(0,12);
    return pyqs.filter((q) => [q.question,q.theme,q.directive,q.year].join(" ").toLowerCase().includes(s)).slice(0,30);
  }, [pyqs, search]);

  function write(q) {
    const state = answerState(q); sessionStorage.setItem("mains_pyq_metadata", JSON.stringify(state)); navigate("/answer-writing/geography-optional/pyq", { state });
  }
  const card = { background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, boxShadow: P.shadow };

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 28px 42px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
          <div><div style={{ color: P.muted, fontSize: 10, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase" }}>Geography Optional · Intelligence</div><h1 style={{ margin: "6px 0 0", fontSize: 31, fontWeight: 900, letterSpacing: "-.035em" }}>PYQ Analysis</h1><div style={{ color: P.muted, fontSize: 12, marginTop: 5 }}>How UPSC asks, what repeats, when themes return and how to approach a selected question.</div></div>
          <button onClick={() => navigate("/geography-optional/pyq")} style={{ border: `1px solid ${P.border2}`, background: P.surface, color: P.text2, borderRadius: 9, padding: "9px 13px", fontWeight: 800, cursor: "pointer" }}>← Geography PYQs</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 14 }}>
          <div style={{ ...card, padding: 16 }}><div style={{ color: P.primary, fontSize: 10, fontWeight: 850 }}>HOW?</div><div style={{ color: P.text, fontSize: 16, fontWeight: 850, marginTop: 5 }}>Question framing</div><div style={{ color: P.muted, fontSize: 11, lineHeight: 1.55, marginTop: 6 }}>{directiveCounts.length ? `${directiveCounts[0][0]} is the most common mapped directive family (${directiveCounts[0][1]} questions).` : "Loading directive patterns…"}</div></div>
          <div style={{ ...card, padding: 16 }}><div style={{ color: "#16A34A", fontSize: 10, fontWeight: 850 }}>WHAT REPEATS?</div><div style={{ color: P.text, fontSize: 16, fontWeight: 850, marginTop: 5 }}>Recurring themes</div><div style={{ color: P.muted, fontSize: 11, lineHeight: 1.55, marginTop: 6 }}>{themeStats[0] ? `${themeStats[0].theme} has ${themeStats[0].count} mapped PYQs.` : "Loading theme recurrence…"}</div></div>
          <div style={{ ...card, padding: 16 }}><div style={{ color: "#F59E0B", fontSize: 10, fontWeight: 850 }}>WHEN?</div><div style={{ color: P.text, fontSize: 16, fontWeight: 850, marginTop: 5 }}>Return gap</div><div style={{ color: P.muted, fontSize: 11, lineHeight: 1.55, marginTop: 6 }}>{themeStats.find((x)=>avgGap(x.years)) ? `Track the average gap between repeated appearances rather than treating every year as isolated.` : "Needs at least two appearances for a gap."}</div></div>
          <div style={{ ...card, padding: 16 }}><div style={{ color: "#8B5CF6", fontSize: 10, fontWeight: 850 }}>VALUE ADD</div><div style={{ color: P.text, fontSize: 16, fontWeight: 850, marginTop: 5 }}>Maps, diagrams, models</div><div style={{ color: P.muted, fontSize: 11, lineHeight: 1.55, marginTop: 6 }}>Use question-specific spatial and theoretical value-add, not decorative diagrams.</div></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(320px,.75fr)", gap: 14, marginBottom: 14 }}>
          <section style={{ ...card, padding: 17 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}><div><div style={{ fontSize: 16, fontWeight: 850 }}>Repeated Topics</div><div style={{ color: P.muted, fontSize: 10, marginTop: 3 }}>Based on mapped `theme` metadata; no fake trend percentages.</div></div></div>
            <div style={{ display: "grid", gap: 7 }}>
              {themeStats.slice(0,10).map((x) => {
                const gap = avgGap(x.years); const ys = [...new Set(x.years)].sort((a,b)=>b-a);
                return <button key={x.theme} onClick={() => { const q = pyqs.find((p)=>p.theme===x.theme); if(q) setSelectedQ(q); }} style={{ border: `1px solid ${P.border}`, background: P.surface2, borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><div><strong style={{ color: P.text, fontSize: 12 }}>{x.theme}</strong><div style={{ color: P.muted, fontSize: 10, marginTop: 4 }}>{ys.slice(0,7).join(" · ")}{ys.length>7?" …":""}</div></div><div style={{ textAlign: "right" }}><div style={{ color: P.primary, fontWeight: 850, fontSize: 12 }}>{x.count} PYQs</div><div style={{ color: P.faint, fontSize: 9, marginTop: 3 }}>{gap ? `Avg gap ${gap.toFixed(1)}y` : "Single appearance"}</div></div></div></button>;
              })}
            </div>
          </section>

          <section style={{ ...card, padding: 17 }}>
            <div style={{ fontSize: 16, fontWeight: 850 }}>Directive Trends</div><div style={{ color: P.muted, fontSize: 10, marginTop: 3 }}>Actual counts from question text/directive metadata.</div>
            <div style={{ marginTop: 13, display: "grid", gap: 9 }}>{directiveCounts.slice(0,8).map(([name,count]) => <div key={name}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span style={{ color: P.text2 }}>{name}</span><strong style={{ color: P.text }}>{count}</strong></div><div style={{ height: 5, borderRadius: 999, background: P.surface3, marginTop: 5, overflow: "hidden" }}><div style={{ width: `${Math.max(8,(count/(directiveCounts[0]?.[1]||1))*100)}%`, height: "100%", background: P.primary }} /></div></div>)}</div>
          </section>
        </div>

        <section style={{ ...card, padding: 17, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}><div><div style={{ fontSize: 16, fontWeight: 850 }}>Selected PYQ Analysis</div><div style={{ color: P.muted, fontSize: 10, marginTop: 3 }}>Select a question below or arrive here from the PYQ page.</div></div>{selectedQ ? <button onClick={() => write(selectedQ)} style={{ border: "none", background: P.primary, color: "#fff", borderRadius: 9, padding: "9px 13px", fontWeight: 800, cursor: "pointer" }}>Write Answer →</button> : null}</div>
          {selectedQ ? <div>
            <div style={{ background: P.primarySoft, border: `1px solid ${P.primary}33`, borderRadius: 12, padding: 14 }}><div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 7 }}><span style={{ color: P.primary, fontSize: 10, fontWeight: 850 }}>UPSC {selectedQ.year || "PYQ"}</span>{selectedQ.paperNumber ? <span style={{ color: P.muted, fontSize: 10 }}>Paper {selectedQ.paperNumber}</span> : null}{selectedQ.marks ? <span style={{ color: "#16A34A", fontSize: 10, fontWeight: 850 }}>{selectedQ.marks}M</span> : null}<span style={{ color: P.muted, fontSize: 10 }}>{directiveFamily(selectedQ)}</span></div><div style={{ color: P.text, fontSize: 15, lineHeight: 1.6, fontWeight: 800 }}>{selectedQ.question}</div>{selectedQ.theme ? <div style={{ color: P.muted, fontSize: 11, marginTop: 6 }}>{selectedQ.theme}</div> : null}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, marginTop: 10 }}>
              <div style={{ background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 11, padding: 12 }}><div style={{ color: P.primary, fontSize: 10, fontWeight: 850 }}>QUESTION DEMAND</div><div style={{ color: P.text2, fontSize: 11, lineHeight: 1.6, marginTop: 6 }}>{demandText(selectedQ)}</div></div>
              <div style={{ background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 11, padding: 12 }}><div style={{ color: "#8B5CF6", fontSize: 10, fontWeight: 850 }}>VALUE ADD</div><div style={{ display: "grid", gap: 5, marginTop: 6 }}>{valueAdd(selectedQ).map((x)=><div key={x} style={{ color: P.text2, fontSize: 11 }}>✓ {x}</div>)}</div></div>
              <div style={{ background: P.surface2, border: `1px solid ${P.border}`, borderRadius: 11, padding: 12 }}><div style={{ color: "#F59E0B", fontSize: 10, fontWeight: 850 }}>RELATED PYQs</div><div style={{ color: P.text2, fontSize: 11, lineHeight: 1.6, marginTop: 6 }}>{selectedRelated.length ? selectedRelated.map((q)=>q.year).filter(Boolean).join(" · ") : "No additional questions with the same mapped theme."}</div></div>
            </div>
          </div> : <div style={{ border: `1px dashed ${P.border2}`, background: P.surface2, borderRadius: 12, padding: 26, textAlign: "center", color: P.muted, fontSize: 12 }}>Select a PYQ to inspect its demand, recurrence and value-add.</div>}
        </section>

        <section style={{ ...card, padding: 17 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}><div><div style={{ fontSize: 16, fontWeight: 850 }}>Find a PYQ</div><div style={{ color: P.muted, fontSize: 10, marginTop: 3 }}>Search the same Geography Optional question bank.</div></div><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search question or theme…" style={{ border: `1px solid ${P.border}`, background: P.surface2, color: P.text, borderRadius: 9, padding: "9px 11px", minWidth: 280, outline: "none" }} /></div>
          {loading ? <div style={{ padding: 20, color: P.muted }}>Loading…</div> : <div style={{ display: "grid", gap: 7 }}>{questionResults.map((q) => <button key={q.id || `${q.year}-${q.question}`} onClick={()=>setSelectedQ(q)} style={{ border: `1px solid ${selectedQ?.id===q.id ? P.primary : P.border}`, background: selectedQ?.id===q.id ? P.primarySoft : P.surface2, borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}><div style={{ color: P.muted, fontSize: 9, marginBottom: 4 }}>{q.year || "—"} · {q.theme || "Geography Optional"}</div><div style={{ color: P.text2, fontSize: 11.5, lineHeight: 1.5 }}>{q.question}</div></button>)}</div>}
        </section>
      </div>
    </div>
  );
}
