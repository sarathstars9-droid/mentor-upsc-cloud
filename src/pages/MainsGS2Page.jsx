// src/pages/MainsGS2Page.jsx
// GS2 Question Selection Page — pre-flight screen before AnswerWritingPage
// Fetches real data from GET /api/mains/gs2/questions

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config.js";

// ─── Theme tokens ─────────────────────────────────────────────────────────────
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
  blue:        "#3b82f6",
  green:       "#22c55e",
  amber:       "#f59e0b",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  teal:        "#14b8a6",
  rose:        "#f43f5e",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const ACCENT = T.blue;

// ─── Display helper ───────────────────────────────────────────────────────────
const getMarksBadge = (q) => (q?.marks ? `${q.marks}M` : null);

// ─── GS2 Theme groups ─────────────────────────────────────────────────────────
const THEMES = [
  { id: "Polity",                   label: "Polity",                   icon: "⚖️",  desc: "Constitution, Parliament, Judiciary, Federalism" },
  { id: "Governance",               label: "Governance",               icon: "🏛️",  desc: "Civil Services, E-Governance, Transparency, RTI" },
  { id: "Social Justice",           label: "Social Justice",           icon: "🤝",  desc: "Welfare, Education, Health, Poverty, SHGs" },
  { id: "International Relations",  label: "International Relations",  icon: "🌐",  desc: "Foreign Policy, Bilateral, Multilateral, India's Neighbourhood" },
];

// ─── PYQ Analysis Data ────────────────────────────────────────────────────────
const THEME_ANALYSIS = [
  {
    id: "Polity",
    icon: "⚖️",
    color: T.blue,
    colorDim: `${T.blue}18`,
    colorBorder: `${T.blue}30`,
    mentorLine: "In GS2 Polity, UPSC tests constitutional reasoning — not article recitation.",
    setterLogic: [
      "UPSC does not want you to quote Article 356 — it wants you to analyse when it becomes a constitutional crisis.",
      "Polity questions test institutional thinking: how do checks and balances actually function, fail, or evolve under pressure?",
    ],
    recurringPattern: [
      "Parliamentary vs Presidential debate",
      "Federalism — cooperative, competitive, fiscal tensions",
      "Judicial overreach vs judicial restraint",
      "Constitutional amendment process and its limits",
      "Governor's role and partisan use of office",
    ],
    howUPSCAsks: [
      "Often poses institutional dysfunction as the starting point",
      "'Examine', 'analyse', 'critically evaluate' — not 'describe'",
      "Short questions with deep analytical demand — 250 words but 3 dimensions expected",
      "Comparative frame: India vs other democracies, pre-vs-post constitutional change",
    ],
    answerArchitecture: [
      "Constitutional foundation — original design and intent",
      "How the institution/provision functions in practice",
      "Tensions, deviations, and recent cases",
      "Reform directions and constitutional balance",
      "Crisp conclusion with position",
    ],
    hiddenDimensions: [
      "Democratic accountability and electoral linkage",
      "Separation of powers and checks-and-balances logic",
      "Federalism — fiscal vs legislative vs administrative asymmetry",
      "Judicial activism and its legitimacy boundary",
      "Constitutional morality vs popular morality",
    ],
    crossSubjectLinks: [
      { paper: "GS1", angle: "Historical roots of constitutional provisions, nationalist thought" },
      { paper: "GS3", angle: "Economic federalism, FRBM, GST Council tensions" },
      { paper: "Essay", angle: "Democracy, constitutionalism, rights, judicial independence" },
      { paper: "Ethics", angle: "Constitutional ethics, rule of law, abuse of office" },
    ],
    markLossTraps: [
      "Listing constitutional articles without analysis",
      "Ignoring recent Supreme Court judgements",
      "No federal dimension when federalism is implicit in the question",
      "Taking a one-sided view without acknowledging counter-arguments",
      "Not concluding with a reform or institutional improvement angle",
    ],
  },
  {
    id: "Governance",
    icon: "🏛️",
    color: T.purple,
    colorDim: `${T.purple}18`,
    colorBorder: `${T.purple}30`,
    mentorLine: "Governance questions are not about listing schemes — they are about the state-citizen interface.",
    setterLogic: [
      "UPSC tests whether the aspirant understands governance as a delivery system — where does it work, where does it fail, and why?",
      "It looks for systemic thinking: policy design → implementation → accountability → outcome.",
    ],
    recurringPattern: [
      "E-governance and digital delivery of services",
      "RTI, transparency, and accountability mechanisms",
      "Civil service reforms — lateral entry, performance, neutrality",
      "Role of SHGs and grassroots governance",
      "Decentralisation — 73rd/74th amendments in practice",
    ],
    howUPSCAsks: [
      "Questions often embed a governance failure and ask for causes + solutions",
      "Multi-level analysis expected: centre, state, local, civil society",
      "Frequently asks about 'effectiveness' — not just existence of a scheme or law",
      "Current affairs anchor is common: RTI amendments, lateral entry debate, CAG reports",
    ],
    answerArchitecture: [
      "Frame the governance challenge clearly",
      "Analyse institutional structures responsible",
      "Identify implementation gaps with examples",
      "Accountability and transparency dimensions",
      "Reform pathway — short-term, structural",
    ],
    hiddenDimensions: [
      "Last-mile delivery failures in welfare schemes",
      "Political interference vs administrative independence",
      "Citizen charter, grievance redressal, feedback loops",
      "Public-private partnership governance gaps",
      "Technology as governance enabler — and its exclusion risks",
    ],
    crossSubjectLinks: [
      { paper: "GS2 Polity", angle: "Constitutional mandate for local bodies, administrative laws" },
      { paper: "GS3", angle: "Digital India, fintech governance, disaster management systems" },
      { paper: "GS4", angle: "Administrative ethics, probity, conflict of interest" },
      { paper: "Essay", angle: "Good governance, citizen-state relationship, accountability" },
    ],
    markLossTraps: [
      "Describing schemes without analysing gaps or outcomes",
      "No accountability dimension — who is responsible and to whom",
      "Ignoring the decentralisation angle in local governance questions",
      "Not distinguishing between policy failure and implementation failure",
      "Generic 'technology will solve it' answer without systemic reasoning",
    ],
  },
  {
    id: "Social Justice",
    icon: "🤝",
    color: T.teal,
    colorDim: `${T.teal}18`,
    colorBorder: `${T.teal}30`,
    mentorLine: "Social Justice in GS2 is tested through rights, institutions, and welfare gaps — not compassion.",
    setterLogic: [
      "UPSC does not want emotional appeals — it wants structural analysis of why groups remain excluded despite welfare architecture.",
      "Social Justice questions test whether you can connect constitutional rights, policy intent, and ground-level inequality.",
    ],
    recurringPattern: [
      "Women — MGNREGA, SHGs, political reservation, safety",
      "SC/ST — reservation debate, atrocities, land rights, mobility",
      "Health and education as rights — NHM, RTE gaps",
      "Poverty — SECC data, DBT, targeting vs universalism",
      "Child labour, trafficking, bonded labour — welfare-rights interface",
    ],
    howUPSCAsks: [
      "Questions rarely just ask about a scheme — they probe whether schemes address structural exclusion",
      "Often asks 'to what extent', 'critically examine effectiveness', 'challenges in implementation'",
      "Intersectional framing expected: gender + caste + region + disability",
      "Rights-based approach vs charity/welfare approach is a recurring implicit frame",
    ],
    answerArchitecture: [
      "Define the structural issue — who is excluded and why systemically",
      "Constitutional and legal framework addressing it",
      "Existing welfare architecture and its reach",
      "Gaps: targeting errors, awareness, corruption, social barriers",
      "Reform or rights-based solution",
    ],
    hiddenDimensions: [
      "Universalism vs targeting debate in welfare programmes",
      "Social barriers beyond economic poverty — stigma, discrimination, mobility",
      "Institutional capacity at state and local level",
      "Rights-based vs needs-based framing of welfare",
      "Intergenerational poverty and structural lock-in",
    ],
    crossSubjectLinks: [
      { paper: "GS1 Society", angle: "Caste, gender, urbanisation, social change context" },
      { paper: "GS3", angle: "MGNREGA, skill development, financial inclusion, food security" },
      { paper: "GS4", angle: "Compassionate administration, inclusive leadership" },
      { paper: "Essay", angle: "Equity, justice, development paradox, excluded voices" },
    ],
    markLossTraps: [
      "Listing government schemes without analysing outcomes or gaps",
      "Treating social justice as only a caste issue — ignoring gender, disability, tribal dimensions",
      "Not using data or specific programme names to anchor claims",
      "Confusing welfare charity with rights-based entitlements",
      "No institutional accountability dimension",
    ],
  },
  {
    id: "International Relations",
    icon: "🌐",
    color: T.amber,
    colorDim: `${T.amber}18`,
    colorBorder: `${T.amber}30`,
    mentorLine: "IR in GS2 rewards strategic thinking — not diplomatic trivia.",
    setterLogic: [
      "UPSC uses IR to test whether the aspirant understands India's strategic interests and how they interact with global power shifts.",
      "It is not testing memory of agreements or summits — it is testing geopolitical reasoning.",
    ],
    recurringPattern: [
      "India-China — LAC, BRI, trade imbalance, multilateral settings",
      "India-USA — defence, tech, diaspora, strategic partnership",
      "India's neighbourhood — SAARC, bilateral strains, connectivity",
      "Multilateralism — UN reforms, WTO, climate negotiations",
      "India's soft power — diaspora, cultural diplomacy, development aid",
    ],
    howUPSCAsks: [
      "Questions blend strategic interest + current event + India's foreign policy principle",
      "Often asks: what should India do? — expecting a calibrated, multi-angled answer",
      "Comparative framing: India vs China in Africa, India vs Pakistan in SCO",
      "Abstract concepts: strategic autonomy, non-alignment 2.0, neighbourhood first",
    ],
    answerArchitecture: [
      "India's strategic interest or principle at stake",
      "Historical and current relationship context",
      "Competing pressures or opportunities",
      "India's response — policy options, strengths, constraints",
      "Way forward with India's national interest as anchor",
    ],
    hiddenDimensions: [
      "Economic interdependence vs strategic rivalry tensions",
      "Multilateral forum bargaining and coalition-building",
      "Diaspora as soft power and foreign policy tool",
      "Regional connectivity vs sovereignty concerns",
      "Energy security and geopolitics linkage",
    ],
    crossSubjectLinks: [
      { paper: "GS3", angle: "Energy security, trade policy, defence procurement, technology transfer" },
      { paper: "GS2 Polity", angle: "Parliament's role in foreign policy, executive autonomy" },
      { paper: "Essay", angle: "Global order, India's rise, multilateralism, sovereignty" },
      { paper: "Current Affairs", angle: "G20, SCO, QUAD, ASEAN, BRICS — India's current positions" },
    ],
    markLossTraps: [
      "Listing agreements and summits without strategic analysis",
      "Writing IR as current affairs reportage, not policy reasoning",
      "Ignoring domestic political constraints on foreign policy",
      "Not anchoring to India's national interest clearly",
      "Binary framing — good/bad partner — without nuance",
    ],
  },
];

const DIRECTIVES = [
  {
    word: "Discuss",
    color: T.amber,
    expects: "Broad coverage across multiple dimensions with organized, reasoned explanation. Not just description.",
    style: "Write 3–5 dimensions. Balance breadth with analytical depth. Avoid surface listing.",
  },
  {
    word: "Analyse",
    color: T.blue,
    expects: "Break the issue into constituent parts. Explain relationships among them. Show why and how — structure and logic first.",
    style: "Use cause-effect or dimension-based structure. Show internal relationships. Avoid mere enumeration.",
  },
  {
    word: "Critically Examine",
    color: T.purple,
    expects: "Argument + limitation. Strengths + weaknesses. A balanced, reasoned judgement. Not blind criticism or blind praise.",
    style: "Give both sides equal analytical weight. End with a synthesized verdict. Don't fence-sit.",
  },
  {
    word: "Explain",
    color: T.teal,
    expects: "Clarity of concept, mechanism/process, and directness. Usually less debate, more precision.",
    style: "Define → Process → Outcome. Avoid debate/evaluation unless it emerges naturally from the concept.",
  },
  {
    word: "Comment",
    color: T.rose,
    expects: "Brief but sharp judgement. Interpretive maturity with concise supporting argument. Do not over-expand like 'Discuss'.",
    style: "2–3 tight paragraphs. Take a clear position and defend it briefly. Precision over volume.",
  },
];

const SILENT_CHECKS = [
  { icon: "⚖️", text: "Can you move from constitutional provision to institutional reality — not just quote, but reason?" },
  { icon: "🔗", text: "Can you connect welfare policy to rights framework without conflating the two?" },
  { icon: "🇮🇳", text: "Can you anchor IR analysis in India's strategic interests, not just global events?" },
  { icon: "⏱️", text: "Can you structure a coherent answer under strict time pressure with clear sub-headings?" },
  { icon: "🧩", text: "Can you avoid listing and write analytically — cause, mechanism, consequence, reform?" },
  { icon: "⚖️", text: "Can you balance institutional design against implementation reality?" },
  { icon: "👁️", text: "Do the dimensions of your answer reveal governance imagination and policy maturity?" },
];

const INTERLINKS = [
  { from: "Polity", to: "GS4", angle: "Constitutional ethics, rule of law, conflict of interest in public office", icon: "↔" },
  { from: "Governance", to: "GS3", angle: "Digital infrastructure, PPP, disaster governance, fiscal accountability", icon: "↔" },
  { from: "Social Justice", to: "GS1 Society", angle: "Caste, gender, structural inequality — root causes of welfare gaps", icon: "↔" },
  { from: "International Relations", to: "GS3", angle: "Trade, energy security, defence procurement, tech transfer", icon: "↔" },
  { from: "GS2", to: "Essay", angle: "Democracy, accountability, inclusion, India's global role, rights vs welfare", icon: "↔" },
];

// ─── Year-wise Trend Data ─────────────────────────────────────────────────────
const TREND_DATA = [
  {
    id: "Polity",
    icon: "⚖️",
    color: T.blue,
    colorDim: `${T.blue}18`,
    colorBorder: `${T.blue}30`,
    phases: [
      { range: "2013–2015", note: "Descriptive questions on constitutional provisions. 'Explain the role of X'. Low analytical demand — definition and features acceptable." },
      { range: "2016–2018", note: "Shift to institutional functioning. Questions began asking about deviations from constitutional intent. Judicial activism debates entered the paper." },
      { range: "2019–2021", note: "Critical institutional analysis. UPSC started asking about constitutional morality, majoritarian pressures, and federal tensions explicitly." },
      { range: "2022–2024", note: "Precision-demand questions. Short word count, deep analytical expectation. Candidates must demonstrate constitutional reasoning, not just knowledge of provisions." },
    ],
    repeatedZones: [
      "Parliament — functioning, productivity, disruption, privilege",
      "Federalism — GST council, governor's role, fiscal transfers",
      "Judiciary — judicial review, PIL, collegium, appointment",
      "President vs Governor — discretionary power use",
      "Anti-defection law — loopholes and reforms",
      "Fundamental rights vs DPSP tension",
    ],
    demandShift: "GS2 Polity moved from textbook constitutional knowledge to analytical evaluation of institutional functioning. Post-2018, UPSC expects candidates to engage with recent SC judgements and constitutional crises.",
    setterTrend: "Setter consistently embeds a constitutional tension — federalism vs centralisation, judicial activism vs restraint, executive dominance vs legislative oversight. Candidates must identify the tension and reason about it.",
    answerImplication: "Never open with an Article number. Open with the constitutional principle or institutional tension at stake. Each paragraph should carry one analytical argument. Close with a position on institutional reform.",
    practiceFocus: [
      "Governor's role — recent controversies and constitutional limits",
      "Anti-defection law — loopholes, reforms, Tenth Schedule cases",
      "GST council — cooperative federalism model and tensions",
      "Judicial collegium vs government in appointment controversy",
    ],
  },
  {
    id: "Governance",
    icon: "🏛️",
    color: T.purple,
    colorDim: `${T.purple}18`,
    colorBorder: `${T.purple}30`,
    phases: [
      { range: "2013–2015", note: "Scheme-listing format. Questions asked about what a programme does. RTI, e-governance described at surface level. Procedural answers passed." },
      { range: "2016–2018", note: "Effectiveness questions emerged. UPSC began asking whether schemes achieve their objectives — not just what they are. CAG findings, NITI Aayog reports referenced." },
      { range: "2019–2021", note: "Systemic failure framing. Why does good policy fail at implementation? Questions on last-mile delivery, state capacity, and grievance redressal dominated." },
      { range: "2022–2024", note: "Reform precision demanded. UPSC asks for specific institutional improvements. Technology governance, civil service neutrality, and decentralisation reform are recurring." },
    ],
    repeatedZones: [
      "E-governance — DBT, Digital India, Aadhaar, exclusion risks",
      "RTI Act — use, misuse, information commission backlog",
      "Civil services — lateral entry, annual confidential report, transfers",
      "Local bodies — 3Fs: funds, functions, functionaries",
      "Social audit — MGNREGA model and spread",
      "Grievance redressal — CPGRAMS, citizen charters, ombudsman",
    ],
    demandShift: "Governance questions evolved from 'what is this programme' to 'why does it underperform'. UPSC now expects candidates to demonstrate systemic understanding — policy-implementation-accountability chain.",
    setterTrend: "Setter prefers questions that expose the gap between policy design and ground-level outcomes. Questions on RTI, SHGs, and 73rd/74th amendments appear almost every year — setter expects fresh angles, not rote answers.",
    answerImplication: "Do not begin with scheme history. Begin with the governance challenge. Each answer needs an accountability paragraph — who is responsible and what mechanism enforces it. Close with structural reform, not technology fix.",
    practiceFocus: [
      "RTI — information asymmetry and why commissions lag",
      "73rd/74th amendments — why 3Fs remain incomplete",
      "Civil service reforms — lateral entry and political neutrality debate",
      "E-governance — JAM Trinity and financial exclusion risks",
    ],
  },
  {
    id: "Social Justice",
    icon: "🤝",
    color: T.teal,
    colorDim: `${T.teal}18`,
    colorBorder: `${T.teal}30`,
    phases: [
      { range: "2013–2015", note: "Issue description format. List challenges faced by women/SCs/tribals. Scheme names expected as answer. Little structural analysis required." },
      { range: "2016–2018", note: "Rights-based framing emerged. Questions began asking about entitlements vs charity, constitutional rights vs welfare discretion." },
      { range: "2019–2021", note: "Intersectional demand. Gender + caste + class + region. Structural barriers expected — not just scheme gaps. Rights as a mechanism for accountability." },
      { range: "2022–2024", note: "Outcome-focused. UPSC asks: despite decades of welfare, why do outcomes remain poor? Systemic explanation expected — not scheme listing or moral advocacy." },
    ],
    repeatedZones: [
      "Women — self-help groups, reservation, workforce participation, safety",
      "SC/ST — reservation debate, atrocity act, land rights, mobility",
      "Minorities — rights, representation, education, minority institutions",
      "Health equity — NHM, Ayushman Bharat, access gaps",
      "Education — RTE implementation, dropout, quality deficit",
      "Child welfare — child labour, ICDS, trafficking",
    ],
    demandShift: "Social Justice questions moved from scheme description to structural analysis. UPSC now expects candidates to identify why entitlements don't reach excluded groups — institutional, social, and systemic barriers.",
    setterTrend: "Setter uses data paradoxes — 'India ranks X on HDI despite Y growth' or 'scheme covers Z million yet exclusion persists'. Candidate must explain the paradox analytically, not just describe the scheme.",
    answerImplication: "Do not list schemes as an answer. Each paragraph should address one structural barrier — institutional, social, geographic, financial. Always include a rights-based framing. Conclude with accountability and reform, not charity.",
    practiceFocus: [
      "MGNREGA — why wages remain low and leakage persists",
      "Women's political reservation — numbers vs substantive representation",
      "SC/ST atrocities — under-reporting and institutional response gaps",
      "Ayushman Bharat — coverage vs quality of care debate",
    ],
  },
  {
    id: "International Relations",
    icon: "🌐",
    color: T.amber,
    colorDim: `${T.amber}18`,
    colorBorder: `${T.amber}30`,
    phases: [
      { range: "2013–2015", note: "Summit and agreement based. 'What is SAARC?', 'India-US defence pact significance'. Factual knowledge with light analysis. Current affairs anchor dominant." },
      { range: "2016–2018", note: "Strategic reasoning entered. UPSC began asking about India's strategic interests, challenges of non-alignment, China's BRI implications. Policy framing expected." },
      { range: "2019–2021", note: "Geopolitical complexity demanded. Questions on India-China-US triangle, neighbourhood tensions, multilateral forum bargaining. No clear-cut answers expected." },
      { range: "2022–2024", note: "Strategic autonomy as core frame. UPSC expects candidates to reason about India's independent foreign policy choices in a multipolar world. Nuance over loyalty." },
    ],
    repeatedZones: [
      "India-China — LAC, BRI, BRICS, SCO balancing",
      "India-USA — QUAD, defence, technology, diaspora",
      "India-Russia — S-400, oil trade, shifting alignment",
      "South Asia — SAARC paralysis, BBIN, neighbourhood first",
      "UN reform — UNSC seat, peacekeeping, India's position",
      "India's soft power — ITEC, cultural diplomacy, Yoga/Ayurveda",
    ],
    demandShift: "IR moved from factual recall to strategic reasoning. Post-2018, UPSC expects candidates to evaluate India's foreign policy choices, identify strategic dilemmas, and reason about national interest in a multipolar setting.",
    setterTrend: "Setter prefers questions that place India at the intersection of two competing forces — China's rise vs US pressure, energy security vs climate commitments, neighbourhood ties vs sovereignty protection. Candidate must navigate, not pick a side.",
    answerImplication: "Open with India's strategic interest at stake. Every paragraph should analyse a dimension — historical, economic, security, multilateral. Avoid diplomatic euphemism. Conclude with India's policy direction anchored in national interest.",
    practiceFocus: [
      "India-China: beyond the border dispute — trade, BRI, multilateral competition",
      "QUAD — significance, India's calibration, China's response",
      "India-Russia: balancing in post-Ukraine multipolar world",
      "India in BRICS, G20, SCO — strategic multilateralism",
    ],
  },
];

// ─── Year-wise Full Test Panel ────────────────────────────────────────────────
function YearTestPanel({ questions, onStart }) {
  const pyqOnly = questions.filter(q => q.source === "PYQ" && q.year);
  const years = [...new Set(pyqOnly.map(q => q.year))].sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = React.useState(null);

  const yearQs = selectedYear ? pyqOnly.filter(q => q.year === selectedYear) : [];
  const totalMarks = yearQs.reduce((s, q) => s + (q.marks || 0), 0);

  return (
    <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.25s ease" }}>
      <div style={{
        background: "linear-gradient(135deg, #0d1a0d 0%, #0a110a 100%)",
        border: `1px solid ${T.green}33`, borderRadius: 16,
        padding: "24px 28px", marginBottom: 20,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -60, right: -40,
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${T.green}10 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ ...label11(T.green), marginBottom: 8 }}>Year-wise Practice</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
          Full Year Test
        </h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 540, lineHeight: 1.6 }}>
          Pick a year and practice <em style={{ color: T.text }}>all its questions</em> as a simulated paper.
        </p>

        {years.length === 0 ? (
          <div style={{ fontSize: 12, color: T.muted }}>No PYQ year data available.</div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {years.map(y => {
              const cnt = pyqOnly.filter(q => q.year === y).length;
              const active = selectedYear === y;
              return (
                <button
                  key={y}
                  onClick={() => setSelectedYear(prev => prev === y ? null : y)}
                  style={{
                    background: active ? T.green : T.surface,
                    border: `1.5px solid ${active ? T.green : T.borderMid}`,
                    borderRadius: 10, padding: "10px 16px",
                    cursor: "pointer", fontFamily: T.font,
                    textAlign: "center", transition: "all 0.12s",
                    minWidth: 72, position: "relative",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, color: active ? "#09090b" : T.textBright }}>{y}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: active ? "#09090b" : T.green, marginTop: 2 }}>
                    {cnt} Qs
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedYear && (
        <div>
          <div style={{
            padding: "16px 18px",
            background: T.surface, border: `1px solid ${T.green}33`,
            borderRadius: 12, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.textBright }}>UPSC GS2 — {selectedYear} Paper</div>
                <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
                  {yearQs.length} question{yearQs.length !== 1 ? "s" : ""}
                  {totalMarks > 0 && ` · ${totalMarks} marks total`} · Practice one by one in order
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[10, 15].map(m => {
                  const mc = yearQs.filter(q => q.marks === m).length;
                  if (!mc) return null;
                  return (
                    <span key={m} style={{
                      fontSize: 11, fontWeight: 700, color: T.amber,
                      background: `${T.amber}10`, border: `1px solid ${T.amber}28`,
                      borderRadius: 20, padding: "3px 12px",
                    }}>
                      {mc} × {m}M
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {yearQs.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: T.muted, fontSize: 13 }}>
              No questions found for {selectedYear}.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {yearQs.map((q, idx) => (
                <div key={q.id || idx} style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: 12, overflow: "hidden",
                }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${T.green}88, transparent)` }} />
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: T.dim,
                        background: T.surfaceHigh, border: `1px solid ${T.border}`,
                        borderRadius: 5, padding: "2px 8px",
                      }}>Q{idx + 1}</span>
                      {q.marks != null && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: T.textBright,
                          background: T.bg, border: `1px solid ${T.borderMid}`,
                          borderRadius: 5, padding: "2px 9px",
                        }}>{q.marks}M</span>
                      )}
                      {q.theme && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: ACCENT,
                          background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`,
                          borderRadius: 5, padding: "2px 9px", textTransform: "uppercase",
                          letterSpacing: "0.05em", marginLeft: "auto",
                        }}>{q.theme}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textBright, lineHeight: 1.7, marginBottom: 14 }}>
                      {q.question}
                    </div>
                    <button
                      onClick={() => onStart(q)}
                      style={{
                        background: T.green, color: "#09090b",
                        border: "none", borderRadius: 8,
                        fontWeight: 900, fontSize: 12,
                        padding: "9px 20px", cursor: "pointer",
                        fontFamily: T.font, letterSpacing: "0.04em",
                        boxShadow: `0 0 14px ${T.green}28`,
                      }}
                    >
                      ✏️&nbsp;&nbsp;Start Writing
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Year-wise Trends Panel ───────────────────────────────────────────────────
function YearwiseTrendsPanel({ questions }) {
  const [openId, setOpenId] = useState(null);

  const pyqOnly = questions.filter(q => q.source === "PYQ" && q.year);
  const years   = pyqOnly.map(q => q.year).filter(Boolean);
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const yearSpan = (minYear && maxYear && minYear !== maxYear) ? `${minYear}–${maxYear}` : (maxYear || "—");
  const perTheme = THEMES.map(t => ({
    ...t,
    count: questions.filter(q => q.theme === t.id && q.source === "PYQ").length,
    color: TREND_DATA.find(d => d.id === t.id)?.color || T.blue,
  }));

  return (
    <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.25s ease" }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: "linear-gradient(135deg, #000d1a 0%, #000811 100%)",
        border: `1px solid ${T.blue}33`, borderRadius: 16,
        padding: "24px 28px", marginBottom: 24,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -60, right: -40,
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${T.blue}10 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ ...label11(T.blue), marginBottom: 8 }}>Trend Intelligence Layer</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
          GS2 Year-wise PYQ Trends
        </h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 560, lineHeight: 1.6 }}>
          How question style, demand, and setter preferences <em style={{ color: T.text }}>evolved across exam years</em> — and what that means for your preparation now.
        </p>

        {questions.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{
              background: T.surface, border: `1px solid ${T.borderMid}`,
              borderRadius: 10, padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <div>
                <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>Year Span</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.blue, lineHeight: 1 }}>{yearSpan}</div>
              </div>
            </div>
            <div style={{
              background: T.surface, border: `1px solid ${T.borderMid}`,
              borderRadius: 10, padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>📊</span>
              <div>
                <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>Total PYQs</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.green, lineHeight: 1 }}>{pyqOnly.length}</div>
              </div>
            </div>
            {perTheme.map(t => (
              <div key={t.id} style={{
                background: T.surface, border: `1px solid ${T.borderMid}`,
                borderRadius: 10, padding: "8px 14px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: t.color, lineHeight: 1 }}>{t.count}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TREND_DATA.map(data => {
          const isOpen = openId === data.id;
          return (
            <div key={data.id} style={{
              border: `1px solid ${isOpen ? data.colorBorder : T.border}`,
              borderRadius: 16, overflow: "hidden",
              background: T.surface, transition: "border-color 0.15s ease",
            }}>
              <button
                onClick={() => setOpenId(prev => prev === data.id ? null : data.id)}
                style={{
                  width: "100%", background: "none", border: "none",
                  borderBottom: isOpen ? `1px solid ${data.colorBorder}` : "none",
                  padding: "16px 22px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14,
                  fontFamily: T.font, textAlign: "left",
                }}
              >
                <span style={{
                  fontSize: 20, width: 38, height: 38,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: data.colorDim, borderRadius: 9,
                }}>{data.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: data.color, marginBottom: 1 }}>{data.id}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>Year-wise evolution · Repeated zones · Setter trends</div>
                </div>
                <span style={{
                  fontSize: 15, color: data.color,
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}>›</span>
              </button>

              {isOpen && (
                <div style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div style={{ ...label11(data.color), marginBottom: 12 }}>① Year-wise Evolution</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.phases.map((p, i) => (
                        <div key={i} style={{
                          display: "flex", gap: 14,
                          background: T.surfaceHigh, borderRadius: 10, padding: "12px 14px",
                          border: `1px solid ${T.border}`,
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 800, color: data.color,
                            background: data.colorDim, border: `1px solid ${data.colorBorder}`,
                            borderRadius: 6, padding: "3px 9px", flexShrink: 0,
                            alignSelf: "flex-start", marginTop: 1, letterSpacing: "0.04em",
                          }}>{p.range}</span>
                          <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>{p.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px",
                    border: `1px solid ${T.border}`,
                  }}>
                    <div style={{ ...label11(data.color), marginBottom: 10 }}>② Repeated Zones</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {data.repeatedZones.map((z, i) => (
                        <span key={i} style={{
                          fontSize: 11.5, color: T.text,
                          background: data.colorDim, border: `1px solid ${data.colorBorder}`,
                          borderRadius: 6, padding: "4px 11px",
                        }}>{z}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                      <div style={{ ...label11(data.color), marginBottom: 8 }}>③ Demand Shift</div>
                      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{data.demandShift}</p>
                    </div>
                    <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                      <div style={{ ...label11(data.color), marginBottom: 8 }}>④ Setter Trend</div>
                      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{data.setterTrend}</p>
                    </div>
                    <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                      <div style={{ ...label11(data.color), marginBottom: 8 }}>⑤ Answer Implication</div>
                      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{data.answerImplication}</p>
                    </div>
                    <div style={{ background: `${T.blue}08`, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.blue}28` }}>
                      <div style={{ ...label11(T.blue), marginBottom: 10 }}>⑥ Practice Focus</div>
                      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                        {data.practiceFocus.map((f, i) => (
                          <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{ color: T.blue, fontSize: 11, flexShrink: 0, marginTop: 2 }}>▸</span>
                            <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const label11 = (color = T.subtle) => ({
  fontSize: 11, fontWeight: 700, letterSpacing: "0.11em",
  textTransform: "uppercase", color,
});

// ─── Bullet list ──────────────────────────────────────────────────────────────
function BulletList({ items, color = T.dim, dot = "›" }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{dot}</span>
          <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Theme analysis block ─────────────────────────────────────────────────────
function ThemeAnalysisBlock({ data, questions }) {
  const [open, setOpen] = useState(false);
  const count = questions.filter(q => q.theme === data.id).length;

  return (
    <div style={{ border: `1px solid ${data.colorBorder}`, borderRadius: 16, overflow: "hidden", background: T.surface }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "none", border: "none",
          borderBottom: open ? `1px solid ${data.colorBorder}` : "none",
          padding: "18px 22px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 14,
          fontFamily: T.font, textAlign: "left",
        }}
      >
        <span style={{
          fontSize: 22, width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: data.colorDim, borderRadius: 10,
        }}>{data.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: data.color, marginBottom: 2 }}>{data.id} — Setter Intelligence</div>
          <div style={{ fontSize: 11, color: T.dim }}>7-layer UPSC pattern analysis</div>
        </div>
        {count > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: data.color,
            background: data.colorDim, border: `1px solid ${data.colorBorder}`,
            borderRadius: 20, padding: "4px 12px",
          }}>{count} Qs</span>
        )}
        <span style={{ fontSize: 16, color: data.color, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>›</span>
      </button>

      {open && (
        <div style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{
            background: data.colorDim, border: `1px solid ${data.colorBorder}`,
            borderLeft: `3px solid ${data.color}`, borderRadius: 8, padding: "12px 16px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: data.color, fontStyle: "italic", lineHeight: 1.6 }}>
              "{data.mentorLine}"
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>① Setter Logic</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.setterLogic.map((l, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{l}</p>
                ))}
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>② Recurring Ask Pattern</div>
              <BulletList items={data.recurringPattern} color={data.color} dot="▸" />
            </div>
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>③ Demand Decoder</div>
              <BulletList items={data.howUPSCAsks} color={T.dim} />
            </div>
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>④ Answer Architecture</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                {data.answerArchitecture.map((s, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>{s}</li>
                ))}
              </ol>
            </div>
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>⑤ Hidden Dimensions</div>
              <BulletList items={data.hiddenDimensions} color={data.color} dot="◆" />
            </div>
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>⑥ Cross-Paper Links</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.crossSubjectLinks.map((link, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: data.color,
                      background: data.colorDim, border: `1px solid ${data.colorBorder}`,
                      borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginTop: 1,
                      letterSpacing: "0.06em",
                    }}>{link.paper}</span>
                    <span style={{ fontSize: 12, color: T.text, lineHeight: 1.55 }}>{link.angle}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: `${T.red}08`, border: `1px solid ${T.red}28`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ ...label11(T.red), marginBottom: 10 }}>⑦ Mark-Loss Traps</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.markLossTraps.map((trap, i) => (
                <span key={i} style={{
                  fontSize: 11.5, color: T.text,
                  background: `${T.red}0c`, border: `1px solid ${T.red}28`,
                  borderRadius: 6, padding: "5px 12px", lineHeight: 1.5,
                }}>✗ {trap}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Directive card ───────────────────────────────────────────────────────────
function DirectiveCard({ d }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `2px solid ${d.color}`, borderRadius: 12, padding: "18px 20px",
      flex: "1 1 200px",
    }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: d.color, marginBottom: 8, fontStyle: "italic" }}>{d.word}</div>
      <div style={{ ...label11(T.subtle), marginBottom: 6 }}>UPSC Expects</div>
      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, margin: "0 0 12px 0" }}>{d.expects}</p>
      <div style={{ ...label11(T.subtle), marginBottom: 6 }}>Answer Style</div>
      <p style={{ fontSize: 12, color: T.dim, lineHeight: 1.6, margin: 0 }}>{d.style}</p>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ label, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...label11(T.dim), marginBottom: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: T.subtle, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// ─── PYQ Analysis Panel ───────────────────────────────────────────────────────
function PYQAnalysisPanel({ questions }) {
  const themeCounts = THEMES.map(t => ({
    ...t,
    count: questions.filter(q => q.theme === t.id).length,
    color: THEME_ANALYSIS.find(a => a.id === t.id)?.color || T.blue,
  }));

  return (
    <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.25s ease" }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        background: "linear-gradient(135deg, #00091a 0%, #000611 100%)",
        border: `1px solid ${ACCENT}33`, borderRadius: 16,
        padding: "24px 28px", marginBottom: 28,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -60, right: -40,
          width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ ...label11(ACCENT), marginBottom: 8 }}>Intelligence Layer</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
          GS2 PYQ Analysis
        </h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 560, lineHeight: 1.6 }}>
          What UPSC is <em style={{ color: T.text }}>really</em> testing — setter logic, demand decoding, answer architecture, and where aspirants lose marks.
        </p>

        {questions.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {themeCounts.map(t => (
              <div key={t.id} style={{
                background: T.surface, border: `1px solid ${T.border}`,
                borderRadius: 10, padding: "8px 14px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: t.color, lineHeight: 1 }}>{t.count}</div>
                </div>
              </div>
            ))}
            <div style={{
              background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`,
              borderRadius: 10, padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 14 }}>📊</span>
              <div>
                <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>Total PYQs</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>
                  {questions.filter(q => q.source === "PYQ").length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionHeading label="1 · Theme Intelligence" sub="Expand each block to see all 7 analysis layers — setter logic to mark-loss traps." />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {THEME_ANALYSIS.map(data => (
            <ThemeAnalysisBlock key={data.id} data={data} questions={questions} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionHeading label="2 · Directive Intelligence" sub="What 'Discuss', 'Analyse', 'Critically examine' actually demand from you." />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {DIRECTIVES.map(d => <DirectiveCard key={d.word} d={d} />)}
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <SectionHeading label="3 · What UPSC is Silently Checking" sub="The invisible evaluation dimensions that separate a 12-mark answer from a 7-mark answer." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
          {SILENT_CHECKS.map((c, i) => (
            <div key={i} style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: "14px 18px",
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>{c.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <SectionHeading label="4 · Interlink Opportunities" sub="How to enrich GS2 answers by borrowing intelligently from other papers." />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INTERLINKS.map((link, i) => (
            <div key={i} style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 12, padding: "14px 20px",
              display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: ACCENT,
                  background: `${ACCENT}12`, border: `1px solid ${ACCENT}28`,
                  borderRadius: 6, padding: "3px 10px",
                }}>{link.from}</span>
                <span style={{ fontSize: 16, color: T.dim }}>{link.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: T.blue,
                  background: `${T.blue}12`, border: `1px solid ${T.blue}28`,
                  borderRadius: 6, padding: "3px 10px",
                }}>{link.to}</span>
              </div>
              <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, flex: 1, minWidth: 200 }}>{link.angle}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Theme card ───────────────────────────────────────────────────────────────
function ThemeCard({ theme, active, onClick }) {
  const selected = active === theme.id;
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 140px",
        background: selected ? `${ACCENT}12` : T.surface,
        border: selected ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`,
        borderRadius: 12, padding: "14px 16px",
        cursor: "pointer", fontFamily: T.font,
        textAlign: "left", transition: "all 0.12s ease",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{theme.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: selected ? ACCENT : T.textBright, marginBottom: 4 }}>
        {theme.label}
      </div>
      <div style={{ fontSize: 11, color: T.dim, lineHeight: 1.45 }}>{theme.desc}</div>
    </button>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────
function QuestionCard({ q, onStart }) {
  const themeLabel = THEMES.find(t => t.id === q.theme)?.label || q.theme;

  const [questionState, setQuestionState] = React.useState({
    hasAttempt: false, hasSavedAnswer: false,
    hasExternalReview: false, hasProcessedReview: false,
  });

  React.useEffect(() => {
    try {
      const attempts = JSON.parse(localStorage.getItem("mains_answer_attempts_v1") || "[]");
      const matchingAttempt = attempts.find(a =>
        a.question?.substring(0, 50) === q.question?.substring(0, 50)
      );
      if (matchingAttempt) {
        setQuestionState({
          hasAttempt: true, hasSavedAnswer: !!matchingAttempt.answerText,
          hasExternalReview: false, hasProcessedReview: false,
        });
      }
    } catch (e) {}
  }, [q.question]);

  const { hasSavedAnswer, hasProcessedReview } = questionState;

  const renderButtons = () => {
    if (hasProcessedReview) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => onStart(q)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em" }}>
            👁 View Review
          </button>
          <button onClick={() => onStart(q)} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, fontWeight: 600, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>
            🔄 Redo
          </button>
          <button onClick={() => onStart(q)} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, fontWeight: 600, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>
            📚 Mistakes
          </button>
        </div>
      );
    }
    if (hasSavedAnswer) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => onStart(q)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em" }}>
            ✏️ Continue Attempt
          </button>
          <button onClick={() => onStart(q)} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, fontWeight: 600, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>
            🤖 Review Now
          </button>
        </div>
      );
    }
    return (
      <button onClick={() => onStart(q)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em", boxShadow: `0 0 16px ${ACCENT}28` }}>
        ✏️&nbsp;&nbsp;Start Writing
      </button>
    );
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${ACCENT}88, transparent)` }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: T.green, background: `${T.green}14`, border: `1px solid ${T.green}33`, borderRadius: 5, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>PYQ</span>
          {q.year && (
            <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 9px" }}>UPSC {q.year}</span>
          )}
          {getMarksBadge(q) && (
            <span style={{ fontSize: 11, fontWeight: 800, color: T.textBright, background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 5, padding: "2px 9px" }}>{getMarksBadge(q)}</span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`, borderRadius: 5, padding: "2px 9px", letterSpacing: "0.05em", textTransform: "uppercase", marginLeft: "auto" }}>
            {themeLabel}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.textBright, lineHeight: 1.7, marginBottom: q.subparts?.length ? 10 : 14 }}>{q.question}</div>
        {q.subparts && q.subparts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {q.subparts.map((sp, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: ACCENT,
                  background: `${ACCENT}12`, border: `1px solid ${ACCENT}28`,
                  borderRadius: 4, padding: "1px 7px", flexShrink: 0, marginTop: 2,
                }}>({sp.label})</span>
                <span style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>{sp.question}</span>
              </div>
            ))}
          </div>
        )}
        {q.focus && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12, marginBottom: 16 }}>
            <span style={{ ...label11(ACCENT), fontSize: 9, flexShrink: 0, marginTop: 1 }}>Focus</span>
            <span style={{ fontSize: 12, color: T.dim, lineHeight: 1.5 }}>{q.focus}</span>
          </div>
        )}
        {renderButtons()}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ height: 12, width: "30%", borderRadius: 6, background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`, marginBottom: 14 }} />
          <div style={{ height: 16, width: "90%", borderRadius: 6, background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`, marginBottom: 8 }} />
          <div style={{ height: 16, width: "70%", borderRadius: 6, background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", border: `1px solid ${T.red}33`, borderRadius: 14, background: `${T.red}08` }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>Failed to load questions</div>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 18 }}>{message}</div>
      <button onClick={onRetry} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 20px", cursor: "pointer", fontFamily: T.font }}>
        Retry
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsGS2Page() {
  const navigate = useNavigate();

  const [questions,     setQuestions]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [activeTheme,   setActiveTheme]   = useState("all");
  const [markFilter,    setMarkFilter]    = useState("all");
  const [sourceFilter,  setSourceFilter]  = useState("all");
  const [showAnalysis,  setShowAnalysis]  = useState(false);
  const [showTrends,    setShowTrends]    = useState(false);
  const [showYearTest,  setShowYearTest]  = useState(false);

  // Normalize new clean-dataset fields to what the UI expects
  function normalizeQuestion(q) {
    return {
      ...q,
      theme:     q.theme     || q.subject  || "",
      source:    q.source    || "PYQ",
      focus:     q.focus     || "",
      structure: q.structure || "",
    };
  }

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mains/questions?paper=GS2`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unknown error");
      setQuestions((data.questions || []).map(normalizeQuestion));
    } catch (err) {
      setError(err.message || "Could not connect to backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchQuestions(); }, []);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (activeTheme !== "all" && q.theme !== activeTheme) return false;
      if (markFilter  !== "all" && String(q.marks) !== markFilter) return false;
      if (sourceFilter !== "all" && q.source !== sourceFilter) return false;
      return true;
    });
  }, [questions, activeTheme, markFilter, sourceFilter]);

  function normalizeQ(q) {
    return {
      id:             q.id || "",
      paper:          "GS2",
      year:           q.year || null,
      question:       q.question || "",
      marks:          q.marks != null ? String(q.marks) : "15",
      structure:      q.structure || "",
      focus:          q.focus || "",
      priority:       q.source === "PYQ" ? "UPSC PYQ · High Priority" : `${q.theme || ""} · Topic Practice`,
      subparts:       q.subparts || [],
      syllabusNodeId: q.nodeId || "",
    };
  }

  function handleStart(q) {
    const normList = filtered.map(normalizeQ);
    const idx = normList.findIndex(item => item.id && item.id === (q.id || ""));
    navigate("/mains/answer-writing", {
      state: {
        paper:          "GS2",
        mode:           q.source || "PYQ",
        year:           q.year || null,
        topic:          q.theme || "",
        syllabusNodeId: q.nodeId || "",
        questions:      idx >= 0 ? normList : [normalizeQ(q)],
        currentIndex:   idx >= 0 ? idx : 0,
      },
    });
  }

  function toggleTheme(id) {
    setActiveTheme(prev => (prev === id ? "all" : id));
  }

  const pyqCount   = questions.filter(q => q.source === "PYQ").length;
  const topicCount = questions.filter(q => q.source === "Topic").length;

  const yearsPresent = questions.map(q => q.year).filter(Boolean);
  const latestYear   = yearsPresent.length ? Math.max(...yearsPresent) : null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${T.border}`, padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 8,
        background: T.bg, position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate("/mains")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font }}>
          <span style={label11(T.subtle)}>Mains</span>
        </button>
        <span style={{ color: T.muted, fontSize: 11 }}>›</span>
        <span style={label11(ACCENT)}>General Studies II</span>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto" }}>

        {/* ── Hero header ─────────────────────────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${T.surface} 0%, ${T.surfaceHigh} 100%)`,
          border: `1px solid ${T.borderMid}`, borderRadius: 16,
          padding: "28px 32px", marginBottom: 28, position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
            background: `linear-gradient(180deg, ${ACCENT}, ${ACCENT}44)`,
            borderRadius: "14px 0 0 14px",
          }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ ...label11(ACCENT), marginBottom: 8 }}>GS Paper II</div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                General Studies II
              </h1>
              <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px 0", lineHeight: 1.6, maxWidth: 520 }}>
                Polity, Governance, Social Justice &amp; International Relations — select a theme or question below.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {loading ? (
                  <span style={{ fontSize: 11, color: T.dim }}>Loading questions…</span>
                ) : error ? (
                  <span style={{ fontSize: 11, color: T.red }}>Could not load count</span>
                ) : (
                  [
                    { label: `${questions.length} Questions`, color: T.textBright },
                    { label: `${pyqCount} PYQs`,              color: T.green },
                    { label: latestYear ? `Latest: ${latestYear}` : "No year data", color: ACCENT },
                  ].map(p => (
                    <span key={p.label} style={{
                      fontSize: 11, fontWeight: 700, color: p.color,
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 20, padding: "4px 12px",
                    }}>{p.label}</span>
                  ))
                )}
              </div>
            </div>

            {/* Intelligence toggle buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignSelf: "flex-start", flexShrink: 0 }}>
              <button
                onClick={() => { setShowAnalysis(s => !s); setShowTrends(false); setShowYearTest(false); }}
                style={{
                  background: showAnalysis ? ACCENT : T.surfaceHigh,
                  color: showAnalysis ? "#fff" : ACCENT,
                  border: `1.5px solid ${ACCENT}${showAnalysis ? "ff" : "55"}`,
                  borderRadius: 10, fontWeight: 800, fontSize: 12.5,
                  padding: "10px 20px", cursor: "pointer",
                  fontFamily: T.font, letterSpacing: "0.03em",
                  boxShadow: showAnalysis ? `0 0 20px ${ACCENT}30` : "none",
                  transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 15 }}>🧠</span>
                {showAnalysis ? "Hide Analysis" : "PYQ Analysis"}
              </button>
              <button
                onClick={() => { setShowTrends(s => !s); setShowAnalysis(false); setShowYearTest(false); }}
                style={{
                  background: showTrends ? T.blue : T.surfaceHigh,
                  color: showTrends ? "#fff" : T.blue,
                  border: `1.5px solid ${T.blue}${showTrends ? "ff" : "55"}`,
                  borderRadius: 10, fontWeight: 800, fontSize: 12.5,
                  padding: "10px 20px", cursor: "pointer",
                  fontFamily: T.font, letterSpacing: "0.03em",
                  boxShadow: showTrends ? `0 0 20px ${T.blue}30` : "none",
                  transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 15 }}>📈</span>
                {showTrends ? "Hide Trends" : "Year-wise Trends"}
              </button>
              <button
                onClick={() => { setShowYearTest(s => !s); setShowAnalysis(false); setShowTrends(false); }}
                style={{
                  background: showYearTest ? T.green : T.surfaceHigh,
                  color: showYearTest ? "#09090b" : T.green,
                  border: `1.5px solid ${T.green}${showYearTest ? "ff" : "55"}`,
                  borderRadius: 10, fontWeight: 800, fontSize: 12.5,
                  padding: "10px 20px", cursor: "pointer",
                  fontFamily: T.font, letterSpacing: "0.03em",
                  boxShadow: showYearTest ? `0 0 20px ${T.green}30` : "none",
                  transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 15 }}>📅</span>
                {showYearTest ? "Hide Year Test" : "Year-wise Test"}
              </button>
            </div>
          </div>
        </div>

        {/* ── PYQ Analysis Panel ───────────────────────────────────────────────── */}
        {showAnalysis && <PYQAnalysisPanel questions={questions} />}

        {/* ── Year-wise Trends Panel ───────────────────────────────────────────── */}
        {showTrends && <YearwiseTrendsPanel questions={questions} />}

        {/* ── Year-wise Full Test Panel ────────────────────────────────────────── */}
        {showYearTest && <YearTestPanel questions={questions} onStart={handleStart} />}

        {/* ── Theme cards ──────────────────────────────────────────────────────── */}
        <div style={{ ...label11(T.subtle), marginBottom: 12 }}>Filter by Theme</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={() => setActiveTheme("all")}
            style={{
              flex: "0 0 auto",
              background: activeTheme === "all" ? `${ACCENT}12` : T.surface,
              border: activeTheme === "all" ? `1.5px solid ${ACCENT}66` : `1px solid ${T.border}`,
              borderRadius: 12, padding: "10px 20px",
              cursor: "pointer", fontFamily: T.font,
              fontSize: 12, fontWeight: activeTheme === "all" ? 800 : 600,
              color: activeTheme === "all" ? ACCENT : T.dim,
            }}
          >
            All Themes
          </button>
          {THEMES.map(t => (
            <ThemeCard key={t.id} theme={t} active={activeTheme} onClick={() => toggleTheme(t.id)} />
          ))}
        </div>

        {/* ── Inline filters ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={label11(T.subtle)}>Filter:</div>

          <div style={{ display: "flex", gap: 6 }}>
            {["all", "10", "15"].map(m => (
              <button
                key={m}
                onClick={() => setMarkFilter(m)}
                style={{
                  padding: "5px 12px", borderRadius: 7,
                  border: markFilter === m ? `1.5px solid ${ACCENT}` : `1px solid ${T.borderMid}`,
                  background: markFilter === m ? `${ACCENT}15` : T.surface,
                  color: markFilter === m ? ACCENT : T.dim,
                  fontWeight: markFilter === m ? 800 : 500,
                  fontSize: 11, cursor: "pointer", fontFamily: T.font,
                }}
              >
                {m === "all" ? "All Marks" : `${m}M`}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 18, background: T.border }} />

          <div style={{ display: "flex", gap: 6 }}>
            {[{ v: "all", l: "All" }, { v: "PYQ", l: "PYQ Only" }].map(s => (
              <button
                key={s.v}
                onClick={() => setSourceFilter(s.v)}
                style={{
                  padding: "5px 12px", borderRadius: 7,
                  border: sourceFilter === s.v ? `1.5px solid ${T.purple}` : `1px solid ${T.borderMid}`,
                  background: sourceFilter === s.v ? `${T.purple}15` : T.surface,
                  color: sourceFilter === s.v ? T.purple : T.dim,
                  fontWeight: sourceFilter === s.v ? 800 : 500,
                  fontSize: 11, cursor: "pointer", fontFamily: T.font,
                }}
              >
                {s.l}
              </button>
            ))}
          </div>

          {!loading && !error && (
            <span style={{ fontSize: 11, color: T.muted, marginLeft: "auto" }}>
              {filtered.length} question{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ── Question list / states ───────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {!loading && error && <ErrorState message={error} onRetry={fetchQuestions} />}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map(q => <QuestionCard key={q.id} q={q} onStart={handleStart} />)}
          </div>
        )}

        {!loading && !error && questions.length > 0 && filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", border: `1px dashed ${T.borderMid}`, borderRadius: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions match this filter</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>Try changing the theme or marks filter above.</div>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", border: `1px dashed ${T.borderMid}`, borderRadius: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions loaded</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>Check that the tagged data files are present in the backend.</div>
          </div>
        )}

      </div>
    </div>
  );
}
