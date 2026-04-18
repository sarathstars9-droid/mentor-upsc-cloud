import { useState } from "react";
import { useNavigate } from "react-router-dom";

const StatChip = ({ label, value }) => (
  <div style={{
    display: "inline-flex", flexDirection: "column", alignItems: "center",
    background: "#111", border: "1px solid #2a2a2a", borderRadius: 6,
    padding: "6px 14px", minWidth: 90
  }}>
    <span style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>{value}</span>
    <span style={{ fontSize: 10, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>{label}</span>
  </div>
);

const FeatureCard = ({ icon, title, description, badge, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#111" : "#0a0a0a",
        border: `1px solid ${hov ? "#f59e0b44" : "#1e1e1e"}`,
        borderRadius: 10, padding: "22px 20px", cursor: "pointer",
        transition: "all 0.2s", position: "relative", overflow: "hidden"
      }}
    >
      {badge && (
        <span style={{
          position: "absolute", top: 12, right: 12,
          background: "#1a1a00", border: "1px solid #f59e0b44",
          color: "#f59e0b", fontSize: 9, fontWeight: 700,
          letterSpacing: "0.1em", borderRadius: 4, padding: "2px 7px", textTransform: "uppercase"
        }}>{badge}</span>
      )}
      <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{description}</div>
      <div style={{ marginTop: 14, fontSize: 11, color: hov ? "#f59e0b" : "#333", transition: "color 0.2s" }}>Open →</div>
    </div>
  );
};

const ActivityRow = ({ label, time, type }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid #111"
  }}>
    <div>
      <div style={{ fontSize: 12, color: "#bbb" }}>{label}</div>
      <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{type}</div>
    </div>
    <div style={{ fontSize: 10, color: "#444", fontFamily: "monospace" }}>{time}</div>
  </div>
);

export default function GeographyOptionalPage() {
  const navigate = useNavigate();
  const s = {
    page: { background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" },
    sectionCard: {
      background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10,
      padding: "20px 22px", marginBottom: 20
    },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>MAINS · OPTIONAL</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Geography Optional</h1>
        <p style={{ margin: "6px 0 18px", fontSize: 12, color: "#555", maxWidth: 560 }}>
          Your complete Geography Optional workspace — PYQ analysis, institutional test evaluation, and mistake tracking in one place.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatChip label="PYQs Saved" value="0" />
          <StatChip label="Tests Done" value="0" />
          <StatChip label="Mistakes" value="0" />
          <StatChip label="Revision Queue" value="0" />
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <FeatureCard
          icon="📚"
          title="Geography Optional PYQ"
          description="Analyze previous year questions, identify source traditions, get structured ChatGPT breakdowns, and save analysis notes."
          badge="PYQ"
          onClick={() => navigate("/geography-optional/pyq")}
        />
        <FeatureCard
          icon="🏛"
          title="Geography Optional Institutional"
          description="Upload institutional question papers, extract your handwritten answers, evaluate against model answers, and save evaluations."
          badge="INST"
          onClick={() => navigate("/geography-optional/institutional")}
        />
        <FeatureCard
          icon="🔖"
          title="Geography Optional Mistakes"
          description="Review flagged weak questions, track repeated errors, maintain a revision queue, and monitor your growth over time."
          badge="TRACK"
          onClick={() => navigate("/geography-optional/mistakes")}
        />
      </div>

      {/* Guidance */}
      <div style={s.sectionCard}>
        <div style={s.sectionLabel}>How to use this space</div>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.9, maxWidth: 680 }}>
          Start with <span style={{ color: "#aaa" }}>PYQ</span> to build conceptual clarity on question demand.
          Move to <span style={{ color: "#aaa" }}>Institutional</span> when you have test papers to evaluate.
          Weak answers are flagged automatically (in future phase) into <span style={{ color: "#aaa" }}>Mistakes</span> for targeted revision.
          Geography Optional rewards depth — use this workspace to build that depth systematically.
        </div>
      </div>

      {/* Recent Activity placeholder */}
      <div style={s.sectionCard}>
        <div style={s.sectionLabel}>Recent Activity</div>
        <div style={{ fontSize: 11, color: "#333", marginBottom: 14 }}>No activity yet — start by opening PYQ or Institutional.</div>
        <ActivityRow label="No entries yet" time="—" type="Activity will appear here" />
        <div style={{ marginTop: 14, fontSize: 10, color: "#2a2a2a" }}>
          Future sync: activity will pull from PYQ and Institutional sessions automatically.
        </div>
      </div>

      {/* Future sync note */}
      <div style={{
        background: "#0a0f0a", border: "1px solid #1a2a1a", borderRadius: 8,
        padding: "12px 16px", fontSize: 11, color: "#444"
      }}>
        <span style={{ color: "#22c55e", fontWeight: 700 }}>Future sync: </span>
        PYQ analysis, evaluation scores, and flagged mistakes will unify into a single performance dashboard for Geography Optional.
      </div>
    </div>
  );
}
