// src/pages/MainsGS3Page.jsx
// GS3 Question Selection Page — pre-flight screen before AnswerWritingPage
// Fetches real data from GET /api/mains/gs3/questions

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
  green:       "#22c55e",
  amber:       "#f59e0b",
  blue:        "#3b82f6",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  teal:        "#14b8a6",
  rose:        "#f43f5e",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const ACCENT = T.green;

// ─── GS3 Theme groups ─────────────────────────────────────────────────────────
const THEMES = [
  { id: "Economy",           label: "Economy",           icon: "📈",  desc: "Growth, Agriculture, Infrastructure, Budget, Banking" },
  { id: "Environment",       label: "Environment",       icon: "🌿",  desc: "Ecology, Biodiversity, Climate Change, Conservation" },
  { id: "Science & Tech",    label: "Science & Tech",    icon: "🔬",  desc: "Space, Biotech, Cyber, Defence, AI, IP Rights" },
  { id: "Internal Security", label: "Internal Security", icon: "🛡️",  desc: "Terrorism, Extremism, Disaster Management, Border" },
];

// ─── PYQ Analysis Data ────────────────────────────────────────────────────────
const THEME_ANALYSIS = [
  {
    id: "Economy",
    icon: "📈",
    color: T.amber,
    colorDim: `${T.amber}18`,
    colorBorder: `${T.amber}30`,
    mentorLine: "In GS3 Economy, UPSC tests policy reasoning — not GDP definitions.",
    setterLogic: [
      "UPSC does not want textbook economics — it wants policy-application thinking.",
      "Economy questions test whether the aspirant can link data, policy, institutional constraints, and reform pathways into one coherent answer.",
    ],
    recurringPattern: [
      "Agriculture — MSP, farm income, productivity, credit access",
      "Budget — fiscal deficit, subsidies, capital expenditure vs revenue",
      "Infrastructure — PPP, NIP, land acquisition bottlenecks",
      "Banking — NPAs, SARFAESI, fintech, financial inclusion",
      "Inclusive growth — inequality, job creation, informal sector",
    ],
    howUPSCAsks: [
      "Questions embed a policy tension — growth vs equity, centralisation vs federalism",
      "'Examine', 'critically evaluate', 'analyse challenges' — not 'define'",
      "Often uses contemporary data or schemes as the question anchor",
      "Short precise questions with a multi-dimensional analytical demand",
    ],
    answerArchitecture: [
      "Frame the economic challenge or policy context clearly",
      "Explain current policy/institutional mechanism",
      "Analyse implementation gaps and structural constraints",
      "Data points or scheme performance as evidence",
      "Reform pathway — incremental and structural",
    ],
    hiddenDimensions: [
      "Federalism in economic policy — states' fiscal autonomy",
      "Informal economy and its policy blind spots",
      "Agricultural distress as structural, not just cyclical",
      "Financial inclusion vs credit discipline tension",
      "Capital formation vs consumption demand debate",
    ],
    crossSubjectLinks: [
      { paper: "GS2", angle: "Economic federalism, DBT governance, NITI Aayog vs Planning Commission" },
      { paper: "GS1", angle: "Colonial deindustrialisation, land reforms post-independence" },
      { paper: "GS4", angle: "Ethics in resource allocation, corporate governance, subsidy targeting" },
      { paper: "Essay", angle: "Growth vs development, agrarian crisis, inequality, sustainability" },
    ],
    markLossTraps: [
      "Defining economic terms without applying them to the policy question",
      "Ignoring agricultural and rural dimensions in economy answers",
      "Not mentioning data or scheme outcomes as evidence",
      "Generic 'reforms are needed' without specifying what and why",
      "Missing the inequality or informal sector dimension",
    ],
  },
  {
    id: "Environment",
    icon: "🌿",
    color: T.teal,
    colorDim: `${T.teal}18`,
    colorBorder: `${T.teal}30`,
    mentorLine: "In GS3 Environment, UPSC tests the development-ecology tension — not species names.",
    setterLogic: [
      "UPSC does not test biodiversity encyclopaedia — it tests whether the aspirant understands environment as a governance challenge.",
      "Environment questions probe the interface: development vs conservation, growth vs sustainability, national vs global commitments.",
    ],
    recurringPattern: [
      "Climate change — INDCs, Paris Agreement, loss and damage",
      "Biodiversity — Convention on Biological Diversity, hotspots, invasive species",
      "Pollution — air, water, plastic — regulatory gaps",
      "Forest rights — FRA, tribal displacement, conservation vs livelihood",
      "Disaster management — NDMA, Sendai Framework, resilience",
    ],
    howUPSCAsks: [
      "Questions rarely test pure ecology — always a policy or governance angle",
      "Frames the tension: conservation vs development, national vs global",
      "Uses recent events: glacier retreat, coral bleaching, cyclone response",
      "Asks India's position in international climate negotiations",
    ],
    answerArchitecture: [
      "Define the environmental challenge with data/scale",
      "Explain the ecological mechanism or impact pathway",
      "Governance and policy response — national and international",
      "Development-conservation tension and trade-off",
      "Sustainable solution with equity and rights dimensions",
    ],
    hiddenDimensions: [
      "Tribal and forest community rights in conservation",
      "Climate finance and technology transfer North-South equity",
      "Urban ecology — heat islands, flooding, urban forests",
      "Soil and groundwater as invisible resource crises",
      "Environmental justice — who bears the cost of degradation",
    ],
    crossSubjectLinks: [
      { paper: "GS1 Geography", angle: "Climate variability, disasters, monsoon, resource distribution" },
      { paper: "GS2", angle: "Environmental governance, NGT, EIA, forest rights law" },
      { paper: "GS4", angle: "Intergenerational equity, ethics of climate action, corporate responsibility" },
      { paper: "Essay", angle: "Development vs ecology, climate justice, sustainability" },
    ],
    markLossTraps: [
      "Listing species or ecosystems without governance/policy angle",
      "Ignoring India's specific position in international agreements",
      "Not addressing development-conservation trade-off",
      "No equity or rights dimension in conservation answers",
      "Missing disaster management as part of environment portfolio",
    ],
  },
  {
    id: "Science & Tech",
    icon: "🔬",
    color: T.blue,
    colorDim: `${T.blue}18`,
    colorBorder: `${T.blue}30`,
    mentorLine: "In GS3 Sci & Tech, UPSC rewards application — what this technology means for India, not how it works.",
    setterLogic: [
      "UPSC is not testing engineering knowledge — it tests whether the aspirant understands technology as a policy, security, and equity challenge.",
      "Science & Tech questions probe India's capacity, vulnerabilities, and strategic interests in emerging technology domains.",
    ],
    recurringPattern: [
      "Space — ISRO milestones, commercial space, satellite applications",
      "Biotechnology — GMO debate, gene editing, pharma, biosafety",
      "Cyber security — threats, frameworks, data protection, critical infrastructure",
      "AI and data — digital governance, algorithmic bias, data sovereignty",
      "Defence technology — self-reliance, exports, DRDO, dual-use concerns",
    ],
    howUPSCAsks: [
      "Questions anchor technology to a policy or strategic implication",
      "India's readiness, strategic interest, or vulnerability is always expected",
      "Ethical, social, or equity dimension is frequently embedded",
      "Dual-use technology — civilian vs military — appears in many questions",
    ],
    answerArchitecture: [
      "Brief explanation of the technology (1–2 lines — not a tutorial)",
      "India's specific interest, capacity, or vulnerability",
      "Strategic or policy implications",
      "Opportunities for India — indigenous development, export, application",
      "Risks, ethical concerns, or governance gaps",
    ],
    hiddenDimensions: [
      "Technology as a sovereignty question — data localisation, dual-use",
      "Equity of technology access — digital divide, rural gaps",
      "IP rights and international technology transfer constraints",
      "Ethical governance of AI, gene editing, surveillance tech",
      "Defence-civilian technology blurring — DRDO, startups, dual-use",
    ],
    crossSubjectLinks: [
      { paper: "GS2", angle: "Cybersecurity governance, data protection law, space policy" },
      { paper: "GS3 Economy", angle: "Digital economy, fintech, platform regulation, startup ecosystem" },
      { paper: "GS4", angle: "Ethics of AI, genetic engineering, surveillance, tech equity" },
      { paper: "Essay", angle: "Technology and society, digital divide, innovation and inequality" },
    ],
    markLossTraps: [
      "Writing a technology explainer without India-specific policy angle",
      "Ignoring security or strategic implications",
      "No equity or access dimension for India's development context",
      "Over-praising technology without addressing risks or governance gaps",
      "Ignoring India's indigenous development capacity or constraints",
    ],
  },
  {
    id: "Internal Security",
    icon: "🛡️",
    color: T.red,
    colorDim: `${T.red}18`,
    colorBorder: `${T.red}30`,
    mentorLine: "Internal Security in GS3 demands strategic clarity — not emotional nationalism.",
    setterLogic: [
      "UPSC tests whether the aspirant understands security as a governance challenge, not just a threat.",
      "It expects analysis of causes, institutional response gaps, civil liberties trade-offs, and sustainable security strategies.",
    ],
    recurringPattern: [
      "Left-wing extremism — causes, SAMADHAN doctrine, development linkage",
      "Terrorism — cross-border, funding, counter-terrorism architecture",
      "Border management — fencing, technology, trans-border crime",
      "Cyber threats — critical infrastructure, state-sponsored attacks",
      "Organised crime — money laundering, drug trafficking, nexus with politics",
    ],
    howUPSCAsks: [
      "Questions embed the security-civil liberties tension — rarely single-dimensional",
      "Causes → institutional gaps → policy response → long-term strategy expected",
      "India's specific geography and neighbourhood context is always relevant",
      "Often links development deficits to security challenges",
    ],
    answerArchitecture: [
      "Define the security threat with its specific characteristics",
      "Root causes — structural, economic, political, ideological",
      "Institutional response — central agencies, state capacity, coordination",
      "Gaps in current approach — rights, intelligence, rehabilitation",
      "Sustainable security strategy — development + governance + deterrence",
    ],
    hiddenDimensions: [
      "Security-development nexus — deprivation as recruitment ground",
      "Civil liberties vs security trade-off — UAPA, sedition, surveillance",
      "Inter-agency coordination failure as a systemic issue",
      "Rehabilitation and de-radicalisation as long-term strategy",
      "Neighbourhood security linkage — Myanmar, Bangladesh, Pakistan spillover",
    ],
    crossSubjectLinks: [
      { paper: "GS2", angle: "Constitutional provisions for security, NSA, UAPA, federal security coordination" },
      { paper: "GS3 Economy", angle: "Development deficit in conflict zones, infrastructure for security" },
      { paper: "GS4", angle: "Ethics of counter-terrorism, proportionate force, civil liberties" },
      { paper: "Essay", angle: "Security and freedom, state power, development and peace" },
    ],
    markLossTraps: [
      "Writing only about threats without analysing institutional response gaps",
      "Ignoring civil liberties dimension — security cannot be absolute",
      "No development-security nexus in LWE or insurgency answers",
      "Treating all security threats as identical — no specificity",
      "Missing inter-agency coordination as a recurring systemic failure",
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
  { icon: "📈", text: "Can you move from economic policy to ground-level impact — data to reality, not just theory?" },
  { icon: "🌿", text: "Can you frame environment answers as governance challenges, not ecology textbook chapters?" },
  { icon: "🔬", text: "Can you explain what a technology means for India's strategic interest in 2 sentences?" },
  { icon: "🛡️", text: "Can you analyse security threats without losing the civil liberties and development dimensions?" },
  { icon: "🧩", text: "Can you avoid listing and write analytically — cause, policy, gap, reform?" },
  { icon: "⚖️", text: "Can you balance national interest with global obligations in environment and security answers?" },
  { icon: "👁️", text: "Do the dimensions of your answer reveal policy maturity and systemic understanding?" },
];

const INTERLINKS = [
  { from: "Economy", to: "GS2", angle: "Economic federalism, DBT, NITI Aayog, financial inclusion governance", icon: "↔" },
  { from: "Environment", to: "GS1 Geo", angle: "Climate variability, resource distribution, disaster-prone zones", icon: "↔" },
  { from: "Science & Tech", to: "GS2 IR", angle: "Technology diplomacy, cyber sovereignty, space cooperation", icon: "↔" },
  { from: "Internal Security", to: "GS2", angle: "Constitutional provisions, UAPA, federal security coordination", icon: "↔" },
  { from: "GS3", to: "Essay", angle: "Development vs ecology, technology and society, security and freedom", icon: "↔" },
];

// ─── Year-wise Trend Data ─────────────────────────────────────────────────────
const TREND_DATA = [
  {
    id: "Economy",
    icon: "📈",
    color: T.amber,
    colorDim: `${T.amber}18`,
    colorBorder: `${T.amber}30`,
    phases: [
      { range: "2013–2015", note: "Definitional and scheme-based. Questions asked candidates to explain economic concepts or describe flagship schemes. Low analytical demand." },
      { range: "2016–2018", note: "Policy effectiveness questions emerged. UPSC began asking whether schemes achieve their objectives — growth outcomes, farm income, NPA resolution." },
      { range: "2019–2021", note: "Structural analysis expected. Questions on informal economy, agricultural distress as structural problem, fiscal federalism tensions. Data-backed answers required." },
      { range: "2022–2024", note: "Reform precision demanded. Questions probe specific institutional failure — why does India's manufacturing lag, why do farm incomes stagnate. Systemic explanations expected." },
    ],
    repeatedZones: [
      "MSP and farm income — adequacy, alternatives, procurement",
      "Infrastructure — land acquisition, PPP failures, NIP",
      "Banking — NPAs, recapitalisation, fintech disruption",
      "Inflation — food inflation, RBI tools, fiscal-monetary coordination",
      "Inclusive growth — informal sector, MGNREGA, job quality",
      "Budget — fiscal deficit, capital vs revenue expenditure debate",
    ],
    demandShift: "GS3 Economy moved from scheme description to policy analysis. UPSC now expects candidates to explain why policies underperform — structural, institutional, and political economy reasons.",
    setterTrend: "Setter consistently picks economy-governance interface questions — where policy design meets institutional delivery gap. Agricultural distress, NPA cycles, and infrastructure PPP failures appear cyclically.",
    answerImplication: "Never open with a GDP figure or scheme name. Open with the economic challenge or structural tension. Each paragraph should carry one analytical argument — not a list of scheme features. Conclude with reform logic.",
    practiceFocus: [
      "MSP — adequacy debate, procurement gaps, income support alternatives",
      "NPA cycle — causes, SARFAESI, resolution mechanisms",
      "Fiscal federalism — GST devolution, states' borrowing limits",
      "Infrastructure bottlenecks — land acquisition, private investment gap",
    ],
  },
  {
    id: "Environment",
    icon: "🌿",
    color: T.teal,
    colorDim: `${T.teal}18`,
    colorBorder: `${T.teal}30`,
    phases: [
      { range: "2013–2015", note: "Ecology-heavy questions. Biodiversity hotspots, ecosystem services, wildlife corridors. Factual recall with light governance dimension." },
      { range: "2016–2018", note: "Policy-governance frame entered. EIA process, NGT role, forest rights, climate commitments. India's position in global agreements began featuring." },
      { range: "2019–2021", note: "Development-conservation tension became central. Forest Rights Act vs conservation, climate finance equity, disaster governance. No longer just ecology." },
      { range: "2022–2024", note: "Rights and equity foreground. Who bears the cost of conservation? Climate justice, loss and damage, tribal displacement in protected areas. Multi-layered answers expected." },
    ],
    repeatedZones: [
      "Climate change — Paris Agreement, INDCs, loss and damage, India's position",
      "Biodiversity — CBD, hotspots, species conservation, invasive species",
      "Forest Rights Act — tribal vs conservation tension",
      "Pollution — air quality standards, plastic waste, river pollution",
      "Wetlands — Ramsar sites, urban encroachment, ecological services",
      "Disaster management — NDMA, Sendai Framework, climate-disaster nexus",
    ],
    demandShift: "Environment questions evolved from ecology to governance. UPSC now expects candidates to analyse why conservation policies fail — institutional, political economy, and rights-based reasons — not just describe ecosystems.",
    setterTrend: "Setter consistently embeds the development-conservation trade-off. A question on forests will expect tribal rights dimension. A question on climate will expect India's equity argument in international negotiations.",
    answerImplication: "Never write a nature documentary. Every environment answer needs a governance, rights, and equity paragraph. India's international negotiating position should be anchored in developmental equity, not just ecological concern.",
    practiceFocus: [
      "Forest Rights Act — implementation gaps and conservation conflict",
      "Paris Agreement — India's commitments, climate finance, loss and damage",
      "NGT — powers, effectiveness, judicial activism in environment",
      "Plastic waste — producer responsibility, informal sector recycling",
    ],
  },
  {
    id: "Science & Tech",
    icon: "🔬",
    color: T.blue,
    colorDim: `${T.blue}18`,
    colorBorder: `${T.blue}30`,
    phases: [
      { range: "2013–2015", note: "Technology awareness questions. 'What is nanotechnology?' Explanation-heavy, India relevance minimal. Current affairs anchor dominant." },
      { range: "2016–2018", note: "India's strategic interest entered. ISRO milestones, defence indigenisation, space applications for development. Policy dimension began appearing." },
      { range: "2019–2021", note: "Governance of technology emerged. AI regulation, data protection, cyber threats to critical infrastructure. Technology as policy challenge." },
      { range: "2022–2024", note: "Dual-use, sovereignty, and equity foreground. Questions on data localisation, algorithmic bias, gene-editing ethics, cyber sovereignty. Multi-dimensional answers required." },
    ],
    repeatedZones: [
      "Space — ISRO, commercial space policy, satellite navigation, space diplomacy",
      "Biotechnology — GMO, gene editing, biosafety protocols",
      "Cyber security — critical infrastructure, state-sponsored threats, CERT-In",
      "AI — governance, algorithmic decision-making, bias, data sovereignty",
      "Defence tech — Atmanirbhar Bharat, DRDO, defence exports",
      "Digital India — fintech, UPI, digital divide, data privacy",
    ],
    demandShift: "Sci & Tech questions moved from technology explanation to policy and strategic analysis. UPSC now expects candidates to evaluate India's strategic interests, vulnerabilities, and governance gaps in technology domains.",
    setterTrend: "Setter prefers questions at the technology-governance interface — where a technology creates a policy dilemma: AI and bias, gene editing and ethics, space and sovereignty. Purely technical answers score poorly.",
    answerImplication: "Never write a technology explainer. Open with India's strategic interest or policy challenge. Every S&T answer needs an India-specific angle — indigenous capacity, vulnerability, or equity of access.",
    practiceFocus: [
      "AI governance — India's draft framework, algorithmic bias, data sovereignty",
      "Space policy — commercial space, ISRO commercialisation, space debris",
      "Cybersecurity — critical infrastructure protection, CERT-In, state actors",
      "Gene editing — CRISPR regulation, biosafety, ethical frameworks",
    ],
  },
  {
    id: "Internal Security",
    icon: "🛡️",
    color: T.red,
    colorDim: `${T.red}18`,
    colorBorder: `${T.red}30`,
    phases: [
      { range: "2013–2015", note: "Threat description format. 'What is LWE?', 'Explain cross-border terrorism'. Factual answer with light policy dimension passed." },
      { range: "2016–2018", note: "Institutional response framing. Questions began asking about counter-terrorism architecture, intelligence sharing, border management weaknesses." },
      { range: "2019–2021", note: "Systemic analysis expected. SAMADHAN doctrine, development-security nexus, cyber threats as new security frontier. Causes + response + gap." },
      { range: "2022–2024", note: "Multi-dimensional security expected. Civil liberties trade-off, rehabilitation vs deterrence, neighbourhood dimension. Single-track 'security must win' answers score poorly." },
    ],
    repeatedZones: [
      "Left-wing extremism — SAMADHAN, development deficit, state capacity",
      "Terrorism — cross-border, funding networks, de-radicalisation",
      "Border security — Smart Fencing, trans-border crime, drug trafficking",
      "Cyber threats — critical infrastructure, state actors, CERT-In response",
      "Organised crime — money laundering, political nexus",
      "Disaster management — NDRF, state capacity, inter-agency coordination",
    ],
    demandShift: "Internal Security questions evolved from threat identification to systemic analysis. UPSC now expects candidates to explain why security challenges persist — institutional, developmental, and political economy reasons.",
    setterTrend: "Setter consistently embeds the security-development or security-rights tension. A question on LWE will expect the development deficit angle. A question on counter-terrorism will expect civil liberties trade-off analysis.",
    answerImplication: "Never write a threat catalogue. Open with the security challenge's root cause or structural dimension. Every answer needs: causes, institutional response gap, rights trade-off, and sustainable strategy — not just 'strong action needed'.",
    practiceFocus: [
      "LWE — SAMADHAN doctrine effectiveness and development-security nexus",
      "Cyber threats — critical infrastructure protection, India's preparedness",
      "Border management — technological surveillance and trans-border crime",
      "De-radicalisation — models, institutional support, rehabilitation success",
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
                    minWidth: 72,
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
            padding: "16px 18px", background: T.surface,
            border: `1px solid ${T.green}33`, borderRadius: 12, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.textBright }}>UPSC GS3 — {selectedYear} Paper</div>
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
                    }}>{mc} × {m}M</span>
                  );
                })}
              </div>
            </div>
          </div>

          {yearQs.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: T.muted, fontSize: 13 }}>No questions found for {selectedYear}.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {yearQs.map((q, idx) => (
                <div key={q.id || idx} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${T.green}88, transparent)` }} />
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: T.dim, background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 8px" }}>Q{idx + 1}</span>
                      {q.marks != null && (
                        <span style={{ fontSize: 11, fontWeight: 800, color: T.textBright, background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 5, padding: "2px 9px" }}>{q.marks}M</span>
                      )}
                      {q.theme && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`, borderRadius: 5, padding: "2px 9px", textTransform: "uppercase", letterSpacing: "0.05em", marginLeft: "auto" }}>{q.theme}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textBright, lineHeight: 1.7, marginBottom: 14 }}>{q.question}</div>
                    <button
                      onClick={() => onStart(q)}
                      style={{ background: T.green, color: "#09090b", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em", boxShadow: `0 0 14px ${T.green}28` }}
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
    color: TREND_DATA.find(d => d.id === t.id)?.color || T.green,
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
        <div style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${T.blue}10 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ ...label11(T.blue), marginBottom: 8 }}>Trend Intelligence Layer</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>GS3 Year-wise PYQ Trends</h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 560, lineHeight: 1.6 }}>
          How question style, demand, and setter preferences <em style={{ color: T.text }}>evolved across exam years</em> — and what that means for your preparation now.
        </p>

        {questions.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <div>
                <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>Year Span</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.blue, lineHeight: 1 }}>{yearSpan}</div>
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>📊</span>
              <div>
                <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>Total PYQs</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: T.green, lineHeight: 1 }}>{pyqOnly.length}</div>
              </div>
            </div>
            {perTheme.map(t => (
              <div key={t.id} style={{ background: T.surface, border: `1px solid ${T.borderMid}`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
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
            <div key={data.id} style={{ border: `1px solid ${isOpen ? data.colorBorder : T.border}`, borderRadius: 16, overflow: "hidden", background: T.surface, transition: "border-color 0.15s ease" }}>
              <button
                onClick={() => setOpenId(prev => prev === data.id ? null : data.id)}
                style={{ width: "100%", background: "none", border: "none", borderBottom: isOpen ? `1px solid ${data.colorBorder}` : "none", padding: "16px 22px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, fontFamily: T.font, textAlign: "left" }}
              >
                <span style={{ fontSize: 20, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", background: data.colorDim, borderRadius: 9 }}>{data.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: data.color, marginBottom: 1 }}>{data.id}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>Year-wise evolution · Repeated zones · Setter trends</div>
                </div>
                <span style={{ fontSize: 15, color: data.color, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>›</span>
              </button>

              {isOpen && (
                <div style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div style={{ ...label11(data.color), marginBottom: 12 }}>① Year-wise Evolution</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.phases.map((p, i) => (
                        <div key={i} style={{ display: "flex", gap: 14, background: T.surfaceHigh, borderRadius: 10, padding: "12px 14px", border: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: data.color, background: data.colorDim, border: `1px solid ${data.colorBorder}`, borderRadius: 6, padding: "3px 9px", flexShrink: 0, alignSelf: "flex-start", marginTop: 1, letterSpacing: "0.04em" }}>{p.range}</span>
                          <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>{p.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
                    <div style={{ ...label11(data.color), marginBottom: 10 }}>② Repeated Zones</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {data.repeatedZones.map((z, i) => (
                        <span key={i} style={{ fontSize: 11.5, color: T.text, background: data.colorDim, border: `1px solid ${data.colorBorder}`, borderRadius: 6, padding: "4px 11px" }}>{z}</span>
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
        style={{ width: "100%", background: "none", border: "none", borderBottom: open ? `1px solid ${data.colorBorder}` : "none", padding: "18px 22px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, fontFamily: T.font, textAlign: "left" }}
      >
        <span style={{ fontSize: 22, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: data.colorDim, borderRadius: 10 }}>{data.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: data.color, marginBottom: 2 }}>{data.id} — Setter Intelligence</div>
          <div style={{ fontSize: 11, color: T.dim }}>7-layer UPSC pattern analysis</div>
        </div>
        {count > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: data.color, background: data.colorDim, border: `1px solid ${data.colorBorder}`, borderRadius: 20, padding: "4px 12px" }}>{count} Qs</span>
        )}
        <span style={{ fontSize: 16, color: data.color, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>›</span>
      </button>

      {open && (
        <div style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: data.colorDim, border: `1px solid ${data.colorBorder}`, borderLeft: `3px solid ${data.color}`, borderRadius: 8, padding: "12px 16px" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: data.color, fontStyle: "italic", lineHeight: 1.6 }}>"{data.mentorLine}"</span>
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
                    <span style={{ fontSize: 9, fontWeight: 800, color: data.color, background: data.colorDim, border: `1px solid ${data.colorBorder}`, borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginTop: 1, letterSpacing: "0.06em" }}>{link.paper}</span>
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
                <span key={i} style={{ fontSize: 11.5, color: T.text, background: `${T.red}0c`, border: `1px solid ${T.red}28`, borderRadius: 6, padding: "5px 12px", lineHeight: 1.5 }}>✗ {trap}</span>
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
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${d.color}`, borderRadius: 12, padding: "18px 20px", flex: "1 1 200px" }}>
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
    color: THEME_ANALYSIS.find(a => a.id === t.id)?.color || T.green,
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
        background: "linear-gradient(135deg, #001a04 0%, #001108 100%)",
        border: `1px solid ${ACCENT}33`, borderRadius: 16,
        padding: "24px 28px", marginBottom: 28,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ ...label11(ACCENT), marginBottom: 8 }}>Intelligence Layer</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>GS3 PYQ Analysis</h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 560, lineHeight: 1.6 }}>
          What UPSC is <em style={{ color: T.text }}>really</em> testing — setter logic, demand decoding, answer architecture, and where aspirants lose marks.
        </p>

        {questions.length > 0 && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {themeCounts.map(t => (
              <div key={t.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>{t.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: t.color, lineHeight: 1 }}>{t.count}</div>
                </div>
              </div>
            ))}
            <div style={{ background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`, borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>📊</span>
              <div>
                <div style={{ fontSize: 10, color: T.dim, fontWeight: 600 }}>Total PYQs</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: ACCENT, lineHeight: 1 }}>{questions.filter(q => q.source === "PYQ").length}</div>
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
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>{c.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <SectionHeading label="4 · Interlink Opportunities" sub="How to enrich GS3 answers by borrowing intelligently from other papers." />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {INTERLINKS.map((link, i) => (
            <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, background: `${ACCENT}12`, border: `1px solid ${ACCENT}28`, borderRadius: 6, padding: "3px 10px" }}>{link.from}</span>
                <span style={{ fontSize: 16, color: T.dim }}>{link.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.blue, background: `${T.blue}12`, border: `1px solid ${T.blue}28`, borderRadius: 6, padding: "3px 10px" }}>{link.to}</span>
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
      <div style={{ fontSize: 13, fontWeight: 800, color: selected ? ACCENT : T.textBright, marginBottom: 4 }}>{theme.label}</div>
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
          <button onClick={() => onStart(q)} style={{ background: ACCENT, color: "#09090b", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em" }}>👁 View Review</button>
          <button onClick={() => onStart(q)} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, fontWeight: 600, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>🔄 Redo</button>
          <button onClick={() => onStart(q)} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, fontWeight: 600, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>📚 Mistakes</button>
        </div>
      );
    }
    if (hasSavedAnswer) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => onStart(q)} style={{ background: ACCENT, color: "#09090b", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em" }}>✏️ Continue Attempt</button>
          <button onClick={() => onStart(q)} style={{ background: "transparent", color: ACCENT, border: `1px solid ${ACCENT}44`, borderRadius: 8, fontWeight: 600, fontSize: 12, padding: "8px 16px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.03em" }}>🤖 Review Now</button>
        </div>
      );
    }
    return (
      <button onClick={() => onStart(q)} style={{ background: ACCENT, color: "#09090b", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 12, padding: "9px 20px", cursor: "pointer", fontFamily: T.font, letterSpacing: "0.04em", boxShadow: `0 0 16px ${ACCENT}28` }}>
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
          {q.marks != null && (
            <span style={{ fontSize: 11, fontWeight: 800, color: T.textBright, background: T.bg, border: `1px solid ${T.borderMid}`, borderRadius: 5, padding: "2px 9px" }}>{q.marks}M</span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`, borderRadius: 5, padding: "2px 9px", letterSpacing: "0.05em", textTransform: "uppercase", marginLeft: "auto" }}>{themeLabel}</span>
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
      <button onClick={onRetry} style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, fontWeight: 700, fontSize: 12, padding: "8px 20px", cursor: "pointer", fontFamily: T.font }}>Retry</button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsGS3Page() {
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

  // Map raw subject values from the clean dataset to GS3 theme IDs
  const GS3_SUBJECT_MAP = {
    "Economy":             "Economy",
    "ECONOMY":             "Economy",
    "Agriculture":         "Economy",
    "AGRICULTURE":         "Economy",
    "Environment":         "Environment",
    "ENVIRONMENT":         "Environment",
    "Science & Tech":      "Science & Tech",
    "Science & Technology":"Science & Tech",
    "SCIENCE_TECH":        "Science & Tech",
    "Internal Security":   "Internal Security",
    "INTERNAL_SECURITY":   "Internal Security",
    "Disaster Management": "Internal Security",
    "DISASTER_MANAGEMENT": "Internal Security",
  };

  function normalizeQuestion(q) {
    const theme = q.theme || GS3_SUBJECT_MAP[q.subject] || q.subject || "";
    return {
      ...q,
      theme,
      source:    q.source    || "PYQ",
      focus:     q.focus     || "",
      structure: q.structure || "",
    };
  }

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/mains/questions?paper=GS3`);
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

  // Dedupe by id (backend normalizes all 6 GS3 files; questionNumber is not in the output)
  const validQuestions = useMemo(() => {
    return Array.from(
      new Map((questions || []).map((q) => [q.id, q])).values()
    );
  }, [questions]);

  const filtered = useMemo(() => {
    return validQuestions.filter(q => {
      if (activeTheme !== "all" && q.theme !== activeTheme) return false;
      if (markFilter  !== "all" && String(q.marks) !== markFilter) return false;
      if (sourceFilter !== "all" && q.source !== sourceFilter) return false;
      return true;
    });
  }, [validQuestions, activeTheme, markFilter, sourceFilter]);

  function normalizeQ(q) {
    return {
      id:             q.id || "",
      paper:          "GS3",
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
        paper:          "GS3",
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

  const pyqCount    = validQuestions.filter(q => q.source === "PYQ").length;
  const yearsPresent = validQuestions.map(q => q.year).filter(Boolean);
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
        <span style={label11(ACCENT)}>General Studies III</span>
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
              <div style={{ ...label11(ACCENT), marginBottom: 8 }}>GS Paper III</div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                General Studies III
              </h1>
              <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px 0", lineHeight: 1.6, maxWidth: 520 }}>
                Economy, Environment, Science &amp; Tech &amp; Internal Security — select a theme or question below.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {loading ? (
                  <span style={{ fontSize: 11, color: T.dim }}>Loading questions…</span>
                ) : error ? (
                  <span style={{ fontSize: 11, color: T.red }}>Could not load count</span>
                ) : (
                  [
                    { label: `${validQuestions.length} Questions`, color: T.textBright },
                    { label: `${pyqCount} PYQs`,                   color: T.green },
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
                  color: showAnalysis ? "#09090b" : ACCENT,
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
        {showAnalysis && <PYQAnalysisPanel questions={validQuestions} />}

        {/* ── Year-wise Trends Panel ───────────────────────────────────────────── */}
        {showTrends && <YearwiseTrendsPanel questions={validQuestions} />}

        {/* ── Year-wise Full Test Panel ────────────────────────────────────────── */}
        {showYearTest && <YearTestPanel questions={validQuestions} onStart={handleStart} />}

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
