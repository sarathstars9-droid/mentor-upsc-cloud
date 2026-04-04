// src/pages/MainsPage.jsx
// Mains Command Center — GS1, GS2, GS3 only.
// Ethics, Essay, Geography Optional: separate pages later.
// Frontend-only. No backend wiring. Production-safe.

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: "#09090b",
  surface: "#111113",
  surfaceHigh: "#18181b",
  border: "#1f1f23",
  borderMid: "#27272a",
  muted: "#3f3f46",
  subtle: "#52525b",
  dim: "#71717a",
  text: "#e4e4e7",
  textBright: "#f4f4f5",
  amber: "#f59e0b",
  amberDim: "#d97706",
  blue: "#3b82f6",
  blueDim: "#2563eb",
  green: "#22c55e",
  greenDim: "#16a34a",
  red: "#ef4444",
  purple: "#8b5cf6",
  font: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

// ─── GS paper definitions ─────────────────────────────────────────────────────
const GS_PAPERS = [
  {
    id: "gs1", label: "GS1", title: "General Studies I",
    accent: T.amber, accentDim: T.amberDim,
    themes: ["History", "Society", "Geography", "Art & Culture"],
    route: "/mains/gs1",
  },
  {
    id: "gs2", label: "GS2", title: "General Studies II",
    accent: T.blue, accentDim: T.blueDim,
    themes: ["Polity", "Governance", "Social Justice", "Int. Relations"],
    route: "/mains/gs2",
  },
  {
    id: "gs3", label: "GS3", title: "General Studies III",
    accent: T.green, accentDim: T.greenDim,
    themes: ["Economy", "Environment", "Sci & Tech", "Internal Security"],
    route: "/mains/gs3",
  },
];

// ─── Quick Practice question bank (dummy-safe) ────────────────────────────────
const PRACTICE_QUESTIONS = {
  gs1: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "Discuss the significance of the Bhakti Movement in shaping the social and religious fabric of medieval India.", hint: "Focus: saint-poets, caste critique, regional language literature, social reform" },
        { year: 2022, marks: 10, q: "What were the main features of the Subsidiary Alliance system introduced by Lord Wellesley?", hint: "Focus: treaty mechanics, political subordination, economic drain from princely states" },
        { year: 2021, marks: 10, q: "Highlight the importance of the Revolt of 1857 as the first war of Indian Independence.", hint: "Focus: causes, spread across regions, British response, legacy for later nationalism" },
      ],
      "15": [
        { year: 2023, marks: 15, q: "Explain how the women's question was central to the 19th-century Indian renaissance. Discuss the role of reformers in transforming the condition of women.", hint: "Focus: role of reformers, sati abolition, widow remarriage, education for women" },
        { year: 2022, marks: 15, q: "Analyze the social and economic impact of colonial rule in transforming Indian society during the 19th century.", hint: "Focus: deindustrialisation, land revenue systems, rise of new middle class, caste shifts" },
      ],
      "20": [
        { year: 2022, marks: 20, q: "Trace the process of economic drain from India during British rule. How did it affect Indian industrialization and peasantry?", hint: "Focus: Dadabhai Naoroji's drain theory, home charges, export surplus, agrarian crisis" },
        { year: 2021, marks: 20, q: "Critically examine the impact of British land revenue policies on Indian agriculture and rural society.", hint: "Focus: Zamindari, Ryotwari, Mahalwari — differentiate impacts by region and class" },
      ],
    },
    topic: {
      "10": [
        { year: null, marks: 10, q: "What is the significance of the Ajanta and Ellora caves in the context of Indian art and culture?", hint: "Focus: Buddhist, Hindu, Jain themes; patronage; UNESCO heritage; painting styles" },
        { year: null, marks: 10, q: "Briefly explain the salient features of Indian Society as described by sociologists.", hint: "Focus: diversity, hierarchy, syncretism, joint family, caste, tribal plurality" },
      ],
      "15": [
        { year: null, marks: 15, q: "Examine the challenges to Indian secularism in a diverse society with competing religious identities.", hint: "Focus: constitutional secularism vs. western model, majoritarian pressures, personal law debates" },
        { year: null, marks: 15, q: "Analyze the factors responsible for the declining sex ratio in India and measures taken to address it.", hint: "Focus: son preference, female foeticide, dowry, PCPNDT Act, Beti Bachao scheme" },
      ],
      "20": [
        { year: null, marks: 20, q: "Globalization has brought both opportunities and challenges to Indian society and culture. Critically examine with examples.", hint: "Focus: cultural homogenisation vs. hybridity, consumerism, diaspora, art commodification" },
      ],
    },
    mixed: {
      "10": [
        { year: 2020, marks: 10, q: "Highlight the central features of Gandhian economic thought and its relevance today.", hint: "Focus: self-sufficiency, village economy, trusteeship, non-exploitation, sustainable living" },
        { year: null, marks: 10, q: "What were the contributions of the Sufi movement to the composite culture of India?", hint: "Focus: khanqahs, silsilas, devotional music, Hindu-Muslim synthesis, popular appeal" },
      ],
      "15": [
        { year: 2019, marks: 15, q: "Discuss the contributions of women leaders in the Indian freedom struggle beyond the iconic figures.", hint: "Focus: regional women leaders, non-cooperation, salt march participation, social reform link" },
      ],
      "20": [
        { year: 2023, marks: 20, q: "Discuss the social and economic consequences of rapid urbanization in India. What policy interventions are needed?", hint: "Focus: slum growth, infrastructure deficit, migration pull-push, AMRUT, Smart Cities Mission" },
      ],
    },
  },
  gs2: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "Discuss the significance of the 42nd Constitutional Amendment Act. How did it alter the basic structure of the Constitution?", hint: "Focus: Preamble changes, Fundamental Duties, emergency powers — Minerva Mills reversal" },
        { year: 2022, marks: 10, q: "What are the constitutional provisions for protection of civil servants? Examine their adequacy.", hint: "Focus: Art 310–311, security of tenure, political neutrality vs. accountability gaps" },
      ],
      "15": [
        { year: 2023, marks: 15, q: "Examine the role of the Supreme Court as the guardian of fundamental rights. Illustrate with landmark judgements.", hint: "Focus: Kesavananda, Maneka Gandhi, Puttaswamy — evolution of rights jurisprudence" },
        { year: 2022, marks: 15, q: "Discuss the challenges in the functioning of Parliamentary committees and suggest measures to strengthen them.", hint: "Focus: low attendance, BJP-opposition dynamics, weak follow-up mechanism, PRS recommendations" },
      ],
      "20": [
        { year: 2022, marks: 20, q: "Critically analyze India's approach to its neighborhood. How have bilateral relations with major neighbors evolved in the last decade?", hint: "Focus: Neighbourhood First, SAARC stagnation, China factor, cross-border infrastructure" },
      ],
    },
    topic: {
      "10": [
        { year: null, marks: 10, q: "Explain the significance of Directive Principles of State Policy in achieving social and economic justice.", hint: "Focus: non-justiciability, complementary relationship with FR, judicial enforcement trends" },
        { year: null, marks: 10, q: "Discuss the role of Local Self Government as the third tier of democracy in India.", hint: "Focus: 73rd/74th amendments, devolution gaps, Panchayati Raj, urban bodies under-capacity" },
      ],
      "15": [
        { year: null, marks: 15, q: "Examine the challenges in implementing the Right to Education Act effectively across India.", hint: "Focus: infrastructure deficit, teacher shortage, private school compliance, quality vs. access" },
      ],
      "20": [
        { year: null, marks: 20, q: "Analyze the structural and functional challenges of Indian federalism in the context of Centre-State relations.", hint: "Focus: fiscal asymmetry, concurrent list friction, Governor's role, cooperative federalism initiatives" },
      ],
    },
    mixed: {
      "10": [
        { year: 2021, marks: 10, q: "What are the key features of the Anti-Defection Law? Discuss its impact on legislative behavior.", hint: "Focus: 10th Schedule, Floor-crossing, Speaker's role, loopholes via merger clause" },
      ],
      "15": [
        { year: 2020, marks: 15, q: "Examine the role of Civil Society in strengthening democracy and governance in India.", hint: "Focus: accountability function, RTI activism, watchdog role, NGO regulation concerns" },
      ],
      "20": [
        { year: 2023, marks: 20, q: "India's foreign policy has undergone a strategic shift in recent years. Analyze the key drivers and implications of this shift.", hint: "Focus: strategic autonomy, QUAD, Act East, China hedging, G20 positioning, multilateralism" },
      ],
    },
  },
  gs3: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "Discuss the significance of the Production Linked Incentive (PLI) scheme for India's manufacturing sector.", hint: "Focus: import substitution, sector-specific targets, employment, Make in India alignment" },
        { year: 2022, marks: 10, q: "What are the challenges associated with implementation of MSP policy for farmers in India?", hint: "Focus: coverage gaps, procurement limitations, fiscal burden, Shanta Kumar report" },
      ],
      "15": [
        { year: 2023, marks: 15, q: "Examine the role of space technology in India's development. Discuss the commercial potential of ISRO's achievements.", hint: "Focus: remote sensing, disaster mgmt, navigation, IN-SPACe, Chandrayaan, NewSpace India" },
        { year: 2022, marks: 15, q: "Analyze the impact of climate change on Indian agriculture and the adaptation strategies needed.", hint: "Focus: rainfall variability, crop yield loss, PMFSBY, drought-resistant varieties, agroforestry" },
      ],
      "20": [
        { year: 2022, marks: 20, q: "India's digital economy has grown rapidly in the last decade. Examine the opportunities and challenges it presents for inclusive development.", hint: "Focus: UPI, digital divide, data localisation, gig economy, PMGDISHA, fintech regulation" },
      ],
    },
    topic: {
      "10": [
        { year: null, marks: 10, q: "Explain the importance of Intellectual Property Rights in promoting innovation and economic growth.", hint: "Focus: patents, trade secrets, TRIPS compliance, startups, compulsory licensing" },
        { year: null, marks: 10, q: "Discuss the role of SHGs (Self Help Groups) in rural development and financial inclusion.", hint: "Focus: NABARD, NRLM, women empowerment, microfinance, convergence with govt schemes" },
      ],
      "15": [
        { year: null, marks: 15, q: "Examine the major causes of food inflation in India and policy responses to contain it.", hint: "Focus: supply-side shocks, MSP-WPI gap, buffer stock policy, essential commodities act" },
      ],
      "20": [
        { year: null, marks: 20, q: "Critically analyze India's cybersecurity landscape. What institutional and policy measures are needed to address emerging threats?", hint: "Focus: CERT-In, National Cyber Policy, critical infrastructure vulnerability, state-actor threats" },
      ],
    },
    mixed: {
      "10": [
        { year: 2021, marks: 10, q: "What is the importance of the NDMA in India's disaster preparedness framework?", hint: "Focus: Sendai Framework, DM Act 2005, NDRF, state-level coordination, early warning systems" },
      ],
      "15": [
        { year: 2020, marks: 15, q: "Examine the linkages between poverty, malnutrition, and public health in India. What policy interventions have been made?", hint: "Focus: hunger-poverty nexus, ICDS, Mid-Day Meal, POSHAN Abhiyaan, stunting vs. wasting" },
      ],
      "20": [
        { year: 2023, marks: 20, q: "Analyze the geopolitical dimensions of India's energy security. Discuss the role of renewable energy in reducing strategic vulnerabilities.", hint: "Focus: import dependence, IEA membership, solar mission, green hydrogen, Malacca dilemma" },
      ],
    },
  },
};

// ─── Real recent attempts — loaded from localStorage ─────────────────────────
function useRecentAttempts(limit = 3) {
  const [attempts, setAttempts] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mains_answer_attempts_v1");
      const all = raw ? JSON.parse(raw) : [];
      // Sort newest first by createdAt, then take top N
      const sorted = [...all].sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setAttempts(sorted.slice(0, limit));
    } catch {
      setAttempts([]);
    }
  }, [limit]);
  return attempts;
}

// ─── Dynamic weak areas — derived from mains_mistakes_v1 ────────────────────────
const SEV_RANK = { high: 0, medium: 1, low: 2 };

function useWeakAreas() {
  const [areas, setAreas] = useState({ GS1: [], GS2: [], GS3: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mains_mistakes_v1");
      const all = raw ? JSON.parse(raw) : [];

      // Filter unresolved only
      const open = all.filter((m) => m.status !== "resolved");

      // Group by paper
      const grouped = { GS1: [], GS2: [], GS3: [] };
      open.forEach((m) => {
        const key = (m.paper || "").toUpperCase();
        if (grouped[key]) grouped[key].push(m);
      });

      // Sort and pick top 3 per paper
      const pick = (list) =>
        [...list]
          .sort((a, b) => {
            // mustRevise first
            if (a.mustRevise !== b.mustRevise) return a.mustRevise ? -1 : 1;
            // severity High > Medium > Low
            const sa = SEV_RANK[(a.severity || "medium").toLowerCase()] ?? 1;
            const sb = SEV_RANK[(b.severity || "medium").toLowerCase()] ?? 1;
            if (sa !== sb) return sa - sb;
            // newest first
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          })
          .slice(0, 3)
          .map((m) => {
            // Build a human-readable label from topic / mistakeTypes / question snippet
            const base = m.topic || (m.question ? m.question.slice(0, 60) + "\u2026" : "Untitled");
            const tag  = (m.mistakeTypes || [])[0] || "";
            return tag ? `${base} — ${tag}` : base;
          });

      setAreas({
        GS1: pick(grouped.GS1),
        GS2: pick(grouped.GS2),
        GS3: pick(grouped.GS3),
      });
    } catch {
      setAreas({ GS1: [], GS2: [], GS3: [] });
    }
  }, []);

  return areas;
}

// ─── Mains dashboard stats — derived from both localStorage keys ────────────────
function useMainsStats() {
  const [stats, setStats] = useState({
    total: 0, thisWeek: 0,
    strongestPaper: "—", weakestPaper: "—",
    openMistakes: 0,
  });

  useEffect(() => {
    try {
      // ─ Attempts ─
      const attRaw  = localStorage.getItem("mains_answer_attempts_v1");
      const allAtt  = attRaw ? JSON.parse(attRaw) : [];
      const total   = allAtt.length;

      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const thisWeek = allAtt.filter(
        (a) => a.createdAt && new Date(a.createdAt).getTime() >= weekAgo
      ).length;

      // Strongest paper = most attempts
      const attByPaper = {};
      allAtt.forEach((a) => {
        const p = (a.paper || "").toUpperCase();
        if (p) attByPaper[p] = (attByPaper[p] || 0) + 1;
      });
      const strongestPaper = Object.keys(attByPaper).sort(
        (a, b) => attByPaper[b] - attByPaper[a]
      )[0] || "—";

      // ─ Mistakes ─
      const misRaw  = localStorage.getItem("mains_mistakes_v1");
      const allMis  = misRaw ? JSON.parse(misRaw) : [];
      const openMis = allMis.filter((m) => m.status !== "resolved");
      const openMistakes = openMis.length;

      // Weakest paper = paper with most open mistakes
      const misByPaper = {};
      openMis.forEach((m) => {
        const p = (m.paper || "").toUpperCase();
        if (p) misByPaper[p] = (misByPaper[p] || 0) + 1;
      });
      const weakestPaper = Object.keys(misByPaper).sort(
        (a, b) => misByPaper[b] - misByPaper[a]
      )[0] || "—";

      setStats({ total, thisWeek, strongestPaper, weakestPaper, openMistakes });
    } catch {
      // keep defaults
    }
  }, []);

  return stats;
}

// ─── Per-paper stats — derived from localStorage ──────────────────────────────
function usePerPaperStats() {
  const PAPERS = ["GS1", "GS2", "GS3"];
  const empty  = () => ({ answersWritten: 0, openWeakAreas: 0 });
  const [data, setData] = useState({ GS1: empty(), GS2: empty(), GS3: empty() });

  useEffect(() => {
    try {
      // Attempts
      const attRaw = localStorage.getItem("mains_answer_attempts_v1");
      const allAtt = attRaw ? JSON.parse(attRaw) : [];

      // Mistakes — open only
      const misRaw = localStorage.getItem("mains_mistakes_v1");
      const allMis = misRaw ? JSON.parse(misRaw) : [];
      const openMis = allMis.filter((m) => m.status !== "resolved");

      const result = {};
      for (const p of PAPERS) {
        const pUp = p.toUpperCase();
        result[p] = {
          answersWritten: allAtt.filter((a) => (a.paper || "").toUpperCase() === pUp).length,
          openWeakAreas:  openMis.filter((m) => (m.paper || "").toUpperCase() === pUp).length,
        };
      }
      setData(result);
    } catch {
      // keep zeros
    }
  }, []);

  return data;
}

// ─── Relative time helper ─────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return "Unknown time";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 2)  return "Just now";
  if (mins  < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days  < 7)  return `${days} day${days  !== 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
const label11 = (color = T.subtle) => ({
  fontSize: 11, fontWeight: 700, letterSpacing: "0.11em",
  textTransform: "uppercase", color,
});

const outlineBtn = (accent) => ({
  background: "transparent", color: accent,
  border: `1px solid ${accent}44`, borderRadius: 8,
  fontWeight: 600, fontSize: 12, padding: "7px 14px",
  cursor: "pointer", fontFamily: T.font,
  letterSpacing: "0.03em", whiteSpace: "nowrap",
});

// ─── Micro-components ─────────────────────────────────────────────────────────
function Chip({ label, accent, small }) {
  return (
    <span style={{
      fontSize: small ? 10 : 11, fontWeight: 700,
      padding: small ? "2px 8px" : "3px 10px", borderRadius: 20,
      border: `1px solid ${accent}33`, color: accent,
      background: `${accent}11`, letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, accent }) {
  return (
    <div style={{ height: 4, background: T.muted, borderRadius: 4, overflow: "hidden", width: "100%" }}>
      <div style={{
        height: "100%", width: `${Math.min(value, 100)}%`,
        background: `linear-gradient(90deg, ${accent}, ${accent}bb)`, borderRadius: 4,
      }} />
    </div>
  );
}

// ─── Selector pill group ──────────────────────────────────────────────────────
function SelectorGroup({ label, options, active, onChange, getAccent }) {
  return (
    <div>
      <div style={{ ...label11(T.subtle), marginBottom: 9 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {options.map((opt) => {
          const isActive = active === opt.value;
          const accent = getAccent ? getAccent(opt.value) : T.amber;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: "7px 15px",
                borderRadius: 8,
                border: isActive ? `1.5px solid ${accent}` : `1px solid ${T.borderMid}`,
                background: isActive ? `${accent}15` : T.surface,
                color: isActive ? accent : T.dim,
                fontWeight: isActive ? 800 : 600,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: T.font,
                letterSpacing: "0.05em",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── GS Card ──────────────────────────────────────────────────────────────────
function GSCard({ paper, stats }) {
  const navigate = useNavigate();
  const { accent, accentDim, label, title, themes, route } = paper;

  // Real values from stats; "—" for anything without a truthful source
  const answersWritten = stats?.answersWritten ?? 0;
  const openWeakAreas  = stats?.openWeakAreas  ?? 0;

  const metrics = [
    { label: "Topics Covered",  value: "—",                      note: "Pending mapping" },
    { label: "Answers Written", value: String(answersWritten),   note: null },
    { label: "Open Weak Areas", value: String(openWeakAreas),   note: null },
  ];

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, ${accentDim})` }} />
      <div style={{ padding: "22px 20px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: accent, background: `${accent}15`, border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 10px", letterSpacing: "0.06em" }}>
                {label}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.textBright, lineHeight: 1.25 }}>{title}</div>
          </div>
          {/* Answers written — the one number we can honestly show prominently */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: accent, lineHeight: 1 }}>{answersWritten}</div>
            <div style={{ ...label11(T.subtle), fontSize: 9, marginTop: 2 }}>Answers</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 18 }}>
          {themes.map((t) => <Chip key={t} label={t} accent={accent} small />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: m.value === "—" ? T.muted : T.text, marginBottom: 3 }}>{m.value}</div>
              <div style={{ ...label11(T.subtle), fontSize: 9 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: "auto" }}>
          <button
            onClick={() => route && navigate(route)}
            style={{ background: accent, color: "#09090b", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}
          >
            Open {label}
          </button>
          <button
            onClick={() => route && navigate(route)}
            style={outlineBtn(accent)}
          >
            Practice Qs
          </button>
          <button style={outlineBtn(T.dim)}>Weak Areas</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat box ─────────────────────────────────────────────────────────────────
function StatBox({ label, value, accent }) {
  return (
    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 130 }}>
      <div style={{ ...label11(T.subtle), marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || T.text }}>{value}</div>
    </div>
  );
}

function RecentRow({ item, isLast }) {
  // Support both real attempt shape and legacy shape
  const paper   = item.paper || "GS";
  const title   = item.question || item.title || "Answer attempt";
  const mode    = item.mode   || item.topic || "";
  const time    = item.createdAt ? timeAgo(item.createdAt) : (item.time || "");
  const marks   = item.marks  ? `${item.marks}M` : "";

  const accent =
    paper.toUpperCase().includes("GS1") ? T.amber
    : paper.toUpperCase().includes("GS2") ? T.blue
    : paper.toUpperCase().includes("GS3") ? T.green
    : T.dim;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
      <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, background: `${accent}15`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: accent, letterSpacing: "0.04em" }}>
        {paper.toUpperCase().replace(/(GS[123])/i, "$1").slice(0, 3)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {mode && <span style={{ fontSize: 11, color: T.dim }}>{mode}</span>}
          {mode && <span style={{ color: T.muted, fontSize: 10 }}>·</span>}
          {marks && <span style={{ fontSize: 11, color: T.subtle }}>{marks}</span>}
          {marks && <span style={{ color: T.muted, fontSize: 10 }}>·</span>}
          <span style={{ fontSize: 11, color: T.muted }}>{time}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, border: `1px solid ${T.green}33`, color: T.green, background: `${T.green}11`, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Saved
        </span>
      </div>
    </div>
  );
}

// ─── Weak area column ─────────────────────────────────────────────────────────
function WeakColumn({ gs, accent, items }) {
  return (
    <div style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}44)` }} />
      <div style={{ padding: "16px 14px 14px" }}>
        <div style={{ ...label11(accent), marginBottom: 12 }}>{gs} Focus</div>
        {items.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px", background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0, marginTop: 4 }} />
                <span style={{ fontSize: 12, color: T.text, fontWeight: 500, lineHeight: 1.4 }}>{item}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic", padding: "8px 0" }}>
            No weak areas yet.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MainsThemeBrowser ────────────────────────────────────────────────────────
// Minimal, additive. Fetches subject-theme tree from backend and renders
// a drill-down: paper selector → subject cards → theme rows → subtheme rows → PYQ list.

const THEME_PAPERS = [
  { id: "GS1", accent: T.amber, label: "GS1", title: "General Studies I" },
  { id: "GS2", accent: T.blue,  label: "GS2", title: "General Studies II" },
  { id: "GS3", accent: T.green, label: "GS3", title: "General Studies III" },
  { id: "GS4", accent: T.purple, label: "GS4", title: "General Studies IV" },
];

function MainsThemeBrowser() {
  const [paper,      setPaper]      = useState("GS1");
  const [tree,       setTree]       = useState([]);         // [{subject, count, themes}]
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [openSubject, setOpenSubject] = useState(null);
  const [openTheme,   setOpenTheme]   = useState(null);
  const [openSubtheme, setOpenSubtheme] = useState(null);
  const [pyqs,       setPyqs]       = useState([]);         // full question objects
  const [pyqsLoading, setPyqsLoading] = useState(false);
  const [pyqsError,   setPyqsError]   = useState("");

  // ── Cascading filter state ─────────────────────────────────────────────────
  const [selSubject,  setSelSubject]  = useState("all");
  const [selTopic,    setSelTopic]    = useState("all");
  const [selSubtopic, setSelSubtopic] = useState("all");

  const accent = THEME_PAPERS.find(p => p.id === paper)?.accent || T.amber;

  // ── Derived dropdown options (from live tree data only) ───────────────────
  const availableSubjects = useMemo(
    () => tree.map(s => s.subject).filter(Boolean),
    [tree]
  );

  const availableTopics = useMemo(() => {
    if (selSubject === "all") return [];
    const node = tree.find(s => s.subject === selSubject);
    return (node?.themes || []).map(t => t.name).filter(Boolean);
  }, [tree, selSubject]);

  const availableSubtopics = useMemo(() => {
    if (selSubject === "all" || selTopic === "all") return [];
    const node = tree.find(s => s.subject === selSubject);
    const themeNode = (node?.themes || []).find(t => t.name === selTopic);
    return (themeNode?.subthemes || []).map(st => st.name).filter(Boolean);
  }, [tree, selSubject, selTopic]);

  const showSubtopicDropdown = availableSubtopics.length > 0;

  // ── Filtered tree for accordion rendering ─────────────────────────────────
  const filteredTree = useMemo(() => {
    if (selSubject === "all") return tree;
    return tree
      .filter(s => s.subject === selSubject)
      .map(s => {
        if (selTopic === "all") return s;
        const filteredThemes = (s.themes || [])
          .filter(t => t.name === selTopic)
          .map(t => {
            if (selSubtopic === "all") return t;
            return { ...t, subthemes: (t.subthemes || []).filter(st => st.name === selSubtopic) };
          });
        return { ...s, themes: filteredThemes };
      });
  }, [tree, selSubject, selTopic, selSubtopic]);

  // ── Cascading handlers ────────────────────────────────────────────────────
  function handleSelSubject(v) {
    setSelSubject(v);
    setSelTopic("all");
    setSelSubtopic("all");
    setOpenSubject(v !== "all" ? v : null);
    setOpenTheme(null);
    setOpenSubtheme(null);
    setPyqs([]);
  }

  function handleSelTopic(v) {
    setSelTopic(v);
    setSelSubtopic("all");
    setOpenTheme(v !== "all" && selSubject !== "all" ? `${selSubject}||${v}` : null);
    setOpenSubtheme(null);
    setPyqs([]);
  }

  function handleSelSubtopic(v) {
    setSelSubtopic(v);
    if (v !== "all" && selSubject !== "all" && selTopic !== "all") {
      const stKey = `${selSubject}||${selTopic}||${v}`;
      setOpenSubtheme(stKey);
      setPyqs([]);
      setPyqsError("");
      setPyqsLoading(true);
      fetch(
        `${BACKEND_URL}/api/mains/pyqs/by-subtheme` +
        `?paper=${encodeURIComponent(paper)}` +
        `&subject=${encodeURIComponent(selSubject)}` +
        `&theme=${encodeURIComponent(selTopic)}` +
        `&subtheme=${encodeURIComponent(v)}`
      )
        .then(r => r.json())
        .then(data => { if (data.ok) setPyqs(data.questions || []); else setPyqsError(data.error || "Failed"); })
        .catch(e => setPyqsError(String(e?.message || e)))
        .finally(() => setPyqsLoading(false));
    } else {
      setOpenSubtheme(null);
      setPyqs([]);
    }
  }

  // ── Dropdown style (matches page dark theme) ──────────────────────────────
  const dropdownStyle = {
    background: T.bg, border: `1px solid ${T.borderMid}`,
    borderRadius: 8, color: T.text, fontSize: 12,
    padding: "6px 10px", fontFamily: T.font,
    cursor: "pointer", outline: "none", minWidth: 140,
  };

  // ── Fetch tree on paper change ─────────────────────────────────────────────
  useEffect(() => {
    setTree([]);
    setOpenSubject(null);
    setOpenTheme(null);
    setOpenSubtheme(null);
    setPyqs([]);
    setError("");
    setLoading(true);

    fetch(`${BACKEND_URL}/api/mains/themes/${paper}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setTree(data.tree || []);
        else setError(data.error || "Failed to load themes");
      })
      .catch(e => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [paper]);

  // ── Fetch PYQs when subtheme selected ─────────────────────────────────────
  function loadSubthemePyqs(subject, theme, subtheme) {
    setPyqs([]);
    setPyqsError("");
    setPyqsLoading(true);

    const url = `${BACKEND_URL}/api/mains/pyqs/by-subtheme`
      + `?paper=${encodeURIComponent(paper)}`
      + `&subject=${encodeURIComponent(subject)}`
      + `&theme=${encodeURIComponent(theme)}`
      + `&subtheme=${encodeURIComponent(subtheme)}`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setPyqs(data.questions || []);
        else setPyqsError(data.error || "Failed to load PYQs");
      })
      .catch(e => setPyqsError(String(e?.message || e)))
      .finally(() => setPyqsLoading(false));
  }

  function handleSubthemeClick(subject, theme, subtheme) {
    const key = `${subject}||${theme}||${subtheme}`;
    if (openSubtheme === key) {
      setOpenSubtheme(null);
      setPyqs([]);
      return;
    }
    setOpenSubtheme(key);
    loadSubthemePyqs(subject, theme, subtheme);
  }

  const chevron = (open) => (
    <span style={{ fontSize: 13, color: accent, transition: "transform 0.2s",
      display: "inline-block", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
  );

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 14, overflow: "hidden", marginBottom: 28,
    }}>
      {/* Header accent bar */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}44, transparent)` }} />
      <div style={{ padding: "20px 24px" }}>

        {/* Section title + paper selector */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ ...label11(accent), marginBottom: 5 }}>PYQ Theme Intelligence</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: T.textBright }}>Browse PYQs by Theme</div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 3 }}>Select paper → subject → theme → subtheme</div>
          </div>
          {/* Paper pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {THEME_PAPERS.map(p => (
              <button
                key={p.id}
                onClick={() => setPaper(p.id)}
                style={{
                  padding: "6px 14px", borderRadius: 8,
                  border: paper === p.id ? `1.5px solid ${p.accent}` : `1px solid ${T.borderMid}`,
                  background: paper === p.id ? `${p.accent}18` : T.bg,
                  color: paper === p.id ? p.accent : T.dim,
                  fontWeight: paper === p.id ? 800 : 500,
                  fontSize: 12, cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em",
                }}
              >{p.label}</button>
            ))}
          </div>
        </div>

        {/* ── Cascading filters ── */}
        {tree.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {/* Subject */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.subtle }}>Subject</span>
              <select value={selSubject} onChange={e => handleSelSubject(e.target.value)} style={dropdownStyle}>
                <option value="all">All Subjects</option>
                {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Topic — only enabled when subject is selected */}
            {selSubject !== "all" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.subtle }}>Topic</span>
                <select value={selTopic} onChange={e => handleSelTopic(e.target.value)} style={dropdownStyle}>
                  <option value="all">All Topics</option>
                  {availableTopics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {/* Subtopic — only when topic selected AND subtopics exist */}
            {selTopic !== "all" && showSubtopicDropdown && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.subtle }}>Subtopic</span>
                <select value={selSubtopic} onChange={e => handleSelSubtopic(e.target.value)} style={dropdownStyle}>
                  <option value="all">All Subtopics</option>
                  {availableSubtopics.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            )}

            {/* Reset pill */}
            {selSubject !== "all" && (
              <button
                onClick={() => { handleSelSubject("all"); }}
                style={{
                  alignSelf: "flex-end", background: "transparent",
                  border: `1px solid ${T.borderMid}`, borderRadius: 6,
                  color: T.dim, fontSize: 11, padding: "6px 12px",
                  cursor: "pointer", fontFamily: T.font,
                }}
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* State: loading/error/empty */}
        {loading && (
          <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: T.muted }}>Loading themes…</div>
        )}
        {error && (
          <div style={{ padding: "12px", background: `${T.red}12`, border: `1px solid ${T.red}33`, borderRadius: 8, fontSize: 12, color: T.red }}>{error}</div>
        )}

        {/* No results after filtering */}
        {!loading && !error && tree.length > 0 && filteredTree.length === 0 && (
          <div style={{ padding: "16px 0", fontSize: 12, color: T.muted }}>No themes match the selected filters.</div>
        )}

        {/* Subject list */}
        {!loading && !error && filteredTree.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredTree.map(({ subject, count, themes }) => {
              const isSubjectOpen = openSubject === subject;
              return (
                <div key={subject} style={{
                  border: `1px solid ${isSubjectOpen ? accent + "44" : T.border}`,
                  borderRadius: 10, overflow: "hidden",
                  background: isSubjectOpen ? `${accent}06` : T.bg,
                  transition: "background 0.15s",
                }}>
                  {/* Subject header */}
                  <button
                    onClick={() => {
                      setOpenSubject(isSubjectOpen ? null : subject);
                      setOpenTheme(null);
                      setOpenSubtheme(null);
                      setPyqs([]);
                    }}
                    style={{
                      width: "100%", background: "none", border: "none",
                      padding: "12px 16px", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      fontFamily: T.font, textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, color: isSubjectOpen ? accent : T.textBright }}>{subject}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: accent,
                        background: `${accent}14`, border: `1px solid ${accent}30`,
                        borderRadius: 20, padding: "2px 9px",
                      }}>{count} PYQs</span>
                      {chevron(isSubjectOpen)}
                    </div>
                  </button>

                  {/* Theme list */}
                  {isSubjectOpen && (
                    <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 0" }}>
                      {themes.map(({ name: themeName, count: themeCount, subthemes }) => {
                        const themeKey  = `${subject}||${themeName}`;
                        const isThemeOpen = openTheme === themeKey;
                        return (
                          <div key={themeName}>
                            <button
                              onClick={() => {
                                setOpenTheme(isThemeOpen ? null : themeKey);
                                setOpenSubtheme(null);
                                setPyqs([]);
                              }}
                              style={{
                                width: "100%", background: "none", border: "none",
                                padding: "9px 16px 9px 28px", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                fontFamily: T.font, textAlign: "left",
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700, color: isThemeOpen ? accent : T.text }}>▸ {themeName}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10, color: T.muted }}>{themeCount} Qs</span>
                                {chevron(isThemeOpen)}
                              </div>
                            </button>

                            {/* Subtheme list */}
                            {isThemeOpen && (
                              <div style={{ borderTop: `1px solid ${T.border}22`, padding: "4px 0 8px" }}>
                                {subthemes.map(({ name: subthemeName, count: stCount, lastAskedYear, years, topDirective, matchModeSummary }) => {
                                  const stKey    = `${subject}||${themeName}||${subthemeName}`;
                                  const isStOpen = openSubtheme === stKey;

                                  // Compute match quality label from matchModeSummary
                                  const mms      = matchModeSummary || {};
                                  const exact    = mms.mappedNodeExact || 0;
                                  const fallback = (mms.keywordStrong || 0) + (mms.keywordModerate || 0) + (mms.themeNameFallback || 0);
                                  const matchLabel = stCount === 0 ? null
                                    : exact === stCount ? "Exact"
                                    : fallback === stCount ? "Fallback"
                                    : exact > 0 ? "Mixed"
                                    : null;
                                  const matchLabelColor = matchLabel === "Exact" ? T.green
                                    : matchLabel === "Mixed" ? T.amber
                                    : T.red;
                                  return (
                                    <div key={subthemeName} style={{ borderBottom: `1px solid ${T.border}22` }}>
                                      <button
                                        onClick={() => handleSubthemeClick(subject, themeName, subthemeName)}
                                        style={{
                                          width: "100%", background: isStOpen ? `${accent}0a` : "none",
                                          border: "none", padding: "8px 16px 8px 44px",
                                          cursor: "pointer", display: "flex", alignItems: "center",
                                          justifyContent: "space-between", fontFamily: T.font, textAlign: "left",
                                        }}
                                      >
                                        <div>
                                          <span style={{ fontSize: 11.5, fontWeight: isStOpen ? 700 : 500, color: isStOpen ? accent : T.textBright }}>– {subthemeName}</span>
                                          <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
                                            <span style={{ fontSize: 10, color: T.muted }}>{stCount} question{stCount !== 1 ? "s" : ""}</span>
                                            {lastAskedYear && <span style={{ fontSize: 10, color: T.dim }}>Last: {lastAskedYear}</span>}
                                            {years && years.length > 0 && (
                                              <span style={{ fontSize: 10, color: T.muted }}>{years.slice(0, 4).join(", ")}{years.length > 4 ? "…" : ""}</span>
                                            )}
                                            {topDirective && (
                                              <span style={{ fontSize: 9, fontWeight: 700, color: accent, background: `${accent}12`, border: `1px solid ${accent}25`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.04em" }}>
                                                {topDirective}
                                              </span>
                                            )}
                                            {matchLabel && (
                                              <span style={{ fontSize: 9, fontWeight: 800, color: matchLabelColor, background: `${matchLabelColor}12`, border: `1px solid ${matchLabelColor}30`, borderRadius: 4, padding: "1px 7px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                                {matchLabel}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        {chevron(isStOpen)}
                                      </button>

                                      {/* PYQ panel */}
                                      {isStOpen && (
                                        <div style={{ padding: "10px 16px 14px 44px" }}>
                                          {pyqsLoading && (
                                            <div style={{ fontSize: 11, color: T.muted, padding: "6px 0" }}>Loading PYQs…</div>
                                          )}
                                          {pyqsError && (
                                            <div style={{ fontSize: 11, color: T.red }}>{pyqsError}</div>
                                          )}
                                          {!pyqsLoading && !pyqsError && pyqs.length === 0 && (
                                            <div style={{ fontSize: 11, color: T.muted }}>No PYQs found for this subtheme.</div>
                                          )}
                                          {!pyqsLoading && pyqs.length > 0 && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                              {pyqs.map(q => (
                                                <div key={q.id} style={{
                                                  background: T.surface, border: `1px solid ${T.border}`,
                                                  borderRadius: 8, padding: "12px 14px",
                                                }}>
                                                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                                                    {q.year && (
                                                      <span style={{
                                                        fontSize: 10, fontWeight: 700, color: accent,
                                                        background: `${accent}14`, border: `1px solid ${accent}30`,
                                                        borderRadius: 5, padding: "2px 8px",
                                                      }}>UPSC {q.year}</span>
                                                    )}
                                                    {q.marks && (
                                                      <span style={{
                                                        fontSize: 10, fontWeight: 600, color: T.dim,
                                                        background: T.bg, border: `1px solid ${T.border}`,
                                                        borderRadius: 5, padding: "2px 8px",
                                                      }}>{q.marks}M</span>
                                                    )}
                                                    {q.wordLimit && (
                                                      <span style={{
                                                        fontSize: 10, color: T.muted,
                                                        background: T.bg, border: `1px solid ${T.border}`,
                                                        borderRadius: 5, padding: "2px 8px",
                                                      }}>{q.wordLimit} words</span>
                                                    )}
                                                  </div>
                                                  <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>
                                                    {q.question}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quick Practice ───────────────────────────────────────────────────────────
function QuickPractice() {
  const [paper, setPaper] = useState("gs1");
  const [mode, setMode] = useState("pyq");
  const [marks, setMarks] = useState("15");
  const [qIndex, setQIndex] = useState(0);

  const paperAccent = paper === "gs1" ? T.amber : paper === "gs2" ? T.blue : T.green;
  const paperLabel  = paper === "gs1" ? "GS1"  : paper === "gs2" ? "GS2"  : "GS3";

  const pool       = PRACTICE_QUESTIONS?.[paper]?.[mode]?.[marks] || [];
  const totalInPool = pool.length;
  const currentQ   = totalInPool > 0 ? pool[qIndex % totalInPool] : null;

  const handleNext  = () => { if (totalInPool > 1) setQIndex((i) => (i + 1) % totalInPool); };
  const handlePaper = (v) => { setPaper(v); setQIndex(0); };
  const handleMode  = (v) => { setMode(v);  setQIndex(0); };
  const handleMarks = (v) => { setMarks(v); setQIndex(0); };

  const modeColor  = mode === "pyq" ? T.purple : mode === "topic" ? T.amber : T.blue;
  const modeLabel  = mode === "pyq" ? "PYQ" : mode === "topic" ? "Topic" : "Mixed";

  const wordGuide   = marks === "10" ? "~150 words" : marks === "15" ? "~200 words" : "~250 words";
  const timeGuide   = marks === "10" ? "7 min"      : marks === "15" ? "10 min"     : "13 min";
  const structGuide = marks === "10" ? "Intro + 3 pts + Concl" : marks === "15" ? "Intro + 4–5 pts + Concl" : "Intro + 6 pts + Concl";

  const navigate = useNavigate();

  const handleStartWriting = () => {
    if (!currentQ) return;
    const priorityLabel = mode === "pyq" ? "UPSC PYQ · High Priority"
      : mode === "topic" ? "Topic Practice · Depth Builder"
      : "Mixed Mode · Breadth Drill";
    navigate("/mains/answer-writing", {
      state: {
        question: {
          paper: paperLabel,
          mode: modeLabel,
          marks: marks,
          year: currentQ.year || null,
          structure: structGuide,
          focus: currentQ.hint || "",
          priority: priorityLabel,
          question: currentQ.q,
        },
      },
    });
  };

  // Source line copy — refined, badge-style
  const sourceLine = mode === "pyq"
    ? { dot: T.green,  label: "UPSC PYQ",              sub: "High Priority" }
    : mode === "topic"
    ? { dot: T.amber,  label: "Topic Practice",         sub: "Depth Builder" }
    : { dot: T.blue,   label: "Mixed Mode",              sub: "Breadth Drill" };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>

      {/* Dynamic accent top bar tracks selected paper */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${paperAccent}, ${paperAccent}44, transparent)` }} />

      <div style={{ padding: "26px 28px 28px" }}>

        {/* ── Section header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ ...label11(paperAccent), marginBottom: 7, letterSpacing: "0.14em" }}>Answer Writing Practice</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T.textBright, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
              Mains Practice Session
            </div>
            <div style={{ fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>
              Select paper, mode, and marker type — then begin focused mains writing.
            </div>
          </div>

          {/* Live config pill — mirrors active selector state */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
            background: T.bg, border: `1px solid ${T.borderMid}`,
            borderRadius: 10, padding: "9px 16px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: paperAccent, letterSpacing: "0.04em" }}>{paperLabel}</span>
            <span style={{ color: T.muted, fontSize: 12 }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: modeColor, letterSpacing: "0.06em" }}>{modeLabel}</span>
            <span style={{ color: T.muted, fontSize: 12 }}>·</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{marks}M</span>
          </div>
        </div>

        {/* ── Selectors — lighter, command-control feel ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 0, marginBottom: 24,
          background: T.bg, borderRadius: 10,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
        }}>
          {[
            {
              label: "Paper",
              opts: [
                { label: "GS1", value: "gs1" },
                { label: "GS2", value: "gs2" },
                { label: "GS3", value: "gs3" },
              ],
              active: paper, onChange: handlePaper,
              getAccent: (v) => v === "gs1" ? T.amber : v === "gs2" ? T.blue : T.green,
            },
            {
              label: "Mode",
              opts: [
                { label: "PYQ",   value: "pyq" },
                { label: "Topic", value: "topic" },
                { label: "Mixed", value: "mixed" },
              ],
              active: mode, onChange: handleMode,
              getAccent: () => T.purple,
            },
            {
              label: "Answer Type",
              opts: [
                { label: "10 Marker", value: "10" },
                { label: "15 Marker", value: "15" },
                { label: "20 Marker", value: "20" },
              ],
              active: marks, onChange: handleMarks,
              getAccent: () => paperAccent,
            },
          ].map((group, gIdx) => (
            <div
              key={group.label}
              style={{
                padding: "14px 16px 16px",
                borderRight: gIdx < 2 ? `1px solid ${T.border}` : "none",
              }}
            >
              <div style={{ ...label11(T.subtle), marginBottom: 10, fontSize: 10 }}>{group.label}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {group.opts.map((opt) => {
                  const isActive = group.active === opt.value;
                  const acc = group.getAccent(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => group.onChange(opt.value)}
                      style={{
                        padding: "5px 13px",
                        borderRadius: 7,
                        border: isActive ? `1.5px solid ${acc}` : `1px solid ${T.borderMid}`,
                        background: isActive ? `${acc}18` : "transparent",
                        color: isActive ? acc : T.dim,
                        fontWeight: isActive ? 800 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: T.font,
                        letterSpacing: "0.04em",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Question preview card ── */}
        {currentQ ? (
          <div style={{
            background: T.bg,
            border: `1px solid ${paperAccent}22`,
            borderRadius: 12, overflow: "hidden", marginBottom: 22,
          }}>

            {/* Card header — meta chips row */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 18px",
              borderBottom: `1px solid ${T.border}`,
              background: `${paperAccent}07`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 900, color: paperAccent,
                  background: `${paperAccent}18`, border: `1px solid ${paperAccent}33`,
                  borderRadius: 6, padding: "3px 10px", letterSpacing: "0.07em",
                }}>
                  {paperLabel}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: modeColor,
                  background: `${modeColor}14`, border: `1px solid ${modeColor}30`,
                  borderRadius: 6, padding: "3px 9px", letterSpacing: "0.07em", textTransform: "uppercase",
                }}>
                  {modeLabel}
                </span>
                {currentQ.year && (
                  <span style={{ fontSize: 11, color: T.dim, fontWeight: 600 }}>UPSC {currentQ.year}</span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: T.textBright,
                  background: T.surface, border: `1px solid ${T.borderMid}`,
                  borderRadius: 6, padding: "3px 10px",
                }}>
                  {marks} Marks
                </span>
                {totalInPool > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: T.dim,
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "3px 10px",
                  }}>
                    {totalInPool} Question{totalInPool !== 1 ? "s" : ""} Available
                  </span>
                )}
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: "22px 20px 0" }}>

              {/* Writing guide pills */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                  { label: "Word Limit", value: wordGuide },
                  { label: "Time",       value: timeGuide },
                  { label: "Structure",  value: structGuide },
                ].map((g) => (
                  <div key={g.label} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "4px 11px",
                  }}>
                    <span style={{ fontSize: 10, color: T.subtle, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>{g.label}:</span>
                    <span style={{ fontSize: 11, color: T.text, fontWeight: 700 }}>{g.value}</span>
                  </div>
                ))}
              </div>

              {/* Question text — visual center of the card */}
              <div style={{
                fontSize: 17, fontWeight: 700, color: T.textBright,
                lineHeight: 1.85, letterSpacing: "0.01em",
                paddingBottom: 20,
              }}>
                {currentQ.q}
              </div>

            </div>

            {/* Card footer — focus hint + source line */}
            <div style={{
              padding: "14px 20px 16px",
              borderTop: `1px solid ${T.border}`,
              background: `${T.surface}88`,
              display: "flex", flexDirection: "column", gap: 9,
            }}>

              {/* Focus Hint */}
              {currentQ.hint && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: paperAccent,
                    textTransform: "uppercase", letterSpacing: "0.1em",
                    flexShrink: 0, marginTop: 1,
                  }}>Focus</span>
                  <span style={{ fontSize: 12, color: T.dim, fontWeight: 500, lineHeight: 1.5 }}>
                    {currentQ.hint}
                  </span>
                </div>
              )}

              {/* Source / priority line */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: sourceLine.dot, flexShrink: 0,
                }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>{sourceLine.label}</span>
                <span style={{ color: T.muted, fontSize: 10 }}>·</span>
                <span style={{ fontSize: 11, color: T.subtle }}>{sourceLine.sub}</span>
              </div>

            </div>
          </div>
        ) : (
          <div style={{
            background: T.bg, border: `1px dashed ${T.borderMid}`,
            borderRadius: 12, padding: "48px 24px",
            textAlign: "center", marginBottom: 22,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.6 }}>📝</div>
            <div style={{ fontSize: 13, color: T.subtle, fontWeight: 700 }}>No questions for this combination</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>Try a different paper, mode, or marker type</div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{
          display: "flex", gap: 12, alignItems: "center",
          flexWrap: "wrap", paddingTop: 4,
        }}>

          {/* Primary — Start Writing */}
          <button
            disabled={!currentQ}
            onClick={handleStartWriting}
            style={{
              background: currentQ ? paperAccent : T.muted,
              color: "#09090b",
              border: "none", borderRadius: 9,
              fontWeight: 900, fontSize: 13,
              padding: "12px 28px",
              cursor: currentQ ? "pointer" : "not-allowed",
              fontFamily: T.font, letterSpacing: "0.04em",
              opacity: currentQ ? 1 : 0.45,
              boxShadow: currentQ ? `0 0 18px ${paperAccent}30` : "none",
            }}
          >
            ✏️&nbsp;&nbsp;Start Writing
          </button>

          {/* Secondary — Next Question */}
          <button
            onClick={handleNext}
            disabled={!currentQ || totalInPool <= 1}
            style={{
              background: "transparent",
              color: currentQ && totalInPool > 1 ? T.text : T.muted,
              border: `1px solid ${T.borderMid}`,
              borderRadius: 9, fontWeight: 700, fontSize: 13,
              padding: "11px 22px",
              cursor: currentQ && totalInPool > 1 ? "pointer" : "not-allowed",
              fontFamily: T.font, letterSpacing: "0.03em",
              opacity: currentQ && totalInPool > 1 ? 1 : 0.4,
            }}
          >
            Next Question →
          </button>

          {/* Tertiary — View More PYQs */}
          <button
            style={{
              background: "transparent",
              color: T.purple,
              border: `1px solid ${T.purple}44`,
              borderRadius: 9, fontWeight: 600, fontSize: 13,
              padding: "11px 20px",
              cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            View More PYQs
          </button>

        </div>

      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsPage() {
  const navigate       = useNavigate();
  const recentAttempts = useRecentAttempts(3);
  const weakAreas      = useWeakAreas();
  const stats          = useMainsStats();
  const perPaperStats  = usePerPaperStats();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

      {/* Breadcrumb bar */}
      <div style={{
        borderBottom: `1px solid ${T.border}`,
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 8,
        background: T.bg, position: "sticky", top: 0, zIndex: 10,
      }}>
        <span style={label11(T.subtle)}>Mains</span>
        <span style={{ color: T.muted, fontSize: 11 }}>·</span>
        <span style={label11(T.dim)}>Answer Writing System</span>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto" }}>

        {/* ═══ HERO ════════════════════════════════════════════════════════════ */}
        <div style={{
          background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surfaceHigh} 100%)`,
          border: `1px solid ${T.borderMid}`, borderRadius: 16,
          padding: "30px 32px", marginBottom: 28,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: `linear-gradient(180deg, ${T.amber}, ${T.blue}, ${T.green})`,
            borderRadius: "14px 0 0 14px",
          }} />
          <div style={{ ...label11(T.subtle), marginBottom: 10 }}>Mains Preparation System</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: T.textBright, margin: "0 0 8px 0", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Mains{" "}
            <span style={{ background: `linear-gradient(90deg, ${T.amber}, ${T.blue})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Answer Writing
            </span>
          </h1>
          <p style={{ fontSize: 14, color: T.dim, margin: "0 0 22px 0", maxWidth: 520, lineHeight: 1.65 }}>
            Build structure. Refine content. Turn your knowledge into marks.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Chip label="GS1" accent={T.amber} />
            <Chip label="GS2" accent={T.blue} />
            <Chip label="GS3" accent={T.green} />
            <div style={{ width: 1, height: 18, background: T.border, margin: "0 4px" }} />
            {[
              { label: `${stats.total} Answers Written`,   color: T.textBright },
              { label: `${stats.openMistakes} Weak Areas`, color: T.red },
            ].map((p) => (
              <span key={p.label} style={{ fontSize: 12, fontWeight: 600, color: p.color, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "4px 12px" }}>
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ═══ GS CARDS ════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 28 }}>
          {GS_PAPERS.map((paper) => (
            <GSCard
              key={paper.id}
              paper={paper}
              stats={perPaperStats[paper.label] ?? null}
            />
          ))}
        </div>

        {/* ═══ THEME BROWSER — generated from backend theme index ═══════════════ */}
        <MainsThemeBrowser />

        {/* ═══ PERFORMANCE STRIP ═══════════════════════════════════════════════ */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ ...label11(T.subtle), marginBottom: 16 }}>Mains Performance Overview</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatBox label="Total Answers Written" value={String(stats.total)}     accent={T.textBright} />
            <StatBox label="This Week"             value={String(stats.thisWeek)}  accent={T.amber} />
            <StatBox label="Strongest Paper"       value={stats.strongestPaper}    accent={T.blue} />
            <StatBox label="Weakest Paper"         value={stats.weakestPaper}      accent={T.red} />
          </div>
        </div>

        {/* ═══ RECENT ANSWER WRITING — real localStorage data ══════════════════ */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, ${T.amber}88, ${T.border})` }} />
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={label11(T.subtle)}>Recent Answer Writing</div>
              <button
                style={{ ...outlineBtn(T.dim), fontSize: 11, padding: "5px 12px" }}
                onClick={() => navigate("/mains/mistakes")}
              >
                View All
              </button>
            </div>

            {recentAttempts.length > 0 ? (
              recentAttempts.map((item, i) => (
                <RecentRow
                  key={item.id || i}
                  item={item}
                  isLast={i === recentAttempts.length - 1}
                />
              ))
            ) : (
              <div style={{
                padding: "32px 0", textAlign: "center",
                borderTop: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.5 }}>✏️</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No attempts yet</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
                  Use Quick Practice below to write your first answer.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ CURRENT FOCUS / WEAK AREAS — real localStorage data ══════════════ */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, ${T.red}66, ${T.border})` }} />
          <div style={{ padding: "20px 24px" }}>
            <div style={{ ...label11(T.subtle), marginBottom: 16 }}>Current Focus — Weak Areas</div>
            {weakAreas.GS1.length === 0 && weakAreas.GS2.length === 0 && weakAreas.GS3.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No weak areas yet.</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
                  Start writing answers to generate insights.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 14 }}>
                <WeakColumn gs="GS1" accent={T.amber} items={weakAreas.GS1} />
                <WeakColumn gs="GS2" accent={T.blue}  items={weakAreas.GS2} />
                <WeakColumn gs="GS3" accent={T.green} items={weakAreas.GS3} />
              </div>
            )}
          </div>
        </div>

        {/* ═══ QUICK PRACTICE ══════════════════════════════════════════════════ */}
        <QuickPractice />

      </div>
    </div>
  );
}

/*
 ─── WIRE-UP NOTES ─────────────────────────────────────────────────────────────
 1.  GSCard "Open GS1/2/3"           → useNavigate() to paper.route
 2.  GSCard "Practice Qs"            → /mains/gs1/practice
 3.  GSCard "Weak Areas"             → /mains/gs1/weak-areas or drawer
 4.  Recent "Continue"               → /mains/answer-editor?id={item.id}
 5.  Recent "View All"               → /mains/answer-log
 6.  QuickPractice "Start Writing"   → open answer editor with currentQ data
 7.  QuickPractice "View More PYQs"  → /mains/{paper}/pyq
 8.  Stat values (72, 9 etc.)        → useMainsAnalytics() hook
 9.  GS card progress %              → syllabusProgressEngine / attempt analytics
10.  WEAK_AREAS data                 → weaknessEngine.js computation
11.  PRACTICE_QUESTIONS bank         → replace with real PYQ loader from data layer
 ──────────────────────────────────────────────────────────────────────────────
*/
