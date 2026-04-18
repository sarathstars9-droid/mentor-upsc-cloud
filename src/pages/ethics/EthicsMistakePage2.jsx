import { useState } from "react";

const FILTER_CHIPS = ["All", "Weak Questions", "Repeated Mistakes", "AI Notes", "Revision Queue"];

const EmptyCard = ({ icon, label, subtext }) => (
  <div style={{ background: "#0a0a0a", border: "1px dashed #1e1e1e", borderRadius: 8, padding: "24px 20px", textAlign: "center", marginBottom: 14 }}>
    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>{label}</div>
    {subtext && <div style={{ fontSize: 11, color: "#333", marginTop: 4 }}>{subtext}</div>}
  </div>
);

const PlaceholderEntry = ({ title, tag, date }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
    <div>
      <div style={{ fontSize: 12, color: "#bbb" }}>{title}</div>
      <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{date}</div>
    </div>
    <span style={{ background: "#1a1200", border: "1px solid #f59e0b44", color: "#f59e0b", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{tag}</span>
  </div>
);

export default function EthicsMistakePage() {
  const [activeFilter, setActiveFilter] = useState("All");

  const s = {
    page: { background: "#080808", minHeight: "100vh", padding: "28px 32px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e7eb" },
    sectionCard: { background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10, padding: "20px 22px", marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 },
    sectionSub: { fontSize: 12, color: "#555", marginBottom: 16 },
    chip: (active) => ({ background: active ? "#1a1200" : "#0a0a0a", border: `1px solid ${active ? "#f59e0b" : "#2a2a2a"}`, color: active ? "#f59e0b" : "#555", borderRadius: 20, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", transition: "all 0.2s" }),
  };

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>ETHICS · GS PAPER IV · MISTAKES</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Ethics Mistakes</h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#555", maxWidth: 540 }}>
          Weak ethical reasoning, repeated case-handling errors, saved AI notes, and revision queue. Auto-populated from PYQ and Institutional pages in future sync.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {FILTER_CHIPS.map(chip => (
          <button key={chip} onClick={() => setActiveFilter(chip)} style={s.chip(activeFilter === chip)}>{chip}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <div style={s.sectionCard}>
            <div style={s.sectionLabel}>Weak Questions</div>
            <div style={s.sectionSub}>Ethics and case study questions flagged as weak.</div>
            <EmptyCard icon="⚠️" label="No weak questions yet" subtext="Flag questions from Ethics PYQ or Institutional pages." />
            <PlaceholderEntry title="Placeholder: Discuss the role of emotional intelligence in administration..." tag="Weak" date="—" />
            <PlaceholderEntry title="Placeholder: A civil servant faces a conflict of interest..." tag="Weak" date="—" />
          </div>

          <div style={s.sectionCard}>
            <div style={s.sectionLabel}>Repeated Mistakes</div>
            <div style={s.sectionSub}>Ethical dimension gaps appearing across multiple answers.</div>
            <EmptyCard icon="🔄" label="No repeated mistakes detected" subtext="Patterns across sessions will surface here automatically." />
          </div>
        </div>

        <div>
          <div style={s.sectionCard}>
            <div style={s.sectionLabel}>Saved AI Notes</div>
            <div style={s.sectionSub}>ChatGPT analysis and source-fit notes from Ethics sessions.</div>
            <EmptyCard icon="🤖" label="No AI notes saved yet" subtext="Save ChatGPT outputs from PYQ and Institutional pages." />
            <PlaceholderEntry title="Placeholder: AI analysis — Stakeholder identification gap in case..." tag="AI Note" date="—" />
          </div>

          <div style={s.sectionCard}>
            <div style={s.sectionLabel}>Revision Queue</div>
            <div style={s.sectionSub}>Ethics questions and thinkers flagged for scheduled revision.</div>
            <EmptyCard icon="📅" label="Revision queue empty" subtext="Toggle 'Add to Future Revision' on PYQ questions to build this queue." />
            <PlaceholderEntry title="Placeholder: Rawls' Theory of Justice — application in policy..." tag="Revision" date="—" />
          </div>
        </div>
      </div>

      <div style={{ background: "#0a0f0a", border: "1px solid #1a2a1a", borderRadius: 8, padding: "12px 16px", fontSize: 11, color: "#444", marginTop: 4 }}>
        <span style={{ color: "#22c55e", fontWeight: 700 }}>Future sync: </span>
        Flagged questions and AI notes from Ethics PYQ and Institutional pages will auto-populate all sections here once backend sync is activated.
      </div>
    </div>
  );
}
