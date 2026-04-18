import { useState, useEffect, useMemo, useRef } from "react";
import { BACKEND_URL } from "../../config";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:          "#09090b",
  surface:     "#111113",
  surfaceHigh: "#18181b",
  border:      "#1f1f23",
  borderMid:   "#27272a",
  muted:       "#3f3f46",
  subtle:      "#52525b",
  dim:         "#71717a",
  text:        "#e4e4e7",
  textBright:  "#f4f4f5",
  amber:       "#f59e0b",
  green:       "#22c55e",
  red:         "#ef4444",
  teal:        "#14b8a6",
  blue:        "#3b82f6",
  purple:      "#8b5cf6",
  orange:      "#f97316",
  pink:        "#ec4899",
  cyan:        "#06b6d4",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};
const ACCENT = T.teal;

// ── Theme meta ────────────────────────────────────────────────────────────────
const THEME_META = {
  PHILOSOPHICAL: { label: "Philosophy & Values", short: "Philosophy",  icon: "🔮", desc: "Truth, freedom, justice, human existence",       accent: T.purple },
  SOCIAL:        { label: "Society",             short: "Society",     icon: "👥", desc: "Diversity, gender, caste, identity, change",      accent: T.pink   },
  POLITICAL:     { label: "Governance",          short: "Governance",  icon: "🏛️", desc: "Democracy, institutions, leadership",             accent: T.blue   },
  ECONOMIC:      { label: "Economy",             short: "Economy",     icon: "📊", desc: "Growth, development, inequality",                 accent: T.amber  },
  SCIENCE_TECH:  { label: "Science & Tech",      short: "Sci-Tech",    icon: "🔬", desc: "Technology, AI, innovation",                     accent: T.cyan   },
  ENVIRONMENT:   { label: "Environment",         short: "Environment", icon: "🌿", desc: "Sustainability, climate, ecology",                accent: T.green  },
  INTERNATIONAL: { label: "International",       short: "Global",      icon: "🌐", desc: "Global order, diplomacy",                        accent: T.teal   },
  ETHICS:        { label: "Ethics & Values",     short: "Ethics",      icon: "⚖️", desc: "Morality, integrity, philosophical ethics",      accent: T.orange },
};

function getThemeMeta(cat) {
  return THEME_META[cat] || { label: cat || "Unknown", short: cat || "—", icon: "·", desc: "", accent: T.dim };
}

const ESSAY_CATS = Object.entries(THEME_META).map(([id, m]) => ({ id, ...m }));

// ── Interpretation intelligence ───────────────────────────────────────────────
const THEME_INTERPRETATION_HINTS = {
  PHILOSOPHICAL: [
    "Apply multi-layer philosophical inquiry — individual, social, and metaphysical",
    "Bridge abstract principles to concrete ground realities",
    "Draw on both Eastern and Western philosophical traditions for depth",
  ],
  SOCIAL: [
    "Ground with sociological data and field observations",
    "Include historical evolution — show transformation, not just a snapshot",
    "Tension between tradition and change is often the essay's core thesis",
  ],
  POLITICAL: [
    "Balance institutional top-down and grassroots bottom-up perspectives",
    "Reference constitutional provisions and governance frameworks",
    "Avoid partisan framing — structural analysis is more credible",
  ],
  ECONOMIC: [
    "Lead with a data anchor — inequality index, growth rate, or HDI comparison",
    "Engage the equity vs efficiency trade-off explicitly",
    "Policy critique must be nuanced — show alternatives, not just problems",
  ],
  SCIENCE_TECH: [
    "Address both opportunity and risk — dual-use framing is expected",
    "Connect technology to inclusive human welfare, not just innovation",
    "Regulatory and ethical governance of tech add strong differentiation",
  ],
  ENVIRONMENT: [
    "Intergenerational equity is a powerful thesis anchor",
    "Engage the development vs conservation tension honestly",
    "Scale from individual to policy to global — all three layers needed",
  ],
  ETHICS: [
    "Apply thinker quotes — Kant, Gandhi, Aristotle, Rawls elevate depth",
    "Tie abstract moral claims to concrete governance or social contexts",
    "Avoid preaching tone — analytical moral reasoning is preferred",
  ],
  INTERNATIONAL: [
    "India's position and national interest must be addressed explicitly",
    "Engage multilateral vs bilateral and rules-based vs power-based frames",
    "Historical precedents and current events both strengthen the argument",
  ],
};

const MICROTHEME_SIGNAL_MAP = {
  "freedom":         "Liberal autonomy vs collective responsibility tension",
  "equality":        "Substantive vs formal equality — the distinction matters",
  "justice":         "Procedural, distributive, and restorative dimensions apply",
  "leadership":      "Authority, responsibility, and accountability triad",
  "democracy":       "Institutional integrity and participatory depth",
  "development":     "Inclusive growth vs GDP-first framing",
  "technology":      "Disruption, inclusion, and governance of tech",
  "environment":     "Sustainability with intergenerational equity angle",
  "women":           "Structural barriers and agency — not just welfare framing",
  "education":       "Access, quality, and critical thinking as outcome",
  "governance":      "Accountability and transparency as twin levers",
  "corruption":      "Systemic vs individual ethics of public service",
  "tradition":       "Continuity and change — avoid binary opposition",
  "culture":         "Living traditions vs ossified customs — the key distinction",
  "identity":        "Intersectionality — no single axis captures social reality",
  "nation building": "Unity in diversity — constitutional framework as anchor",
  "self-control":    "Internal governance as precondition for external leadership",
  "ethics":          "Deontological and consequentialist frames both apply",
  "science":         "Science as method, not just product — process matters",
  "climate":         "CBDR principle — shared but differentiated responsibility",
  "poverty":         "Capability deprivation lens (Sen) — beyond income measures",
  "growth":          "Jobless growth paradox and distributional dimension",
  "power":           "Hard, soft, and structural power — all three dimensions",
  "knowledge":       "Access, production, and power asymmetries in knowledge",
};

function buildTopicCues(q) {
  if (!q) return null;
  return { keywords: q.keywords || [], microthemes: q.microthemes || [], bucket: q.sourceTopicBucket || "" };
}

function buildInterpretationHints(q) {
  if (!q) return [];
  const hints = [];
  const themeHints = THEME_INTERPRETATION_HINTS[q.themeCategory] || [];
  hints.push(...themeHints.slice(0, 2));
  const mts = (q.microthemes || []).map(m => m.toLowerCase());
  let matched = 0;
  for (const [key, hint] of Object.entries(MICROTHEME_SIGNAL_MAP)) {
    if (matched >= 2) break;
    if (mts.some(m => m.includes(key) || key.includes(m))) { hints.push(hint); matched++; }
  }
  return hints;
}

function sortEssayTopics(items, sortKey) {
  const copy = [...items];
  if (sortKey === "newest") return copy.sort((a, b) => (b.year || 0) - (a.year || 0));
  if (sortKey === "oldest") return copy.sort((a, b) => (a.year || 0) - (b.year || 0));
  if (sortKey === "alpha")  return copy.sort((a, b) => (a.topic || "").localeCompare(b.topic || ""));
  if (sortKey === "theme")  return copy.sort((a, b) => (a.themeCategory || "").localeCompare(b.themeCategory || ""));
  return copy;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function buildBlueprintSummary({ angle, introStyle, bodyDimensions, conclusionStyle }) {
  const parts = [];
  if (angle)                parts.push(`${angle} angle`);
  if (introStyle)           parts.push(`${introStyle} intro`);
  if (bodyDimensions.length) parts.push(`${bodyDimensions.length} dimension${bodyDimensions.length !== 1 ? "s" : ""}`);
  if (conclusionStyle)      parts.push(`${conclusionStyle} conclusion`);
  return parts.length ? `Blueprint: ${parts.join(" • ")}` : "Blueprint: define your strategy above";
}

function getEssayStepState({ selectedQ, angle, thesis, outlineIntro, essayDraft, draftV1, improvementNotes }) {
  return [
    { label: "Select Topic",   done: !!selectedQ },
    { label: "Understand",     done: !!selectedQ },
    { label: "Build Strategy", done: !!(angle || thesis) },
    { label: "Outline",        done: !!(outlineIntro) },
    { label: "Draft Essay",    done: essayDraft.trim().length > 100 },
    { label: "Analyze",        done: false },
    { label: "Improve",        done: !!improvementNotes },
    { label: "Save Version",   done: !!draftV1 },
  ];
}

// ── ChatGPT prompts ───────────────────────────────────────────────────────────
const ANALYZE_PROMPT_TEMPLATE = `You are a UPSC Essay paper expert examiner.

TASK: Deep analysis of the given essay topic.

RETURN:
1. THEME INTERPRETATION — What is the core philosophical or conceptual theme? How many layers does it have?
2. TOPIC TYPE — Philosophical / Social / Political / Economic / Science & Tech / Abstract / Contemporary / Hybrid
3. MULTIDIMENSIONALITY — What are the 4-6 key dimensions a complete essay must cover?
4. TOPPER THINKING — How should a high scorer interpret and approach this topic?
5. IDEAL STRUCTURE — Give a specific essay architecture:
   - Introduction type (quote / anecdote / definition / paradox)
   - 4-5 body section themes with transition logic
   - Conclusion approach
6. PHILOSOPHICAL DEPTH — Which thinkers, quotes, or concepts elevate this essay?
7. EXAMPLES & DATA — What specific examples add credibility?
8. COMMON WEAKNESSES — What do average candidates do wrong?
9. ORIGINALITY OPPORTUNITIES — Where can a writer express a unique perspective?

TOPIC: [TOPIC]`;

const SOURCE_PROMPT_TEMPLATE = `You are a UPSC question forensics expert specializing in Essay paper patterns.

TASK: Identify the likely SOURCE TRADITION and THEMATIC LINEAGE of the given essay topic.

ANALYZE AND CLASSIFY:
1. TOPIC TRADITION — Which category does it most resemble?
2. THEMATIC LINEAGE — Has UPSC asked similar topics before?
3. SOURCE CLUES — What features indicate this tradition?
4. PREPARATION IMPLICATION — What reading is most relevant?
5. CONFIDENCE — If uncertain, rank top 2-3 likely classifications.

TOPIC: [TOPIC]`;

function buildPrompt(template, topic) {
  const filled = topic && topic.trim() ? topic.trim() : "[paste essay topic here]";
  return template.replace("[TOPIC]", filled);
}

// ── Shared UI components ──────────────────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ background: copied ? `${T.green}18` : T.surface, border: `1px solid ${copied ? T.green : T.borderMid}`, color: copied ? T.green : T.dim, borderRadius: 5, padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: T.font, transition: "all 0.2s" }}>
      {copied ? "✓ Copied" : "Copy Prompt"}
    </button>
  );
};

const PromptPanel = ({ title, prompt, visible }) => {
  if (!visible) return null;
  return (
    <div style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: T.green, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: T.font }}>{title}</span>
        <CopyButton text={prompt} />
      </div>
      <pre style={{ fontFamily: "monospace", fontSize: 11, color: T.dim, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, background: T.surface, borderRadius: 6, padding: 14, border: `1px solid ${T.border}`, maxHeight: 280, overflowY: "auto" }}>{prompt}</pre>
    </div>
  );
};

const SectionCard = ({ title, subtitle, accent, children }) => (
  <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "20px 22px", marginBottom: 20 }}>
    {title    && <div style={{ fontSize: 11, fontWeight: 700, color: accent || T.amber, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, fontFamily: T.font }}>{title}</div>}
    {subtitle && <div style={{ fontSize: 12, color: T.muted, marginBottom: 14, fontFamily: T.font }}>{subtitle}</div>}
    {children}
  </div>
);

const TogglePill = ({ label, active, onToggle, color }) => {
  const c = color || T.amber;
  return (
    <button onClick={onToggle}
      style={{ background: active ? `${c}14` : T.surface, border: `1px solid ${active ? c : T.borderMid}`, color: active ? c : T.dim, borderRadius: 20, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: T.font, transition: "all 0.2s" }}>
      {active ? "✓ " : ""}{label}
    </button>
  );
};

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: "5px 12px", borderRadius: 7, border: active ? `1.5px solid ${ACCENT}` : `1px solid ${T.borderMid}`, background: active ? `${ACCENT}18` : T.surface, color: active ? ACCENT : T.dim, fontWeight: active ? 800 : 500, fontSize: 11, cursor: "pointer", fontFamily: T.font }}>
      {label}
    </button>
  );
}

function CategoryCard({ cat, active, count, onClick }) {
  const meta = getThemeMeta(cat.id);
  return (
    <button onClick={onClick}
      style={{ flex: "1 1 140px", background: active ? `${meta.accent}12` : T.surface, border: active ? `1.5px solid ${meta.accent}66` : `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", fontFamily: T.font, textAlign: "left", transition: "all 0.12s ease" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{cat.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: active ? meta.accent : T.textBright, marginBottom: 4 }}>{cat.label}</div>
      <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.45, marginBottom: 4 }}>{cat.desc}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: active ? meta.accent : T.subtle }}>{count} topics</div>
    </button>
  );
}

// ── Step tracker ──────────────────────────────────────────────────────────────
function EssayStepTracker({ steps }) {
  const firstActive = steps.findIndex(s => !s.done);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", marginBottom: 20, overflowX: "auto" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.subtle, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Essay Progress</div>
      <div style={{ display: "flex", gap: 0, minWidth: "fit-content" }}>
        {steps.map((step, i) => {
          const isActive = i === firstActive;
          const color = step.done ? T.green : isActive ? ACCENT : T.muted;
          return (
            <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: step.done ? `${T.green}18` : isActive ? `${ACCENT}18` : T.surfaceHigh, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color }}>
                  {step.done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 9, fontWeight: isActive ? 800 : 600, color, whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 24, height: 2, background: step.done ? `${T.green}44` : T.borderMid, margin: "0 2px", marginBottom: 18 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Focus card ────────────────────────────────────────────────────────────────
function FocusCard({ selectedQ, onClear }) {
  if (!selectedQ) {
    return (
      <div style={{ background: "#16161a", border: `1px solid ${T.borderMid}`, borderLeft: `3px solid ${ACCENT}55`, borderRadius: 12, padding: "24px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ fontSize: 28, color: ACCENT, opacity: 0.3 }}>↓</div>
        <div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>Select a topic from the bank below</div>
          <div style={{ fontSize: 11, color: T.subtle, marginTop: 4 }}>Full analysis cues, dimensions, and ChatGPT prompts will activate here</div>
        </div>
      </div>
    );
  }

  const meta  = getThemeMeta(selectedQ.themeCategory);
  const cues  = buildTopicCues(selectedQ);
  const hints = buildInterpretationHints(selectedQ);

  return (
    <div style={{ background: "#1a1a22", border: `2px solid ${meta.accent}`, borderLeft: `5px solid ${meta.accent}`, borderRadius: 12, padding: "22px 26px", marginBottom: 20, boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${meta.accent}22` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: meta.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>✓ Selected Topic</span>
            {selectedQ.year && (
              <span style={{ fontSize: 10, fontWeight: 800, color: T.amber, background: `${T.amber}14`, border: `1px solid ${T.amber}30`, borderRadius: 5, padding: "2px 8px" }}>
                UPSC {selectedQ.year}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, color: meta.accent, background: `${meta.accent}14`, border: `1px solid ${meta.accent}33`, borderRadius: 5, padding: "2px 8px" }}>
              {meta.icon} {meta.short}
            </span>
            {selectedQ.section
              ? <span style={{ fontSize: 10, color: T.subtle }}>Section {selectedQ.section}</span>
              : <span style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>Section unavailable</span>
            }
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.textBright, lineHeight: 1.8 }}>{selectedQ.topic}</div>
          {selectedQ.sourceTopicBucket && (
            <div style={{ fontSize: 11, color: T.text, marginTop: 6 }}>
              <span style={{ color: meta.accent, fontWeight: 700 }}>Essay Family: </span>{selectedQ.sourceTopicBucket}
            </div>
          )}
        </div>
        <button onClick={onClear}
          style={{ background: "none", border: `1px solid ${T.borderMid}`, borderRadius: 6, color: T.dim, fontSize: 12, cursor: "pointer", padding: "4px 10px", fontFamily: T.font, flexShrink: 0 }}>
          Clear ×
        </button>
      </div>

      {(cues.keywords.length > 0 || cues.microthemes.length > 0) && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
          {cues.keywords.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: meta.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Keywords</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {cues.keywords.map(k => (
                  <span key={k} style={{ fontSize: 10, color: meta.accent, background: "#111116", border: `1px solid ${meta.accent}66`, borderRadius: 4, padding: "3px 8px", fontWeight: 600 }}>{k}</span>
                ))}
              </div>
            </div>
          )}
          {cues.microthemes.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: T.amber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Dimensions</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {cues.microthemes.map(m => (
                  <span key={m} style={{ fontSize: 10, color: T.amber, background: "#111116", border: `1px solid ${T.amber}66`, borderRadius: 4, padding: "3px 8px", fontWeight: 600 }}>{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {hints.length > 0 && (
        <div style={{ background: "#111116", border: `1px solid ${meta.accent}44`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: meta.accent, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Interpretation Hints</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {hints.map((h, i) => (
              <div key={i} style={{ fontSize: 11, color: T.text, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: meta.accent, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>›</span>
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Topic row ─────────────────────────────────────────────────────────────────
function TopicRow({ q, onSelect, selected }) {
  const meta = getThemeMeta(q.themeCategory);
  const previewDims = (q.microthemes || []).slice(0, 2);
  const topicText = q.topic || "Untitled topic";
  return (
    <div onClick={() => onSelect(q)}
      style={{ background: selected ? `${meta.accent}10` : T.surface, border: `1px solid ${selected ? meta.accent : T.border}`, borderLeft: `4px solid ${meta.accent}`, borderRadius: 8, cursor: "pointer", transition: "background 0.1s, border-color 0.1s", userSelect: "none" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = T.surfaceHigh; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = T.surface; }}>
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
          {q.year != null && <span style={{ fontSize: 11, fontWeight: 800, color: T.amber }}>{q.year}</span>}
          <span style={{ fontSize: 10, fontWeight: 700, color: meta.accent, background: T.surfaceHigh, border: `1px solid ${meta.accent}`, borderRadius: 4, padding: "2px 8px" }}>{meta.short}</span>
          {q.sourceTopicBucket && <span style={{ fontSize: 10, color: T.dim }}>{q.sourceTopicBucket}</span>}
          {selected && <span style={{ fontSize: 10, fontWeight: 800, color: meta.accent, marginLeft: "auto" }}>✓ Active</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: selected ? T.textBright : T.text, lineHeight: 1.6, fontFamily: T.font }}>{topicText}</div>
        {previewDims.length > 0 && (
          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
            {previewDims.map(d => (
              <span key={d} style={{ fontSize: 10, color: T.dim, background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 3, padding: "2px 8px" }}>{d}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px" }}>
          <div style={{ height: 9, width: "18%", borderRadius: 4, background: `${T.muted}30`, marginBottom: 7 }} />
          <div style={{ height: 12, width: "85%", borderRadius: 4, background: `${T.muted}30` }} />
        </div>
      ))}
    </div>
  );
}

// ── Strategy constants ────────────────────────────────────────────────────────
const ANGLE_OPTIONS    = ["Philosophical","Social","Governance","Economic","Ethical","International","Mixed"];
const INTRO_OPTIONS    = ["Anecdote","Definition","Contrast","Quote","Paradox","Contemporary example"];
const BODY_DIM_OPTIONS = ["Individual","Family","Society","Economy","Polity","Ethics","Environment","Global","Future"];
const CONCL_OPTIONS    = ["Hopeful","Cyclical","Value-based","Constitutional","Civilizational","Action-oriented"];
const SORT_OPTIONS     = [{ v: "newest", l: "Newest" }, { v: "oldest", l: "Oldest" }, { v: "alpha", l: "A → Z" }, { v: "theme", l: "Theme" }];
const DURATION_OPTIONS = [{ v: 1800, l: "30 min", sub: "Outline only" }, { v: 3600, l: "60 min", sub: "Quick essay" }, { v: 5400, l: "90 min", sub: "Full essay" }];
const REVIEW_ITEMS     = ["Intro effectiveness", "Thesis clarity", "Balance of dimensions", "Flow / transitions", "Conclusion quality"];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function EssayPyqPage() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Existing workspace state (all preserved) ───────────────────────────────
  const [question,        setQuestion]        = useState("");
  const [source,          setSource]          = useState("");
  const [year,            setYear]            = useState("");
  const [section,         setSection]         = useState("");
  const [showAnalyze,     setShowAnalyze]     = useState(false);
  const [showSource,      setShowSource]      = useState(false);
  const [savedAnalysis,   setSavedAnalysis]   = useState("");
  const [savedSourceNote, setSavedSourceNote] = useState("");
  const [weak,            setWeak]            = useState(false);
  const [review,          setReview]          = useState(false);
  const [revision,        setRevision]        = useState(false);

  // ── Explorer state (all preserved) ───────────────────────────────────────
  const [pyqList,        setPyqList]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchText,     setSearchText]     = useState("");
  const [selectedId,     setSelectedId]     = useState(null);
  const [selectedQ,      setSelectedQ]      = useState(null);
  const [sortKey,        setSortKey]        = useState("newest");

  // ── Timer state ───────────────────────────────────────────────────────────
  const [duration,       setDuration]       = useState(5400);
  const [timeLeft,       setTimeLeft]       = useState(5400);
  const [isRunning,      setIsRunning]      = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const timerRef = useRef(null);

  // ── Strategy state ────────────────────────────────────────────────────────
  const [angle,           setAngle]           = useState("");
  const [thesis,          setThesis]          = useState("");
  const [introStyle,      setIntroStyle]      = useState("");
  const [bodyDimensions,  setBodyDimensions]  = useState([]);
  const [conclusionStyle, setConclusionStyle] = useState("");

  // ── Outline state ─────────────────────────────────────────────────────────
  const [outlineIntro,      setOutlineIntro]      = useState("");
  const [outlineBody1,      setOutlineBody1]      = useState("");
  const [outlineBody2,      setOutlineBody2]      = useState("");
  const [outlineBody3,      setOutlineBody3]      = useState("");
  const [outlineBody4,      setOutlineBody4]      = useState("");
  const [outlineConclusion, setOutlineConclusion] = useState("");

  // ── Draft & version state ─────────────────────────────────────────────────
  const [essayDraft,       setEssayDraft]       = useState("");
  const [draftV1,          setDraftV1]          = useState("");
  const [draftV2,          setDraftV2]          = useState("");
  const [improvementNotes, setImprovementNotes] = useState("");
  const [savedMsg,         setSavedMsg]         = useState("");

  const focusRef = useRef(null);

  // ── Timer effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft]);

  function startSession() {
    setTimeLeft(duration);
    setIsRunning(true);
    setSessionStarted(true);
  }
  function resetSession() {
    clearInterval(timerRef.current);
    setIsRunning(false);
    setSessionStarted(false);
    setTimeLeft(duration);
  }

  // ── Data fetch ────────────────────────────────────────────────────────────
  function fetchQuestions() {
    setLoading(true); setError(null);
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=essay`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setPyqList(Array.isArray(data?.questions) ? data.questions : []); })
      .catch(err => { setError(err.message || "Backend error"); })
      .finally(() => setLoading(false));
  }
  useEffect(() => { fetchQuestions(); }, []);

  const catCounts = useMemo(() => {
    const m = {};
    ESSAY_CATS.forEach(c => { m[c.id] = pyqList.filter(q => q.themeCategory === c.id).length; });
    return m;
  }, [pyqList]);

  const filtered = useMemo(() => {
    const base = pyqList.filter(q => {
      if (activeCategory !== "all" && q.themeCategory !== activeCategory) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!(q.topic || "").toLowerCase().includes(s) &&
            !(q.sourceTopicBucket || "").toLowerCase().includes(s) &&
            !(q.keywords    || []).some(k => k.toLowerCase().includes(s)) &&
            !(q.microthemes || []).some(m => m.toLowerCase().includes(s))) return false;
      }
      return true;
    });
    return sortEssayTopics(base, sortKey);
  }, [pyqList, activeCategory, searchText, sortKey]);

  function handleSelect(q) {
    setQuestion(q.topic || "");
    setYear(String(q.year || ""));
    setSource(`UPSC ${q.year || ""}`);
    setSection(q.section || "");
    setSelectedId(q.id);
    setSelectedQ(q);
    focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function handleClear() {
    setSelectedId(null); setSelectedQ(null);
    setQuestion(""); setYear(""); setSource(""); setSection("");
  }
  function toggleDimension(dim) {
    setBodyDimensions(prev => prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]);
  }
  function saveDraft(slot) {
    if (!essayDraft.trim()) return;
    if (slot === 1) setDraftV1(essayDraft);
    if (slot === 2) setDraftV2(essayDraft);
    setSavedMsg(`Saved as Version ${slot}`);
    setTimeout(() => setSavedMsg(""), 2200);
  }

  const analyzePrompt = buildPrompt(ANALYZE_PROMPT_TEMPLATE, question);
  const sourcePrompt  = buildPrompt(SOURCE_PROMPT_TEMPLATE, question);
  const blueprint     = buildBlueprintSummary({ angle, introStyle, bodyDimensions, conclusionStyle });
  const essaySteps    = getEssayStepState({ selectedQ, angle, thesis, outlineIntro, essayDraft, draftV1, improvementNotes });

  const timerPct   = sessionStarted ? ((duration - timeLeft) / duration) * 100 : 0;
  const timerColor = timeLeft < 300 ? T.red : timeLeft < 900 ? T.amber : T.green;

  const wordCount = essayDraft.trim() ? essayDraft.trim().split(/\s+/).filter(Boolean).length : 0;

  const s = {
    page:        { background: T.bg, minHeight: "100vh", fontFamily: T.font, color: T.text },
    textarea:    { width: "100%", background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 6, color: T.text, fontSize: 12, padding: "10px 12px", fontFamily: T.font, resize: "vertical", outline: "none", boxSizing: "border-box" },
    label:       { fontSize: 11, color: T.subtle, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block", fontFamily: T.font },
    select:      { background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 6, color: T.text, fontSize: 12, padding: "8px 10px", fontFamily: T.font, outline: "none" },
    selDisabled: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, color: T.muted, fontSize: 12, padding: "8px 10px", fontFamily: T.font, outline: "none", cursor: "not-allowed" },
    input:       { background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 6, color: T.text, fontSize: 12, padding: "8px 10px", fontFamily: T.font, outline: "none", width: "100%", boxSizing: "border-box" },
    btnPrimary:  { background: `${ACCENT}1a`, border: `2px solid ${ACCENT}88`, color: ACCENT, borderRadius: 8, padding: "11px 20px", fontSize: 13, cursor: "pointer", fontFamily: T.font, fontWeight: 800, letterSpacing: "0.02em", width: "100%", transition: "all 0.15s" },
    btnSecondary:{ background: T.surface, border: `1px solid ${T.borderMid}`, color: T.dim, borderRadius: 7, padding: "10px 16px", fontSize: 12, cursor: "pointer", fontFamily: T.font, fontWeight: 500, width: "100%", transition: "all 0.15s" },
    grid2:       { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 },
    chipRow:     { display: "flex", gap: 7, flexWrap: "wrap" },
  };

  // inline chip helper
  const chip = (label, active, onClick, color) => {
    const c = color || ACCENT;
    return (
      <button key={label} onClick={onClick}
        style={{ padding: "5px 13px", borderRadius: 20, border: active ? `1.5px solid ${c}` : `1px solid ${T.borderMid}`, background: active ? `${c}18` : T.surfaceHigh, color: active ? c : T.dim, fontWeight: active ? 700 : 400, fontSize: 11, cursor: "pointer", fontFamily: T.font, transition: "all 0.12s" }}>
        {label}
      </button>
    );
  };

  const outlineFields = [
    { label: "Introduction Plan",  val: outlineIntro,      set: setOutlineIntro      },
    { label: "Body Dimension 1",   val: outlineBody1,      set: setOutlineBody1      },
    { label: "Body Dimension 2",   val: outlineBody2,      set: setOutlineBody2      },
    { label: "Body Dimension 3",   val: outlineBody3,      set: setOutlineBody3      },
    { label: "Body Dimension 4",   val: outlineBody4,      set: setOutlineBody4      },
    { label: "Conclusion Plan",    val: outlineConclusion, set: setOutlineConclusion },
  ];

  return (
    <div style={s.page}>

      {/* ── Breadcrumb (sticky, timer shown here when running) ─────────────── */}
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 32px", display: "flex", alignItems: "center", gap: 8, background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: T.subtle }}>Mains</span>
        <span style={{ color: T.muted, fontSize: 11 }}>›</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: ACCENT }}>Essay PYQ</span>
        {sessionStarted && (
          <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 900, color: timerColor, fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em" }}>
            ⏱ {formatTimer(timeLeft)}
          </span>
        )}
      </div>

      <div style={{ padding: isMobile ? "20px 16px" : "28px 32px", maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Hero header ────────────────────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surfaceHigh} 100%)`, border: `1px solid ${T.borderMid}`, borderRadius: 16, padding: "28px 32px", marginBottom: 28, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT}44)`, borderRadius: "14px 0 0 14px" }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: ACCENT, marginBottom: 8 }}>Essay Paper</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>Essay Writing Engine</h1>
          <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px 0", lineHeight: 1.6, maxWidth: 520 }}>Select a topic → build strategy → outline → draft → review → save.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {loading ? (
              <span style={{ fontSize: 11, color: T.dim }}>Loading topics…</span>
            ) : error ? (
              <span style={{ fontSize: 11, color: T.red }}>Could not load count</span>
            ) : (
              <>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textBright, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>{pyqList.length} Topics</span>
                {ESSAY_CATS.map(c => (
                  <span key={c.id} style={{ fontSize: 11, fontWeight: 700, color: getThemeMeta(c.id).accent, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 10px" }}>
                    {c.icon} {catCounts[c.id] || 0}
                  </span>
                ))}
              </>
            )}
            <input value={searchText} onChange={e => setSearchText(e.target.value)}
              placeholder="Search topics, keywords, dimensions…"
              style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 7, color: T.text, fontSize: 11, padding: "6px 10px", fontFamily: T.font, outline: "none", width: isMobile ? "100%" : 240, marginLeft: isMobile ? 0 : "auto" }} />
          </div>
        </div>

        {/* ── Theme filter cards ──────────────────────────────────────────────── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: T.subtle, marginBottom: 12 }}>Filter by Theme</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <button onClick={() => setActiveCategory("all")}
            style={{ flex: "0 0 auto", background: activeCategory === "all" ? `${ACCENT}12` : T.surface, border: activeCategory === "all" ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`, borderRadius: 12, padding: "10px 20px", cursor: "pointer", fontFamily: T.font, fontSize: 12, fontWeight: activeCategory === "all" ? 800 : 600, color: activeCategory === "all" ? ACCENT : T.dim }}>
            All Themes
          </button>
          {ESSAY_CATS.map(cat => (
            <CategoryCard key={cat.id} cat={cat} active={activeCategory === cat.id} count={catCounts[cat.id] || 0}
              onClick={() => setActiveCategory(prev => prev === cat.id ? "all" : cat.id)} />
          ))}
        </div>

        {/* ══ WORKSPACE ZONE ════════════════════════════════════════════════════ */}
        <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: "0.11em", textTransform: "uppercase", marginBottom: 10 }}>
          ── Workspace
          <div style={{ height: 1, background: `linear-gradient(90deg, ${ACCENT}44, transparent)`, marginTop: 5 }} />
        </div>

        <div ref={focusRef} style={{ scrollMarginTop: 16 }} />

        {/* Step tracker */}
        <EssayStepTracker steps={essaySteps} />

        {/* Focus card */}
        <FocusCard selectedQ={selectedQ} onClear={handleClear} />

        {/* ── 1. WRITING SESSION ─────────────────────────────────────────────── */}
        <SectionCard title="Essay Writing Session" subtitle="Set your duration and start the clock" accent={T.green}>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {DURATION_OPTIONS.map(opt => (
              <button key={opt.v} onClick={() => { setDuration(opt.v); if (!sessionStarted) setTimeLeft(opt.v); }}
                style={{ flex: "1 1 100px", padding: "12px 14px", borderRadius: 10, border: duration === opt.v ? `2px solid ${T.green}` : `1px solid ${T.borderMid}`, background: duration === opt.v ? `${T.green}12` : T.surfaceHigh, cursor: "pointer", fontFamily: T.font, textAlign: "center", transition: "all 0.12s" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: duration === opt.v ? T.green : T.textBright }}>{opt.l}</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{opt.sub}</div>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: timerColor, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em", minWidth: 100 }}>
              {formatTimer(timeLeft)}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ height: 6, background: T.surfaceHigh, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.borderMid}` }}>
                <div style={{ height: "100%", width: `${timerPct}%`, background: `linear-gradient(90deg, ${T.green}, ${timerColor})`, borderRadius: 4, transition: "width 1s linear" }} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!sessionStarted ? (
                  <button onClick={startSession}
                    style={{ background: T.green, color: "#000", border: "none", borderRadius: 8, padding: "9px 28px", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>
                    ▶ Start Essay Writing Session
                  </button>
                ) : (
                  <>
                    <button onClick={() => setIsRunning(r => !r)}
                      style={{ background: isRunning ? `${T.amber}18` : `${T.green}18`, border: `1px solid ${isRunning ? T.amber : T.green}`, color: isRunning ? T.amber : T.green, borderRadius: 7, padding: "7px 18px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: T.font }}>
                      {isRunning ? "⏸ Pause" : "▶ Resume"}
                    </button>
                    <button onClick={resetSession}
                      style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, color: T.dim, borderRadius: 7, padding: "7px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: T.font }}>
                      ↺ Reset
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── 2. STRATEGY BUILDER ────────────────────────────────────────────── */}
        <SectionCard title="Essay Strategy Builder" subtitle="Define your angle, thesis, and structure before writing" accent={T.purple}>

          <div style={{ marginBottom: 16 }}>
            <span style={s.label}>Angle</span>
            <div style={s.chipRow}>
              {ANGLE_OPTIONS.map(o => chip(o, angle === o, () => setAngle(prev => prev === o ? "" : o), T.purple))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={s.label}>Central Thesis</span>
            <input value={thesis} onChange={e => setThesis(e.target.value)}
              placeholder="Write the governing argument of your essay"
              style={s.input} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={s.label}>Intro Strategy</span>
            <div style={s.chipRow}>
              {INTRO_OPTIONS.map(o => chip(o, introStyle === o, () => setIntroStyle(prev => prev === o ? "" : o), T.blue))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={s.label}>
              Body Dimensions
              <span style={{ color: T.muted, fontSize: 10, fontWeight: 400, textTransform: "none", marginLeft: 6 }}>(multi-select)</span>
            </span>
            <div style={s.chipRow}>
              {BODY_DIM_OPTIONS.map(o => chip(o, bodyDimensions.includes(o), () => toggleDimension(o), T.amber))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={s.label}>Conclusion Direction</span>
            <div style={s.chipRow}>
              {CONCL_OPTIONS.map(o => chip(o, conclusionStyle === o, () => setConclusionStyle(prev => prev === o ? "" : o), ACCENT))}
            </div>
          </div>

          <div style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: T.dim, fontStyle: "italic" }}>
            <span style={{ color: T.purple, fontWeight: 700, fontStyle: "normal" }}>✦ </span>{blueprint}
          </div>
        </SectionCard>

        {/* ── 3. ESSAY OUTLINE ───────────────────────────────────────────────── */}
        <SectionCard title="Essay Outline" subtitle="Plan each section before the full draft" accent={T.cyan}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {outlineFields.map(({ label, val, set }) => (
              <div key={label}>
                <span style={{ ...s.label, marginBottom: 4 }}>{label}</span>
                <textarea rows={2} value={val} onChange={e => set(e.target.value)}
                  placeholder={`Notes for ${label.toLowerCase()}…`}
                  style={{ ...s.textarea, resize: "vertical" }} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Existing workspace grid (preserved) ────────────────────────────── */}
        <div style={s.grid2}>

          {/* LEFT: topic input + ChatGPT actions + flags */}
          <div>
            <SectionCard title="Essay Topic Workspace" subtitle="Selected or pasted topic with metadata">
              <span style={s.label}>Essay Topic</span>
              <textarea rows={4} value={question} onChange={e => setQuestion(e.target.value)}
                placeholder="Paste essay topic here…" style={{ ...s.textarea, marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <span style={s.label}>Year</span>
                  <select value={year} onChange={e => setYear(e.target.value)} style={{ ...s.select, width: "100%" }}>
                    <option value="">Select</option>
                    {["2024","2023","2022","2021","2020","2019","Earlier"].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <span style={s.label}>Section</span>
                  <select disabled style={{ ...s.selDisabled, width: "100%" }}><option>Unavailable</option></select>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontStyle: "italic" }}>Source does not preserve Section A/B</div>
                </div>
              </div>
              <span style={s.label}>Source / Exam</span>
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. UPSC 2023" style={s.input} />
            </SectionCard>

            <SectionCard title="ChatGPT Action Panel" subtitle="Topic-injected prompts — copy and analyze instantly">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => { setShowAnalyze(v => !v); setShowSource(false); }} style={s.btnPrimary}>⚡ Evaluate / Analyze This Topic</button>
                <button onClick={() => { setShowSource(v => !v); setShowAnalyze(false); }} style={s.btnSecondary}>🔍 Find Topic Source Tradition</button>
              </div>
              {question && question.trim() && (
                <div style={{ marginTop: 10, fontSize: 11, color: T.dim, background: `${ACCENT}08`, border: `1px solid ${ACCENT}20`, borderRadius: 6, padding: "8px 12px" }}>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>Topic injected: </span>
                  <span style={{ fontStyle: "italic" }}>{question.length > 70 ? question.slice(0, 70) + "…" : question}</span>
                </div>
              )}
              <PromptPanel title="Essay Topic Analysis Prompt" prompt={analyzePrompt} visible={showAnalyze} />
              <PromptPanel title="Source Tradition Prompt"      prompt={sourcePrompt}  visible={showSource} />
            </SectionCard>

            <SectionCard title="Topic Flags" subtitle="Tag this topic for tracking">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <TogglePill label="Mark as Weak"           active={weak}     onToggle={() => setWeak(v => !v)} />
                <TogglePill label="Add to Mistake Review"  active={review}   onToggle={() => setReview(v => !v)} />
                <TogglePill label="Add to Future Revision" active={revision} onToggle={() => setRevision(v => !v)} />
              </div>
            </SectionCard>
          </div>

          {/* RIGHT: saved analysis notes */}
          <div>
            <SectionCard title="Saved ChatGPT Analysis" subtitle="Paste ChatGPT output here to save locally">
              <textarea rows={9} value={savedAnalysis} onChange={e => setSavedAnalysis(e.target.value)}
                placeholder="Paste ChatGPT essay topic analysis here…" style={s.textarea} />
              {savedAnalysis && <div style={{ marginTop: 8 }}><CopyButton text={savedAnalysis} /></div>}
            </SectionCard>
            <SectionCard title="Saved Source-Fit Note" subtitle="Paste source tradition output here">
              <textarea rows={9} value={savedSourceNote} onChange={e => setSavedSourceNote(e.target.value)}
                placeholder="Paste source-fit analysis from ChatGPT here…" style={s.textarea} />
              {savedSourceNote && <div style={{ marginTop: 8 }}><CopyButton text={savedSourceNote} /></div>}
            </SectionCard>
            <div style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, borderRadius: 8, padding: "12px 16px", fontSize: 11, color: T.muted, fontFamily: T.font }}>
              <span style={{ color: ACCENT, fontWeight: 700 }}>Tip: </span>
              Essay topics often have 2-3 layers. The analysis prompt helps you identify all layers before you begin writing.
            </div>
          </div>
        </div>

        {/* ── 4. FULL ESSAY DRAFT ────────────────────────────────────────────── */}
        <SectionCard title="Full Essay Draft" subtitle="Write your complete essay here — separate from ChatGPT notes" accent={T.blue}>
          <textarea rows={18} value={essayDraft} onChange={e => setEssayDraft(e.target.value)}
            placeholder="Write your full essay here. Aim for 1000–1200 words. Use your outline above as a guide."
            style={{ ...s.textarea, fontSize: 13, lineHeight: 1.75 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => saveDraft(1)}
              style={{ background: `${T.blue}18`, border: `1px solid ${T.blue}66`, color: T.blue, borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: T.font }}>
              💾 Save as Version 1
            </button>
            <button onClick={() => saveDraft(2)}
              style={{ background: `${T.purple}18`, border: `1px solid ${T.purple}66`, color: T.purple, borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: T.font }}>
              💾 Save as Version 2
            </button>
            <button onClick={() => setEssayDraft("")}
              style={{ background: T.surfaceHigh, border: `1px solid ${T.borderMid}`, color: T.dim, borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: T.font }}>
              ✕ Clear Draft
            </button>
            {savedMsg && <span style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>✓ {savedMsg}</span>}
            {wordCount > 0 && (
              <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>~{wordCount} words</span>
            )}
          </div>
          {(draftV1 || draftV2) && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {draftV1 && (
                <button onClick={() => setEssayDraft(draftV1)}
                  style={{ fontSize: 11, color: T.blue, background: `${T.blue}08`, border: `1px solid ${T.blue}33`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: T.font }}>
                  ↩ Restore V1 ({draftV1.trim().split(/\s+/).filter(Boolean).length} words)
                </button>
              )}
              {draftV2 && (
                <button onClick={() => setEssayDraft(draftV2)}
                  style={{ fontSize: 11, color: T.purple, background: `${T.purple}08`, border: `1px solid ${T.purple}33`, borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: T.font }}>
                  ↩ Restore V2 ({draftV2.trim().split(/\s+/).filter(Boolean).length} words)
                </button>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── 5. SELF REVIEW ─────────────────────────────────────────────────── */}
        <SectionCard title="Self Review" subtitle="Guided checklist — honest self-assessment, no AI" accent={T.orange}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {REVIEW_ITEMS.map((item, i) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.surfaceHigh, borderRadius: 8, border: `1px solid ${T.borderMid}` }}>
                <span style={{ fontSize: 12, color: T.muted, fontWeight: 800, flexShrink: 0, minWidth: 18 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{item}</span>
                <div style={{ display: "flex", gap: 5 }}>
                  {["Weak","Fair","Strong"].map(rating => (
                    <button key={rating}
                      style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, border: `1px solid ${T.borderMid}`, background: T.surface, color: T.dim, cursor: "pointer", fontFamily: T.font }}>
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <span style={s.label}>Improvement Notes</span>
          <textarea rows={4} value={improvementNotes} onChange={e => setImprovementNotes(e.target.value)}
            placeholder="What would you do differently? Which sections need more depth?"
            style={s.textarea} />
        </SectionCard>

        {/* ══ TOPIC BANK EXPLORER ═══════════════════════════════════════════════ */}
        <div style={{ marginTop: 36, borderTop: `1px solid ${T.border}`, paddingTop: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: "0.11em", textTransform: "uppercase", marginBottom: 3 }}>Topic Bank Explorer</div>
              <div style={{ fontSize: 11, color: T.muted }}>
                {loading ? "Loading…" : `${filtered.length} topic${filtered.length !== 1 ? "s" : ""} — click any to load into workspace`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: T.subtle, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Sort:</span>
              {SORT_OPTIONS.map(opt => (
                <FilterPill key={opt.v} label={opt.l} active={sortKey === opt.v} onClick={() => setSortKey(opt.v)} />
              ))}
            </div>
          </div>

          {loading && <LoadingSkeleton />}

          {!loading && error && (
            <div style={{ padding: "28px", textAlign: "center", border: `1px solid ${T.red}33`, borderRadius: 10, background: `${T.red}08` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 8 }}>{error}</div>
              <button onClick={fetchQuestions}
                style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 11, fontWeight: 700, padding: "6px 16px", cursor: "pointer", fontFamily: T.font }}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, maxHeight: 640, overflowY: "auto", paddingRight: 6, paddingBottom: 4 }}>
              {filtered.map(q => <TopicRow key={q.id} q={q} onSelect={handleSelect} selected={q.id === selectedId} />)}
            </div>
          )}

          {!loading && !error && pyqList.length > 0 && filtered.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", border: `1px dashed ${T.borderMid}`, borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: T.subtle, fontWeight: 700 }}>No topics match this filter</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>Try adjusting search text or theme filter</div>
            </div>
          )}

          {!loading && !error && pyqList.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", border: `1px dashed ${T.borderMid}`, borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: T.subtle, fontWeight: 700 }}>No topics available</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>Backend returned an empty list</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
