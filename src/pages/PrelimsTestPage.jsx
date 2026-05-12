// src/pages/PrelimsTestPage.jsx
// Prelims Test Engine — Home: choose mode, configure, start
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config";

const USER_ID = "user_1";

const PAGE_BG = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 80% 10%, rgba(56,189,248,0.09), transparent 30%)," +
    "radial-gradient(circle at 10% 90%, rgba(168,85,247,0.08), transparent 28%), #020617",
  color: "#f8fafc",
  padding: "24px 20px 48px",
  fontFamily: "'Inter', sans-serif",
};

const CARD = {
  background: "rgba(15,23,42,0.88)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 16px 40px rgba(2,6,23,0.36)",
  marginBottom: 20,
};

const BTN_PRIMARY = {
  width: "100%",
  padding: "14px 0",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  letterSpacing: 0.4,
  marginTop: 14,
};

const SELECT_STYLE = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.2)",
  background: "rgba(15,23,42,0.9)",
  color: "#e2e8f0",
  fontSize: 14,
  fontWeight: 600,
  marginTop: 6,
  outline: "none",
};

const LABEL = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginTop: 14,
  display: "block",
};

const CHIP = (active, color = "#38bdf8") => ({
  padding: "8px 16px",
  borderRadius: 99,
  border: active ? `1px solid ${color}66` : "1px solid rgba(148,163,184,0.18)",
  background: active ? `${color}18` : "rgba(15,23,42,0.6)",
  color: active ? color : "#94a3b8",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  transition: "all 0.15s",
});

const GS_YEARS  = Array.from({ length: 30 }, (_, i) => 2025 - i);
const CSAT_YEARS = Array.from({ length: 15 }, (_, i) => 2024 - i);

// Node catalog — basic subjects for topic mode (GS)
const GS_SUBJECT_NODES = [
  { label: "History — Ancient", nodeId: "GS1-HIS-ANC-IVC-MT04" },
  { label: "History — Modern National Movement", nodeId: "GS1-HIS-MOD-NATIONAL-MT01" },
  { label: "History — Medieval", nodeId: "GS1-HIS-MED-MUGHAL-MT01" },
  { label: "Geography — India Physio", nodeId: "GS1-GEO-IND-PHYSIO-MT01" },
  { label: "Geography — Drainage", nodeId: "GS1-GEO-IND-DRAINAGE-MT01" },
  { label: "Geography — Climate", nodeId: "GS1-GEO-IND-CLIMATE-MT01" },
  { label: "Geography — World Places", nodeId: "GS1-GEO-PRE-REGIONAL-PLACES-MT01" },
  { label: "Polity — Parliament", nodeId: "GS2-POL-PARL-MT01" },
  { label: "Polity — Fundamental Rights", nodeId: "GS2-POL-FR-MT01" },
  { label: "Polity — Judiciary", nodeId: "GS2-POL-JUD-MT01" },
  { label: "Economy — Monetary Policy", nodeId: "GS3-ECO-MONETARY-POLICY-MT01" },
  { label: "Economy — Banking", nodeId: "GS3-ECO-BANKING-MT01" },
  { label: "Environment — Conservation", nodeId: "GS3-ENV-CONSERVATION-MT01" },
  { label: "Environment — Species", nodeId: "GS3-ENV-SPECIES-MT01" },
  { label: "Science — Space", nodeId: "GS3-ST-SPACE-MT01" },
  { label: "Science — Biotech", nodeId: "GS3-ST-BIOTECH-MT01" },
];

export default function PrelimsTestPage() {
  const navigate = useNavigate();

  // ── shared
  const [paper, setPaper] = useState("GS");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  // ── topic mode
  const [topicNodeId, setTopicNodeId]     = useState(GS_SUBJECT_NODES[0].nodeId);
  const [topicLimit, setTopicLimit]       = useState(25);

  // ── year mode
  const [yearVal, setYearVal] = useState(2023);
  const [yearLimit, setYearLimit] = useState(100);

  // ── mixed mode
  const [mixedLimit, setMixedLimit] = useState(50);

  // ── history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/prelims-tests/history?userId=${USER_ID}&limit=8`)
      .then(r => r.json())
      .then(d => { if (d.ok) setHistory(d.attempts || []); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  async function startTest(mode) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ userId: USER_ID, mode, paper, limit: 200, shuffle: "true" });
      if (mode === "topic") params.set("nodeId", topicNodeId);
      if (mode === "year")  params.set("year", yearVal);

      const qRes = await fetch(`${BACKEND_URL}/api/prelims-tests/questions?${params}`);
      const qData = await qRes.json();
      if (!qData.ok || !qData.questions?.length) {
        throw new Error(qData.error || "No questions found for the selected filters.");
      }

      const cap = mode === "topic" ? topicLimit : mode === "year" ? yearLimit : mixedLimit;
      const sliced = qData.questions.slice(0, cap);
      const questionIds = sliced.map(q => q.id);

      const node  = GS_SUBJECT_NODES.find(n => n.nodeId === topicNodeId);
      const title = mode === "topic"
        ? `${paper} — ${node?.label || topicNodeId} (${sliced.length} Qs)`
        : mode === "year"
        ? `${paper} ${yearVal} — ${sliced.length} Qs`
        : `${paper} Mixed — ${sliced.length} Qs`;

      const aRes = await fetch(`${BACKEND_URL}/api/prelims-tests/attempts`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, mode, paper, title, nodeId: topicNodeId, year: yearVal, questionIds }),
      });
      const aData = await aRes.json();
      if (!aData.ok) throw new Error(aData.error || "Failed to create attempt");

      navigate(`/prelims/test/${aData.attemptId}`, {
        state: { questions: sliced, attempt: aData, title, paper, mode },
      });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={PAGE_BG}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Hero */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#e0f2fe", letterSpacing: -0.5 }}>
            ⚡ Prelims Test Engine
          </div>
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
            Topic-wise · Year-wise · Mixed Practice — with Mistake Book integration
          </div>
        </div>

        {/* Paper selector */}
        <div style={{ ...CARD, padding: "16px 20px" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Paper</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["GS", "CSAT"].map(p => (
              <button key={p} onClick={() => setPaper(p)} style={CHIP(paper === p, "#38bdf8")}>{p}</button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 13, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Mode 1: Topic-wise ── */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>📚</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#e0f2fe" }}>Topic-wise PYQ Test</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Pick a specific node and test only those questions</div>
            </div>
          </div>

          <label style={LABEL}>Select Topic / Node</label>
          <select value={topicNodeId} onChange={e => setTopicNodeId(e.target.value)} style={SELECT_STYLE}>
            {GS_SUBJECT_NODES.map(n => (
              <option key={n.nodeId} value={n.nodeId}>{n.label}</option>
            ))}
          </select>

          <label style={LABEL}>Number of Questions</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {[10, 25, 50].map(n => (
              <button key={n} onClick={() => setTopicLimit(n)} style={CHIP(topicLimit === n, "#a78bfa")}>{n}</button>
            ))}
          </div>

          <button disabled={loading} onClick={() => startTest("topic")} style={BTN_PRIMARY}>
            {loading ? "Loading…" : "▶  Start Topic Test"}
          </button>
        </div>

        {/* ── Mode 2: Year-wise ── */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>📅</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#e0f2fe" }}>Year-wise PYQ Test</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Solve a full year's paper for GS or CSAT</div>
            </div>
          </div>

          <label style={LABEL}>Select Year</label>
          <select value={yearVal} onChange={e => setYearVal(Number(e.target.value))} style={SELECT_STYLE}>
            {(paper === "CSAT" ? CSAT_YEARS : GS_YEARS).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <label style={LABEL}>Number of Questions</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {[50, 100].map(n => (
              <button key={n} onClick={() => setYearLimit(n)} style={CHIP(yearLimit === n, "#34d399")}>{n}</button>
            ))}
          </div>

          <button disabled={loading} onClick={() => startTest("year")} style={BTN_PRIMARY}>
            {loading ? "Loading…" : "▶  Start Year Test"}
          </button>
        </div>

        {/* ── Mode 3: Mixed ── */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🔀</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#e0f2fe" }}>Mixed Practice</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Random {paper} questions from all years</div>
            </div>
          </div>

          <label style={LABEL}>Number of Questions</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {[25, 50, 100].map(n => (
              <button key={n} onClick={() => setMixedLimit(n)} style={CHIP(mixedLimit === n, "#fb923c")}>{n}</button>
            ))}
          </div>

          <button disabled={loading} onClick={() => startTest("mixed")} style={BTN_PRIMARY}>
            {loading ? "Loading…" : "▶  Start Mixed Test"}
          </button>
        </div>

        {/* ── Recent History ── */}
        <div style={CARD}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#e0f2fe", marginBottom: 14 }}>📋 Recent Attempts</div>
          {historyLoading && <div style={{ color: "#475569", fontSize: 13 }}>Loading…</div>}
          {!historyLoading && history.length === 0 && <div style={{ color: "#475569", fontSize: 13 }}>No attempts yet. Start a test above!</div>}
          {history.map(a => (
            <div
              key={a.id}
              onClick={() => navigate(`/prelims/test/result/${a.id}`)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", borderRadius: 10, marginBottom: 8,
                background: "rgba(30,41,59,0.7)", border: "1px solid rgba(148,163,184,0.1)",
                cursor: "pointer", transition: "background 0.15s",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#e0f2fe" }}>{a.title || "Prelims Test"}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {a.mode} · {a.paper} · {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: a.status === "submitted" ? "#22c55e" : "#f59e0b" }}>
                  {a.status === "submitted" ? `Score: ${a.score}` : "In Progress"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  {a.correct_count}✓ {a.wrong_count}✗ {a.skipped_count}—
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
