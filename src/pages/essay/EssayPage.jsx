import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LIGHT = {
  page: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceAlt: "#FCFCFD",
  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  text: "#101828",
  muted: "#667085",
  subtle: "#98A2B3",
  blue: "#0A64F5",
  blueSoft: "#F2F7FF",
  blueBorder: "#CFE0FF",
  amber: "#B54708",
  amberSoft: "#FFF8EB",
  amberBorder: "#FEDF89",
  green: "#027A48",
  greenSoft: "#ECFDF3",
  greenBorder: "#ABEFC6",
  red: "#B42318",
  redSoft: "#FEF3F2",
  redBorder: "#FECDCA",
  track: "#EAF0F7",
  shadow: "rgba(16,24,40,.06)",
};

const DARK = {
  page: "#090B0F",
  surface: "#111419",
  surfaceAlt: "#0D1015",
  border: "#242A33",
  borderStrong: "#343C48",
  text: "#F4F6F8",
  muted: "#A6AFBD",
  subtle: "#6F7A8A",
  blue: "#4C8DFF",
  blueSoft: "#101D33",
  blueBorder: "#254575",
  amber: "#FDB022",
  amberSoft: "#2A1D08",
  amberBorder: "#65430D",
  green: "#32D583",
  greenSoft: "#0D251A",
  greenBorder: "#1E5A3D",
  red: "#F97066",
  redSoft: "#2A1212",
  redBorder: "#652A25",
  track: "#1B222C",
  shadow: "rgba(0,0,0,.28)",
};

function parseRgbBrightness(value) {
  const match = String(value || "").match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!match) return null;
  const [, r, g, b] = match.map(Number);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function detectAppDarkMode() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  const storageKeys = [
    "theme", "appearance", "mode", "color-theme", "colorTheme",
    "mentoros-theme", "mentorosTheme", "darkMode"
  ];

  try {
    for (const key of storageKeys) {
      const raw = window.localStorage?.getItem(key);
      if (raw == null) continue;
      const value = String(raw).toLowerCase().trim();
      if (["dark", "night", "true", "1"].includes(value)) return true;
      if (["light", "day", "false", "0"].includes(value)) return false;
      if (value === "system") return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    }
  } catch (_) {
    // localStorage may be unavailable in private/restricted contexts.
  }

  const nodes = [document.documentElement, document.body].filter(Boolean);
  for (const node of nodes) {
    const attrs = [
      node.getAttribute("data-theme"),
      node.getAttribute("data-mode"),
      node.getAttribute("data-color-mode"),
      node.getAttribute("data-color-scheme"),
      node.getAttribute("data-appearance"),
    ].filter(Boolean).map(v => String(v).toLowerCase());

    if (attrs.some(v => v.includes("dark") || v.includes("night"))) return true;
    if (attrs.some(v => v.includes("light") || v.includes("day"))) return false;

    const classes = Array.from(node.classList || []).map(v => v.toLowerCase());
    if (classes.some(v => ["dark", "dark-mode", "theme-dark", "night"].includes(v))) return true;
    if (classes.some(v => ["light", "light-mode", "theme-light", "day"].includes(v))) return false;
  }

  const rootScheme = window.getComputedStyle(document.documentElement).colorScheme;
  if (rootScheme === "dark") return true;
  if (rootScheme === "light") return false;

  // Fallback for apps that theme the shell by changing only the root/body background.
  const bodyBrightness = parseRgbBrightness(window.getComputedStyle(document.body).backgroundColor);
  if (bodyBrightness != null) {
    if (bodyBrightness < 90) return true;
    if (bodyBrightness > 190) return false;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function useAppDarkMode() {
  const [dark, setDark] = useState(() => detectAppDarkMode());

  useEffect(() => {
    const sync = () => setDark(detectAppDarkMode());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-mode", "data-color-mode", "data-color-scheme", "data-appearance"],
    });
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "data-mode", "data-color-mode", "data-color-scheme", "data-appearance"],
      });
    }

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", sync);

    // Covers apps that store the theme in localStorage/context without mutating root classes.
    const timer = window.setInterval(sync, 700);
    window.addEventListener("storage", sync);
    window.addEventListener("themechange", sync);

    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", sync);
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
      window.removeEventListener("themechange", sync);
    };
  }, []);

  return dark;
}

function Icon({ type, size = 18 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const icons = {
    spark: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .8 2 .2.5.5.2 2 .8-2 .8-.5.2-.2.5-.8 2-.8-2-.2-.5-.5-.2-2-.8 2-.8.5-.2.2-.5.8-2Z"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5z"/></>,
    pen: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4V2M12 22v-2M4 12H2M22 12h-2"/></>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    chart: <><path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-8"/><path d="M22 20V8"/></>,
    alert: <><path d="M10.3 3.7 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0 1 5"/><path d="M20 4v7h-7"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };

  return <svg {...props}>{icons[type] || icons.spark}</svg>;
}

function Metric({ label, value, helper, icon }) {
  return (
    <div className="ei-metric">
      <div className="ei-metric-icon"><Icon type={icon} size={17} /></div>
      <div className="ei-metric-value">{value}</div>
      <div className="ei-metric-label">{label}</div>
      <div className="ei-metric-help">{helper}</div>
    </div>
  );
}

function LoopCard({ number, stage, title, description, meta, cta, icon, onClick }) {
  return (
    <button className="ei-loop-card" onClick={onClick}>
      <div className="ei-loop-top">
        <div className="ei-loop-number">{number}</div>
        <div className="ei-loop-icon"><Icon type={icon} size={18} /></div>
      </div>
      <div className="ei-loop-stage">{stage}</div>
      <div className="ei-loop-title">{title}</div>
      <div className="ei-loop-desc">{description}</div>
      <div className="ei-loop-meta">{meta}</div>
      <div className="ei-loop-cta">{cta}<Icon type="arrow" size={14} /></div>
    </button>
  );
}

function IntelligenceCard({ label, title, body, state = "locked" }) {
  const locked = state === "locked";
  return (
    <div className="ei-intel-card">
      <div className="ei-intel-head">
        <span className="ei-diagnostic-label">{label}</span>
        <span className={`ei-intel-state ${locked ? "locked" : "active"}`}>
          <Icon type={locked ? "lock" : "check"} size={11} />
          {locked ? "LOCKED" : "ACTIVE"}
        </span>
      </div>
      <div className="ei-intel-title">{title}</div>
      <div className="ei-intel-body">{body}</div>
    </div>
  );
}

export default function EssayPage() {
  const navigate = useNavigate();
  const darkMode = useAppDarkMode();
  const C = darkMode ? DARK : LIGHT;

  // Replace with real backend aggregation when connected.
  // MentorOS must not infer performance patterns until evidence is sufficient.
  const stats = {
    essaysEvaluated: 0,
    averageScore: null,
    themesCovered: 0,
    totalThemes: 8,
    mistakes: 0,
    revisionDue: 0,
  };

  const baselineTarget = 3;
  const baselineCount = Math.min(stats.essaysEvaluated, baselineTarget);
  const baselineReady = stats.essaysEvaluated >= baselineTarget;
  const baselinePct = Math.round((baselineCount / baselineTarget) * 100);

  return (
    <div className="ei-page">
      <style>{`
        .ei-page {
          min-height: 100vh;
          background: ${C.page};
          color: ${C.text};
          padding: 24px 30px 42px;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
          transition: background-color .18s ease, color .18s ease;
        }
        .ei-shell { max-width: 1460px; margin: 0 auto; }
        .ei-breadcrumb { display:flex; gap:8px; align-items:center; color:${C.subtle}; font-size:12px; font-weight:650; margin-bottom:12px; }
        .ei-breadcrumb strong { color:${C.muted}; }

        .ei-intro { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; margin-bottom:14px; }
        .ei-kicker { display:flex; align-items:center; gap:7px; color:${C.blue}; font-size:10px; font-weight:850; letter-spacing:.12em; text-transform:uppercase; margin-bottom:6px; }
        .ei-title { margin:0; font-size:34px; line-height:1.08; letter-spacing:-.035em; font-weight:790; }
        .ei-subtitle { margin-top:7px; color:${C.muted}; font-size:13px; line-height:1.55; max-width:780px; }
        .ei-state-pill { flex:0 0 auto; border:1px solid ${C.amberBorder}; background:${C.amberSoft}; color:${C.amber}; border-radius:999px; padding:6px 10px; font-size:10px; font-weight:850; letter-spacing:.03em; }

        .ei-command { background:${C.surface}; border:1px solid ${C.blueBorder}; border-left:4px solid ${C.blue}; border-radius:14px; padding:18px 20px; display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:22px; align-items:center; }
        .ei-command-label { color:${C.blue}; font-size:9.5px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .ei-command-title { margin-top:5px; font-size:18px; font-weight:800; letter-spacing:-.02em; }
        .ei-command-copy { margin-top:5px; color:${C.muted}; font-size:11.5px; line-height:1.55; max-width:800px; }
        .ei-command-actions { display:flex; align-items:center; gap:8px; margin-top:12px; flex-wrap:wrap; }
        .ei-btn { border:0; border-radius:8px; padding:9px 12px; font:inherit; font-size:11px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:.15s ease; }
        .ei-btn:hover { transform:translateY(-1px); }
        .ei-btn-primary { background:${C.blue}; color:#fff; }
        .ei-btn-secondary { background:${C.surface}; color:${C.text}; border:1px solid ${C.borderStrong}; }
        .ei-progress-box { border-left:1px solid ${C.border}; padding-left:22px; }
        .ei-progress-row { display:flex; justify-content:space-between; gap:12px; align-items:center; font-size:10px; color:${C.muted}; font-weight:700; margin-bottom:7px; }
        .ei-progress-row strong { color:${C.text}; font-size:15px; }
        .ei-progress-track { height:7px; background:${C.track}; border-radius:999px; overflow:hidden; }
        .ei-progress-fill { height:100%; background:${C.blue}; border-radius:999px; transition:width .2s ease; }
        .ei-progress-note { margin-top:7px; color:${C.subtle}; font-size:9.5px; line-height:1.4; }

        .ei-metrics { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin-top:12px; }
        .ei-metric { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; padding:13px 14px; min-width:0; }
        .ei-metric-icon { width:28px; height:28px; border-radius:8px; display:grid; place-items:center; color:${C.blue}; background:${C.blueSoft}; margin-bottom:9px; }
        .ei-metric-value { font-size:19px; line-height:1; font-weight:820; letter-spacing:-.025em; }
        .ei-metric-label { margin-top:5px; font-size:10.5px; font-weight:760; color:${C.muted}; }
        .ei-metric-help { margin-top:3px; font-size:9px; color:${C.subtle}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .ei-section-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-end; margin:20px 0 10px; }
        .ei-section-title { margin:0; font-size:16px; font-weight:800; letter-spacing:-.015em; }
        .ei-section-sub { margin-top:3px; color:${C.muted}; font-size:10.5px; }
        .ei-section-tag { color:${C.subtle}; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }

        .ei-loop { display:grid; grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1fr); gap:0; align-items:stretch; }
        .ei-loop-arrow { display:grid; place-items:center; color:${C.subtle}; }
        .ei-loop-card { background:${C.surface}; border:1px solid ${C.border}; border-radius:14px; padding:16px; text-align:left; font:inherit; cursor:pointer; transition:.16s ease; min-height:180px; }
        .ei-loop-card:hover { border-color:${C.blueBorder}; transform:translateY(-2px); box-shadow:0 8px 22px ${C.shadow}; }
        .ei-loop-top { display:flex; justify-content:space-between; align-items:center; }
        .ei-loop-number { color:${C.subtle}; font-size:10px; font-weight:900; letter-spacing:.08em; }
        .ei-loop-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:9px; background:${C.blueSoft}; color:${C.blue}; }
        .ei-loop-stage { margin-top:13px; color:${C.blue}; font-size:9px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
        .ei-loop-title { margin-top:5px; font-size:15px; font-weight:820; }
        .ei-loop-desc { margin-top:6px; color:${C.muted}; font-size:10.5px; line-height:1.5; }
        .ei-loop-meta { margin-top:9px; color:${C.subtle}; font-size:9.5px; font-weight:650; }
        .ei-loop-cta { margin-top:12px; display:flex; align-items:center; gap:5px; color:${C.blue}; font-size:10.5px; font-weight:820; }

        .ei-intel-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
        .ei-intel-card { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; padding:14px; min-height:122px; }
        .ei-intel-head { display:flex; justify-content:space-between; gap:10px; align-items:center; }
        .ei-diagnostic-label { color:${C.subtle}; font-size:8.5px; font-weight:900; letter-spacing:.11em; text-transform:uppercase; }
        .ei-intel-state { display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:4px 6px; font-size:8px; font-weight:900; letter-spacing:.05em; }
        .ei-intel-state.locked { color:${C.amber}; background:${C.amberSoft}; border:1px solid ${C.amberBorder}; }
        .ei-intel-state.active { color:${C.green}; background:${C.greenSoft}; border:1px solid ${C.greenBorder}; }
        .ei-intel-title { margin-top:12px; font-size:13px; font-weight:810; }
        .ei-intel-body { margin-top:5px; color:${C.muted}; font-size:10px; line-height:1.5; }

        .ei-bottom { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(340px,.85fr); gap:12px; margin-top:12px; }
        .ei-panel { background:${C.surface}; border:1px solid ${C.border}; border-radius:12px; padding:15px; }
        .ei-panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding-bottom:11px; border-bottom:1px solid ${C.border}; }
        .ei-panel-title { font-size:12.5px; font-weight:820; }
        .ei-panel-sub { margin-top:3px; color:${C.muted}; font-size:9.5px; line-height:1.45; }
        .ei-panel-badge { color:${C.blue}; background:${C.blueSoft}; border:1px solid ${C.blueBorder}; border-radius:999px; padding:4px 7px; font-size:8px; font-weight:900; letter-spacing:.06em; white-space:nowrap; }

        .ei-baseline-steps { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:12px; }
        .ei-baseline-step { border:1px solid ${C.border}; border-radius:10px; padding:10px; background:${C.surfaceAlt}; }
        .ei-baseline-num { width:22px; height:22px; border-radius:7px; display:grid; place-items:center; color:${C.blue}; background:${C.blueSoft}; font-size:9px; font-weight:900; }
        .ei-baseline-step strong { display:block; margin-top:7px; font-size:10px; }
        .ei-baseline-step span { display:block; margin-top:3px; color:${C.subtle}; font-size:8.8px; line-height:1.4; }

        .ei-pillar-list { display:grid; gap:8px; margin-top:12px; }
        .ei-pillar-row { display:grid; grid-template-columns:76px 1fr; gap:10px; align-items:start; }
        .ei-pillar-name { color:${C.text}; font-size:9.5px; font-weight:820; }
        .ei-pillar-copy { color:${C.muted}; font-size:9px; line-height:1.4; }

        .ei-rule { margin-top:12px; color:${C.subtle}; font-size:9px; line-height:1.45; text-align:right; }

        @media (max-width:1180px) {
          .ei-command { grid-template-columns:1fr; }
          .ei-progress-box { border-left:0; border-top:1px solid ${C.border}; padding-left:0; padding-top:14px; }
          .ei-intel-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ei-bottom { grid-template-columns:1fr; }
        }
        @media (max-width:900px) {
          .ei-page { padding:20px 16px 36px; }
          .ei-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .ei-loop { grid-template-columns:1fr; gap:9px; }
          .ei-loop-arrow { transform:rotate(90deg); height:20px; }
          .ei-baseline-steps { grid-template-columns:repeat(2,minmax(0,1fr)); }
        }
        @media (max-width:560px) {
          .ei-intro { align-items:flex-start; flex-direction:column; gap:10px; }
          .ei-title { font-size:28px; }
          .ei-metrics, .ei-intel-grid, .ei-baseline-steps { grid-template-columns:1fr; }
        }
      `}</style>

      <div className="ei-shell">
        <div className="ei-breadcrumb">
          <span>Mains</span><span>›</span><span>GS Paper I</span><span>›</span><strong>Essay</strong>
        </div>

        <header className="ei-intro">
          <div>
            <div className="ei-kicker"><Icon type="spark" size={13}/> MentorOS Essay Intelligence</div>
            <h1 className="ei-title">Essay Intelligence</h1>
            <div className="ei-subtitle">Build depth, coherence and originality through a disciplined PYQ → writing → evaluation → correction loop.</div>
          </div>
          <div className="ei-state-pill">{baselineReady ? "PERFORMANCE ACTIVE" : "BASELINE BUILDING"}</div>
        </header>

        <section className="ei-command">
          <div>
            <div className="ei-command-label">Mentor Command</div>
            <div className="ei-command-title">
              {baselineReady ? "Use evidence to attack your primary Essay bottleneck." : "Establish your Essay baseline before MentorOS diagnoses patterns."}
            </div>
            <div className="ei-command-copy">
              {baselineReady
                ? "Enough evaluated work exists to surface recurring weaknesses, neglected themes and the next skill to train."
                : "Complete 3 evaluated full-length essays. Until then MentorOS will prescribe actions and show evidence gaps — never fabricated strengths or weaknesses."}
            </div>
            <div className="ei-command-actions">
              <button className="ei-btn ei-btn-primary" onClick={() => navigate("/answer-writing/essay/institutional")}>Start baseline essay <Icon type="arrow" size={14}/></button>
              <button className="ei-btn ei-btn-secondary" onClick={() => navigate("/essay/pyq")}>Analyse a PYQ</button>
            </div>
          </div>
          <div className="ei-progress-box">
            <div className="ei-progress-row"><span>Baseline evidence</span><strong>{baselineCount}/{baselineTarget}</strong></div>
            <div className="ei-progress-track"><div className="ei-progress-fill" style={{ width: `${baselinePct}%` }}/></div>
            <div className="ei-progress-note">Pattern Intelligence unlocks after {baselineTarget} evaluated essays.</div>
          </div>
        </section>

        <section className="ei-metrics">
          <Metric icon="file" label="Baseline" value={`${baselineCount}/${baselineTarget}`} helper="Evaluated essays" />
          <Metric icon="chart" label="Average Score" value={stats.averageScore == null ? "— /125" : `${stats.averageScore}/125`} helper="Activates with evidence" />
          <Metric icon="layers" label="Theme Coverage" value={`${stats.themesCovered}/${stats.totalThemes}`} helper="Essay families attempted" />
          <Metric icon="alert" label="Active Mistakes" value={stats.mistakes} helper="Recurring weaknesses" />
          <Metric icon="refresh" label="Revision Due" value={stats.revisionDue} helper="Spaced improvement" />
        </section>

        <div className="ei-section-head">
          <div>
            <h2 className="ei-section-title">Your Essay Loop</h2>
            <div className="ei-section-sub">Understand the demand → perform under exam conditions → diagnose and rewrite.</div>
          </div>
          <div className="ei-section-tag">Understand → Perform → Improve</div>
        </div>

        <section className="ei-loop">
          <LoopCard
            number="01"
            stage="Understand"
            title="PYQ Intelligence"
            description="Decode the topic before writing: theme family, interpretation, dimensions, thesis possibilities and recurring UPSC patterns."
            meta="Themes • dimensions • thesis • PYQ patterns"
            cta="Explore PYQs"
            icon="book"
            onClick={() => navigate("/essay/pyq")}
          />
          <div className="ei-loop-arrow"><Icon type="arrow" size={17}/></div>
          <LoopCard
            number="02"
            stage="Perform"
            title="Essay Lab"
            description="Write in test conditions or upload a completed essay. Preserve the original answer and evaluate it against UPSC Essay standards."
            meta="90 min • full essay • strict evaluation"
            cta="Start Essay"
            icon="pen"
            onClick={() => navigate("/answer-writing/essay/institutional")}
          />
          <div className="ei-loop-arrow"><Icon type="arrow" size={17}/></div>
          <LoopCard
            number="03"
            stage="Improve"
            title="Mistake Intelligence"
            description="Convert evaluation into repeatable corrections: pattern tracking, revision items, weak sections and deliberate rewrites."
            meta="Patterns • weak dimensions • revision • rewrite"
            cta="Review Mistakes"
            icon="target"
            onClick={() => navigate("/essay/mistakes")}
          />
        </section>

        <div className="ei-section-head">
          <div>
            <h2 className="ei-section-title">Mentor Intelligence</h2>
            <div className="ei-section-sub">Signals appear only when the evidence supports them.</div>
          </div>
          <div className="ei-section-tag">Evidence-gated</div>
        </div>

        <section className="ei-intel-grid">
          <IntelligenceCard
            label="Primary Bottleneck"
            title={baselineReady ? "Diagnosis available" : "Baseline unavailable"}
            body={baselineReady ? "Connect backend intelligence here." : "MentorOS needs 3 evaluated essays before naming a primary weakness."}
            state={baselineReady ? "active" : "locked"}
          />
          <IntelligenceCard
            label="Pattern Intelligence"
            title={baselineReady ? "Recurring pattern detected" : "Unlock after 3 essays"}
            body={baselineReady ? "Connect repeated structure, coherence and content patterns here." : "Repeated mistakes are detected only across multiple evaluated attempts."}
            state={baselineReady ? "active" : "locked"}
          />
          <IntelligenceCard
            label="Theme Intelligence"
            title={baselineReady ? "Coverage profile ready" : "No evidence yet"}
            body={baselineReady ? "Show overused and neglected theme families here." : "Attempted essays are required to identify strong, weak and neglected dimensions."}
            state={baselineReady ? "active" : "locked"}
          />
          <IntelligenceCard
            label="Next Skill"
            title={baselineReady ? "Skill prescription ready" : "Establish baseline"}
            body={baselineReady ? "Prescribe one measurable skill for the next essay." : "Your next task is evidence creation, not optimisation."}
            state={baselineReady ? "active" : "locked"}
          />
        </section>

        <section className="ei-bottom">
          <div className="ei-panel">
            <div className="ei-panel-head">
              <div>
                <div className="ei-panel-title">Today · Baseline Protocol</div>
                <div className="ei-panel-sub">One complete cycle is more useful than passive browsing.</div>
              </div>
              <span className="ei-panel-badge">NEXT ACTION</span>
            </div>
            <div className="ei-baseline-steps">
              <div className="ei-baseline-step"><div className="ei-baseline-num">1</div><strong>Analyse 1 PYQ</strong><span>Identify core tension, thesis and dimensions.</span></div>
              <div className="ei-baseline-step"><div className="ei-baseline-num">2</div><strong>Build outline</strong><span>Intro → thesis → 5–7 dimensions → conclusion.</span></div>
              <div className="ei-baseline-step"><div className="ei-baseline-num">3</div><strong>Write 90 min</strong><span>Full-length test-condition attempt.</span></div>
              <div className="ei-baseline-step"><div className="ei-baseline-num">4</div><strong>Evaluate + save</strong><span>Capture mistakes and one rewrite task.</span></div>
            </div>
          </div>

          <div className="ei-panel">
            <div className="ei-panel-head">
              <div>
                <div className="ei-panel-title">Evaluation Lens</div>
                <div className="ei-panel-sub">What every Essay review should measure.</div>
              </div>
              <span className="ei-panel-badge">4 PILLARS</span>
            </div>
            <div className="ei-pillar-list">
              <div className="ei-pillar-row"><div className="ei-pillar-name">Breadth</div><div className="ei-pillar-copy">Relevant dimensions without checklist-style dumping.</div></div>
              <div className="ei-pillar-row"><div className="ei-pillar-name">Depth</div><div className="ei-pillar-copy">Reasoning, examples, thinkers, data and conceptual insight.</div></div>
              <div className="ei-pillar-row"><div className="ei-pillar-name">Coherence</div><div className="ei-pillar-copy">Thesis, transitions, progression and synthesis.</div></div>
              <div className="ei-pillar-row"><div className="ei-pillar-name">Originality</div><div className="ei-pillar-copy">Distinctive but defensible articulation and perspective.</div></div>
            </div>
          </div>
        </section>

        <div className="ei-rule">MentorOS data rule: no performance claim is shown without sufficient evaluated evidence.</div>
      </div>
    </div>
  );
}
