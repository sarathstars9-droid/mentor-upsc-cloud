import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config.js";
import "../../styles/ethics-workspace.css";

function looksEthics(m) {
  const blob = [m?.paper, m?.subject, m?.topic, m?.question, m?.syllabusNodeId, m?.category, m?.stage].filter(Boolean).join(" ").toLowerCase();
  return blob.includes("gs4") || blob.includes("gs 4") || blob.includes("ethic") || blob.includes("integrity") || blob.includes("probity");
}

export default function EthicsMistakePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let alive = true;
    fetch(`${BACKEND_URL}/api/mistakes?userId=user_1&stage=mains`, { cache: "no-store" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (alive) setItems((Array.isArray(data) ? data : []).filter(looksEthics)); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => items.filter(m => {
    if (filter === "all") return true;
    const blob = JSON.stringify(m).toLowerCase();
    if (filter === "weak") return blob.includes("weak") || blob.includes("high") || blob.includes("critical");
    if (filter === "repeat") return blob.includes("repeat") || Number(m.count || m.occurrences || 0) > 1;
    if (filter === "revision") return blob.includes("revision") || blob.includes("revise") || m.must_revise === true;
    return true;
  }), [items, filter]);

  return (
    <div className="eth-page"><div className="eth-shell">
      <header className="eth-explorer-head"><div><div className="eth-kicker">Ethics · GS Paper IV · Repair</div><h1 className="eth-title">Ethics Mistakes</h1><p className="eth-subtitle">Weak questions, repeated reasoning gaps and revision signals from your actual GS4 work.</p></div><button className="eth-back" onClick={() => navigate("/ethics")} aria-label="Back">←</button></header>
      <div className="eth-explorer-stats"><span className="eth-meta-pill"><span className="eth-meta-dot" />{loading ? "Loading…" : `${items.length} signals`}</span><span className="eth-meta-pill">No institutional placeholders</span></div>

      <section className="eth-section"><div className="eth-card eth-filter-bar">{[["all","All"],["weak","Weak Questions"],["repeat","Repeated Patterns"],["revision","Revision Queue"]].map(([v,l]) => <button key={v} className={`eth-filter-chip ${filter === v ? "active" : ""}`} onClick={() => setFilter(v)}>{l}</button>)}</div></section>

      <section className="eth-section"><div className="eth-section-head"><div><h2 className="eth-section-title">{loading ? "Building repair queue…" : `${visible.length} Repair Signals`}</h2><p className="eth-section-copy">Only real stored signals are shown. No fake examples or placeholder weaknesses.</p></div><button className="eth-link-button" onClick={() => navigate("/ethics/pyq")}>Practice Ethics PYQs →</button></div>
        {!loading && visible.length === 0 ? <div className="eth-card eth-review-card"><div className="eth-empty"><div className="eth-empty-title">No Ethics mistake signals yet</div><div className="eth-empty-copy">After evaluated GS4 answers begin producing weakness signals, they will appear here for repair and re-test.</div><button className="eth-btn eth-btn-primary" style={{ marginTop: 13 }} onClick={() => navigate("/ethics/pyq")}>Start an Ethics PYQ</button></div></div> : <div className="eth-mistake-list">{visible.map((m, i) => <article key={m.id || i} className="eth-card eth-mistake-item"><div className="eth-mistake-meta"><span className="eth-badge eth-badge-blue">{m.category || m.type || "Ethics"}</span>{m.severity && <span className="eth-badge">{m.severity}</span>}{m.topic && <span className="eth-badge">{m.topic}</span>}</div><div className="eth-mistake-text">{m.title || m.question || m.mistake || m.description || "Ethics weakness signal"}</div>{(m.note || m.feedback || m.reason) && <div className="eth-mistake-note">{m.note || m.feedback || m.reason}</div>}</article>)}</div>}
      </section>
    </div></div>
  );
}
