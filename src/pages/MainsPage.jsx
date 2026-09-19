// src/pages/MainsPage.jsx
// Mains Command Center — GS1, GS2, GS3 only.
// Ethics, Essay, Geography Optional: separate pages later.
// Frontend-only. No backend wiring. Production-safe.

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";
import HandwrittenSheetReviewPanel from "../components/HandwrittenSheetReviewPanel.jsx";

// ─── Theme bridge ─────────────────────────────────────────────────────────────
// Surfaces/text come from the global MentorOS light/dark theme. Paper accents are
// intentionally stable identifiers and are used sparingly.
const T = {
  bg: "var(--bg-page)",
  surface: "var(--bg-surface)",
  surfaceHigh: "var(--bg-subtle)",
  border: "var(--border-subtle)",
  borderMid: "var(--border-default)",
  muted: "var(--text-tertiary)",
  subtle: "var(--text-tertiary)",
  dim: "var(--text-tertiary)",
  text: "var(--text-secondary)",
  textBright: "var(--text-primary)",
  amber: "#f59e0b",
  amberDim: "#d97706",
  blue: "#3b82f6",
  blueDim: "#2563eb",
  green: "#22c55e",
  greenDim: "#16a34a",
  red: "#ef4444",
  purple: "#8b5cf6",
  font: "var(--sans)",
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
  gs4: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "What do you understand by the term 'constitutional morality'? How does one uphold it?", hint: "Focus: Rule of law, individual liberty, democratic values, judicial interpretations" },
        { year: 2022, marks: 10, q: "Explain the role of family and society in inculcating values in individuals.", hint: "Focus: Socialisation process, parental role, peer influence, changing family structures" },
      ],
      "15": [
        { year: 2023, marks: 15, q: "Discuss the contribution of moral thinkers and philosophers from India and the world in shaping ethical perspectives.", hint: "Focus: Socrates, Kant, Gandhiji, Buddhist ethics, utilitarianism vs deontology" },
      ],
      "20": [
        { year: 2022, marks: 20, q: "Case Study: You are a district collector facing a conflict between local tribal communities protesting a mining project and government developmental guidelines. How do you resolve this ethical dilemma?", hint: "Focus: Stakeholder analysis, tribal rights, economic development, public interest, administrative ethics" },
      ]
    },
    topic: {
      "10": [
        { year: null, marks: 10, q: "Define corporate governance and its significance in ensuring ethical business practices.", hint: "Focus: Transparency, accountability, shareholder rights, CSR, corporate citizenship" },
      ],
      "15": [
        { year: null, marks: 15, q: "Emotional intelligence is key to civil service administration. Discuss with examples.", hint: "Focus: Self-awareness, empathy, motivation, crisis management, relationship regulation" },
      ],
      "20": [
        { year: null, marks: 20, q: "Case Study: An infrastructure project is delayed due to environmental clearance issues. Propose a balanced resolution framework.", hint: "Focus: Sustainable development, legal compliances, socio-economic costs of delay" }
      ]
    },
    mixed: {
      "15": [
        { year: 2021, marks: 15, q: "Discuss the role of social media in public administration from an ethical standpoint.", hint: "Focus: Accessibility, misinformation risk, public trust, civil service code of conduct" },
      ]
    }
  },
  essay: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "Forests are the best case studies for economic excellence.", hint: "Focus: Philosophical essay, sustainability, ecological balance, resources vs preservation" },
      ],
      "15": [
        { year: 2022, marks: 15, q: "The time to repair the roof is when the sun is shining.", hint: "Focus: Philosophical essay, proactive governance, crisis prevention, individual readiness" },
      ],
      "20": [
        { year: 2021, marks: 20, q: "Philosophy of wantlessness is Utopian, while materialism is a chimera.", hint: "Focus: Conceptual synthesis, ancient Indian philosophy, consumerism, ethical middle path" }
      ]
    },
    topic: {
      "15": [
        { year: null, marks: 15, q: "Real education is not about instruction, but about character building.", hint: "Focus: Value-based education, modern curriculum challenges, Gandhi's Nai Talim" },
      ]
    },
    mixed: {
      "20": [
        { year: null, marks: 20, q: "Science without religion is lame, religion without science is blind.", hint: "Focus: Rationality vs spirituality, ethics in scientific progress, historical perspective" },
      ]
    }
  },
  geo_p1: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "Discuss the concept of plate tectonics and its relationship with earthquakes and volcanism.", hint: "Focus: Plate boundaries, mantle convection, seismic zones, volcanic arcs" },
      ],
      "15": [
        { year: 2022, marks: 15, q: "Explain the factors influencing the global distribution of major soil types.", hint: "Focus: Climate, parent material, topography, organic matter, time" },
      ],
      "20": [
        { year: 2021, marks: 20, q: "Examine the geographical impacts of climate change on the cryosphere and ocean circulation.", hint: "Focus: Glacial retreat, sea level rise, thermohaline circulation shutdown" }
      ]
    },
    topic: {
      "15": [
        { year: null, marks: 15, q: "Describe the characteristics and development of karst topography.", hint: "Focus: Limestone dissolution, sinkholes, stalactites, stalagmites, drainage patterns" },
      ]
    },
    mixed: {
      "15": [
        { year: null, marks: 15, q: "Analyze the environmental hazards associated with rapid urbanisation in coastal cities.", hint: "Focus: Urban heat island, pollution, subsidence, vulnerability to storms" },
      ]
    }
  },
  geo_p2: {
    pyq: {
      "10": [
        { year: 2023, marks: 10, q: "Examine the geographical factors responsible for the distribution of cotton textile industry in India.", hint: "Focus: Proximity to raw materials, port access, cheap labor, climate" },
      ],
      "15": [
        { year: 2022, marks: 15, q: "Discuss the problems and prospects of dryland agriculture in India.", hint: "Focus: Water scarcity, crop diversification, watershed management, micro-irrigation" },
      ],
      "20": [
        { year: 2021, marks: 20, q: "Critically evaluate the interlinking of rivers project in India from ecological and economic perspectives.", hint: "Focus: Water surplus-deficit balance, biodiversity loss, rehabilitation, fiscal cost" }
      ]
    },
    topic: {
      "15": [
        { year: null, marks: 15, q: "Analyze the pattern of rural-urban migration in India and its socio-spatial consequences.", hint: "Focus: Push-pull factors, growth of slums, demographic shifts, rural labor vacuum" },
      ]
    },
    mixed: {
      "15": [
        { year: null, marks: 15, q: "Highlight the significance of the monsoon on Indian agriculture and food security.", hint: "Focus: El Nino/La Nina influence, rain-fed area vulnerabilities, policy buffers" },
      ]
    }
  }
};

// ─── Real recent attempts — loaded from API ─────────────────────────
function useRecentAttempts(limit = 3) {
  const [attempts, setAttempts] = useState([]);
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/mains-answers?userId=user_1`, { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        const sorted = [...all].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        setAttempts(sorted.slice(0, limit));
      })
      .catch(() => setAttempts([]));
  }, [limit]);
  return attempts;
}

// ─── Dynamic weak areas — derived from API ────────────────────────
const SEV_RANK = { high: 0, medium: 1, low: 2 };

function useWeakAreas() {
  const [areas, setAreas] = useState({ GS1: [], GS2: [], GS3: [] });

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/mistakes?userId=user_1&stage=mains`, { cache: "no-store" })
      .then(res => res.json())
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        const open = all.filter((m) => m.answer_status !== "resolved" && m.status !== "resolved");

        const grouped = { GS1: [], GS2: [], GS3: [] };
        open.forEach((m) => {
          const key = (m.paper || "").toUpperCase();
          if (grouped[key]) grouped[key].push(m);
        });

        const pick = (list) =>
          [...list]
            .sort((a, b) => {
              if (a.must_revise !== b.must_revise) return a.must_revise ? -1 : 1;
              const sa = SEV_RANK[(a.severity || "medium").toLowerCase()] ?? 1;
              const sb = SEV_RANK[(b.severity || "medium").toLowerCase()] ?? 1;
              if (sa !== sb) return sa - sb;
              return new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0);
            })
            .slice(0, 3)
            .map((m) => {
              const base = m.topic || (m.question_text || m.question ? (m.question_text || m.question).slice(0, 60) + "\u2026" : "Untitled");
              const tag  = (m.error_type || m.mistakeTypes?.[0]) || "";
              return tag ? `${base} — ${tag}` : base;
            });

        setAreas({
          GS1: pick(grouped.GS1),
          GS2: pick(grouped.GS2),
          GS3: pick(grouped.GS3),
        });
      })
      .catch(() => setAreas({ GS1: [], GS2: [], GS3: [] }));
  }, []);

  return areas;
}

// ─── Mains dashboard stats — derived from API ────────────────
function useMainsStats() {
  const [stats, setStats] = useState({
    total: 0, thisWeek: 0,
    strongestPaper: "—", weakestPaper: "—",
    openMistakes: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/mains-answers?userId=user_1`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/api/mistakes?userId=user_1&stage=mains`, { cache: "no-store" }).then(r => r.json()).catch(() => [])
    ]).then(([attData, misData]) => {
      const allAtt = Array.isArray(attData) ? attData : [];
      const allMis = Array.isArray(misData) ? misData : [];

      const total = allAtt.length;
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      const thisWeek = allAtt.filter(
        (a) => a.createdAt && new Date(a.createdAt).getTime() >= weekAgo
      ).length;

      const attByPaper = {};
      allAtt.forEach((a) => {
        const p = (a.paper || "").toUpperCase();
        if (p) attByPaper[p] = (attByPaper[p] || 0) + 1;
      });
      const strongestPaper = Object.keys(attByPaper).sort(
        (a, b) => attByPaper[b] - attByPaper[a]
      )[0] || "—";

      const openMis = allMis.filter((m) => m.answer_status !== "resolved" && m.status !== "resolved");
      const openMistakes = openMis.length;

      const misByPaper = {};
      openMis.forEach((m) => {
        const p = (m.paper || "").toUpperCase();
        if (p) misByPaper[p] = (misByPaper[p] || 0) + 1;
      });
      const weakestPaper = Object.keys(misByPaper).sort(
        (a, b) => misByPaper[b] - misByPaper[a]
      )[0] || "—";

      setStats({ total, thisWeek, strongestPaper, weakestPaper, openMistakes });
    });
  }, []);

  return stats;
}

// ─── Per-paper stats — derived from API ──────────────────────────────
function usePerPaperStats() {
  const PAPERS = ["GS1", "GS2", "GS3"];
  const empty  = () => ({ answersWritten: 0, openWeakAreas: 0 });
  const [data, setData] = useState({ GS1: empty(), GS2: empty(), GS3: empty() });

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/mains-answers?userId=user_1`, { cache: "no-store" }).then(r => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/api/mistakes?userId=user_1&stage=mains`, { cache: "no-store" }).then(r => r.json()).catch(() => [])
    ]).then(([attData, misData]) => {
      const allAtt = Array.isArray(attData) ? attData : [];
      const allMis = Array.isArray(misData) ? misData : [];
      const openMis = allMis.filter((m) => m.answer_status !== "resolved" && m.status !== "resolved");

      const result = {};
      for (const p of PAPERS) {
        const pUp = p.toUpperCase();
        result[p] = {
          answersWritten: allAtt.filter((a) => (a.paper || "").toUpperCase() === pUp).length,
          openWeakAreas:  openMis.filter((m) => (m.paper || "").toUpperCase() === pUp).length,
        };
      }
      setData(result);
    });
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



// ─── Quick Practice ───────────────────────────────────────────────────────────
function QuickPractice() {
  const [paper, setPaper] = useState("gs1");
  const [mode, setMode] = useState("pyq");
  const [marks, setMarks] = useState("15");
  const [qIndex, setQIndex] = useState(0);
  const navigate = useNavigate();

  const getPaperLabel = (p) => {
    switch (p) {
      case "gs1": return "GS1";
      case "gs2": return "GS2";
      case "gs3": return "GS3";
      case "gs4": return "GS4 Ethics";
      case "essay": return "Essay";
      case "geo_p1": return "Geography Optional P1";
      case "geo_p2": return "Geography Optional P2";
      default: return "GS1";
    }
  };

  const paperLabel = getPaperLabel(paper);
  const pool = PRACTICE_QUESTIONS?.[paper]?.[mode]?.[marks] || [];
  const totalInPool = pool.length;
  const currentQ = totalInPool > 0 ? pool[qIndex % totalInPool] : null;

  const handleNext = () => {
    if (totalInPool > 1) setQIndex((i) => (i + 1) % totalInPool);
  };
  const handlePaper = (v) => { setPaper(v); setQIndex(0); };
  const handleMode = (v) => { setMode(v); setQIndex(0); };
  const handleMarks = (v) => { setMarks(v); setQIndex(0); };

  const wordGuide = marks === "10" ? "~150 words" : marks === "15" ? "~200 words" : "~250 words";
  const timeGuide = marks === "10" ? "7 min" : marks === "15" ? "10 min" : "13 min";
  const structGuide = marks === "10"
    ? "Intro + 3 points + conclusion"
    : marks === "15"
      ? "Intro + 4–5 points + conclusion"
      : "Intro + 6 points + conclusion";
  const modeLabel = mode === "pyq" ? "PYQ" : mode === "topic" ? "Topic" : "Mixed";

  const handleStartWriting = () => {
    if (!currentQ) return;
    const priorityLabel = mode === "pyq"
      ? "UPSC PYQ · High Priority"
      : mode === "topic"
        ? "Topic Practice · Depth Builder"
        : "Mixed Mode · Breadth Drill";

    navigate("/mains/answer-writing", {
      state: {
        paper: paperLabel,
        mode: modeLabel,
        year: currentQ.year || null,
        topic: "",
        syllabusNodeId: "",
        questions: [
          {
            paper: paperLabel,
            mode: modeLabel,
            marks,
            year: currentQ.year || null,
            structure: structGuide,
            focus: currentQ.hint || "",
            priority: priorityLabel,
            question: currentQ.q,
          }
        ],
        currentIndex: 0,
        question: {
          paper: paperLabel,
          mode: modeLabel,
          marks,
          year: currentQ.year || null,
          structure: structGuide,
          focus: currentQ.hint || "",
          priority: priorityLabel,
          question: currentQ.q,
        },
      },
    });
  };

  const papers = [
    ["GS1", "gs1"], ["GS2", "gs2"], ["GS3", "gs3"], ["GS4", "gs4"],
    ["Essay", "essay"], ["Geo P1", "geo_p1"], ["Geo P2", "geo_p2"],
  ];

  return (
    <section className="mos-surface mos-question-picker" aria-labelledby="mos-question-picker-title">
      <div className="mos-question-picker__head">
        <h2 id="mos-question-picker-title">Choose another question</h2>
      </div>

      <div className="mos-question-picker__controls">
        <div className="mos-scroll-segment" aria-label="Select paper">
          {papers.map(([label, value]) => (
            <button
              key={value}
              type="button"
              className={paper === value ? "is-active" : ""}
              data-paper={value}
              onClick={() => handlePaper(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mos-question-picker__lower-controls">
          <div className="mos-segment" aria-label="Select mode">
            {[["PYQ", "pyq"], ["Topic", "topic"], ["Mixed", "mixed"]].map(([label, value]) => (
              <button key={value} type="button" className={mode === value ? "is-active" : ""} onClick={() => handleMode(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="mos-marks-control">
            <span>Marks</span>
            <div className="mos-segment">
              {["10", "15", "20"].map((value) => (
                <button key={value} type="button" className={marks === value ? "is-active" : ""} onClick={() => handleMarks(value)}>
                  {value}M
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mos-question-picker__question">
        {currentQ ? (
          <>
            <div className="mos-question-meta">
              <span>{paperLabel}</span>
              <span>{modeLabel}</span>
              {currentQ.year && <span>UPSC {currentQ.year}</span>}
              <span>{marks} marks</span>
            </div>
            <h3>{currentQ.q}</h3>
            <div className="mos-guides">
              <span>{timeGuide}</span>
              <span>{wordGuide}</span>
              <span>{structGuide}</span>
            </div>
            {currentQ.hint && (
              <p className="mos-focus"><strong>Focus</strong>{currentQ.hint.replace(/^Focus:\s*/i, "")}</p>
            )}
            <div className="mos-actions">
              <button type="button" className="mos-btn mos-btn--primary" onClick={handleStartWriting}>Start Writing</button>
              <button type="button" className="mos-btn mos-btn--quiet" onClick={handleNext} disabled={totalInPool <= 1}>Another Question →</button>
            </div>
          </>
        ) : (
          <div className="mos-inline-state">No questions for this combination. Try another paper, source or mark value.</div>
        )}
      </div>
    </section>
  );
}



// ─── Command-center helpers ───────────────────────────────────────────────────
const PAPER_LABELS = { gs1: "GS1", gs2: "GS2", gs3: "GS3" };
const MODE_LABELS = { pyq: "PYQ", topic: "Topic", mixed: "Mixed" };

function practiceGuides(marks) {
  const m = String(marks || "15");
  if (m === "10") return { words: "~150 words", time: "7 min", structure: "Intro + 3 points + conclusion" };
  if (m === "20") return { words: "~250 words", time: "13 min", structure: "Intro + 6 points + conclusion" };
  return { words: "~200 words", time: "10 min", structure: "Intro + 4–5 points + conclusion" };
}

function tokenSet(value = "") {
  const stop = new Set(["the", "and", "for", "with", "from", "this", "that", "into", "your", "area", "areas", "missing", "weak", "examples", "example", "question", "answer"]);
  return new Set(
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stop.has(word))
  );
}

function overlapScore(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  let score = 0;
  left.forEach((token) => { if (right.has(token)) score += 1; });
  return score;
}

function flattenPracticeQuestions(paperId) {
  const bank = PRACTICE_QUESTIONS[paperId] || {};
  const result = [];
  ["topic", "pyq", "mixed"].forEach((mode) => {
    const byMarks = bank[mode] || {};
    ["15", "10", "20"].forEach((marks) => {
      (byMarks[marks] || []).forEach((question) => {
        result.push({ paper: paperId, mode, marks, question });
      });
    });
  });
  return result;
}

function buildCommandCandidates(weakAreas) {
  const weakPaper = ["GS1", "GS2", "GS3"].find((paper) => (weakAreas?.[paper] || []).length > 0);
  const paperId = weakPaper ? weakPaper.toLowerCase() : "gs1";
  const focus = weakPaper ? weakAreas[weakPaper][0] : "";
  const primary = flattenPracticeQuestions(paperId);

  primary.sort((a, b) => {
    const aScore = overlapScore(focus, `${a.question.q} ${a.question.hint || ""}`);
    const bScore = overlapScore(focus, `${b.question.q} ${b.question.hint || ""}`);
    return bScore - aScore;
  });

  const fallback = ["gs1", "gs2", "gs3"]
    .filter((id) => id !== paperId)
    .flatMap(flattenPracticeQuestions);

  return [...primary, ...fallback].map((item) => ({ ...item, focus }));
}

function routeStateForPractice(item) {
  if (!item?.question) return null;
  const guides = practiceGuides(item.marks);
  const modeLabel = MODE_LABELS[item.mode] || "Practice";
  const priority = item.mode === "pyq"
    ? "UPSC PYQ · High Priority"
    : item.mode === "topic"
      ? "Topic Practice · Depth Builder"
      : "Mixed Mode · Breadth Drill";

  const paperLabel = PAPER_LABELS[item.paper] || item.paper?.toUpperCase() || "GS1";

  const questionObj = {
    id: item.question.id || `q_${item.paper}_${item.question.year || "topic"}_${item.marks}`,
    paper: paperLabel,
    year: item.question.year || null,
    question: item.question.q || item.question.question || "",
    marks: String(item.marks || 15),
    wordLimit: guides.words,
    structure: guides.structure,
    focus: item.question.hint || "",
    priority,
    subparts: item.question.subparts || [],
    syllabusNodeId: item.question.syllabusNodeId || "",
  };

  return {
    paper: paperLabel,
    mode: modeLabel,
    year: item.question.year || null,
    topic: item.focus || "",
    syllabusNodeId: item.question.syllabusNodeId || "",
    questions: [questionObj],
    currentIndex: 0,
    question: questionObj,
  };
}

function MentorCommandCard({ weakAreas }) {
  const navigate = useNavigate();
  const candidates = useMemo(() => buildCommandCandidates(weakAreas), [weakAreas]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [candidates]);

  const item = candidates[index % Math.max(candidates.length, 1)] || null;
  if (!item) return null;

  const paperLabel = PAPER_LABELS[item.paper] || item.paper.toUpperCase();
  const guides = practiceGuides(item.marks);
  const topic = item.focus ? item.focus.split("—")[0].trim() : "today's writing target";
  const rawWeakness = item.focus?.includes("—") ? item.focus.split("—").slice(1).join("—").trim() : "";
  const weakness = rawWeakness
    ? rawWeakness.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Build answer-writing consistency";

  const start = () => {
    const state = routeStateForPractice(item);
    if (state) navigate("/mains/answer-writing", { state });
  };

  return (
    <section className="mos-surface mos-command-hero" aria-labelledby="mains-command-title">
      <div className="mos-command-hero__topline">
        <span className="mos-kicker">Next action</span>
        <span className="mos-recommended">Recommended for you</span>
      </div>
      <h2 id="mains-command-title">Write one {paperLabel} answer on {topic}</h2>
      <p className="mos-command-question">{item.question.q}</p>
      <div className="mos-repair-line"><span>Repair</span><strong>{weakness}</strong></div>
      <div className="mos-command-facts">
        <span>{item.marks} marks</span>
        <span>{guides.time}</span>
        <span>{guides.words}</span>
        <span>{guides.structure}</span>
      </div>
      <div className="mos-actions">
        <button type="button" className="mos-btn mos-btn--primary" onClick={start}>Start {guides.time} Answer</button>
        <button type="button" className="mos-btn mos-btn--secondary" onClick={() => setIndex((current) => (current + 1) % candidates.length)}>Change</button>
        <button type="button" className="mos-btn mos-btn--text" onClick={() => document.getElementById("mos-review-repair")?.scrollIntoView({ behavior: "smooth", block: "center" })}>Why this?</button>
      </div>
    </section>
  );
}

function PaperQuickAccess({ perPaperStats }) {
  const navigate = useNavigate();
  const [showUpload, setShowUpload] = useState(false);

  return (
    <section className="mos-practice-access" aria-labelledby="mos-practice-access-title">
      <div className="mos-section-head mos-section-head--simple">
        <div>
          <span className="mos-kicker">Practice</span>
          <h2 id="mos-practice-access-title">Open a paper workspace</h2>
        </div>
        <span className="mos-section-note">GS4, Essay & Geography Optional are available below</span>
      </div>

      <div className="mos-paper-grid">
        {GS_PAPERS.map((paper) => {
          const values = perPaperStats?.[paper.label] || {};
          return (
            <button key={paper.id} type="button" className="mos-paper-item" data-paper={paper.id} onClick={() => navigate(paper.route)}>
              <span className="mos-paper-item__accent" />
              <span className="mos-paper-item__copy">
                <small>{paper.label}</small>
                <strong>{paper.title}</strong>
                <span>{values.answersWritten ?? 0} answers · {values.openWeakAreas ?? 0} weak areas</span>
              </span>
              <span className="mos-paper-item__open">Open →</span>
            </button>
          );
        })}
      </div>

      <div className="mos-other-ways">
        <span className="mos-kicker">Other ways</span>
        <div className="mos-utility-grid">
          <div className="mos-utility-row">
            <div>
              <strong>Handwritten Answer Review</strong>
              <span>Upload an answer sheet for extraction and evaluation.</span>
            </div>
            <button type="button" className="mos-btn mos-btn--quiet" onClick={() => setShowUpload((v) => !v)}>{showUpload ? "Close" : "Upload →"}</button>
          </div>
          <div className="mos-utility-row">
            <div>
              <strong>PYQ by Themes</strong>
              <span>Drill from paper to subject, theme and subtheme.</span>
            </div>
            <button type="button" className="mos-btn mos-btn--quiet" onClick={() => navigate("/mains/pyq-explorer")}>Browse →</button>
          </div>
        </div>
      </div>

      {showUpload && <div className="mos-upload-host"><HandwrittenSheetReviewPanel /></div>}
    </section>
  );
}

function WritingBaselineCard({ stats }) {
  const target = 10;
  const completed = Math.min(stats.total || 0, target);
  const remaining = Math.max(target - completed, 0);
  const pct = Math.round((completed / target) * 100);

  return (
    <section className="mains-command__side-card" aria-labelledby="writing-baseline-title">
      <span className="mains-command__eyebrow">Writing Baseline</span>
      <div className="mains-command__baseline-head">
        <div>
          <h2 id="writing-baseline-title">{completed} / {target}</h2>
          <p>{remaining > 0 ? `${remaining} more evaluated answers to build a reliable pattern.` : "Baseline volume reached. Keep building evidence across papers."}</p>
        </div>
        <span className="mains-command__baseline-pct">{pct}%</span>
      </div>
      <div className="mains-command__progress" aria-label={`${pct}% baseline progress`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="mains-command__fact-grid">
        <div><strong>{stats.total || 0}</strong><span>Total answers</span></div>
        <div><strong>{stats.thisWeek || 0}</strong><span>This week</span></div>
        <div><strong>{stats.openMistakes || 0}</strong><span>Weak signals</span></div>
      </div>
      <p className="mains-command__baseline-footnote">
        Paper strength is intentionally hidden until a real score-based performance measure exists.
      </p>
    </section>
  );
}

function LatestAnswerCard({ attempt }) {
  if (!attempt) {
    return (
      <section className="mains-command__section-card mains-command__review-card">
        <span className="mains-command__eyebrow">Latest Answer</span>
        <h2>Start your first evaluated answer</h2>
        <p className="mains-command__empty-copy">Your latest attempt and review signals will appear here.</p>
      </section>
    );
  }

  const score = attempt.currentScore ?? attempt.score ?? attempt.marksAwarded ?? null;
  return (
    <section className="mains-command__section-card mains-command__review-card">
      <div className="mains-command__section-heading-row">
        <div>
          <span className="mains-command__eyebrow">Latest Answer</span>
          <h2>{attempt.paper || "Mains"} · {attempt.marks ? `${attempt.marks} Marks` : "Saved attempt"}</h2>
        </div>
        {score !== null && score !== "" && <span className="mains-command__score-chip">{score}</span>}
      </div>
      <p className="mains-command__latest-question">{attempt.question || attempt.questionText || attempt.title || "Answer attempt"}</p>
      <div className="mains-command__latest-meta">
        {attempt.topic && <span>{attempt.topic}</span>}
        {attempt.createdAt && <span>{timeAgo(attempt.createdAt)}</span>}
        <span>{attempt.status || "Saved"}</span>
      </div>
    </section>
  );
}

function ActiveWeakAreasCard({ weakAreas }) {
  const navigate = useNavigate();
  const flattened = ["GS1", "GS2", "GS3"].flatMap((paper) =>
    (weakAreas?.[paper] || []).map((label) => ({ paper, label }))
  ).slice(0, 5);

  return (
    <section id="mains-active-weak-areas" className="mains-command__section-card mains-command__weak-card">
      <div className="mains-command__section-heading-row">
        <div>
          <span className="mains-command__eyebrow">Active Weak Areas</span>
          <h2>What to repair next</h2>
        </div>
        <button type="button" className="mains-command__text-btn" onClick={() => navigate("/mains/mistakes")}>View All</button>
      </div>

      {flattened.length === 0 ? (
        <p className="mains-command__empty-copy">No open Mains weakness signals yet. MentorOS will populate this after evaluated answers.</p>
      ) : (
        <div className="mains-command__weak-list">
          {flattened.map((item, index) => (
            <div className="mains-command__weak-item" key={`${item.paper}-${index}`}>
              <span className="mains-command__weak-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="mains-command__weak-label">{item.label}</span>
              <span className="mains-command__weak-paper">{item.paper}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewRepair({ attempt, weakAreas }) {
  const navigate = useNavigate();
  const flattened = ["GS1", "GS2", "GS3"].flatMap((paper) =>
    (weakAreas?.[paper] || []).map((label) => ({ paper, label }))
  ).slice(0, 3);
  const score = attempt ? (attempt.currentScore ?? attempt.score ?? attempt.marksAwarded ?? null) : null;
  const candidate = buildCommandCandidates(weakAreas)[0] || null;

  const practiceWeakest = () => {
    if (!candidate) return;
    const state = routeStateForPractice(candidate);
    if (state) navigate("/mains/answer-writing", { state });
  };

  const splitWeakness = (label = "") => {
    const [topic, raw = ""] = label.split("—").map((part) => part.trim());
    return {
      topic,
      issue: raw ? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Needs repair",
    };
  };

  return (
    <section id="mos-review-repair" className="mos-surface mos-review-repair" aria-labelledby="mos-review-repair-title">
      <div className="mos-review-repair__head">
        <span className="mos-kicker">Review & Repair</span>
        <h2 id="mos-review-repair-title">Close the loop</h2>
      </div>
      <div className="mos-review-repair__grid">
        <div className="mos-review-pane">
          <span className="mos-kicker">{score !== null && score !== "" ? "Last evaluation" : "Last answer"}</span>
          {attempt ? (
            <>
              <div className="mos-last-answer__title-row">
                <h3>{attempt.paper || "Mains"}{attempt.marks ? ` · ${attempt.marks} Marks` : ""}</h3>
                {score !== null && score !== "" && <span className="mos-score">{score}</span>}
              </div>
              <p>{attempt.question || attempt.questionText || attempt.title || "Answer attempt"}</p>
              <div className="mos-muted-meta">
                {attempt.createdAt && <span>{timeAgo(attempt.createdAt)}</span>}
                <span>{attempt.status || "Saved"}</span>
              </div>
            </>
          ) : (
            <p className="mos-empty-copy">Your latest answer will appear here after your first attempt.</p>
          )}
        </div>

        <div className="mos-review-pane mos-review-pane--fix">
          <div className="mos-fix-head">
            <div>
              <span className="mos-kicker">Fix next</span>
              <h3>Open weakness signals</h3>
            </div>
            {candidate && <button type="button" className="mos-btn mos-btn--primary mos-btn--small" onClick={practiceWeakest}>Practice weakest area →</button>}
          </div>

          {flattened.length > 0 ? (
            <div className="mos-fix-list">
              {flattened.map((item, index) => {
                const parsed = splitWeakness(item.label);
                return (
                  <div className="mos-fix-item" key={`${item.paper}-${index}`}>
                    <span className="mos-fix-index">0{index + 1}</span>
                    <span className="mos-fix-copy"><strong>{parsed.issue}</strong><small>{parsed.topic}</small></span>
                    <span className="mos-paper-badge">{item.paper}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mos-empty-copy">No open Mains weakness signals yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function RecentAnswersCard({ attempts }) {
  return (
    <section className="mos-flat-section" aria-labelledby="mos-recent-work-title">
      <div className="mos-section-head mos-section-head--simple">
        <div>
          <span className="mos-kicker">Recent work</span>
          <h2 id="mos-recent-work-title">Your latest saved work</h2>
        </div>
        <span className="mos-section-note">Showing up to 3 recent attempts</span>
      </div>
      {attempts.length > 0 ? (
        <div className="mos-recent-list">
          {attempts.map((item, index) => {
            const paper = item.paper || "GS";
            const title = item.question || item.questionText || item.title || "Answer attempt";
            const score = item.currentScore ?? item.score ?? item.marksAwarded ?? null;
            return (
              <div className="mos-recent-row" key={item.id || index}>
                <span className="mos-recent-paper">{paper.toUpperCase().slice(0, 3)}</span>
                <span className="mos-recent-copy">
                  <strong>{title}</strong>
                  <small>{item.marks ? `${item.marks}M` : ""}{item.createdAt ? `${item.marks ? " · " : ""}${new Date(item.createdAt).toLocaleDateString()}` : ""}</small>
                </span>
                <span className={score !== null && score !== "" ? "mos-recent-status mos-recent-status--score" : "mos-recent-status"}>{score !== null && score !== "" ? score : "Saved"}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mos-empty-copy">No attempts yet. Start with the recommended answer above.</p>
      )}
    </section>
  );
}

const PREMIUM_MAINS_CSS = `
.mos-premium {
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--bg-page, var(--mos-bg));
  color: var(--text-primary, var(--mos-text));
  padding: 22px 28px 56px;
}
.mos-premium__inner { width: min(1180px, 100%); max-width: 100%; margin: 0 auto; display: grid; gap: 22px; min-width: 0; box-sizing: border-box; }
.mos-page-head { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; padding: 2px 2px 0; min-width: 0; }
.mos-page-head h1 { margin: 0; font-size: clamp(20px, 4vw, 24px); line-height: 1.2; letter-spacing: -0.025em; font-weight: 740; overflow-wrap: break-word; }
.mos-page-head__meta, .mos-section-note { color: var(--text-tertiary); font-size: 12px; font-weight: 550; }
.mos-surface {
  background: var(--bg-surface, var(--mos-surface));
  border: 1px solid var(--border-subtle, var(--mos-border));
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(16,24,40,.035), 0 8px 24px rgba(16,24,40,.035);
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
html[data-theme="dark"] .mos-surface { box-shadow: none; }
.mos-kicker { display: block; color: var(--text-tertiary); font-size: 10px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
.mos-command-hero { position: relative; padding: 26px 28px 27px 32px; overflow: hidden; min-width: 0; }
.mos-command-hero::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--brand-primary); }
.mos-command-hero__topline { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.mos-recommended { color: var(--brand-primary); font-size: 11px; font-weight: 650; }
.mos-command-hero h2 { margin: 0; max-width: 920px; font-size: clamp(20px, 2.5vw, 30px); line-height: 1.2; letter-spacing: -.032em; font-weight: 760; overflow-wrap: break-word; word-break: break-word; }
.mos-command-question { margin: 8px 0 0; max-width: 920px; color: var(--text-secondary); font-size: 13.5px; line-height: 1.6; overflow-wrap: break-word; word-break: break-word; }
.mos-repair-line { display: flex; gap: 9px; align-items: baseline; margin-top: 12px; color: var(--text-tertiary); font-size: 12px; flex-wrap: wrap; }
.mos-repair-line strong { color: var(--text-secondary); font-weight: 650; overflow-wrap: break-word; }
.mos-command-facts, .mos-guides { display: flex; gap: 0; flex-wrap: wrap; margin-top: 13px; color: var(--text-secondary); font-size: 11.5px; font-weight: 600; }
.mos-command-facts span + span::before, .mos-guides span + span::before { content: "·"; margin: 0 9px; color: var(--text-tertiary); }
.mos-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-top: 18px; }
.mos-btn { min-height: 36px; border-radius: 10px; border: 1px solid transparent; padding: 0 14px; font: inherit; font-size: 12px; font-weight: 680; transition: .16s ease; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; }
.mos-btn:focus-visible, .mos-segment button:focus-visible, .mos-scroll-segment button:focus-visible, .mos-paper-item:focus-visible, .mos-subject-row:focus-visible { outline: 2px solid var(--brand-primary); outline-offset: 2px; }
.mos-btn--primary { background: var(--brand-primary); color: white; }
.mos-btn--primary:hover { background: var(--brand-primary-hover); }
.mos-btn--secondary { background: var(--bg-surface); border-color: var(--border-default); color: var(--text-primary); }
.mos-btn--secondary:hover, .mos-btn--quiet:hover { background: var(--bg-subtle); }
.mos-btn--quiet { background: transparent; border-color: var(--border-subtle); color: var(--text-primary); }
.mos-btn--text { background: transparent; color: var(--brand-primary); padding-inline: 5px; }
.mos-btn--small { min-height: 32px; padding-inline: 11px; font-size: 11px; }
.mos-practice-access { padding: 2px 0 0; min-width: 0; }
.mos-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 14px; min-width: 0; }
.mos-section-head--simple { align-items: baseline; }
.mos-section-head h2, .mos-review-repair__head h2 { margin: 4px 0 0; font-size: 16px; line-height: 1.25; letter-spacing: -.016em; font-weight: 720; overflow-wrap: break-word; }
.mos-section-head p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 11.5px; }
.mos-paper-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; min-width: 0; }
.mos-paper-item { position: relative; display: grid; grid-template-columns: 3px 1fr auto; gap: 11px; align-items: center; min-height: 84px; padding: 14px 14px 14px 0; border: 1px solid var(--border-subtle); border-radius: 14px; background: var(--bg-surface); color: var(--text-primary); text-align: left; transition: .16s ease; min-width: 0; box-sizing: border-box; }
.mos-paper-item:hover { border-color: var(--border-default); background: var(--bg-subtle); transform: translateY(-1px); }
.mos-paper-item__accent { width: 3px; align-self: stretch; border-radius: 0 3px 3px 0; background: var(--brand-primary); }
.mos-paper-item[data-paper="gs1"] .mos-paper-item__accent { background:#f59e0b; }
.mos-paper-item[data-paper="gs2"] .mos-paper-item__accent { background:#3b82f6; }
.mos-paper-item[data-paper="gs3"] .mos-paper-item__accent { background:#22c55e; }
.mos-paper-item__copy { display: grid; gap: 2px; min-width: 0; }
.mos-paper-item__copy small { color: var(--text-tertiary); font-size: 10px; font-weight: 750; }
.mos-paper-item__copy strong { font-size: 13px; font-weight: 700; overflow-wrap: break-word; }
.mos-paper-item__copy span { color: var(--text-tertiary); font-size: 10.5px; overflow-wrap: break-word; }
.mos-paper-item__open { color: var(--brand-primary); font-size: 11px; font-weight: 650; flex-shrink: 0; }
.mos-other-ways { margin-top: 16px; padding-top: 15px; border-top: 1px solid var(--border-subtle); min-width: 0; }
.mos-utility-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; min-width: 0; }
.mos-utility-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 58px; padding: 9px 11px 9px 13px; border-radius: 12px; border: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-surface) 82%, var(--bg-subtle)); min-width: 0; box-sizing: border-box; }
.mos-utility-row > div { display: grid; gap: 2px; min-width: 0; }
.mos-utility-row strong { font-size: 12px; overflow-wrap: break-word; }
.mos-utility-row span { color: var(--text-tertiary); font-size: 10.5px; line-height: 1.4; overflow-wrap: break-word; }
.mos-upload-host { margin-top: 14px; min-width: 0; }
.mos-question-picker { padding: 22px 24px 24px; min-width: 0; }
.mos-question-picker__head h2 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.014em; }
.mos-question-picker__controls { margin-top: 14px; min-width: 0; }
.mos-scroll-segment { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.mos-scroll-segment::-webkit-scrollbar { display: none; }
.mos-scroll-segment button { flex: 0 0 auto; white-space: nowrap; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); min-height: 30px; padding: 0 10px; border-radius: 8px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.mos-segment button { white-space: nowrap; border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); min-height: 30px; padding: 0 10px; border-radius: 8px; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
.mos-scroll-segment button.is-active, .mos-segment button.is-active { background: var(--brand-primary-soft); border-color: color-mix(in srgb, var(--brand-primary) 48%, var(--border-default)); color: var(--brand-primary); }
.mos-scroll-segment button[data-paper="gs1"].is-active { color:#d97706; border-color:rgba(245,158,11,.45); background:rgba(245,158,11,.07); }
.mos-question-picker__lower-controls { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 9px; min-width: 0; }
.mos-segment { display: inline-flex; align-items: center; gap: 5px; }
.mos-marks-control { display: flex; align-items: center; gap: 8px; }
.mos-marks-control > span { color: var(--text-tertiary); font-size: 9px; font-weight: 750; text-transform: uppercase; letter-spacing: .08em; }
.mos-question-picker__question { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle); min-width: 0; }
.mos-question-meta { display: flex; flex-wrap: wrap; gap: 7px; color: var(--text-tertiary); font-size: 10.5px; font-weight: 650; }
.mos-question-meta span + span::before { content:"·"; margin-right:7px; }
.mos-question-picker__question h3 { max-width: 960px; margin: 9px 0 0; font-size: clamp(15px, 1.6vw, 19px); line-height: 1.48; letter-spacing: -.017em; font-weight: 690; overflow-wrap: break-word; word-break: break-word; }
.mos-guides { margin-top: 10px; color: var(--text-tertiary); }
.mos-focus { margin: 10px 0 0; color: var(--text-secondary); font-size: 11.5px; line-height: 1.55; overflow-wrap: break-word; word-break: break-word; }
.mos-focus strong { margin-right: 8px; color: var(--text-primary); }
.mos-baseline-note { margin: -8px 2px 0; color: var(--text-tertiary); font-size: 11.5px; overflow-wrap: break-word; }
.mos-review-repair { padding: 0; overflow: hidden; min-width: 0; }
.mos-review-repair__head { padding: 18px 22px 0; }
.mos-review-repair__grid { display: grid; grid-template-columns: .85fr 1.15fr; margin-top: 13px; border-top: 1px solid var(--border-subtle); min-width: 0; }
.mos-review-pane { min-width: 0; padding: 20px 22px 22px; box-sizing: border-box; }
.mos-review-pane + .mos-review-pane { border-left: 1px solid var(--border-subtle); }
.mos-last-answer__title-row, .mos-fix-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.mos-review-pane h3 { margin: 5px 0 0; font-size: 15px; letter-spacing: -.01em; overflow-wrap: break-word; }
.mos-review-pane p { margin: 9px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; overflow-wrap: break-word; word-break: break-word; }
.mos-score { flex: 0 0 auto; color: #15803d; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.18); padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; }
.mos-muted-meta { display: flex; gap: 12px; margin-top: 10px; color: var(--text-tertiary); font-size: 10.5px; flex-wrap: wrap; }
.mos-fix-list { display: grid; margin-top: 11px; min-width: 0; }
.mos-fix-item { display: grid; grid-template-columns: 24px 1fr auto; gap: 10px; align-items: center; min-height: 48px; border-top: 1px solid var(--border-subtle); min-width: 0; }
.mos-fix-item:first-child { border-top: 0; }
.mos-fix-index { color: var(--text-tertiary); font-size: 9px; font-variant-numeric: tabular-nums; }
.mos-fix-copy { display: grid; gap: 2px; min-width: 0; }
.mos-fix-copy strong { color: var(--text-primary); font-size: 11.5px; font-weight: 650; text-transform: none; overflow-wrap: break-word; }
.mos-fix-copy small { color: var(--text-tertiary); font-size: 10.5px; overflow-wrap: break-word; }
.mos-paper-badge { color: var(--brand-primary); font-size: 9px; font-weight: 750; flex-shrink: 0; }
.mos-explore {
  padding: 20px 22px 22px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(16,24,40,.025), 0 6px 18px rgba(16,24,40,.025);
  min-width: 0;
  box-sizing: border-box;
}
html[data-theme="dark"] .mos-explore { box-shadow: none; }
.mos-explore__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; min-width: 0; }
.mos-explore__head h2 { margin: 4px 0 0; font-size: 16px; line-height: 1.25; letter-spacing: -.016em; font-weight: 720; color: var(--text-primary); overflow-wrap: break-word; }
.mos-explore__head p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 11.5px; }
.mos-explore__paper-tabs { display: inline-flex; gap: 7px; align-items: center; }
.mos-explore__paper-tabs button {
  min-width: 44px;
  height: 30px;
  padding: 0 11px;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15,23,42,.05);
  transition: border-color .16s ease, color .16s ease, background .16s ease, transform .16s ease;
  flex: 0 0 auto;
}
html[data-theme="dark"] .mos-explore__paper-tabs button { box-shadow: none; }
.mos-explore__paper-tabs button:hover { transform: translateY(-1px); border-color: var(--border-default); }
.mos-explore__paper-tabs button.is-active {
  color: var(--tab-accent, var(--brand-primary));
  border-color: color-mix(in srgb, var(--tab-accent, var(--brand-primary)) 48%, var(--border-default));
  background: color-mix(in srgb, var(--tab-accent, var(--brand-primary)) 7%, var(--bg-surface));
}
.mos-explore__filters { display: grid; gap: 5px; margin-top: 14px; min-width: 0; }
.mos-explore__filters label {
  color: var(--text-tertiary);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .11em;
  text-transform: uppercase;
}
.mos-explore__filters select {
  width: 150px;
  height: 32px;
  padding: 0 30px 0 10px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: 11px;
  outline: none;
  max-width: 100%;
}
.mos-explore__filters select:focus { border-color: color-mix(in srgb, var(--brand-primary) 45%, var(--border-default)); }
.mos-explore__subject-rows { display: grid; gap: 6px; margin-top: 12px; min-width: 0; }
.mos-explore__subject-row {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--bg-subtle) 62%, var(--bg-surface));
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
  min-width: 0;
  box-sizing: border-box;
}
.mos-explore__subject-row:hover {
  border-color: var(--border-default);
  background: var(--bg-subtle);
  transform: translateY(-1px);
}
.mos-explore__subject-name { font-size: 12px; font-weight: 650; color: var(--text-secondary); min-width: 0; overflow-wrap: break-word; }
.mos-explore__subject-meta { display: inline-flex; align-items: center; gap: 9px; flex-shrink: 0; }
.mos-explore__count {
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--explore-accent, #f59e0b) 8%, transparent);
  color: color-mix(in srgb, var(--explore-accent, #f59e0b) 78%, var(--text-secondary));
  font-size: 9.5px;
  font-weight: 650;
}
.mos-explore__chevron { color: color-mix(in srgb, var(--explore-accent, #f59e0b) 72%, var(--text-tertiary)); font-size: 15px; line-height: 1; }
.mos-inline-state { padding: 18px 0; color: var(--text-tertiary); font-size: 12px; }
.mos-inline-state--error { color: var(--error, #ef4444); }
.mos-flat-section { padding: 1px 0 0; min-width: 0; }
.mos-recent-list { border-top: 1px solid var(--border-subtle); min-width: 0; }
.mos-recent-row { display: grid; grid-template-columns: 42px 1fr auto; gap: 12px; align-items: center; min-height: 58px; border-bottom: 1px solid var(--border-subtle); min-width: 0; }
.mos-recent-row:last-child { border-bottom: 0; }
.mos-recent-paper { color: var(--brand-primary); font-size: 10px; font-weight: 750; }
.mos-recent-copy { display: grid; gap: 2px; min-width: 0; }
.mos-recent-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; font-weight: 650; }
.mos-recent-copy small { color: var(--text-tertiary); font-size: 10px; }
.mos-recent-status { color: #16a34a; font-size: 10px; font-weight: 650; flex-shrink: 0; }
.mos-recent-status--score { color: var(--text-primary); }
.mos-empty-copy { color: var(--text-tertiary); font-size: 12px; }

@media (max-width: 900px) {
  .mos-premium { padding-inline: 18px; }
  .mos-paper-grid { grid-template-columns: 1fr; }
  .mos-utility-grid, .mos-review-repair__grid { grid-template-columns: 1fr; }
  .mos-review-pane + .mos-review-pane { border-left: 0; border-top: 1px solid var(--border-subtle); }
  .mos-page-head { align-items: flex-start; flex-direction: column; gap: 5px; }
}
@media (max-width: 640px) {
  .mos-premium { padding: 14px 10px 40px; }
  .mos-premium__inner { gap: 16px; }
  .mos-command-hero, .mos-question-picker, .mos-explore { padding: 18px 14px; }
  .mos-command-hero h2 { font-size: 20px; }
  .mos-section-head { align-items: flex-start; flex-direction: column; gap: 6px; }
  .mos-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
  }
  .mos-actions .mos-btn--primary {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 44px;
    justify-content: center;
  }
  .mos-actions .mos-btn--secondary,
  .mos-actions .mos-btn--quiet,
  .mos-actions .mos-btn--text {
    width: 100%;
    text-align: center;
    justify-content: center;
    min-height: 38px;
  }
  .mos-paper-item {
    padding: 12px 12px 12px 0;
    min-height: 72px;
    gap: 8px;
  }
  .mos-question-picker__lower-controls { align-items: stretch; flex-direction: column; gap: 10px; }
  .mos-marks-control { width: 100%; justify-content: space-between; }
  .mos-utility-grid { grid-template-columns: 1fr; }
  .mos-utility-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px;
  }
  .mos-utility-row button {
    width: 100%;
    justify-content: center;
    min-height: 36px;
  }
  .mos-fix-head { align-items: flex-start; flex-direction: column; gap: 8px; }
  .mos-fix-head button { width: 100%; justify-content: center; }
  .mos-fix-item { grid-template-columns: 20px minmax(0, 1fr) auto; gap: 8px; }
  .mos-recent-row { grid-template-columns: 34px minmax(0, 1fr) auto; }
  .mos-explore__head { flex-direction: column; gap: 10px; }
  .mos-explore__paper-tabs { width: 100%; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
  .mos-explore__filters select { width: 100%; }
`;


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsPage() {
  const recentAttempts = useRecentAttempts(3);
  const weakAreas = useWeakAreas();
  const stats = useMainsStats();
  const perPaperStats = usePerPaperStats();
  const baselineTarget = 10;
  const baselineRemaining = Math.max(baselineTarget - Math.min(stats.total || 0, baselineTarget), 0);

  return (
    <div className="mos-premium">
      <style>{PREMIUM_MAINS_CSS}</style>
      <div className="mos-premium__inner">
        <header className="mos-page-head">
          <h1>Mains Answer Writing</h1>
          <div className="mos-page-head__meta">{stats.total} answers · {stats.openMistakes} weak signals</div>
        </header>

        <MentorCommandCard weakAreas={weakAreas} />
        <PaperQuickAccess perPaperStats={perPaperStats} />
        <QuickPractice />

        {baselineRemaining > 0 && (
          <p className="mos-baseline-note">{baselineRemaining} more answer{baselineRemaining === 1 ? "" : "s"} needed for reliable pattern intelligence.</p>
        )}

        <ReviewRepair attempt={recentAttempts[0]} weakAreas={weakAreas} />
        <RecentAnswersCard attempts={recentAttempts} />
      </div>
    </div>
  );
}
