// src/pages/MainsGS1Page.jsx
// GS1 Question Selection Page — pre-flight screen before AnswerWritingPage
// Fetches from GET /api/mains/gs1/questions (PYQ) + /api/mains/gs1/topic-questions (Topic)
// Merges on the frontend; sourceFilter partitions the combined pool.

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
  amber:       "#f59e0b",
  amberDim:    "#d97706",
  blue:        "#3b82f6",
  green:       "#22c55e",
  red:         "#ef4444",
  purple:      "#8b5cf6",
  teal:        "#14b8a6",
  rose:        "#f43f5e",
  font:        "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
};

const ACCENT = T.amber;

// ─── GS1 Theme groups ─────────────────────────────────────────────────────────
const THEMES = [
  { id: "History",       label: "History",       icon: "🏛️",  desc: "Modern India, World History, Post-Independence" },
  { id: "Society",       label: "Society",        icon: "👥",  desc: "Diversity, Population, Urbanisation, Caste, Gender" },
  { id: "Geography",     label: "Geography",      icon: "🌍",  desc: "Physical, World Geography, Salient Features" },
  { id: "Art & Culture", label: "Art & Culture",  icon: "🎨",  desc: "Indian Art, Architecture, Performing Arts, Literature" },
];

// ─── PYQ Analysis Data ────────────────────────────────────────────────────────
const THEME_ANALYSIS = [
  {
    id: "History",
    icon: "🏛️",
    color: T.amber,
    colorDim: `${T.amber}18`,
    colorBorder: `${T.amber}30`,
    mentorLine: "In GS1 History, UPSC rewards interpretation, not storytelling.",
    setterLogic: [
      "UPSC is not testing whether the student knows history.",
      "It tests whether the student can convert historical processes into causation, continuity & change, consequences for society/nation-building, and relevance to modern India.",
    ],
    recurringPattern: [
      "Cause → Consequence",
      "Movement → Transformation",
      "Leader / Ideology → Long-term impact",
      "Colonial policy → Social / economic effect",
      "Global event → Indian implication",
    ],
    howUPSCAsks: [
      "What changed? Why did it change?",
      "Who was affected and how?",
      "How did it shape later developments?",
      "Rarely just chronology — always analytical demand.",
    ],
    answerArchitecture: [
      "Brief contextual opening (1–2 lines)",
      "3–5 analytical dimensions (causes / processes / actors)",
      "Effect across polity, economy, society, identity",
      "Balanced conclusion with historical significance",
    ],
    hiddenDimensions: [
      "Social impact beyond the event",
      "Economic restructuring and resource shifts",
      "Identity formation and consciousness",
      "Institutional consequences and legacy",
      "Relation to nationalism / modernity",
    ],
    crossSubjectLinks: [
      { paper: "GS2", angle: "Constitutionalism, nationalism, representative institutions" },
      { paper: "GS3", angle: "Deindustrialisation, resource drain, labour shifts" },
      { paper: "Essay", angle: "Modernity, reform, identity, freedom" },
      { paper: "Ethics", angle: "Moral courage of reformers / leadership character" },
    ],
    markLossTraps: [
      "Writing pure narrative without analysis",
      "Overloading dates and names",
      "No linkage between event and significance",
      "Not moving from event to 'so what?'",
      "Ignoring the long-term consequence dimension",
    ],
  },
  {
    id: "Society",
    icon: "👥",
    color: T.purple,
    colorDim: `${T.purple}18`,
    colorBorder: `${T.purple}30`,
    mentorLine: "GS1 Society is not answered by facts alone; it is answered by layered social understanding.",
    setterLogic: [
      "UPSC uses Society to test whether the aspirant understands India as a living social system — changing, unequal, layered, and contradictory.",
      "It is testing sociological maturity, not textbook reproduction.",
    ],
    recurringPattern: [
      "Women and empowerment",
      "Caste and identity tensions",
      "Family transformation and urbanisation",
      "Diversity, migration, and marginality",
      "Globalization and social change",
    ],
    howUPSCAsks: [
      "Questions are often abstract, layered, and value-loaded.",
      "They look short but demand concept + evidence + Indian context + balanced judgement.",
      "Multi-causal framing is expected even in brief questions.",
    ],
    answerArchitecture: [
      "Define the social process or issue precisely",
      "Explain 3–5 dimensions with Indian reality",
      "Support with contemporary examples",
      "Identify the contradiction or tension underneath",
      "Close with reform-oriented, nuanced way forward",
    ],
    hiddenDimensions: [
      "Class + caste + gender intersectionality",
      "Family structure linked to economy and migration",
      "Culture, identity, and state policy interplay",
      "Empowerment vs. structural constraints paradox",
    ],
    crossSubjectLinks: [
      { paper: "GS2", angle: "Welfare schemes, affirmative action, rights, institutions" },
      { paper: "GS3", angle: "Migration, urban economy, digital divide, labour changes" },
      { paper: "Essay", angle: "Women, diversity, modernity, social trust" },
      { paper: "Ethics", angle: "Dignity, inclusion, empathy, justice" },
    ],
    markLossTraps: [
      "Writing moral essays without analytical structure",
      "Being too generic — no Indian examples",
      "Using only one axis (gender but not caste/class)",
      "Overusing jargon without logical structure",
      "Ignoring contradictions within the social system",
    ],
  },
  {
    id: "Geography",
    icon: "🌍",
    color: T.teal,
    colorDim: `${T.teal}18`,
    colorBorder: `${T.teal}30`,
    mentorLine: "In GS1 Geography, UPSC rewards answers that move from phenomenon to implication.",
    setterLogic: [
      "UPSC does not want school-level geography.",
      "It wants geography as system thinking, process thinking, human-environment linkage, and application to India and the world.",
    ],
    recurringPattern: [
      "Climate and atmosphere mechanics",
      "Resources, distribution, and depletion",
      "Disasters, vulnerability, and resilience",
      "Water and food security",
      "Landforms and their human consequences",
      "Ecology linked with development pressures",
    ],
    howUPSCAsks: [
      "Concept + Mechanism",
      "Mechanism + Consequence",
      "Static knowledge + Current manifestation",
      "Physical process + Economic/Social impact",
    ],
    answerArchitecture: [
      "Define the concept briefly and precisely",
      "Explain the process or mechanism clearly",
      "Show regional or Indian manifestation",
      "Discuss consequences across sectors",
      "Suggest mitigation / management / sustainability angle",
    ],
    hiddenDimensions: [
      "Agriculture and food security linkage",
      "Livelihood and rural economy impact",
      "Urbanization and land-use pressure",
      "Disaster vulnerability mapping",
      "Climate resilience and adaptation discourse",
    ],
    crossSubjectLinks: [
      { paper: "GS3", angle: "Climate change, disaster management, resources, agriculture" },
      { paper: "GS2", angle: "Governance of disaster preparedness and water sharing" },
      { paper: "Essay", angle: "Sustainability, development vs ecology" },
      { paper: "Current Affairs", angle: "IMD, IPCC, floods, droughts, cyclone patterns" },
    ],
    markLossTraps: [
      "Writing only textbook definitions without application",
      "No India-specific angle",
      "Ignoring human and economic effects",
      "Drawing no process linkage",
      "Static answer to an inherently dynamic question",
    ],
  },
  {
    id: "Art & Culture",
    icon: "🎨",
    color: T.rose,
    colorDim: `${T.rose}18`,
    colorBorder: `${T.rose}30`,
    mentorLine: "In Art & Culture, examples are not decoration — they are proof of understanding.",
    setterLogic: [
      "UPSC is not testing memory of monuments or dynasties.",
      "It is testing whether the student understands culture as: civilizational continuity, artistic expression, social history, and identity formation.",
    ],
    recurringPattern: [
      "Architecture and sculpture across dynasties",
      "Literature and performing art traditions",
      "Bhakti / Sufi movements and their social impact",
      "Dynastic contributions and patronage",
      "Significance of cultural forms for heritage",
    ],
    howUPSCAsks: [
      "Questions appear static but demand feature identification + examples + significance.",
      "Cultural-historical context is always expected.",
      "Significance for Indian heritage or social change is a must.",
    ],
    answerArchitecture: [
      "Contextual opening (dynasty / era / socio-political backdrop)",
      "Core features or contributions",
      "2–4 concrete, specific examples",
      "Significance for heritage, social change, or cultural continuity",
      "Crisp conclusion",
    ],
    hiddenDimensions: [
      "Regional spread and decentralization of culture",
      "Patronage and state support structures",
      "Social impact and community transformation",
      "Philosophical and religious background",
      "Continuity into present heritage and UNESCO discourse",
    ],
    crossSubjectLinks: [
      { paper: "History", angle: "Dynastic and socio-political historical context" },
      { paper: "Essay", angle: "Culture and civilization, plurality, soft power" },
      { paper: "Ethics", angle: "Plurality, tolerance, spiritual traditions" },
      { paper: "Current Affairs", angle: "Heritage conservation, UNESCO, repatriation debates" },
    ],
    markLossTraps: [
      "Only listing names without describing features",
      "No concrete examples cited",
      "No significance attached to the cultural form",
      "Confusing chronology across dynasties",
      "Treating culture answers like objective bullet notes",
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
  { icon: "🎯", text: "Can you move from topic to pattern — not just recall, but recognize?" },
  { icon: "🔗", text: "Can you link static knowledge to present-day relevance without forcing it?" },
  { icon: "🇮🇳", text: "Can you bring Indian context without mechanically inserting current affairs?" },
  { icon: "⏱️", text: "Can you structure a coherent answer under strict time pressure?" },
  { icon: "🧩", text: "Can you avoid narrative and write analytically — causation, not chronology?" },
  { icon: "⚖️", text: "Can you balance breadth with sufficient focus and avoid over-generalization?" },
  { icon: "👁️", text: "Do the dimensions of your answer reveal a sociological/policy imagination?" },
];

const INTERLINKS = [
  { from: "History", to: "Society", angle: "Reform, caste mobility, women, nationalism, consciousness", icon: "↔" },
  { from: "Geography", to: "GS3", angle: "Climate, agriculture, disaster risk, resource distribution", icon: "↔" },
  { from: "Society", to: "GS2", angle: "Rights, social justice, welfare institutions, governance gaps", icon: "↔" },
  { from: "Art & Culture", to: "History", angle: "Dynasties, Bhakti/Sufi movements, civilizational continuity", icon: "↔" },
  { from: "GS1", to: "Essay", angle: "Identity, development, diversity, heritage, women, modernity", icon: "↔" },
];

// ─── Year-wise Trend Data ────────────────────────────────────────────────────
const TREND_DATA = [
  {
    id: "History",
    icon: "🏛️",
    color: T.amber,
    colorDim: `${T.amber}18`,
    colorBorder: `${T.amber}30`,
    phases: [
      { range: "2013–2015", note: "Heavily event and leader-based. 'Discuss the role of X' format dominated. Mostly descriptive with light analytical demand." },
      { range: "2016–2018", note: "Shift toward cause-consequence framing. Questions started asking 'why' and 'so what'. World History entries increased." },
      { range: "2019–2021", note: "Strong analytical demand — 'critically examine', 'to what extent', 'assess the legacy'. Social and economic history foregrounded." },
      { range: "2022–2024", note: "Consequence-forward questions. UPSC increasingly asks about long-term impact on nation-building, identity, and governance. Short questions with deep demand." },
    ],
    repeatedZones: [
      "Freedom struggle phases — Non-Cooperation, Civil Disobedience, Quit India",
      "Socio-religious reform movements — 19th century",
      "Impact of colonial economic policies — deindustrialisation, drain theory",
      "Role of Gandhi vs Ambedkar vs Nehru — differing visions",
      "World War consequences on Indian politics",
      "Post-independence consolidation — integration of princely states",
    ],
    demandShift: "Early GS1 History allowed narrative. Post-2018, UPSC demands clear causation chains, evaluation of historical actors, and linkage to contemporary India. Pure chronology now loses marks.",
    setterTrend: "Setter favours questions where candidates must compare or contrast — two movements, two leaders, two phases. Also prefers questions that force the candidate to cross the history–society boundary.",
    answerImplication: "Open with a sharp contextual frame, not a date. Each paragraph must carry one analytical argument, not one event. Conclude with what this means for India's present — constitutionalism, identity, social justice.",
    practiceFocus: [
      "Socio-economic impact of British policies",
      "Comparative analysis of nationalist leaders",
      "Freedom struggle and social reform intersection",
      "World History — industrial revolution, imperialism, cold war effects on India",
    ],
  },
  {
    id: "Society",
    icon: "👥",
    color: T.purple,
    colorDim: `${T.purple}18`,
    colorBorder: `${T.purple}30`,
    phases: [
      { range: "2013–2015", note: "Concrete, issue-based questions. Women's status, urbanisation, tribal rights. Format was often descriptive with a policy ask." },
      { range: "2016–2018", note: "Abstract conceptual framing appeared — 'social capital', 'multiculturalism', 'secularism and pluralism'. Required sociological vocabulary." },
      { range: "2019–2021", note: "Layered questions — intersectionality, contradictions within development. Gender + caste + class combined in single asks." },
      { range: "2022–2024", note: "Strongly contextual. Questions embed India-specific tensions. No pure sociology — always grounded in India's policy, data, and reality. Short word counts demand precision." },
    ],
    repeatedZones: [
      "Women — empowerment, patriarchy, labour participation, safety",
      "Caste — persistence, mobility, reservation debate, violence",
      "Globalization effects — social change, aspiration, inequality",
      "Urbanisation — migration, slums, civic access",
      "Population dynamics — demographic dividend, ageing, fertility",
      "Secularism and communalism in Indian context",
    ],
    demandShift: "Society went from 'describe the problem' to 'analyse the structure'. UPSC now expects candidates to identify contradictions, acknowledge systemic causes, avoid moralism, and propose grounded solutions.",
    setterTrend: "Setter prefers questions that reveal India's social paradoxes — high growth + persistent inequality, constitutional equality + structural hierarchy. Questions often carry value-weight but demand analytical response.",
    answerImplication: "Do not write a social essay. Write a sociological analysis. Define the problem structurally, dimension it across class-caste-gender axes, use data or scheme references as anchors, and close with a reform-logic conclusion.",
    practiceFocus: [
      "Women's economic and social empowerment — structural barriers",
      "Caste in post-liberalisation India",
      "India's demographic dividend vs challenge",
      "Globalisation and identity crisis among youth",
    ],
  },
  {
    id: "Geography",
    icon: "🌍",
    color: T.teal,
    colorDim: `${T.teal}18`,
    colorBorder: `${T.teal}30`,
    phases: [
      { range: "2013–2015", note: "Textbook-adjacent. Define + explain format. Climate zones, landforms, natural resources. Human geography limited." },
      { range: "2016–2018", note: "Applied geography emerged — disaster management, river disputes, resource distribution. Linkage to policy and economy increased." },
      { range: "2019–2021", note: "Process-oriented. Explain mechanism, then consequences. Social-geographic linkage expected. Disaster vulnerability, food security, climate resilience." },
      { range: "2022–2024", note: "Highly integrated. Physical geography as a lens — not a subject. Questions blend climate + agriculture + migration + security. Purely static answers now fail."},
    ],
    repeatedZones: [
      "Monsoon — variability, agriculture linkage, deficit/excess years",
      "Disaster risk — cyclones, floods, droughts, earthquake zones",
      "Mineral and energy resource distribution",
      "Water — river disputes, groundwater, watershed",
      "Climate change impact on India — coastal, agrarian, urban",
      "Geomorphic processes — types, consequences for settlement",
    ],
    demandShift: "Early geography questions accepted phenomenon + definition. Post-2018, UPSC expects: phenomenon → process → consequence → India-specific link → policy/adaptation angle. Five-step thinking minimum.",
    setterTrend: "Setter increasingly places physical geography into human consequence framing. A question on cyclones will expect Odisha model. A question on glaciers will expect Himalayan water security. Physical is never isolated.",
    answerImplication: "Never stop at defining or explaining the phenomenon. Every geography answer needs a consequence paragraph and an India-specific anchor. Close with adaptation, governance, or sustainability angle — not just description.",
    practiceFocus: [
      "Monsoon mechanism and recent variability patterns",
      "India's disaster-prone zones and preparedness gaps",
      "River water sharing — constitutional and ecological dimensions",
      "Climate change and food/water security nexus",
    ],
  },
  {
    id: "Art & Culture",
    icon: "🎨",
    color: T.rose,
    colorDim: `${T.rose}18`,
    colorBorder: `${T.rose}30`,
    phases: [
      { range: "2013–2015", note: "Feature and identify format. List features of X architecture. Name key texts of Y tradition. High factual load, low analysis." },
      { range: "2016–2018", note: "Significance layer added. Questions began asking 'what does this reflect about the society?' Regional culture foregrounded." },
      { range: "2019–2021", note: "Social history framing. Bhakti/Sufi as social reform movements, not just spiritual. Culture as identity and resistance. Examples mandatory." },
      { range: "2022–2024", note: "Interpretive and civilizational. Questions ask what cultural forms reveal about Indian continuity, pluralism, or composite heritage. One-liner factual answers clearly fail." },
    ],
    repeatedZones: [
      "Temple architecture — Nagara, Dravidian, Vesara; regional variations",
      "Bhakti and Sufi — social reform dimensions, key figures",
      "Sculptural evolution — Maurya to Gupta to medieval",
      "Classical performing arts — dance, music, theatre traditions",
      "Contributions of specific dynasties — Chola, Pallava, Gupta, Mughal",
      "Folk arts and living heritage — threats and protection",
    ],
    demandShift: "Art & Culture moved from encyclopaedic recall to interpretive analysis. UPSC now expects candidates to explain what a cultural form signifies — socially, politically, spiritually — not just describe its features.",
    setterTrend: "Setter increasingly expects the candidate to connect the cultural form to its social context: who patronised it, who was included/excluded, what values it reinforced or challenged. Culture as social history.",
    answerImplication: "Never write a list. Every A&C answer needs: context → features with embedded examples → significance sentences that interpret, not just state. The sentence 'this reflects India's composite heritage' is weak; explain how and why.",
    practiceFocus: [
      "Bhakti/Sufi as social reform — Kabir, Mirabai, Nizamuddin",
      "Temple architecture across regions with examples",
      "Sculptural schools — Mathura, Gandhara, Amaravati",
      "Folk art traditions — GI tags, threats, preservation policy",
    ],
  },
];

// ─── Year-wise Full Test Panel ────────────────────────────────────────────────
function YearTestPanel({ questions, onStart }) {
  const pyqOnly = questions.filter(q => q.source === "PYQ" && q.year);
  const years = [...new Set(pyqOnly.map(q => q.year))].sort((a, b) => b - a);
  const [selectedYear, setSelectedYear] = React.useState(null);

  const yearQs = selectedYear
    ? pyqOnly.filter(q => q.year === selectedYear)
    : [];

  const totalMarks = yearQs.reduce((s, q) => s + (q.marks || 0), 0);

  return (
    <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.25s ease" }}>
      {/* Panel header */}
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
          Pick a year and practice <em style={{ color: T.text }}>all its questions</em> as a simulated paper — one by one in exam order.
        </p>

        {/* Year selector grid */}
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
                  <div style={{ fontSize: 15, fontWeight: 900, color: active ? "#09090b" : T.textBright }}>
                    {y}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: active ? "#09090b" : T.green, marginTop: 2 }}>
                    {cnt} Qs
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected year question list */}
      {selectedYear && (
        <div>
          {/* Year test header */}
          <div style={{
            padding: "16px 18px",
            background: T.surface, border: `1px solid ${T.green}33`,
            borderRadius: 12, marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.textBright }}>
                  UPSC GS1 — {selectedYear} Paper
                </div>
                <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
                  {yearQs.length} question{yearQs.length !== 1 ? "s" : ""}
                  {totalMarks > 0 && ` · ${totalMarks} marks total`}
                  {" "}· Practice one by one in order
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
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12, overflow: "hidden",
                }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${T.green}88, transparent)` }} />
                  <div style={{ padding: "16px 20px" }}>
                    {/* Meta row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: T.dim,
                        background: T.surfaceHigh, border: `1px solid ${T.border}`,
                        borderRadius: 5, padding: "2px 8px",
                      }}>
                        Q{idx + 1}
                      </span>
                      {q.marks != null && (
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: T.textBright,
                          background: T.bg, border: `1px solid ${T.borderMid}`,
                          borderRadius: 5, padding: "2px 9px",
                        }}>
                          {q.marks}M
                        </span>
                      )}
                      {q.theme && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: ACCENT,
                          background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`,
                          borderRadius: 5, padding: "2px 9px", textTransform: "uppercase",
                          letterSpacing: "0.05em", marginLeft: "auto",
                        }}>
                          {q.theme}
                        </span>
                      )}
                    </div>
                    {/* Question text */}
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: T.textBright,
                      lineHeight: 1.7, marginBottom: 14,
                    }}>
                      {q.question}
                    </div>
                    {/* Start writing button */}
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

  // Live data strip — derived from real question pool
  const pyqOnly = questions.filter(q => q.source === "PYQ" && q.year);
  const years   = pyqOnly.map(q => q.year).filter(Boolean);
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const yearSpan = (minYear && maxYear && minYear !== maxYear) ? `${minYear}–${maxYear}` : (maxYear || "—");
  const perTheme = THEMES.map(t => ({
    ...t,
    count: questions.filter(q => q.theme === t.id && q.source === "PYQ").length,
    color: TREND_DATA.find(d => d.id === t.id)?.color || T.amber,
  }));

  return (
    <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.25s ease" }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Panel header */}
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
          GS1 Year-wise PYQ Trends
        </h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 560, lineHeight: 1.6 }}>
          How question style, demand, and setter preferences <em style={{ color: T.text }}>evolved across exam years</em> — and what that means for your preparation now.
        </p>

        {/* Live data strip */}
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

      {/* Subject blocks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {TREND_DATA.map(data => {
          const isOpen = openId === data.id;
          return (
            <div key={data.id} style={{
              border: `1px solid ${isOpen ? data.colorBorder : T.border}`,
              borderRadius: 16, overflow: "hidden",
              background: T.surface,
              transition: "border-color 0.15s ease",
            }}>
              {/* Collapsible header */}
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
                }}>
                  {data.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: data.color, marginBottom: 1 }}>
                    {data.id}
                  </div>
                  <div style={{ fontSize: 11, color: T.dim }}>Year-wise evolution · Repeated zones · Setter trends</div>
                </div>
                <span style={{
                  fontSize: 15, color: data.color,
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}>
                  ›
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* Phase timeline */}
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
                          }}>
                            {p.range}
                          </span>
                          <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>{p.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Repeated zones */}
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
                        }}>
                          {z}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom 4: 2-col grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>

                    <div style={{
                      background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px",
                      border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ ...label11(data.color), marginBottom: 8 }}>③ Demand Shift</div>
                      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{data.demandShift}</p>
                    </div>

                    <div style={{
                      background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px",
                      border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ ...label11(data.color), marginBottom: 8 }}>④ Setter Trend</div>
                      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{data.setterTrend}</p>
                    </div>

                    <div style={{
                      background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px",
                      border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ ...label11(data.color), marginBottom: 8 }}>⑤ Answer Implication</div>
                      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{data.answerImplication}</p>
                    </div>

                    <div style={{
                      background: `${T.blue}08`, borderRadius: 12, padding: "16px 18px",
                      border: `1px solid ${T.blue}28`,
                    }}>
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

// ─── Theme Card ───────────────────────────────────────────────────────────────
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

// ─── Question Card ────────────────────────────────────────────────────────────
function QuestionCard({ q, onStart }) {
  const sourceColor = q.source === "PYQ" ? T.green : T.amber;
  const themeLabel  = THEMES.find(t => t.id === q.theme)?.label || q.theme;

  // Check LocalStorage for attempt state
  const [questionState, setQuestionState] = React.useState({
    hasAttempt: false,
    hasSavedAnswer: false,
    hasExternalReview: false,
    hasProcessedReview: false,
  });

  React.useEffect(() => {
    try {
      const attempts = JSON.parse(localStorage.getItem("mains_answer_attempts_v1") || "[]");
      const matchingAttempt = attempts.find(a => 
        a.question?.substring(0, 50) === q.question?.substring(0, 50)
      );
      if (matchingAttempt) {
        setQuestionState({
          hasAttempt: true,
          hasSavedAnswer: !!matchingAttempt.answerText,
          hasExternalReview: false, // Would be set if we fetch from backend
          hasProcessedReview: false, // Would be set if we fetch from backend
        });
      }
    } catch (e) {
      // localStorage unavailable
    }
  }, [q.question]);

  const { hasAttempt, hasSavedAnswer, hasExternalReview, hasProcessedReview } = questionState;

  const renderButtons = () => {
    if (hasProcessedReview) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onStart(q)}
            style={{
              background: ACCENT, color: "#09090b",
              border: "none", borderRadius: 8,
              fontWeight: 900, fontSize: 12,
              padding: "9px 20px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.04em",
            }}
          >
            👁 View Review
          </button>
          <button
            onClick={() => onStart(q)}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}44`, borderRadius: 8,
              fontWeight: 600, fontSize: 12,
              padding: "8px 16px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.03em",
            }}
          >
            🔄 Redo
          </button>
          <button
            onClick={() => onStart(q)}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}44`, borderRadius: 8,
              fontWeight: 600, fontSize: 12,
              padding: "8px 16px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.03em",
            }}
          >
            📚 Mistakes
          </button>
        </div>
      );
    }

    if (hasSavedAnswer && !hasExternalReview) {
      return (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => onStart(q)}
            style={{
              background: ACCENT, color: "#09090b",
              border: "none", borderRadius: 8,
              fontWeight: 900, fontSize: 12,
              padding: "9px 20px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.04em",
            }}
          >
            ✏️ Continue Attempt
          </button>
          <button
            onClick={() => onStart(q)}
            style={{
              background: "transparent", color: ACCENT,
              border: `1px solid ${ACCENT}44`, borderRadius: 8,
              fontWeight: 600, fontSize: 12,
              padding: "8px 16px", cursor: "pointer",
              fontFamily: T.font, letterSpacing: "0.03em",
            }}
          >
            🤖 Review Now
          </button>
        </div>
      );
    }

    // Never attempted
    return (
      <button
        onClick={() => onStart(q)}
        style={{
          background: ACCENT, color: "#09090b",
          border: "none", borderRadius: 8,
          fontWeight: 900, fontSize: 12,
          padding: "9px 20px", cursor: "pointer",
          fontFamily: T.font, letterSpacing: "0.04em",
          boxShadow: `0 0 16px ${ACCENT}28`,
        }}
      >
        ✏️&nbsp;&nbsp;Start Writing
      </button>
    );
  };

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${ACCENT}88, transparent)` }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: sourceColor,
            background: `${sourceColor}14`, border: `1px solid ${sourceColor}33`,
            borderRadius: 5, padding: "2px 8px", letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {q.source}
          </span>
          {q.year && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: T.dim,
              background: T.bg, border: `1px solid ${T.border}`,
              borderRadius: 5, padding: "2px 9px",
            }}>
              UPSC {q.year}
            </span>
          )}
          {q.marks != null && (
            <span style={{
              fontSize: 11, fontWeight: 800, color: T.textBright,
              background: T.bg, border: `1px solid ${T.borderMid}`,
              borderRadius: 5, padding: "2px 9px",
            }}>
              {q.marks}M
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700, color: ACCENT,
            background: `${ACCENT}10`, border: `1px solid ${ACCENT}28`,
            borderRadius: 5, padding: "2px 9px", letterSpacing: "0.05em", textTransform: "uppercase",
            marginLeft: "auto",
          }}>
            {themeLabel}
          </span>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: T.textBright,
          lineHeight: 1.7, marginBottom: q.subparts?.length ? 10 : 14,
        }}>
          {q.question}
        </div>
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
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            borderTop: `1px solid ${T.border}`, paddingTop: 12, marginBottom: 16,
          }}>
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
        <div key={i} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: "18px 20px",
        }}>
          <div style={{
            height: 12, width: "30%", borderRadius: 6,
            background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`,
            marginBottom: 14,
          }} />
          <div style={{
            height: 16, width: "90%", borderRadius: 6,
            background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`,
            marginBottom: 8,
          }} />
          <div style={{
            height: 16, width: "70%", borderRadius: 6,
            background: `linear-gradient(90deg, ${T.muted}33, ${T.borderMid}33, ${T.muted}33)`,
          }} />
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div style={{
      padding: "48px 24px", textAlign: "center",
      border: `1px solid ${T.red}33`, borderRadius: 14,
      background: `${T.red}08`,
    }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 6 }}>
        Failed to load questions
      </div>
      <div style={{ fontSize: 12, color: T.dim, marginBottom: 18 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          background: T.surface, color: T.text,
          border: `1px solid ${T.border}`, borderRadius: 8,
          fontWeight: 700, fontSize: 12, padding: "8px 20px",
          cursor: "pointer", fontFamily: T.font,
        }}
      >
        Retry
      </button>
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
    <div style={{
      border: `1px solid ${data.colorBorder}`,
      borderRadius: 16, overflow: "hidden",
      background: T.surface,
    }}>
      {/* Header bar */}
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
        }}>
          {data.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: data.color, marginBottom: 2 }}>
            {data.id} — Setter Intelligence
          </div>
          <div style={{ fontSize: 11, color: T.dim }}>
            7-layer UPSC pattern analysis
          </div>
        </div>
        {count > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: data.color,
            background: data.colorDim, border: `1px solid ${data.colorBorder}`,
            borderRadius: 20, padding: "4px 12px",
          }}>
            {count} Qs
          </span>
        )}
        <span style={{ fontSize: 16, color: data.color, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          ›
        </span>
      </button>

      {open && (
        <div style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Mentor Line */}
          <div style={{
            background: data.colorDim,
            border: `1px solid ${data.colorBorder}`,
            borderLeft: `3px solid ${data.color}`,
            borderRadius: 8, padding: "12px 16px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: data.color, fontStyle: "italic", lineHeight: 1.6 }}>
              "{data.mentorLine}"
            </span>
          </div>

          {/* 7-layer grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

            {/* 1. Setter Logic */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>① Setter Logic</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.setterLogic.map((l, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.65, margin: 0 }}>{l}</p>
                ))}
              </div>
            </div>

            {/* 2. Recurring Ask Pattern */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>② Recurring Ask Pattern</div>
              <BulletList items={data.recurringPattern} color={data.color} dot="▸" />
            </div>

            {/* 3. Demand Decoder */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>③ Demand Decoder</div>
              <BulletList items={data.howUPSCAsks} color={T.dim} />
            </div>

            {/* 4. Answer Architecture */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>④ Answer Architecture</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                {data.answerArchitecture.map((s, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6 }}>{s}</li>
                ))}
              </ol>
            </div>

            {/* 5. Hidden Dimensions */}
            <div style={{ background: T.surfaceHigh, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.border}` }}>
              <div style={{ ...label11(data.color), marginBottom: 10 }}>⑤ Hidden Dimensions</div>
              <BulletList items={data.hiddenDimensions} color={data.color} dot="◆" />
            </div>

            {/* 6. Cross-Subject Links */}
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
                    }}>
                      {link.paper}
                    </span>
                    <span style={{ fontSize: 12, color: T.text, lineHeight: 1.55 }}>{link.angle}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 7. Mark-Loss Traps — full width */}
          <div style={{
            background: `${T.red}08`, border: `1px solid ${T.red}28`,
            borderRadius: 12, padding: "16px 18px",
          }}>
            <div style={{ ...label11(T.red), marginBottom: 10 }}>⑦ Mark-Loss Traps</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.markLossTraps.map((trap, i) => (
                <span key={i} style={{
                  fontSize: 11.5, color: T.text,
                  background: `${T.red}0c`, border: `1px solid ${T.red}28`,
                  borderRadius: 6, padding: "5px 12px", lineHeight: 1.5,
                }}>
                  ✗ {trap}
                </span>
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
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderTop: `2px solid ${d.color}`,
      borderRadius: 12, padding: "18px 20px",
      flex: "1 1 200px",
    }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: d.color, marginBottom: 8, fontStyle: "italic" }}>
        {d.word}
      </div>
      <div style={{ ...label11(T.subtle), marginBottom: 6 }}>UPSC Expects</div>
      <p style={{ fontSize: 12.5, color: T.text, lineHeight: 1.6, margin: "0 0 12px 0" }}>{d.expects}</p>
      <div style={{ ...label11(T.subtle), marginBottom: 6 }}>Answer Style</div>
      <p style={{ fontSize: 12, color: T.dim, lineHeight: 1.6, margin: 0 }}>{d.style}</p>
    </div>
  );
}

// ─── PYQ Analysis Panel ───────────────────────────────────────────────────────
function PYQAnalysisPanel({ questions }) {
  const themeCounts = THEMES.map(t => ({
    ...t,
    count: questions.filter(q => q.theme === t.id).length,
    color: THEME_ANALYSIS.find(a => a.id === t.id)?.color || T.amber,
  }));

  return (
    <div style={{
      marginBottom: 32,
      animation: "fadeSlideIn 0.25s ease",
    }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Panel header */}
      <div style={{
        background: `linear-gradient(135deg, #1a1200 0%, #110f00 100%)`,
        border: `1px solid ${ACCENT}33`,
        borderRadius: 16, padding: "24px 28px", marginBottom: 28,
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
          GS1 PYQ Analysis
        </h2>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 20px 0", maxWidth: 560, lineHeight: 1.6 }}>
          What UPSC is <em style={{ color: T.text }}>really</em> testing — setter logic, demand decoding, answer architecture, and where aspirants lose marks.
        </p>

        {/* Live theme counts */}
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

      {/* ── Section 1: Theme Intelligence ─────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeading
          label="1 · Theme Intelligence"
          sub="Expand each block to see all 7 analysis layers — setter logic to mark-loss traps."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {THEME_ANALYSIS.map(data => (
            <ThemeAnalysisBlock key={data.id} data={data} questions={questions} />
          ))}
        </div>
      </div>

      {/* ── Section 2: Directive Intelligence ────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeading
          label="2 · Directive Intelligence"
          sub="What 'Discuss', 'Analyse', 'Critically examine' actually demand from you."
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {DIRECTIVES.map(d => <DirectiveCard key={d.word} d={d} />)}
        </div>
      </div>

      {/* ── Section 3: What UPSC is silently checking ─────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionHeading
          label="3 · What UPSC is Silently Checking"
          sub="The invisible evaluation dimensions that separate a 12-mark answer from a 7-mark answer."
        />
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 10,
        }}>
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

      {/* ── Section 4: Interlink Opportunities ───────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <SectionHeading
          label="4 · Interlink Opportunities"
          sub="How to enrich GS1 answers by borrowing intelligently from other papers."
        />
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
                }}>
                  {link.from}
                </span>
                <span style={{ fontSize: 16, color: T.dim }}>{link.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: T.blue,
                  background: `${T.blue}12`, border: `1px solid ${T.blue}28`,
                  borderRadius: 6, padding: "3px 10px",
                }}>
                  {link.to}
                </span>
              </div>
              <span style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
                {link.angle}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MainsGS1Page() {
  const navigate = useNavigate();

  const [questions,  setQuestions]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
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
      const res = await fetch(`${BACKEND_URL}/api/mains/questions?paper=GS1`);
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
      paper:          "GS1",
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
        paper:          "GS1",
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

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font }}>

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${T.border}`, padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 8,
        background: T.bg, position: "sticky", top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate("/mains")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: T.font }}
        >
          <span style={label11(T.subtle)}>Mains</span>
        </button>
        <span style={{ color: T.muted, fontSize: 11 }}>›</span>
        <span style={label11(ACCENT)}>General Studies I</span>
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
              <div style={{ ...label11(ACCENT), marginBottom: 8 }}>GS Paper I</div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: T.textBright, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
                General Studies I
              </h1>
              <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px 0", lineHeight: 1.6, maxWidth: 520 }}>
                History, Society, Geography &amp; Art and Culture — select a theme or question below.
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
                    { label: `${topicCount} Topic`,            color: ACCENT },
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
                id="pyq-analysis-toggle"
                onClick={() => { setShowAnalysis(s => !s); setShowTrends(false); setShowYearTest(false); }}
                style={{
                  background: showAnalysis ? ACCENT : T.surfaceHigh,
                  color: showAnalysis ? "#09090b" : ACCENT,
                  border: `1.5px solid ${ACCENT}${showAnalysis ? "ff" : "55"}`,
                  borderRadius: 10,
                  fontWeight: 800, fontSize: 12.5,
                  padding: "10px 20px", cursor: "pointer",
                  fontFamily: T.font, letterSpacing: "0.03em",
                  boxShadow: showAnalysis ? `0 0 20px ${ACCENT}30` : "none",
                  transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 15 }}>🧠</span>
                {showAnalysis ? "Hide Analysis" : "PYQ Analysis"}
              </button>
              <button
                id="pyq-trends-toggle"
                onClick={() => { setShowTrends(s => !s); setShowAnalysis(false); setShowYearTest(false); }}
                style={{
                  background: showTrends ? T.blue : T.surfaceHigh,
                  color: showTrends ? "#fff" : T.blue,
                  border: `1.5px solid ${T.blue}${showTrends ? "ff" : "55"}`,
                  borderRadius: 10,
                  fontWeight: 800, fontSize: 12.5,
                  padding: "10px 20px", cursor: "pointer",
                  fontFamily: T.font, letterSpacing: "0.03em",
                  boxShadow: showTrends ? `0 0 20px ${T.blue}30` : "none",
                  transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 15 }}>📈</span>
                {showTrends ? "Hide Trends" : "Year-wise Trends"}
              </button>
              <button
                id="year-test-toggle"
                onClick={() => { setShowYearTest(s => !s); setShowAnalysis(false); setShowTrends(false); }}
                style={{
                  background: showYearTest ? T.green : T.surfaceHigh,
                  color: showYearTest ? "#09090b" : T.green,
                  border: `1.5px solid ${T.green}${showYearTest ? "ff" : "55"}`,
                  borderRadius: 10,
                  fontWeight: 800, fontSize: 12.5,
                  padding: "10px 20px", cursor: "pointer",
                  fontFamily: T.font, letterSpacing: "0.03em",
                  boxShadow: showYearTest ? `0 0 20px ${T.green}30` : "none",
                  transition: "all 0.15s ease",
                  display: "flex", alignItems: "center", gap: 8,
                  whiteSpace: "nowrap",
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
            <ThemeCard
              key={t.id}
              theme={t}
              active={activeTheme}
              onClick={() => toggleTheme(t.id)}
            />
          ))}
        </div>

        {/* ── Inline filters ────────────────────────────────────────────────────── */}
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
            {[{ v: "all", l: "All" }, { v: "PYQ", l: "PYQ Only" }, { v: "Topic", l: "Topic Only" }].map(s => (
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

        {!loading && error && (
          <ErrorState message={error} onRetry={fetchQuestions} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map(q => (
              <QuestionCard key={q.id} q={q} onStart={handleStart} />
            ))}
          </div>
        )}

        {!loading && !error && questions.length > 0 && filtered.length === 0 && (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            border: `1px dashed ${T.borderMid}`, borderRadius: 14,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions match this filter</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
              Try changing the theme, marks, or source filter above.
            </div>
          </div>
        )}

        {!loading && !error && questions.length === 0 && (
          <div style={{
            padding: "48px 24px", textAlign: "center",
            border: `1px dashed ${T.borderMid}`, borderRadius: 14,
          }}>
            <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.subtle }}>No questions loaded</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>
              Check that the tagged data files are present in the backend.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
