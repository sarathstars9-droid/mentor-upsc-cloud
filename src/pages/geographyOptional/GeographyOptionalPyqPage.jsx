import { useState, useEffect, useMemo, useRef } from "react";
import { BACKEND_URL } from "../../config";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const T = {
  bg: "#09090b",
  surface: "#111113",
  surfaceHigh: "#18181b",
  border: "#1f1f23",
  borderMid: "#27272a",
  muted: "#3f3f46",
  subtle: "#52525b",
  dim: "#71717a",
  text: "#d4d4d8",
  textBright: "#f4f4f5",
  amber: "#f59e0b",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
};
const ACCENT = T.blue;
const SAN = "'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ── Category definitions ──────────────────────────────────────────────────────
const GEO_CATS = [
  { id: "Geomorphology", label: "Geomorphology", icon: "⛰️", paper: 1, desc: "Landforms, Davis, Penck, erosion cycles" },
  { id: "Climatology", label: "Climatology", icon: "🌩️", paper: 1, desc: "Monsoon, climate types, jet streams" },
  { id: "Oceanography", label: "Oceanography", icon: "🌊", paper: 1, desc: "Currents, tides, ocean resources" },
  { id: "Biogeography", label: "Biogeography", icon: "🌿", paper: 1, desc: "Ecosystem, biomes, soil geography" },
  { id: "Perspectives in Human Geography", label: "Human Geography", icon: "👥", paper: 1, desc: "Schools of thought, models, theories" },
  { id: "Models, Theories and Laws", label: "Models & Theories", icon: "📐", paper: 1, desc: "Christaller, Von Thunen, gravity model" },
  { id: "Economic Geography", label: "Economic Geo", icon: "📊", paper: 1, desc: "Resources, industries, trade, energy" },
  { id: "Population and Settlement Geography", label: "Population", icon: "🏘️", paper: 1, desc: "Distribution, density, urbanisation" },
  { id: "Regional Planning", label: "Regional Planning", icon: "🧭", paper: 1, desc: "Regional disparities, planning" },

  { id: "Physical Setting and Resources", label: "Physical India", icon: "🗺️", paper: 2, desc: "Physiography, drainage, climate of India" },
  { id: "Agriculture", label: "Agriculture", icon: "🌾", paper: 2, desc: "Land use, green revolution, irrigation" },
  { id: "Industry", label: "Industry", icon: "🏭", paper: 2, desc: "Industrial location, SEZs, manufacturing" },
  { id: "Settlements and Demography", label: "Settlements", icon: "🏙️", paper: 2, desc: "Urban hierarchy, population trends" },
  { id: "Regional Development and Planning", label: "Regional Dev.", icon: "📍", paper: 2, desc: "Regional disparities, planning" },
  { id: "Contemporary Issues", label: "Contemporary", icon: "📰", paper: 2, desc: "Disaster, environment, GIS, RS" },
  { id: "Transport, Communication and Trade", label: "Transport & Trade", icon: "🚂", paper: 2, desc: "Road, rail, waterways, trade corridors" },
  { id: "Cultural Setting", label: "Cultural Setting", icon: "🎭", paper: 2, desc: "Ethnic, linguistic, religious patterns" },
  { id: "Political Aspects", label: "Political Aspects", icon: "🧭", paper: 2, desc: "Borders, geopolitics, federal issues" },
];

const CATEGORY_RULES = {
  "Geomorphology": { nodes: ["OPT-P1-GEOM"] },
  "Climatology": { nodes: ["OPT-P1-CLIM"] },
  "Oceanography": { nodes: ["OPT-P1-OCEAN"] },
  "Biogeography": { nodes: ["OPT-P1-BIOGEO"] },
  "Perspectives in Human Geography": { nodes: ["OPT-P1-HG-PERSPECTIVES"] },
  "Models, Theories and Laws": { themes: ["Models, Theories and Laws"] },
  "Economic Geography": { themes: ["Economic Geography"] },
  "Population and Settlement Geography": { nodes: ["OPT-P1-SETTLEMENT"] },
  "Regional Planning": { nodes: ["OPT-P1-REGIONAL-PLANNING"] },
  "Physical Setting and Resources": { nodes: ["OPT-P2-INDIA-PHYS", "OPT-P2-RESOURCES"] },
  "Agriculture": { nodes: ["OPT-P2-AGRI"] },
  "Industry": { nodes: ["OPT-P2-INDUSTRY"] },
  "Settlements and Demography": { nodes: ["OPT-P2-SETTLEMENTS"] },
  "Regional Development and Planning": { nodes: ["OPT-P2-REGIONAL-DEV"] },
  "Contemporary Issues": { nodes: ["OPT-P2-CONTEMP"] },
  "Transport, Communication and Trade": { nodes: ["OPT-P2-TRANSPORT-TRADE"] },
  "Cultural Setting": { nodes: ["OPT-P2-CULTURAL"] },
  "Political Aspects": { nodes: ["OPT-P2-POLITICAL"] },
};

const MARKS_FILTERS = [
  { v: "all", l: "All" },
  { v: "10", l: "10M" },
  { v: "15", l: "15M" },
  { v: "20", l: "20M" },
  { v: "25", l: "25M" },
];

// ── Prompts ───────────────────────────────────────────────────────────────────
const ANALYZE_PROMPT = `You are a UPSC Geography Optional expert examiner.

TASK: Deep analysis of the question provided.

RETURN:
1. QUESTION DEMAND — Exact what is being asked. Identify keywords (critically examine, discuss, analyze, explain, evaluate).
2. QUESTION TYPE — Descriptive / Analytical / Comparative / Integrative / Map-based / Contemporary
3. TOPPER THINKING — How should a top scorer approach this question? What is the mental model?
4. IDEAL STRUCTURE — Give a specific outline: Introduction → 3-4 body sections → Conclusion framework
5. CONCEPTUAL ANCHORS — Which theories, thinkers, models, or case studies are most relevant?
6. COMMON MISTAKES — What do average candidates typically miss or do wrong on this?
7. DIAGRAM/MAP RELEVANCE — Can a diagram or sketch map add value? Suggest what.
8. ANSWER STRATEGY — Final 2-3 line advice on how to begin and what tone to maintain.

QUESTION: [paste question here]`;

const SOURCE_PROMPT = `You are a UPSC question forensics expert.

TASK: Identify the likely SOURCE TRADITION of the given Geography Optional question.

ANALYZE AND CLASSIFY:
1. LIKELY SOURCE — Which of these does it most resemble?
   - IGNOU PGDRD / MA Geography study material
   - NCERT class 11-12 Geography (Fundamentals / India)
   - Standard optional textbooks (Majid Husain, D.R. Khullar, Savindra Singh)
   - Academic/university exam tradition (UGC-NET style)
   - Contemporary issue framing (news/data-driven question)
   - PYQ-derived reframe (similar to past UPSC papers)
   - Coaching module / model test bank style
   - Generic compilation / mixed-style test

2. SOURCE CLUES — Which features indicate that?
3. CONFIDENCE — How confident? If uncertain, rank top 2-3.
4. IMPLICATION FOR PREPARATION — What study material should be prioritized?

QUESTION: [paste question here]`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalize(v) {
  return String(v || "").trim();
}

function getRule(catId) {
  return CATEGORY_RULES[catId] || { nodes: [], themes: [] };
}

function belongsToCategory(q, catId) {
  const rule = getRule(catId);
  const qNode = normalize(q.syllabusNodeId);
  const qTheme = normalize(q.theme);
  if (rule.nodes?.length && rule.nodes.includes(qNode)) return true;
  if (rule.themes?.length && rule.themes.includes(qTheme)) return true;
  return false;
}

function belongsToPaper(q, paperFilter) {
  if (paperFilter === "all") return true;
  const node = normalize(q.syllabusNodeId);
  const prefix = `OPT-P${paperFilter}-`;
  return node.startsWith(prefix);
}

// ── Shared UI components ──────────────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      style={{
        background: copied ? "#0d2e12" : "#141414",
        border: `1px solid ${copied ? T.green : "#2a2a2a"}`,
        color: copied ? T.green : "#888",
        borderRadius: 6,
        padding: "5px 14px",
        fontSize: 12,
        cursor: "pointer",
        fontFamily: MONO,
        transition: "all 0.2s",
        fontWeight: 600,
      }}
    >
      {copied ? "✓ Copied" : "Copy Prompt"}
    </button>
  );
};

const PromptPanel = ({ title, prompt, visible }) => {
  if (!visible) return null;
  return (
    <div style={{ background: "#0a1a0a", border: "1px solid #1a3a1a", borderRadius: 10, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: T.green, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: MONO }}>
          {title}
        </span>
        <CopyButton text={prompt} />
      </div>
      <pre
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color: "#9ca3af",
          whiteSpace: "pre-wrap",
          lineHeight: 1.8,
          margin: 0,
          background: "#050f05",
          borderRadius: 7,
          padding: 14,
          border: "1px solid #1a2e1a",
          maxHeight: 300,
          overflowY: "auto",
        }}
      >
        {prompt}
      </pre>
    </div>
  );
};

const SectionCard = ({ title, subtitle, children, accent }) => (
  <div
    style={{
      background: "#161618",
      border: "1px solid #2a2a30",
      borderRadius: 12,
      padding: "20px 22px",
      marginBottom: 18,
    }}
  >
    {title && (
      <div style={{ marginBottom: subtitle ? 2 : 14 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: accent || T.amber,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontFamily: MONO,
          }}
        >
          {title}
        </span>
      </div>
    )}
    {subtitle && (
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 16, fontFamily: SAN }}>{subtitle}</div>
    )}
    {children}
  </div>
);

const TogglePill = ({ label, active, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      background: active ? "#1e1400" : "#0e0e0e",
      border: `1.5px solid ${active ? T.amber : "#2a2a2a"}`,
      color: active ? T.amber : "#666",
      borderRadius: 20,
      padding: "6px 16px",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: SAN,
      fontWeight: active ? 700 : 400,
      transition: "all 0.15s",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: active ? T.amber : "#3a3a3a",
        display: "inline-block",
        transition: "background 0.15s",
      }}
    />
    {label}
  </button>
);

function StatBadge({ label, color, bg }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color,
        background: bg || `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 20,
        padding: "5px 14px",
        fontFamily: MONO,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function FilterPill({ label, active, onClick, accent = ACCENT }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        border: active ? `1.5px solid ${accent}` : `1px solid ${T.borderMid}`,
        background: active ? `${accent}1a` : "transparent",
        color: active ? accent : T.dim,
        fontWeight: active ? 700 : 400,
        fontSize: 12,
        cursor: "pointer",
        fontFamily: SAN,
        transition: "all 0.12s",
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}

function CategoryCard({ cat, active, count, onClick }) {
  const paperColor = cat.paper === 1 ? ACCENT : T.amber;
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `${paperColor}14` : "#161618",
        border: active ? `1.5px solid ${paperColor}60` : "1px solid #2a2a30",
        borderRadius: 10,
        padding: "12px 14px",
        cursor: "pointer",
        fontFamily: SAN,
        textAlign: "left",
        transition: "border-color 0.12s, background 0.12s",
        width: "100%",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = `${paperColor}40`;
          e.currentTarget.style.background = `${paperColor}08`;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "#2a2a30";
          e.currentTarget.style.background = "#161618";
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 17 }}>{cat.icon}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: paperColor,
            background: `${paperColor}18`,
            border: `1px solid ${paperColor}30`,
            borderRadius: 4,
            padding: "1px 6px",
            fontFamily: MONO,
          }}
        >
          P{cat.paper}
        </span>
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: active ? paperColor : T.textBright,
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {cat.label}
      </div>
      <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.4, marginBottom: 6 }}>{cat.desc}</div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: active ? paperColor : T.subtle,
          fontFamily: MONO,
        }}
      >
        {count} Qs
      </div>
    </button>
  );
}

// ── Focus card ────────────────────────────────────────────────────────────────
function FocusCard({ selectedQ, onClear }) {
  if (!selectedQ) {
    return (
      <div
        style={{
          background: T.surfaceHigh,
          border: `1px dashed ${T.borderMid}`,
          borderRadius: 12,
          padding: "36px 28px",
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.3 }}>↓</div>
        <div style={{ fontSize: 15, color: T.subtle, fontWeight: 600, fontFamily: SAN }}>
          Select a question from the bank below
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6, fontFamily: SAN }}>
          It will appear here and populate the workspace
        </div>
      </div>
    );
  }

  const paperColor = selectedQ.paperNumber === 1 ? ACCENT : T.amber;

  return (
    <div
      style={{
        position: "relative",
        background: `linear-gradient(135deg, ${paperColor}18, ${paperColor}06)`,
        border: `2px solid ${paperColor}55`,
        borderLeft: `4px solid ${paperColor}`,
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: paperColor, letterSpacing: "0.1em", fontFamily: MONO }}>
              ✓ SELECTED
            </span>
            {selectedQ.year && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.amber,
                  background: `${T.amber}14`,
                  border: `1px solid ${T.amber}30`,
                  borderRadius: 5,
                  padding: "2px 8px",
                  fontFamily: MONO,
                }}
              >
                UPSC {selectedQ.year}
              </span>
            )}
            {selectedQ.paperNumber && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: paperColor,
                  background: `${paperColor}18`,
                  border: `1px solid ${paperColor}35`,
                  borderRadius: 5,
                  padding: "2px 8px",
                  fontFamily: MONO,
                }}
              >
                Paper {selectedQ.paperNumber}
              </span>
            )}
            {selectedQ.marks && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.green,
                  background: `${T.green}10`,
                  border: `1px solid ${T.green}28`,
                  borderRadius: 5,
                  padding: "2px 8px",
                  fontFamily: MONO,
                }}
              >
                {selectedQ.marks}M
              </span>
            )}
            {selectedQ.directive && (
              <span style={{ fontSize: 11, color: T.dim, fontFamily: SAN }}>{selectedQ.directive}</span>
            )}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textBright, lineHeight: 1.75, fontFamily: SAN }}>
            {selectedQ.question}
          </div>
          {selectedQ.theme && (
            <div style={{ fontSize: 11, color: T.subtle, marginTop: 8, fontFamily: SAN }}>
              Theme: {selectedQ.theme}
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          style={{
            background: "none",
            border: `1px solid ${T.borderMid}`,
            borderRadius: 7,
            color: T.dim,
            fontSize: 12,
            cursor: "pointer",
            padding: "5px 12px",
            fontFamily: SAN,
            flexShrink: 0,
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.red; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = T.dim; e.currentTarget.style.borderColor = T.borderMid; }}
        >
          Clear ×
        </button>
      </div>
    </div>
  );
}

// ── Question row (in bank) ────────────────────────────────────────────────────
function QuestionRow({ q, onSelect, selected }) {
  const paperColor = q.paperNumber === 1 ? ACCENT : T.amber;
  const rowBg = selected ? `${paperColor}28` : "#252530";
  const rowBorder = selected ? paperColor : "#3a3a48";
  return (
    <div
      onClick={() => onSelect(q)}
      style={{
        background: rowBg,
        border: `${selected ? "1.5px" : "1px"} solid ${rowBorder}`,
        borderRadius: 9,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.12s, background 0.12s",
        marginBottom: 8,
        flexShrink: 0,
        minHeight: 72,
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = paperColor;
          e.currentTarget.style.background = `${paperColor}18`;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = "#3a3a48";
          e.currentTarget.style.background = "#252530";
        }
      }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${paperColor}, ${paperColor}00)` }} />
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
          {q.year && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: "#fbbf24",
                background: "#fbbf2418",
                border: "1px solid #fbbf2440",
                borderRadius: 4,
                padding: "1px 7px",
                fontFamily: MONO,
              }}
            >
              {q.year}
            </span>
          )}
          {q.paperNumber && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: paperColor,
                background: `${paperColor}22`,
                border: `1px solid ${paperColor}50`,
                borderRadius: 4,
                padding: "1px 7px",
                fontFamily: MONO,
              }}
            >
              P{q.paperNumber}
            </span>
          )}
          {q.marks && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#4ade80",
                background: "#4ade8018",
                border: "1px solid #4ade8040",
                borderRadius: 4,
                padding: "1px 7px",
                fontFamily: MONO,
              }}
            >
              {q.marks}M
            </span>
          )}
          {q.directive && (
            <span style={{ fontSize: 11, color: "#8888a0", fontStyle: "italic", fontFamily: SAN }}>{q.directive}</span>
          )}
          {q.theme && (
            <span
              style={{
                fontSize: 10,
                color: "#666680",
                fontFamily: SAN,
                marginLeft: "auto",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {q.theme}
            </span>
          )}
          {selected && (
            <span style={{ fontSize: 12, fontWeight: 800, color: paperColor }}>✓</span>
          )}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: selected ? 600 : 400,
            color: selected ? "#ffffff" : "#c8c8d0",
            lineHeight: 1.65,
            fontFamily: SAN,
          }}
        >
          {(q.question || "").slice(0, 220)}
          {(q.question || "").length > 220 ? "…" : ""}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            background: "#1c1c20",
            border: "1px solid #2e2e34",
            borderRadius: 9,
            padding: "14px 18px",
            opacity: 1 - i * 0.12,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 9 }}>
            <div style={{ height: 16, width: 40, borderRadius: 4, background: "#2e2e38" }} />
            <div style={{ height: 16, width: 28, borderRadius: 4, background: "#282830" }} />
            <div style={{ height: 16, width: 28, borderRadius: 4, background: "#262628" }} />
          </div>
          <div style={{ height: 14, width: "85%", borderRadius: 4, background: "#28282e", marginBottom: 8 }} />
          <div style={{ height: 14, width: "60%", borderRadius: 4, background: "#242428" }} />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PAPER_OPTIONS = ["Paper 1", "Paper 2"];
const SECTION_OPTIONS = [
  "Physical Geography",
  "Human Geography",
  "Indian Geography",
  "World Geography",
  "Geomorphology",
  "Climatology",
  "Oceanography",
  "Economic Geography",
  "Other",
];

const inputBase = {
  background: "#101014",
  border: "1px solid #2a2a30",
  borderRadius: 8,
  color: "#d8d8de",
  fontSize: 13,
  padding: "9px 12px",
  fontFamily: SAN,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

export default function GeographyOptionalPyqPage() {
  const [question, setQuestion] = useState("");
  const [source, setSource] = useState("");
  const [year, setYear] = useState("");
  const [paper, setPaper] = useState("");
  const [section, setSection] = useState("");
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [savedAnalysis, setSavedAnalysis] = useState("");
  const [savedSourceNote, setSavedSourceNote] = useState("");
  const [weak, setWeak] = useState(false);
  const [review, setReview] = useState(false);
  const [revision, setRevision] = useState(false);

  const [pyqList, setPyqList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [paperFilter, setPaperFilter] = useState("all");
  const [marksFilter, setMarksFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedQ, setSelectedQ] = useState(null);

  const focusRef = useRef(null);

  function fetchQuestions() {
    setLoading(true);
    setError(null);
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=geography_optional`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPyqList(Array.isArray(data?.questions) ? data.questions : []);
      })
      .catch((err) => {
        setError(err.message || "Backend error");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchQuestions(); }, []);

  const catCounts = useMemo(() => {
    const map = {};
    GEO_CATS.forEach((c) => {
      map[c.id] = pyqList.filter((q) => belongsToCategory(q, c.id)).length;
    });
    return map;
  }, [pyqList]);

  const p1Count = useMemo(() => pyqList.filter((q) => belongsToPaper(q, "1")).length, [pyqList]);
  const p2Count = useMemo(() => pyqList.filter((q) => belongsToPaper(q, "2")).length, [pyqList]);

  const availableYears = useMemo(() => {
    const yrs = [...new Set(pyqList.map((q) => q.year).filter(Boolean))].sort((a, b) => a - b);
    return yrs;
  }, [pyqList]);

  const visibleCats = useMemo(() => {
    if (paperFilter === "1") return GEO_CATS.filter((c) => c.paper === 1);
    if (paperFilter === "2") return GEO_CATS.filter((c) => c.paper === 2);
    return GEO_CATS;
  }, [paperFilter]);

  const filtered = useMemo(
    () =>
      pyqList.filter((q) => {
        if (activeCategory !== "all" && !belongsToCategory(q, activeCategory)) return false;
        if (!belongsToPaper(q, paperFilter)) return false;
        if (marksFilter !== "all" && String(q.marks) !== marksFilter) return false;
        if (yearFilter !== "all" && String(q.year) !== String(yearFilter)) return false;
        if (searchText) {
          const s = searchText.toLowerCase();
          const hay = [q.question || "", q.theme || "", q.directive || "", q.syllabusNodeId || "", String(q.year || "")]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      }),
    [pyqList, activeCategory, paperFilter, marksFilter, yearFilter, searchText]
  );

  function handleSelect(q) {
    setQuestion(q.question || "");
    setYear(String(q.year || ""));
    setSource(`UPSC ${q.year || ""}`);
    if (q.paperNumber) setPaper(`Paper ${q.paperNumber}`);
    if (q.theme) setSection(q.theme);
    setSelectedId(q.id);
    setSelectedQ(q);
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleClear() {
    setSelectedId(null);
    setSelectedQ(null);
    setQuestion("");
    setYear("");
    setSource("");
    setPaper("");
    setSection("");
  }

  return (
    <div
      style={{
        background: T.bg,
        minHeight: "100vh",
        padding: "28px 32px",
        fontFamily: SAN,
        color: T.text,
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 10,
            color: T.subtle,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 6,
            fontFamily: MONO,
          }}
        >
          Geography Optional · PYQ
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: T.textBright,
            letterSpacing: "-0.02em",
            fontFamily: SAN,
          }}
        >
          Geography Optional PYQ
        </h1>
      </div>

      {/* ── Stats + search bar ──────────────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(135deg, #090d1a, #08090e)`,
          border: `1px solid ${ACCENT}20`,
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 14,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {loading ? (
          <span style={{ fontSize: 12, color: T.dim }}>Loading…</span>
        ) : error ? (
          <span style={{ fontSize: 12, color: T.red }}>Failed to load</span>
        ) : (
          <>
            <StatBadge label={`${pyqList.length} Total`} color={T.textBright} />
            <StatBadge label={`${p1Count} Paper 1`} color={ACCENT} />
            <StatBadge label={`${p2Count} Paper 2`} color={T.amber} />
            <StatBadge label={`${pyqList.filter((q) => q.marks === 15).length} × 15M`} color={T.green} />
          </>
        )}
        <div style={{ marginLeft: "auto", position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 13,
              color: T.dim,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search questions…"
            style={{
              ...inputBase,
              paddingLeft: 32,
              width: 220,
            }}
          />
        </div>
      </div>

      {/* ── Paper + Marks filters ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
          padding: "4px 0",
        }}
      >
        <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 9, padding: 3, border: `1px solid ${T.border}` }}>
          {[
            { v: "all", l: "All Papers" },
            { v: "1", l: "Paper 1" },
            { v: "2", l: "Paper 2" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => { setPaperFilter(f.v); setActiveCategory("all"); }}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "none",
                background: paperFilter === f.v ? (f.v === "1" ? ACCENT : f.v === "2" ? T.amber : "#222") : "transparent",
                color: paperFilter === f.v ? (f.v === "all" ? T.textBright : "#000") : T.dim,
                fontWeight: paperFilter === f.v ? 700 : 400,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: SAN,
                transition: "all 0.12s",
              }}
            >
              {f.l}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: T.borderMid }} />

        <div style={{ display: "flex", gap: 4 }}>
          {MARKS_FILTERS.map((f) => (
            <FilterPill
              key={f.v}
              label={f.l}
              active={marksFilter === f.v}
              onClick={() => setMarksFilter(f.v)}
              accent={T.green}
            />
          ))}
        </div>
      </div>

      {/* ── Year filter ──────────────────────────────────────────────────────── */}
      {availableYears.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
            flexWrap: "wrap",
            background: "#121218",
            border: "1px solid #252530",
            borderRadius: 10,
            padding: "10px 14px",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.subtle,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: MONO,
              marginRight: 4,
              whiteSpace: "nowrap",
            }}
          >
            Year
          </span>
          <button
            onClick={() => setYearFilter("all")}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: yearFilter === "all" ? `1.5px solid ${T.amber}` : "1px solid #2e2e38",
              background: yearFilter === "all" ? `${T.amber}18` : "transparent",
              color: yearFilter === "all" ? T.amber : T.dim,
              fontWeight: yearFilter === "all" ? 700 : 400,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: MONO,
              transition: "all 0.12s",
            }}
          >
            All
          </button>
          {availableYears.map((yr) => {
            const cnt = pyqList.filter(
              (q) =>
                String(q.year) === String(yr) &&
                (activeCategory === "all" || belongsToCategory(q, activeCategory)) &&
                belongsToPaper(q, paperFilter) &&
                (marksFilter === "all" || String(q.marks) === marksFilter)
            ).length;
            const isActive = yearFilter === String(yr);
            return (
              <button
                key={yr}
                onClick={() => setYearFilter(isActive ? "all" : String(yr))}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: isActive ? `1.5px solid ${T.amber}` : "1px solid #2e2e38",
                  background: isActive ? `${T.amber}18` : "transparent",
                  color: isActive ? T.amber : cnt > 0 ? "#aaa" : T.muted,
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 12,
                  cursor: cnt > 0 ? "pointer" : "default",
                  fontFamily: MONO,
                  transition: "all 0.12s",
                  opacity: cnt > 0 ? 1 : 0.35,
                  position: "relative",
                }}
              >
                {yr}
                {cnt > 0 && (
                  <span
                    style={{
                      marginLeft: 5,
                      fontSize: 10,
                      color: isActive ? T.amber : T.muted,
                      fontWeight: 400,
                    }}
                  >
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Category grid ────────────────────────────────────────────────────── */}
      <div
        style={{
          fontSize: 11,
          color: T.subtle,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 10,
          fontFamily: MONO,
        }}
      >
        Filter by Theme
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setActiveCategory("all")}
          style={{
            background: activeCategory === "all" ? `${ACCENT}14` : "#161618",
            border: activeCategory === "all" ? `1.5px solid ${ACCENT}55` : "1px solid #2a2a30",
            borderRadius: 10,
            padding: "14px 14px",
            cursor: "pointer",
            fontFamily: SAN,
            fontSize: 13,
            fontWeight: activeCategory === "all" ? 700 : 500,
            color: activeCategory === "all" ? ACCENT : T.dim,
            textAlign: "left",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 18 }}>🗂️</span>
          <span>All Themes</span>
          {!loading && (
            <span style={{ fontSize: 11, color: T.subtle, fontFamily: MONO }}>{pyqList.length} Qs</span>
          )}
        </button>

        {visibleCats.map((cat) => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            active={activeCategory === cat.id}
            count={catCounts[cat.id] || 0}
            onClick={() => setActiveCategory((prev) => (prev === cat.id ? "all" : cat.id))}
          />
        ))}
      </div>

      {/* ── Focus card ──────────────────────────────────────────────────────── */}
      <div ref={focusRef} style={{ scrollMarginTop: 16 }} />
      <FocusCard selectedQ={selectedQ} onClear={handleClear} />

      {/* ── Workspace label ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: ACCENT,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontFamily: MONO,
          }}
        >
          Workspace
        </div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${ACCENT}40, transparent)` }} />
      </div>

      {/* ── 2-column workspace ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {/* Left column */}
        <div>
          <SectionCard title="Question Workspace" subtitle="Paste question + optional metadata">
            <label style={{ fontSize: 11, color: T.dim, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: MONO }}>
              Question Text
            </label>
            <textarea
              rows={5}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Paste geography optional question here…"
              style={{
                ...inputBase,
                resize: "vertical",
                marginBottom: 14,
                lineHeight: 1.7,
                fontFamily: SAN,
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: T.dim, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: MONO }}>
                  Year
                </label>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2019"
                  style={inputBase}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: T.dim, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: MONO }}>
                  Source
                </label>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. UPSC 2019"
                  style={inputBase}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: T.dim, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: MONO }}>
                  Paper
                </label>
                <select
                  value={paper}
                  onChange={(e) => setPaper(e.target.value)}
                  style={{ ...inputBase, cursor: "pointer" }}
                >
                  <option value="">Select</option>
                  {PAPER_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: T.dim, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: MONO }}>
                  Section / Topic
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  style={{ ...inputBase, cursor: "pointer" }}
                >
                  <option value="">Select</option>
                  {SECTION_OPTIONS.map((sv) => <option key={sv}>{sv}</option>)}
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="ChatGPT Analysis" subtitle="Reveal copy-ready prompts — use in ChatGPT manually">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => { setShowAnalyze((v) => !v); setShowSource(false); }}
                style={{
                  background: showAnalyze ? "#1a1200" : T.amber,
                  border: "none",
                  color: showAnalyze ? T.amber : "#000",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: SAN,
                  fontWeight: 700,
                  textAlign: "left",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>⚡</span>
                Evaluate / Analyze This Question
              </button>
              <button
                onClick={() => { setShowSource((v) => !v); setShowAnalyze(false); }}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.borderMid}`,
                  color: T.dim,
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: SAN,
                  fontWeight: 500,
                  textAlign: "left",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.subtle; e.currentTarget.style.color = T.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.dim; }}
              >
                <span>🔍</span>
                Find Question Source Tradition
              </button>
            </div>
            <PromptPanel title="Question Analysis Prompt" prompt={ANALYZE_PROMPT} visible={showAnalyze} />
            <PromptPanel title="Source Tradition Prompt" prompt={SOURCE_PROMPT} visible={showSource} />
          </SectionCard>

          <SectionCard title="Question Flags" subtitle="Tag this question for later tracking">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <TogglePill label="Mark as Weak" active={weak} onToggle={() => setWeak((v) => !v)} />
              <TogglePill label="Add to Mistake Review" active={review} onToggle={() => setReview((v) => !v)} />
              <TogglePill label="Add to Future Revision" active={revision} onToggle={() => setRevision((v) => !v)} />
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div>
          <SectionCard title="Saved ChatGPT Analysis" subtitle="Paste ChatGPT output here to save locally" accent={T.green}>
            <textarea
              rows={9}
              value={savedAnalysis}
              onChange={(e) => setSavedAnalysis(e.target.value)}
              placeholder="Paste ChatGPT question analysis here…"
              style={{ ...inputBase, resize: "vertical", lineHeight: 1.7, fontFamily: SAN }}
            />
            {savedAnalysis && (
              <div style={{ marginTop: 10 }}>
                <CopyButton text={savedAnalysis} />
              </div>
            )}
          </SectionCard>

          <SectionCard title="Saved Source-Fit Note" subtitle="Paste source tradition output here" accent={T.green}>
            <textarea
              rows={9}
              value={savedSourceNote}
              onChange={(e) => setSavedSourceNote(e.target.value)}
              placeholder="Paste source-fit analysis from ChatGPT here…"
              style={{ ...inputBase, resize: "vertical", lineHeight: 1.7, fontFamily: SAN }}
            />
            {savedSourceNote && (
              <div style={{ marginTop: 10 }}>
                <CopyButton text={savedSourceNote} />
              </div>
            )}
          </SectionCard>

          <div
            style={{
              background: "#080f08",
              border: `1px solid #1a2e1a`,
              borderRadius: 10,
              padding: "13px 16px",
              fontSize: 12,
              color: T.dim,
              fontFamily: SAN,
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: T.green, fontWeight: 700 }}>Tip: </span>
            Use "Find Question Source" to identify if the question is IGNOU-style, textbook-based, or coaching-module type.
          </div>
        </div>
      </div>

      {/* ── Question Bank ────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 36, borderTop: "1px solid #2a2a30", paddingTop: 26 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.subtle,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 4,
                fontFamily: MONO,
              }}
            >
              Question Bank
            </div>
            <div style={{ fontSize: 13, color: T.dim, fontFamily: SAN }}>
              {loading
                ? "Loading questions…"
                : `${filtered.length} question${filtered.length !== 1 ? "s" : ""} — click any to load into workspace above`}
            </div>
          </div>
          {filtered.length > 0 && !loading && (
            <span
              style={{
                fontSize: 12,
                color: T.subtle,
                fontFamily: MONO,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                padding: "3px 10px",
              }}
            >
              {filtered.length} shown
            </span>
          )}
        </div>

        {loading && <LoadingSkeleton />}

        {!loading && error && (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              border: `1px solid ${T.red}30`,
              borderRadius: 12,
              background: `${T.red}06`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 10 }}>{error}</div>
            <button
              onClick={fetchQuestions}
              style={{
                background: T.surface,
                color: T.text,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 18px",
                cursor: "pointer",
                fontFamily: SAN,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 6 }}>
            {filtered.map((q) => (
              <QuestionRow key={q.id} q={q} onSelect={handleSelect} selected={q.id === selectedId} />
            ))}
          </div>
        )}

        {!loading && !error && pyqList.length > 0 && filtered.length === 0 && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              border: `1px dashed ${T.borderMid}`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.3 }}>🔍</div>
            <div style={{ fontSize: 14, color: T.subtle, fontWeight: 600, fontFamily: SAN }}>
              No questions match this filter
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 6, fontFamily: SAN }}>
              Try adjusting the theme, paper, or marks filter
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
