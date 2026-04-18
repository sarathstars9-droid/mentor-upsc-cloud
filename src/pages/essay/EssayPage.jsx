import { useState } from "react";
import { useNavigate } from "react-router-dom";

const StatChip = ({ label, value }) => (
  <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, padding: "6px 14px", minWidth: 90 }}>
    <span style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>{value}</span>
    <span style={{ fontSize: 10, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{label}</span>
  </div>
);

const FeatureCard = ({ icon, title, description, badge, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ background: hov ? "#111" : "#0a0a0a", border: `1px solid ${hov ? "#f59e0b44" : "#1e1e1e"}`, borderRadius: 10, padding: "22px 20px", cursor: "pointer", transition: "all 0.2s", position: "relative" }}>
      {badge && <span style={{ position: "absolute", top: 12, right: 12, background: "#1a1200", border: "1px solid #f59e0b44", color: "#f59e0b", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", borderRadius: 4, padding: "2px 7px", textTransform: "uppercase" }}>{badge}</span>}
      <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{description}</div>
      <div style={{ marginTop: 14, fontSize: 11, color: hov ? "#f59e0b" : "#333", transition: "color 0.2s" }}>Open →</div>
    </div>
  );
};

export default function EssayPage() {
  const navigate = useNavigate();
  const s = {
    page: { background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" },
    sectionCard: { background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "20px 22px", marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 },
  };

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>MAINS · GS PAPER I (ESSAY)</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Essay</h1>
        <p style={{ margin: "6px 0 18px", fontSize: 12, color: "#555", maxWidth: 560 }}>
          Essay paper workspace — PYQ theme analysis, institutional essay evaluation, and mistake tracking for structure, coherence, and multidimensionality.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatChip label="PYQs Saved" value="0" />
          <StatChip label="Essays Written" value="0" />
          <StatChip label="Mistakes" value="0" />
          <StatChip label="Revision Queue" value="0" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <FeatureCard icon="✍️" title="Essay PYQ" description="Analyze past UPSC essay topics — identify theme, philosophical breadth, multidimensionality, and develop your approach strategy." badge="PYQ" onClick={() => navigate("/essay/pyq")} />
        <FeatureCard icon="🏛" title="Essay Institutional" description="Upload institutional essay tests, extract your written essays, and evaluate against UPSC essay standards for coherence and originality." badge="INST" onClick={() => navigate("/essay/institutional")} />
        <FeatureCard icon="🔖" title="Essay Mistakes" description="Review weak essays, structural gaps, saved AI notes, and build a targeted revision queue for recurring weaknesses." badge="TRACK" onClick={() => navigate("/essay/mistakes")} />
      </div>

      <div style={s.sectionCard}>
        <div style={s.sectionLabel}>How to use this space</div>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.9, maxWidth: 680 }}>
          Use <span style={{ color: "#aaa" }}>PYQ</span> to analyze topic types and build your thinking framework before writing.
          Use <span style={{ color: "#aaa" }}>Institutional</span> to evaluate full essays written in test conditions.
          The UPSC Essay paper rewards <span style={{ color: "#aaa" }}>originality, coherence, and multidimensional breadth</span> — not just content volume.
          Build these skills systematically using this workspace.
        </div>
      </div>

      <div style={s.sectionCard}>
        <div style={s.sectionLabel}>Recent Activity</div>
        <div style={{ fontSize: 11, color: "#333", marginBottom: 14 }}>No activity yet — start by opening PYQ or Institutional.</div>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #111", paddingBottom: 10 }}>
          <span style={{ fontSize: 12, color: "#444" }}>No entries yet — activity will appear here.</span>
          <span style={{ fontSize: 10, color: "#2a2a2a", fontFamily: "monospace" }}>—</span>
        </div>
        <div style={{ marginTop: 14, fontSize: 10, color: "#2a2a2a" }}>Future sync: activity will pull from PYQ and Institutional sessions automatically.</div>
      </div>

      <div style={{ background: "#0a0f0a", border: "1px solid #1a2a1a", borderRadius: 8, padding: "12px 16px", fontSize: 11, color: "#444" }}>
        <span style={{ color: "#22c55e", fontWeight: 700 }}>Future sync: </span>
        PYQ analysis, institutional evaluations, and flagged essays will unify into a single Essay performance dashboard.
      </div>
    </div>
  );
}
