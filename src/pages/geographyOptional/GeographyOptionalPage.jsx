import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import HandwrittenSheetReviewPanel from "../../components/HandwrittenSheetReviewPanel.jsx";
import { BACKEND_URL } from "../../config";

const PRIMARY = "#0A64F5";

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
    purpleSoft: dark ? "rgba(139,92,246,.13)" : "#F6F1FF",
    coralSoft: dark ? "rgba(249,115,22,.12)" : "#FFF4EE",
    shadow: dark ? "none" : "0 12px 36px rgba(15,23,42,.055)",
  };
}

function Icon({ type, color = PRIMARY }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "book") return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z"/></svg>;
  if (type === "file") return <svg {...common}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>;
  if (type === "chart") return <svg {...common}><path d="M5 20V10M12 20V4M19 20v-7"/></svg>;
  if (type === "pen") return <svg {...common}><path d="m4 20 4.2-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5.2 16z"/><path d="m14.7 6.5 3 3"/></svg>;
  if (type === "test") return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (type === "target") return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3"/></svg>;
  if (type === "upload") return <svg {...common}><path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 15v5h16v-5"/></svg>;
  return null;
}

function StatCard({ P, icon, value, label, sub, tone = "blue" }) {
  const tint = tone === "purple" ? P.purpleSoft : tone === "coral" ? P.coralSoft : P.primarySoft;
  const color = tone === "purple" ? "#8B5CF6" : tone === "coral" ? "#F97316" : P.primary;
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: "18px 18px", boxShadow: P.shadow, display: "flex", gap: 14, minHeight: 96 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: tint, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon type={icon} color={color} /></div>
      <div>
        <div style={{ color: P.text, fontSize: 28, lineHeight: 1, fontWeight: 850, letterSpacing: "-.03em" }}>{value}</div>
        <div style={{ color: P.text, fontSize: 13, fontWeight: 800, marginTop: 5 }}>{label}</div>
        <div style={{ color: P.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

function FeatureCard({ P, type, title, description, badge, tone = "blue", action, onClick }) {
  const tint = tone === "purple" ? P.purpleSoft : tone === "coral" ? P.coralSoft : P.primarySoft;
  const color = tone === "purple" ? "#8B5CF6" : tone === "coral" ? "#F97316" : P.primary;
  return (
    <button onClick={onClick} style={{ position: "relative", textAlign: "left", width: "100%", border: `1px solid ${P.border}`, background: P.surface, borderRadius: 18, padding: 22, cursor: "pointer", fontFamily: "inherit", boxShadow: P.shadow, minHeight: 218, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(145deg, transparent 42%, ${tint})`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: tint, display: "grid", placeItems: "center" }}><Icon type={type} color={color} /></div>
          <span style={{ color, background: tint, borderRadius: 7, padding: "5px 10px", fontSize: 10, fontWeight: 850, letterSpacing: ".08em" }}>{badge}</span>
        </div>
        <div style={{ color: P.text, fontSize: 17, fontWeight: 850, marginTop: 17, letterSpacing: "-.015em" }}>{title}</div>
        <div style={{ color: P.muted, fontSize: 12, lineHeight: 1.65, marginTop: 8, maxWidth: 360 }}>{description}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <span style={{ color: P.primary, fontSize: 12, fontWeight: 800 }}>{action} →</span>
          <span style={{ width: 36, height: 36, borderRadius: 18, background: tint, color, display: "grid", placeItems: "center", fontSize: 18 }}>→</span>
        </div>
      </div>
    </button>
  );
}

export default function GeographyOptionalPage() {
  const navigate = useNavigate();
  const mode = useMentorTheme();
  const P = useMemo(() => palette(mode), [mode]);
  const [pyqCount, setPyqCount] = useState("—");
  const [showUploader, setShowUploader] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=geography_optional`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => setPyqCount(Array.isArray(data?.questions) ? data.questions.length : "—"))
      .catch(() => setPyqCount("—"));
  }, []);

  return (
    <div style={{ background: P.bg, minHeight: "100vh", color: P.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: isMobile ? "20px 14px 32px" : "28px 30px 42px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: P.muted, fontSize: 10, fontWeight: 850, letterSpacing: ".11em", textTransform: "uppercase" }}>Optional › Geography</div>
          <h1 style={{ margin: "7px 0 0", fontSize: isMobile ? 30 : 40, lineHeight: 1.05, letterSpacing: "-.035em", fontWeight: 900 }}>Geography Optional</h1>
          <div style={{ color: P.muted, fontSize: 14, marginTop: 8 }}>Master the optional through PYQs, writing, evaluation and targeted revision.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
          <StatCard P={P} icon="file" value={pyqCount} label="PYQs Available" sub="From the mapped question bank" />
          <StatCard P={P} icon="pen" value="0" label="Answers Written" sub="Track your progress" />
          <StatCard P={P} icon="test" value="0" label="Tests Evaluated" sub="Institutional & mock tests" tone="purple" />
          <StatCard P={P} icon="target" value="0" label="Revision Due" sub="From weak questions" tone="coral" />
        </div>

        <div style={{ margin: "4px 0 12px" }}>
          <div style={{ color: P.text, fontSize: 20, fontWeight: 850 }}>Practice & Analyse</div>
          <div style={{ color: P.muted, fontSize: 12, marginTop: 3 }}>Everything needed for Geography Optional, in one place.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
          <FeatureCard P={P} type="book" title="Geography Optional PYQs" description="Explore UPSC PYQs topic-wise and sub-topic wise. Analyse questions, view trends and move directly into answer writing." badge="PYQ" action="Explore PYQs" onClick={() => navigate("/geography-optional/pyq")} />
          <FeatureCard P={P} type="test" title="Institutional Tests" description="Upload institutional or coaching test papers, extract handwritten answers, evaluate and track improvement." badge="INST" tone="purple" action="Open Tests" onClick={() => navigate("/answer-writing/geography-optional/institutional")} />
          <FeatureCard P={P} type="chart" title="Mistakes & Revision" description="Review weak questions, recurring errors and your revision queue without placeholder or future-state clutter." badge="TRACK" tone="coral" action="Review Mistakes" onClick={() => navigate("/geography-optional/mistakes")} />
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: isMobile ? 16 : "16px 18px", boxShadow: P.shadow, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr minmax(360px, 1fr) auto", gap: 14, alignItems: "center" }}>
            <div>
              <div style={{ color: P.text, fontSize: 18, fontWeight: 850 }}>Quick Action</div>
              <div style={{ color: P.muted, fontSize: 12, marginTop: 4 }}>Upload a handwritten Geography answer sheet for evaluation.</div>
            </div>
            <button onClick={() => setShowUploader(true)} style={{ border: `1px dashed ${P.border2}`, background: P.surface2, borderRadius: 14, minHeight: 84, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: P.text2 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: P.primarySoft, display: "grid", placeItems: "center" }}><Icon type="upload" /></span>
              <span style={{ textAlign: "left" }}><strong style={{ display: "block", fontSize: 12 }}>Choose image/PDF answer sheet</strong><span style={{ display: "block", fontSize: 10, color: P.muted, marginTop: 3 }}>Multiple pages supported</span></span>
            </button>
            <button onClick={() => setShowUploader(true)} style={{ border: "none", background: P.primary, color: "#fff", borderRadius: 10, padding: "12px 20px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Evaluate Answer →</button>
          </div>
          {showUploader ? (
            <div style={{ marginTop: 16, borderTop: `1px solid ${P.border}`, paddingTop: 16 }}>
              <HandwrittenSheetReviewPanel workspace="geography_optional" subject="Geography Optional" paper="Optional Geography" answerType="optional_geography" defaultMarks={15} />
            </div>
          ) : null}
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, padding: 18, boxShadow: P.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div>
              <div style={{ color: P.text, fontSize: 18, fontWeight: 850 }}>Recent Activity</div>
              <div style={{ color: P.muted, fontSize: 12, marginTop: 3 }}>Your latest PYQ analysis, test evaluations and revision activity.</div>
            </div>
          </div>
          <div style={{ marginTop: 14, background: P.surface2, border: `1px dashed ${P.border2}`, borderRadius: 14, padding: "28px 18px", textAlign: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: P.primarySoft, display: "grid", placeItems: "center", margin: "0 auto 9px" }}><Icon type="file" /></div>
            <div style={{ color: P.text, fontSize: 13, fontWeight: 800 }}>No activity yet</div>
            <div style={{ color: P.muted, fontSize: 11, marginTop: 5 }}>Start by analysing a PYQ, uploading a test or writing an answer.</div>
            <button onClick={() => navigate("/geography-optional/pyq")} style={{ marginTop: 14, border: "none", background: P.primary, color: "#fff", borderRadius: 9, padding: "9px 15px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Explore Geography PYQs →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
