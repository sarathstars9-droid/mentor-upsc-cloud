import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const PRIMARY = "#0A64F5";
const FILTERS = ["All", "Weak Questions", "Repeated Mistakes", "AI Notes", "Revision Queue"];

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
    bg: dark ? "#07090D" : "#F6F8FB",
    surface: dark ? "#0D1117" : "#FFFFFF",
    surface2: dark ? "#111720" : "#F8FAFC",
    border: dark ? "#202A36" : "#E1E7EF",
    border2: dark ? "#2A3544" : "#CFD8E5",
    text: dark ? "#F7F9FC" : "#111827",
    text2: dark ? "#D5DCE7" : "#344054",
    muted: dark ? "#8A96A8" : "#667085",
    primary: PRIMARY,
    primarySoft: dark ? "rgba(10,100,245,.14)" : "rgba(10,100,245,.075)",
    shadow: dark ? "none" : "0 12px 36px rgba(15,23,42,.055)",
  };
}

function EmptyState({ P, title, sub, action, onAction }) {
  return (
    <div style={{ background: P.surface2, border: `1px dashed ${P.border2}`, borderRadius: 14, padding: "28px 18px", textAlign: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: P.primarySoft, color: P.primary, display: "grid", placeItems: "center", margin: "0 auto 10px", fontWeight: 900 }}>○</div>
      <div style={{ color: P.text, fontSize: 14, fontWeight: 850 }}>{title}</div>
      <div style={{ color: P.muted, fontSize: 11, marginTop: 5, lineHeight: 1.5 }}>{sub}</div>
      {action ? <button onClick={onAction} style={{ marginTop: 14, border: "none", background: P.primary, color: "#fff", borderRadius: 9, padding: "9px 14px", fontWeight: 800, cursor: "pointer" }}>{action} →</button> : null}
    </div>
  );
}

export default function GeographyOptionalMistakePage() {
  const navigate = useNavigate();
  const mode = useMentorTheme();
  const P = useMemo(() => makePalette(mode), [mode]);
  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <div style={{ background: P.bg, minHeight: "100vh", color: P.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 28px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 22 }}>
          <div>
            <div style={{ color: P.muted, fontSize: 10, fontWeight: 850, letterSpacing: ".1em", textTransform: "uppercase" }}>Geography Optional · Review</div>
            <h1 style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 900, letterSpacing: "-.03em" }}>Mistakes & Revision</h1>
            <div style={{ color: P.muted, fontSize: 12, marginTop: 6 }}>Weak questions, recurring errors and revision items will appear here after real attempts.</div>
          </div>
          <button onClick={() => navigate("/geography-optional/pyq")} style={{ border: `1px solid ${P.border2}`, background: P.surface, color: P.text2, borderRadius: 9, padding: "9px 13px", cursor: "pointer", fontWeight: 750 }}>Practice PYQs →</button>
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
          {FILTERS.map((f) => <button key={f} onClick={() => setActiveFilter(f)} style={{ border: `1px solid ${activeFilter === f ? P.primary : P.border}`, background: activeFilter === f ? P.primarySoft : P.surface, color: activeFilter === f ? P.primary : P.muted, borderRadius: 999, padding: "7px 12px", fontSize: 11, fontWeight: 750, cursor: "pointer" }}>{f}</button>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <section style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 18, boxShadow: P.shadow }}>
            <div style={{ color: P.text, fontWeight: 850, fontSize: 16 }}>Weak Questions</div>
            <div style={{ color: P.muted, fontSize: 11, margin: "4px 0 14px" }}>Questions explicitly marked weak after practice or evaluation.</div>
            <EmptyState P={P} title="No weak questions recorded" sub="Once you flag a Geography answer or PYQ as weak, it can be surfaced here." action="Practice a PYQ" onAction={() => navigate("/geography-optional/pyq")} />
          </section>

          <section style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 18, boxShadow: P.shadow }}>
            <div style={{ color: P.text, fontWeight: 850, fontSize: 16 }}>Repeated Mistakes</div>
            <div style={{ color: P.muted, fontSize: 11, margin: "4px 0 14px" }}>Patterns should appear only after enough evaluated attempts exist.</div>
            <EmptyState P={P} title="No repeated pattern yet" sub="MentorOS should only label an error repeated when there is real evidence across attempts." />
          </section>

          <section style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 18, boxShadow: P.shadow }}>
            <div style={{ color: P.text, fontWeight: 850, fontSize: 16 }}>Saved Analysis Notes</div>
            <div style={{ color: P.muted, fontSize: 11, margin: "4px 0 14px" }}>Question analysis and evaluator notes saved from Geography sessions.</div>
            <EmptyState P={P} title="No analysis notes saved" sub="Analyse a PYQ or complete an evaluation to start building your evidence base." action="Open PYQ Analysis" onAction={() => navigate("/geography-optional/pyq-analysis")} />
          </section>

          <section style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 18, boxShadow: P.shadow }}>
            <div style={{ color: P.text, fontWeight: 850, fontSize: 16 }}>Revision Queue</div>
            <div style={{ color: P.muted, fontSize: 11, margin: "4px 0 14px" }}>Questions due for targeted revision.</div>
            <EmptyState P={P} title="Revision queue is empty" sub="Add real weak questions to revision after evaluation rather than using placeholder items." />
          </section>
        </div>
      </div>
    </div>
  );
}
