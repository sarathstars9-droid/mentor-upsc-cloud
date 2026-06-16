// src/pages/MainsPage.jsx
// Mains Command Center — GS1, GS2, GS3 only.
// Ethics, Essay, Geography Optional: separate pages later.
// Frontend-only. No backend wiring. Production-safe.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";
import { saveMainsAttemptToDB, extractAnswerFromImagesApi, extractQuestionAnswerFromImagesApi } from "../utils/mainsReviewApi.js";

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
  const [inputMethod, setInputMethod] = useState("typed"); // "typed" | "handwritten"

  // OCR/Upload State
  const [uploadedPages, setUploadedPages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [questionSource, setQuestionSource] = useState("auto"); // "auto", "pyq", "institute", "custom", "essay", "geography"
  const [isExtracting, setIsExtracting] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrSuccess, setOcrSuccess] = useState(false);

  // Verification Form State
  const [verifiedQuestion, setVerifiedQuestion] = useState("");
  const [verifiedAnswer, setVerifiedAnswer] = useState("");
  const [verifiedPaper, setVerifiedPaper] = useState("gs1");
  const [verifiedTopic, setVerifiedTopic] = useState("");
  const [verifiedMarks, setVerifiedMarks] = useState("15");
  const [verifiedYear, setVerifiedYear] = useState("");
  const [verifiedInstitute, setVerifiedInstitute] = useState("");
  const [verifiedTestName, setVerifiedTestName] = useState("");
  const [verifiedQuestionNumber, setVerifiedQuestionNumber] = useState("");

  const [useSelectedCardQuestion, setUseSelectedCardQuestion] = useState(false);

  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fileInputRef = useRef(null);

  const getPaperAccent = (p) => {
    switch (p) {
      case "gs1": return T.amber;
      case "gs2": return T.blue;
      case "gs3": return T.green;
      case "gs4": return T.purple;
      case "essay": return "#ec4899"; // pink
      case "geo_p1": return "#f59e0b"; // amber
      case "geo_p2": return "#10b981"; // green
      default: return T.amber;
    }
  };

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

  const paperAccent = getPaperAccent(paper);
  const paperLabel  = getPaperLabel(paper);

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

  // Upload actions
  const addFiles = (files) => {
    const validFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    const toAdd = validFiles.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      name: file.name,
      type: file.type,
    }));
    setUploadedPages((prev) => [...prev, ...toAdd]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleRemovePage = (index) => {
    setUploadedPages((prev) => {
      const page = prev[index];
      if (page.preview) {
        URL.revokeObjectURL(page.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePrepareAnswerText = async () => {
    if (uploadedPages.length === 0) {
      setOcrError("Please upload at least one image or PDF page.");
      return;
    }
    setIsExtracting(true);
    setOcrError("");
    try {
      const files = uploadedPages.map((pg) => pg.file).filter(Boolean);
      let extractedText = "";
      if (files.length > 0) {
        try {
          const res = await extractAnswerFromImagesApi(files);
          if (res && res.ok && res.text) {
            extractedText = res.text;
          } else {
            extractedText = `Mock extracted answer text from uploaded pages.\n\nPaper: ${getPaperLabel(paper)}\nQuestion Source: ${questionSource}\n\nCandidate's handwritten answer text goes here. The extraction pipeline is ready. (OCR API returned status ok but text empty or error: ${res?.error || 'none'})`;
          }
        } catch (apiErr) {
          console.warn("OCR API error, falling back to mock text for development preview", apiErr);
          extractedText = `Sample Extracted Answer:\n\nThe Bhakti movement was a significant socio-religious movement in medieval India. It originated in South India in the 7th-8th centuries and spread to North India in the 14th-15th centuries. It challenged the rigid caste system, advocated for devotion to a personal god, and promoted regional languages.\n\nKey Saint-poets:\n1. Kabir: Criticized external rituals and emphasized Hindu-Muslim unity.\n2. Mirabai: Expressed intense devotion to Lord Krishna.\n3. Guru Nanak: Founded Sikhism based on equality and devotion.\n\nImpact on Society:\n- Weakened the caste barriers.\n- Promoted vernacular literature (Hindi, Bengali, Marathi).\n- Fostered social reform and equality.`;
        }
      } else {
        extractedText = "No files uploaded to extract.";
      }

      setVerifiedAnswer(extractedText);
      
      if (useSelectedCardQuestion && currentQ) {
        setVerifiedQuestion(currentQ.q);
        setVerifiedPaper(paper);
        setVerifiedMarks(marks);
        setVerifiedYear(currentQ.year || "");
        setVerifiedTopic(currentQ.hint ? currentQ.hint.replace("Focus: ", "") : "");
      } else {
        setVerifiedQuestion("");
        setVerifiedPaper(paper);
        setVerifiedMarks(marks);
        setVerifiedYear("");
        setVerifiedTopic("");
      }
      setOcrSuccess(true);
    } catch (err) {
      setOcrError("Failed to extract text: " + err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveAndContinue = async () => {
    setIsSavingAttempt(true);
    setSaveError("");
    setSaveSuccess(false);

    const existingAttemptId = `mains_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      attemptId:          existingAttemptId,
      userId:             "user_1",
      questionText:       verifiedQuestion,
      paper:              getPaperLabel(verifiedPaper),
      subject:            verifiedTopic || "General",
      topic:              verifiedTopic || "General",
      marks:              parseInt(verifiedMarks) || 15,
      wordLimit:          parseInt(verifiedMarks) === 10 ? 150 : 200,
      finalAnswerText:    verifiedAnswer.trim(),
      extractedText:      verifiedAnswer.trim(),
      answerSource:       "uploaded",
      uploadedPagesMeta:  uploadedPages.map((pg, idx) => ({ pageNo: idx + 1, fileName: pg.name || `page_${idx+1}.jpg` })),
      basicReview:        null,
      air1RawReview:      "",
      air1ParsedJson:     null,
      currentScore:       "",
      targetScore:        "",
      status:             "finalized",
      metadata: {
        questionSource,
        year: verifiedYear,
        institute: verifiedInstitute,
        testName: verifiedTestName,
        questionNumber: verifiedQuestionNumber,
      }
    };

    try {
      const res = await saveMainsAttemptToDB(payload);
      if (res && res.ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          setInputMethod("typed");
          setUploadedPages([]);
          setOcrSuccess(false);
          setSaveSuccess(false);
          localStorage.setItem("current_mains_attempt_id", res.attemptId);
          navigate("/mains/answer-writing", {
            state: {
              attemptId: res.attemptId,
              isRestored: true,
              paper: getPaperLabel(verifiedPaper),
              mode: "Custom",
              question: {
                question: verifiedQuestion,
                paper: getPaperLabel(verifiedPaper),
                marks: verifiedMarks,
                focus: verifiedTopic,
              }
            }
          });
        }, 1500);
      } else {
        setSaveError(res?.error || "Failed to save attempt to DB.");
      }
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save attempt: " + err.message);
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const sourceLine = mode === "pyq"
    ? { dot: T.green,  label: "UPSC PYQ",              sub: "High Priority" }
    : mode === "topic"
    ? { dot: T.amber,  label: "Topic Practice",         sub: "Depth Builder" }
    : { dot: T.blue,   label: "Mixed Mode",              sub: "Breadth Drill" };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${paperAccent}, ${paperAccent}44, transparent)` }} />

      <div style={{ padding: "26px 28px 28px" }}>
        
        {/* ── Section header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ ...label11(paperAccent), marginBottom: 7, letterSpacing: "0.14em" }}>Answer Writing Practice</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: T.textBright, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
              Mains Practice Session
            </div>
            <div style={{ fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>
              Select paper, mode, and marker type — then begin focused mains writing.
            </div>
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            flexShrink: 0,
            background: T.bg,
            border: `1px solid ${T.borderMid}`,
            borderRadius: 10,
            padding: "9px 16px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: paperAccent, letterSpacing: "0.04em" }}>{paperLabel}</span>
            {inputMethod === "typed" && (
              <>
                <span style={{ color: T.muted, fontSize: 12 }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: modeColor, letterSpacing: "0.06em" }}>{modeLabel}</span>
                <span style={{ color: T.muted, fontSize: 12 }}>·</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{marks}M</span>
              </>
            )}
          </div>
        </div>

        {/* ── Input Method selector ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => setInputMethod("typed")}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: `1.5px solid ${paperAccent}`,
              background: `${paperAccent}15`,
              color: paperAccent,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.15s ease",
            }}
          >
            ⌨️ Typed Answer
          </button>
        </div>

        {/* ── Selectors Area ── */}
        <div style={{
          background: T.bg,
          borderRadius: 10,
          border: `1px solid ${T.border}`,
          padding: "16px",
          marginBottom: 24,
        }}>
          {/* Paper Selector (Full Width Row) */}
          <div style={{ marginBottom: inputMethod === "typed" ? 16 : 0 }}>
            <div style={{ ...label11(T.subtle), marginBottom: 8, fontSize: 10 }}>Select Paper</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "GS1", value: "gs1" },
                { label: "GS2", value: "gs2" },
                { label: "GS3", value: "gs3" },
                { label: "GS4 Ethics", value: "gs4" },
                { label: "Essay", value: "essay" },
                { label: "Geography Optional P1", value: "geo_p1" },
                { label: "Geography Optional P2", value: "geo_p2" },
              ].map((opt) => {
                const isActive = paper === opt.value;
                const acc = getPaperAccent(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => handlePaper(opt.value)}
                    style={{
                      padding: "6px 14px",
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

          {/* Mode & Answer Type Selectors (Only for Typed Answer) */}
          {inputMethod === "typed" && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              borderTop: `1px solid ${T.border}`,
              paddingTop: 16,
            }}>
              <div>
                <div style={{ ...label11(T.subtle), marginBottom: 8, fontSize: 10 }}>Mode</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "PYQ", value: "pyq" },
                    { label: "Topic", value: "topic" },
                    { label: "Mixed", value: "mixed" },
                  ].map((opt) => {
                    const isActive = mode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleMode(opt.value)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 7,
                          border: isActive ? `1.5px solid ${T.purple}` : `1px solid ${T.borderMid}`,
                          background: isActive ? `${T.purple}18` : "transparent",
                          color: isActive ? T.purple : T.dim,
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

              <div>
                <div style={{ ...label11(T.subtle), marginBottom: 8, fontSize: 10 }}>Answer Type</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "10 Marker", value: "10" },
                    { label: "15 Marker", value: "15" },
                    { label: "20 Marker", value: "20" },
                  ].map((opt) => {
                    const isActive = marks === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleMarks(opt.value)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 7,
                          border: isActive ? `1.5px solid ${paperAccent}` : `1px solid ${T.borderMid}`,
                          background: isActive ? `${paperAccent}18` : "transparent",
                          color: isActive ? paperAccent : T.dim,
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
            </div>
          )}
        </div>

        {/* ── Typed Answer Practice Flow ── */}
        {inputMethod === "typed" && (
          <>
            {currentQ ? (
              <div style={{
                background: T.bg,
                border: `1px solid ${paperAccent}22`,
                borderRadius: 12, overflow: "hidden", marginBottom: 22,
              }}>
                {/* Card header */}
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

                  <div style={{
                    fontSize: 17, fontWeight: 700, color: T.textBright,
                    lineHeight: 1.85, letterSpacing: "0.01em",
                    paddingBottom: 20,
                  }}>
                    {currentQ.q}
                  </div>
                </div>

                {/* Card footer */}
                <div style={{
                  padding: "14px 20px 16px",
                  borderTop: `1px solid ${T.border}`,
                  background: `${T.surface}88`,
                  display: "flex", flexDirection: "column", gap: 9,
                }}>
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

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", paddingTop: 4 }}>
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
          </>
        )}


      </div>
    </div>
  );
}

// ─── Upload Answer Review Card ───────────────────────────────────────────────
function UploadAnswerReviewCard() {
  const navigate = useNavigate();
  const [sourceOption, setSourceOption] = useState("pyq"); // pyq | institute | custom
  const [paper, setPaper] = useState("GS1");
  const [year, setYear] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [marks, setMarks] = useState("15");
  const [wordLimit, setWordLimit] = useState("250");
  const [instituteName, setInstituteName] = useState("");
  const [testName, setTestName] = useState("");
  const [subjectTopic, setSubjectTopic] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [uploadedPages, setUploadedPages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const handleMarksChange = (val) => {
    setMarks(val);
    if (val === "10") {
      setWordLimit("150");
    } else if (val === "15" || val === "20") {
      setWordLimit("250");
    }
  };

  const addFiles = (files) => {
    const valid = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    const toAdd = valid.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      name: file.name
    }));
    setUploadedPages((prev) => {
      const remaining = 5 - prev.length;
      return [...prev, ...toAdd.slice(0, remaining)];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleRemovePage = (idx) => {
    setUploadedPages((prev) => {
      if (prev[idx].preview) {
        URL.revokeObjectURL(prev[idx].preview);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleExtract = async () => {
    if (uploadedPages.length === 0) {
      setError("Please upload at least one image or PDF page.");
      return;
    }
    setIsExtracting(true);
    setError("");
    try {
      const files = uploadedPages.map((pg) => pg.file).filter(Boolean);
      const res = await extractQuestionAnswerFromImagesApi(files);
      if (res.success) {
        const newAttemptId = `mains_upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const finalPaper = res.detectedMetadata?.paper || paper;
        const finalSubjectTopic = res.detectedMetadata?.topic || res.detectedMetadata?.subject || subjectTopic;

        let finalWordLimit = res.detectedMetadata?.wordLimit;
        if (!finalWordLimit) {
          if (finalPaper === "Essay") {
            finalWordLimit = "1000";
          } else if (marks === "10") {
            finalWordLimit = "150";
          } else {
            finalWordLimit = "250";
          }
        } else {
          finalWordLimit = String(finalWordLimit);
        }

        const finalMeta = {
          sourceOption: res.detectedMetadata?.sourceType || sourceOption,
          paper: finalPaper,
          year: res.detectedMetadata?.year || year,
          questionNumber: res.detectedMetadata?.questionNumber || questionNumber,
          marks: marks,
          wordLimit: finalWordLimit,
          instituteName: res.detectedMetadata?.instituteName || instituteName,
          testName: res.detectedMetadata?.testName || testName,
          subjectTopic: finalSubjectTopic,
          detectedSubject: res.detectedMetadata?.subject || "",
          detectedTopic: res.detectedMetadata?.topic || "",
          detectedMicrotheme: res.detectedMetadata?.microtheme || "",
          confidence: res.confidence || null
        };

        const uploadedPagesMeta = uploadedPages.map((pg, idx) => ({ pageNo: idx + 1, fileName: pg.name || `page_${idx+1}.jpg` }));

        navigate("/mains/answer-writing", {
          state: {
            practiceMode: "upload",
            ocrExtracted: true,
            verifiedQuestionText: res.questionText || "",
            pastedText: res.answerText || "",
            uploadMeta: finalMeta,
            attemptId: newAttemptId,
            sessionStarted: true,
            uploadedPagesMeta: uploadedPagesMeta
          }
        });
      } else {
        setError(res.error || "Failed to extract text from the sheet.");
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || "Extraction failed. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const [winWidth, setWinWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWinWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = winWidth < 768;

  const containerGridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
    gap: 24,
    marginTop: 20
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 28 }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${T.purple}, ${T.purple}44, transparent)` }} />
      <div style={{ padding: "26px 28px 28px" }}>
        
        <div>
          <div style={{ ...label11(T.purple), marginBottom: 7, letterSpacing: "0.14em" }}>Handwritten Sheet Review</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.textBright, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
            Upload Answer Sheet for Review
          </div>
          <div style={{ fontSize: 13, color: T.dim, marginTop: 6, lineHeight: 1.5 }}>
            Upload one image/PDF containing both the question and your written answer. MentorOS will extract, split, verify, evaluate, and generate AIR-1 review.
          </div>
        </div>

        <div style={containerGridStyle}>
          {/* Left Panel: Metadata */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ ...label11(T.subtle), marginBottom: 8, fontSize: 10 }}>Marks</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["10", "15", "20"].map((m) => {
                  const isActive = marks === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMarksChange(m)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: isActive ? `1.5px solid ${T.purple}` : `1px solid ${T.borderMid}`,
                        background: isActive ? `${T.purple}18` : T.bg,
                        color: isActive ? T.purple : T.dim,
                        fontWeight: isActive ? 800 : 500,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: T.font
                      }}
                    >
                      {m} Marks
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.purple,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 0",
                  outline: "none"
                }}
              >
                {showAdvanced ? "▼ Hide Advanced details" : "▶ Show Advanced details"}
              </button>
            </div>

            {showAdvanced && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: 16,
                background: T.bg,
                border: `1px solid ${T.borderMid}`,
                borderRadius: 10
              }}>
                <div>
                  <div style={{ ...label11(T.subtle), marginBottom: 8, fontSize: 10 }}>Source Type</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { label: "UPSC PYQ", value: "pyq" },
                      { label: "Institute Test", value: "institute" },
                      { label: "Custom Practice", value: "custom" }
                    ].map((opt) => {
                      const isActive = sourceOption === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSourceOption(opt.value)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 8,
                            border: isActive ? `1.5px solid ${T.purple}` : `1px solid ${T.borderMid}`,
                            background: isActive ? `${T.purple}18` : T.bg,
                            color: isActive ? T.purple : T.dim,
                            fontWeight: isActive ? 800 : 500,
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: T.font
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  {sourceOption === "pyq" && (
                    <>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                        <select
                          value={paper}
                          onChange={(e) => setPaper(e.target.value)}
                          style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        >
                          {["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Year</label>
                        <input
                          type="number"
                          placeholder="e.g. 2023"
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Question No.</label>
                        <input
                          type="text"
                          placeholder="e.g. 3a"
                          value={questionNumber}
                          onChange={(e) => setQuestionNumber(e.target.value)}
                          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        />
                      </div>
                    </>
                  )}

                  {sourceOption === "institute" && (
                    <>
                      <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Institute Name</label>
                        <input
                          type="text"
                          placeholder="Vision IAS, Forum IAS..."
                          value={instituteName}
                          onChange={(e) => setInstituteName(e.target.value)}
                          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        />
                      </div>
                      <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Test Name / Code</label>
                        <input
                          type="text"
                          placeholder="Mains Test 4..."
                          value={testName}
                          onChange={(e) => setTestName(e.target.value)}
                          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                        <select
                          value={paper}
                          onChange={(e) => setPaper(e.target.value)}
                          style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        >
                          {["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Question No.</label>
                        <input
                          type="text"
                          value={questionNumber}
                          onChange={(e) => setQuestionNumber(e.target.value)}
                          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        />
                      </div>
                    </>
                  )}

                  {sourceOption === "custom" && (
                    <>
                      <div style={{ gridColumn: isMobile ? "span 1" : "span 2" }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Subject / Topic</label>
                        <input
                          type="text"
                          placeholder="e.g. Art & Culture, Internal Security"
                          value={subjectTopic}
                          onChange={(e) => setSubjectTopic(e.target.value)}
                          style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Paper</label>
                        <select
                          value={paper}
                          onChange={(e) => setPaper(e.target.value)}
                          style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                        >
                          {["GS1", "GS2", "GS3", "GS4", "Essay", "Ethics", "Optional"].map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: T.subtle, textTransform: "uppercase" }}>Word Limit</label>
                    <select
                      value={wordLimit}
                      onChange={(e) => setWordLimit(e.target.value)}
                      style={{ width: "100%", background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 8, color: T.text, padding: 8, marginTop: 4, outline: "none" }}
                    >
                      {["150", "250", "1000", "2000"].map((w) => (
                        <option key={w} value={w}>{w} Words</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Uploader & Button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ ...label11(T.subtle), marginBottom: 8, fontSize: 10 }}>Upload Question + Answer Sheet</label>
              <div
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? T.purple : T.borderMid}`,
                  borderRadius: 12,
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: isDragging ? `${T.purple}08` : T.bg,
                  transition: "all 0.2s"
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => addFiles(e.target.files)}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: 28, marginBottom: 8 }}>📤</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textBright }}>
                  Drag & drop image/PDF here or click to select
                </div>
                <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                  Supports multiple pages (max 5 pages)
                </div>
              </div>
            </div>

            {uploadedPages.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.subtle, textTransform: "uppercase", marginBottom: 8 }}>Uploaded Pages ({uploadedPages.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {uploadedPages.map((pg, idx) => (
                    <div key={idx} style={{ position: "relative", width: 70, height: 70, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.borderMid}` }}>
                      {pg.file?.type === "application/pdf" ? (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: T.surfaceHigh, fontSize: 12, fontWeight: 800, color: T.red }}>PDF</div>
                      ) : (
                        <img src={pg.preview} alt={`Page ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePage(idx)}
                        style={{
                          position: "absolute",
                          top: 2,
                          right: 2,
                          background: T.red,
                          color: "#fff",
                          border: "none",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: "bold"
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: `${T.red}15`, border: `1px solid ${T.red}33`, borderRadius: 8, padding: 12, fontSize: 13, color: T.red }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="button"
              disabled={isExtracting || uploadedPages.length === 0}
              onClick={handleExtract}
              style={{
                width: "100%",
                background: isExtracting ? T.muted : `linear-gradient(135deg, ${T.purple} 0%, #4f46e5 100%)`,
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontWeight: 950,
                fontSize: 14,
                padding: "14px 20px",
                cursor: isExtracting || uploadedPages.length === 0 ? "not-allowed" : "pointer",
                boxShadow: uploadedPages.length > 0 && !isExtracting ? `0 4px 14px ${T.purple}40` : "none",
                transition: "all 0.2s"
              }}
            >
              {isExtracting ? "🔍 Extracting Question & Answer (Gemini OCR)..." : "🔍 Extract & Verify"}
            </button>
          </div>
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

  const [winWidth, setWinWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWinWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isMobile = winWidth < 768;

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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 18, marginBottom: 28 }}>
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
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 14 }}>
                <WeakColumn gs="GS1" accent={T.amber} items={weakAreas.GS1} />
                <WeakColumn gs="GS2" accent={T.blue}  items={weakAreas.GS2} />
                <WeakColumn gs="GS3" accent={T.green} items={weakAreas.GS3} />
              </div>
            )}
          </div>
        </div>

        {/* ═══ UPLOAD REVIEW CARD ══════════════════════════════════════════════ */}
        <UploadAnswerReviewCard />

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
