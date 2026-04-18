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

export default function EthicsPage() {
  const navigate = useNavigate();
  const s = {
    page: { background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" },
    sectionCard: { background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "20px 22px", marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 },
  };

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>MAINS · GS PAPER IV</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Ethics, Integrity & Aptitude</h1>
        <p style={{ margin: "6px 0 18px", fontSize: 12, color: "#555", maxWidth: 560 }}>
          GS Paper IV workspace — PYQ analysis, institutional test evaluation, and mistake tracking for Ethics, Case Studies, and Thinkers.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatChip label="PYQs Saved" value="0" />
          <StatChip label="Tests Done" value="0" />
          <StatChip label="Mistakes" value="0" />
          <StatChip label="Case Studies" value="0" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <FeatureCard icon="⚖️" title="Ethics PYQ" description="Analyze past UPSC GS4 questions — identify ethical dimensions, stakeholder analysis, and case-handling strategy." badge="PYQ" onClick={() => navigate("/ethics/pyq")} />
        <FeatureCard icon="🏛" title="Ethics Institutional" description="Upload institutional test papers, extract your answers, and evaluate against case study and theoretical ethics standards." badge="INST" onClick={() => navigate("/ethics/institutional")} />
        <FeatureCard icon="🔖" title="Ethics Mistakes" description="Review weak answers, repeated conceptual gaps, saved AI notes, and build a targeted ethics revision queue." badge="TRACK" onClick={() => navigate("/ethics/mistakes")} />
      </div>

      <div style={s.sectionCard}>
        <div style={s.sectionLabel}>How to use this space</div>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.9, maxWidth: 680 }}>
          GS4 has two types: <span style={{ color: "#aaa" }}>Theory</span> (thinkers, concepts, definitions) and <span style={{ color: "#aaa" }}>Case Studies</span> (applied ethical reasoning).
          Use <span style={{ color: "#aaa" }}>PYQ</span> to master demand-reading and ethical dimension identification.
          Use <span style={{ color: "#aaa" }}>Institutional</span> for test paper evaluation with case-handling rigor.
          Weak answers build your <span style={{ color: "#aaa" }}>Mistakes</span> queue for targeted daily revision.
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
        PYQ analysis, institutional evaluations, and flagged mistakes will unify into a single GS4 performance dashboard.
      </div>
    </div>
  );
}
