import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config";

const PRIMARY = "#0A64F5";

const THEMES = {
  PHILOSOPHICAL: "Philosophy & Values",
  SOCIAL: "Society & Human Relations",
  POLITICAL: "Democracy & Governance",
  ECONOMIC: "Economy & Development",
  SCIENCE_TECH: "Science & Technology",
  ENVIRONMENT: "Environment",
  INTERNATIONAL: "India & the World",
  ETHICS: "Ethics & Values",
};

function detectTheme() {
  const html = document.documentElement;
  const body = document.body;
  const explicit = (
    html.getAttribute("data-theme") ||
    body?.getAttribute("data-theme") ||
    localStorage.getItem("theme") ||
    localStorage.getItem("mentor-theme") ||
    ""
  ).toLowerCase();

  if (explicit.includes("dark")) return "dark";
  if (explicit.includes("light")) return "light";
  if (html.classList.contains("dark") || body?.classList.contains("dark")) return "dark";

  try {
    const bg = getComputedStyle(body).backgroundColor;
    const nums = bg.match(/\d+/g)?.map(Number);
    if (nums?.length >= 3) {
      const luminance = (nums[0] * 299 + nums[1] * 587 + nums[2] * 114) / 1000;
      return luminance < 120 ? "dark" : "light";
    }
  } catch (_) {
    // Fall through to OS preference.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useMentorTheme() {
  const [mode, setMode] = useState(() => detectTheme());

  useEffect(() => {
    const update = () => setMode(detectTheme());
    const observer = new MutationObserver(update);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
    }

    window.addEventListener("storage", update);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", update);
      media?.removeEventListener?.("change", update);
    };
  }, []);

  return mode;
}

function makePalette(mode) {
  const dark = mode === "dark";
  return {
    dark,
    bg: dark ? "#05070A" : "#F6F8FB",
    surface: dark ? "#0B0F14" : "#FFFFFF",
    surface2: dark ? "#10161F" : "#F8FAFC",
    surface3: dark ? "#161E29" : "#EEF4FB",
    border: dark ? "#1F2935" : "#E1E7EF",
    borderStrong: dark ? "#2C3948" : "#CED8E6",
    text: dark ? "#F6F8FB" : "#0F172A",
    text2: dark ? "#CFD7E3" : "#344054",
    muted: dark ? "#8C98AA" : "#667085",
    faint: dark ? "#687487" : "#98A2B3",
    primary: PRIMARY,
    primarySoft: dark ? "rgba(10,100,245,.16)" : "rgba(10,100,245,.075)",
    primarySoft2: dark ? "rgba(10,100,245,.09)" : "rgba(10,100,245,.04)",
    green: dark ? "#50D890" : "#14965F",
    greenSoft: dark ? "rgba(32,201,123,.10)" : "#EEF9F4",
    amber: dark ? "#FFB84D" : "#C87900",
    amberSoft: dark ? "rgba(255,184,77,.10)" : "#FFF7E8",
    violet: dark ? "#B6A1FF" : "#7257D8",
    violetSoft: dark ? "rgba(182,161,255,.10)" : "#F5F1FF",
    red: dark ? "#FF8D8D" : "#D64848",
    redSoft: dark ? "rgba(255,100,100,.10)" : "#FFF1F1",
    shadow: dark ? "none" : "0 12px 32px rgba(15,23,42,.055)",
  };
}

function Card({ P, children, style = {} }) {
  return (
    <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 18, boxShadow: P.shadow, ...style }}>
      {children}
    </div>
  );
}

function Button({ P, children, onClick, primary = false, subtle = false, disabled = false, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${primary ? P.primary : subtle ? P.border : P.borderStrong}`,
        background: primary ? P.primary : subtle ? "transparent" : P.surface,
        color: primary ? "#FFFFFF" : P.text2,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: primary && !P.dark ? "0 7px 16px rgba(10,100,245,.19)" : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ P, children, active = false, onClick }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        border: `1px solid ${active ? P.primary : P.border}`,
        background: active ? P.primarySoft : P.surface2,
        color: active ? P.primary : P.muted,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 10.5,
        fontWeight: active ? 800 : 650,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Comp>
  );
}

function cleanLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeQuestionText(q) {
  return q?.topic || q?.question || q?.questionText || "Untitled Essay PYQ";
}

function questionSubtopics(q) {
  const raw = [q.sourceTopicBucket, ...(q.microthemes || []), ...(q.keywords || [])]
    .map(cleanLabel)
    .filter(Boolean);

  const seen = new Set();
  return raw.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countBy(items, getter) {
  const map = new Map();
  items.forEach((item) => {
    const key = getter(item);
    if (key == null || key === "") return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function statementType(text) {
  const value = String(text || "").trim();
  const lower = value.toLowerCase();

  if (/^[“\"']|[”\"']$/.test(value) || lower.includes("said") || lower.includes("quote")) return "Quote / proposition";
  if (value.length <= 75) return "Compact abstract statement";
  if (/\b(is|are|has|have|can|cannot|should|must|means|without|with)\b/.test(lower)) return "Analytical proposition";
  return "Open interpretive statement";
}

function buildAnalysis(items) {
  const subtopicMap = new Map();

  items.forEach((q) => {
    questionSubtopics(q).slice(0, 8).forEach((label) => {
      const key = label.toLowerCase();
      const current = subtopicMap.get(key) || { label, count: 0, years: [], questions: [], themes: new Set() };
      current.count += 1;
      if (q.year) current.years.push(Number(q.year));
      current.questions.push(q);
      if (q.themeCategory) current.themes.add(q.themeCategory);
      subtopicMap.set(key, current);
    });
  });

  const recurring = [...subtopicMap.values()]
    .map((item) => ({
      ...item,
      years: [...new Set(item.years)].sort((a, b) => a - b),
      themes: [...item.themes],
    }))
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || b.years.at(-1) - a.years.at(-1));

  const yearMap = countBy(items, (q) => Number(q.year) || null);
  const yearly = [...yearMap.entries()].sort((a, b) => a[0] - b[0]);

  const themeMap = countBy(items, (q) => q.themeCategory || "UNKNOWN");
  const themes = [...themeMap.entries()]
    .map(([key, count]) => ({ key, label: THEMES[key] || cleanLabel(key), count }))
    .sort((a, b) => b.count - a.count);

  const typeMap = countBy(items, (q) => statementType(normalizeQuestionText(q)));
  const types = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);

  const recurrenceGaps = recurring
    .map((item) => {
      const gaps = item.years.slice(1).map((year, idx) => year - item.years[idx]);
      return {
        ...item,
        averageGap: gaps.length ? mean(gaps) : null,
        latestYear: item.years.at(-1) || null,
        firstYear: item.years[0] || null,
      };
    })
    .sort((a, b) => {
      if (a.averageGap == null && b.averageGap == null) return b.count - a.count;
      if (a.averageGap == null) return 1;
      if (b.averageGap == null) return -1;
      return a.averageGap - b.averageGap || b.count - a.count;
    });

  return { recurring, yearly, themes, types, recurrenceGaps };
}

export default function EssayPyqAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useMentorTheme();
  const P = useMemo(() => makePalette(mode), [mode]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 980);
  const [pyqList, setPyqList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTheme, setActiveTheme] = useState(location.state?.themeCategory || "all");
  const [range, setRange] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState(location.state?.questionId || null);

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 980);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/subject-pyq?subject=essay`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setPyqList(Array.isArray(data?.questions) ? data.questions : []))
      .catch((e) => setError(e?.message || "Could not load Essay PYQs"))
      .finally(() => setLoading(false));
  }, []);

  const maxYear = useMemo(() => Math.max(0, ...pyqList.map((q) => Number(q.year) || 0)), [pyqList]);

  const scopedQuestions = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    const minYear = range === "5y" ? maxYear - 4 : range === "10y" ? maxYear - 9 : 0;

    return pyqList
      .filter((q) => activeTheme === "all" || q.themeCategory === activeTheme)
      .filter((q) => !minYear || Number(q.year || 0) >= minYear)
      .filter((q) => {
        if (!search) return true;
        return [normalizeQuestionText(q), THEMES[q.themeCategory], ...questionSubtopics(q)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  }, [pyqList, activeTheme, range, maxYear, searchText]);

  const analysis = useMemo(() => buildAnalysis(scopedQuestions), [scopedQuestions]);

  const themeCounts = useMemo(() => {
    const counts = {};
    Object.keys(THEMES).forEach((key) => {
      counts[key] = pyqList.filter((q) => q.themeCategory === key).length;
    });
    return counts;
  }, [pyqList]);

  const averagePerTheme = useMemo(() => {
    const activeThemeCount = analysis.themes.filter((x) => x.count > 0).length;
    return activeThemeCount ? (scopedQuestions.length / activeThemeCount).toFixed(1) : "0.0";
  }, [analysis.themes, scopedQuestions.length]);

  const priorityTopics = analysis.recurring.filter((item) => item.count >= 3).length;
  const maxYearCount = Math.max(1, ...analysis.yearly.map(([, count]) => count));

  const selectedQuestion = useMemo(() => {
    if (!selectedQuestionId) return null;
    return pyqList.find((q) => String(q.id) === String(selectedQuestionId)) || null;
  }, [pyqList, selectedQuestionId]);

  function openAnswerWriting(q) {
    const stateObj = {
      questionText: normalizeQuestionText(q),
      year: q?.year || "",
      paper: "Essay",
      marks: 125,
      topic: q?.sourceTopicBucket || THEMES[q?.themeCategory] || "Essay",
      subject: "Essay",
      source: "PYQ",
      pyqId: q?.id,
    };

    sessionStorage.setItem("mains_pyq_metadata", JSON.stringify(stateObj));
    navigate("/answer-writing/essay/pyq", { state: stateObj });
  }

  function pickRecommendedQuestion() {
    const recurringLabels = new Set(analysis.recurring.slice(0, 8).map((item) => item.label.toLowerCase()));
    const ranked = scopedQuestions
      .map((q) => {
        const overlap = questionSubtopics(q).filter((tag) => recurringLabels.has(tag.toLowerCase())).length;
        return { q, score: overlap * 10 + Number(q.year || 0) / 10000 };
      })
      .sort((a, b) => b.score - a.score);

    if (ranked[0]?.q) {
      setSelectedQuestionId(ranked[0].q.id);
      requestAnimationFrame(() => document.getElementById("essay-analysis-questions")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: P.surface,
    color: P.text,
    border: `1px solid ${P.border}`,
    borderRadius: 11,
    padding: "11px 12px",
    outline: "none",
    fontFamily: "inherit",
    fontSize: 12,
  };

  const insightCards = [
    {
      title: "How?",
      subtitle: "How UPSC frames Essay PYQs",
      tint: P.primarySoft2,
      iconColor: P.primary,
      body: analysis.types.slice(0, 3).map(([label, count]) => `${label} · ${count}`),
    },
    {
      title: "Why?",
      subtitle: "What the pattern is testing",
      tint: P.greenSoft,
      iconColor: P.green,
      body: [
        "Interpret the proposition before taking a position.",
        "Build a multi-dimensional argument rather than a one-sided list.",
        "Show balance, qualification and synthesis in the conclusion.",
      ],
    },
    {
      title: "When?",
      subtitle: "When themes return",
      tint: P.amberSoft,
      iconColor: P.amber,
      body: analysis.recurrenceGaps.slice(0, 3).map((item) => {
        const gap = item.averageGap == null ? "—" : `${item.averageGap.toFixed(1)}y avg gap`;
        return `${item.label} · ${item.count}x · ${gap}`;
      }),
    },
    {
      title: "Trends",
      subtitle: "Most visible areas in this selection",
      tint: P.violetSoft,
      iconColor: P.violet,
      body: analysis.themes.slice(0, 4).map((item) => `${item.label} · ${Math.round((item.count / Math.max(1, scopedQuestions.length)) * 100)}%`),
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: P.bg,
        color: P.text,
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: isMobile ? "18px 14px 36px" : "24px 28px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ color: P.muted, fontSize: 10.5, fontWeight: 750 }}>PYQs &nbsp;›&nbsp; Essay &nbsp;›&nbsp; Analysis</div>
            <h1 style={{ margin: "8px 0 0", fontSize: isMobile ? 27 : 38, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1.08 }}>
              Essay PYQ Analysis
            </h1>
            <div style={{ color: P.muted, fontSize: 13, marginTop: 7 }}>
              Understand repeated topics, recurrence, framing and trends — then choose a PYQ and write it.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button P={P} onClick={() => navigate("/essay/pyqs")}>← Essay PYQs</Button>
            <Button P={P} primary onClick={pickRecommendedQuestion}>Suggest a PYQ →</Button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,minmax(0,1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {[
            [scopedQuestions.length, "Essay PYQs", range === "all" ? "Current selection" : range === "5y" ? "Last 5 years" : "Last 10 years"],
            [analysis.recurring.length, "Recurring Topics", "Repeated 2+ times"],
            [averagePerTheme, "Avg. Questions / Theme", "Across active themes"],
            [priorityTopics, "High-frequency Topics", "Repeated 3+ times"],
          ].map(([value, label, sub]) => (
            <Card P={P} key={label} style={{ padding: isMobile ? 14 : 18, boxShadow: "none" }}>
              <div style={{ color: P.text, fontSize: isMobile ? 24 : 29, fontWeight: 900, letterSpacing: "-.035em" }}>{value}</div>
              <div style={{ color: P.text2, fontSize: 11.5, fontWeight: 800, marginTop: 4 }}>{label}</div>
              <div style={{ color: P.faint, fontSize: 10, marginTop: 3 }}>{sub}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "230px minmax(0,1fr) 270px", gap: 14, alignItems: "start" }}>
          <Card P={P} style={{ padding: 12, boxShadow: "none", position: isMobile ? "static" : "sticky", top: 14 }}>
            <div style={{ padding: "4px 4px 10px" }}>
              <div style={{ color: P.text, fontSize: 13, fontWeight: 900 }}>Themes</div>
              <div style={{ color: P.faint, fontSize: 10, marginTop: 2 }}>Filter the analysis</div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTheme("all")}
              style={{
                width: "100%",
                border: `1px solid ${activeTheme === "all" ? P.primary : "transparent"}`,
                background: activeTheme === "all" ? P.primarySoft : "transparent",
                color: activeTheme === "all" ? P.primary : P.text2,
                borderRadius: 10,
                padding: "10px 10px",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 800,
                textAlign: "left",
              }}
            >
              <span>All Themes</span><span>{pyqList.length}</span>
            </button>

            {Object.entries(THEMES).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setActiveTheme(key)}
                style={{
                  width: "100%",
                  border: `1px solid ${activeTheme === key ? P.primary : "transparent"}`,
                  background: activeTheme === key ? P.primarySoft : "transparent",
                  color: activeTheme === key ? P.primary : P.text2,
                  borderRadius: 10,
                  padding: "10px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 10.7,
                  fontWeight: activeTheme === key ? 850 : 650,
                  textAlign: "left",
                  marginTop: 3,
                }}
              >
                <span style={{ lineHeight: 1.3 }}>{label}</span><span>{themeCounts[key] || 0}</span>
              </button>
            ))}
          </Card>

          <div style={{ minWidth: 0 }}>
            <Card P={P} style={{ padding: 15, marginBottom: 14, boxShadow: "none" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 13, top: 11, color: P.faint }}>⌕</span>
                  <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search analysis by topic or question..." style={{ ...inputStyle, paddingLeft: 34 }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill P={P} active={range === "all"} onClick={() => setRange("all")}>All years</Pill>
                  <Pill P={P} active={range === "10y"} onClick={() => setRange("10y")}>Last 10 years</Pill>
                  <Pill P={P} active={range === "5y"} onClick={() => setRange("5y")}>Last 5 years</Pill>
                </div>
              </div>
            </Card>

            <Card P={P} style={{ padding: 16, marginBottom: 14, boxShadow: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 13, flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: P.text, fontSize: 15, fontWeight: 900 }}>PYQ Insights</div>
                  <div style={{ color: P.muted, fontSize: 10.5, marginTop: 3 }}>How, why, when and what keeps recurring in the current selection.</div>
                </div>
                <div style={{ color: P.primary, fontSize: 10.5, fontWeight: 800 }}>Based on mapped Essay PYQ metadata</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4,minmax(0,1fr))", gap: 9 }}>
                {insightCards.map((card) => (
                  <div key={card.title} style={{ background: card.tint, border: `1px solid ${P.border}`, borderRadius: 14, padding: 13, minHeight: 155 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: P.surface, color: card.iconColor, fontWeight: 900 }}>
                        {card.title === "How?" ? "?" : card.title === "Why?" ? "◎" : card.title === "When?" ? "◷" : "▥"}
                      </div>
                      <div style={{ color: P.text, fontSize: 12, fontWeight: 900 }}>{card.title}</div>
                    </div>
                    <div style={{ color: P.text2, fontSize: 10.5, fontWeight: 750, lineHeight: 1.35, marginTop: 9 }}>{card.subtitle}</div>
                    <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                      {(card.body.length ? card.body : ["Not enough mapped data in this selection."]).map((line, idx) => (
                        <div key={`${card.title}-${idx}`} style={{ color: P.muted, fontSize: 9.9, lineHeight: 1.4 }}>• {line}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.05fr .95fr", gap: 14, marginBottom: 14 }}>
              <Card P={P} style={{ padding: 16, boxShadow: "none" }}>
                <div style={{ color: P.text, fontSize: 14, fontWeight: 900 }}>Repeated Topics</div>
                <div style={{ color: P.muted, fontSize: 10.5, marginTop: 3 }}>The concepts UPSC returns to within this selection.</div>

                <div style={{ marginTop: 12 }}>
                  {analysis.recurring.length === 0 ? (
                    <div style={{ color: P.faint, fontSize: 11, padding: "16px 0" }}>No repeated mapped topics in this filter.</div>
                  ) : analysis.recurring.slice(0, 10).map((item, index) => (
                    <div key={item.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: "10px 0", borderBottom: index === Math.min(analysis.recurring.length, 10) - 1 ? "none" : `1px solid ${P.border}` }}>
                      <div>
                        <div style={{ color: P.text2, fontSize: 11.2, fontWeight: 800 }}>{item.label}</div>
                        <div style={{ color: P.faint, fontSize: 9.7, marginTop: 3 }}>{item.years.join(" · ") || "Year not mapped"}</div>
                      </div>
                      <div style={{ minWidth: 32, height: 26, padding: "0 8px", borderRadius: 9, background: P.primarySoft, color: P.primary, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>{item.count}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card P={P} style={{ padding: 16, boxShadow: "none" }}>
                <div style={{ color: P.text, fontSize: 14, fontWeight: 900 }}>Year-wise Trend</div>
                <div style={{ color: P.muted, fontSize: 10.5, marginTop: 3 }}>Number of mapped Essay PYQs by year.</div>

                <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                  {analysis.yearly.slice(-12).map(([year, count]) => (
                    <div key={year} style={{ display: "grid", gridTemplateColumns: "38px minmax(0,1fr) 24px", alignItems: "center", gap: 8 }}>
                      <div style={{ color: P.muted, fontSize: 9.8, fontWeight: 700 }}>{year}</div>
                      <div style={{ height: 7, background: P.surface3, borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(7, (count / maxYearCount) * 100)}%`, height: "100%", background: P.primary, borderRadius: 999 }} />
                      </div>
                      <div style={{ color: P.text2, fontSize: 9.8, fontWeight: 800, textAlign: "right" }}>{count}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card P={P} id="essay-analysis-questions" style={{ overflow: "hidden", boxShadow: "none" }}>
              <div style={{ padding: "15px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: P.text, fontSize: 15, fontWeight: 900 }}>PYQs in this analysis</div>
                  <div style={{ color: P.muted, fontSize: 10.5, marginTop: 3 }}>Choose a question and continue to the shared Answer Writing workspace.</div>
                </div>
                <div style={{ color: P.faint, fontSize: 10.5 }}>{scopedQuestions.length} questions</div>
              </div>

              {loading ? <div style={{ padding: 28, color: P.muted, fontSize: 12 }}>Loading analysis…</div> : null}
              {error ? <div style={{ padding: 28, color: P.red, fontSize: 12 }}>{error}</div> : null}

              {!loading && !error && scopedQuestions.map((q, index) => {
                const active = String(selectedQuestionId || "") === String(q.id || "");
                return (
                  <div
                    key={q.id || `${q.year}-${index}`}
                    onClick={() => setSelectedQuestionId(q.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "64px minmax(0,1fr) auto",
                      gap: 12,
                      padding: "14px 16px",
                      borderBottom: index === scopedQuestions.length - 1 ? "none" : `1px solid ${P.border}`,
                      background: active ? P.primarySoft2 : "transparent",
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ color: P.primary, fontSize: 11.5, fontWeight: 900 }}>{q.year || "—"}</div>
                      <div style={{ color: P.faint, fontSize: 9.3, marginTop: 2 }}>Essay</div>
                    </div>
                    <div>
                      <div style={{ color: P.text, fontSize: 12.2, fontWeight: 750, lineHeight: 1.45 }}>{normalizeQuestionText(q)}</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                        <Pill P={P}>{THEMES[q.themeCategory] || "Essay"}</Pill>
                        {questionSubtopics(q).slice(0, 3).map((tag) => <Pill P={P} key={tag}>{tag}</Pill>)}
                      </div>
                    </div>
                    <Button P={P} primary onClick={(e) => { e?.stopPropagation?.(); openAnswerWriting(q); }}>Write Answer →</Button>
                  </div>
                );
              })}
            </Card>
          </div>

          <div style={{ display: "grid", gap: 14, position: isMobile ? "static" : "sticky", top: 14 }}>
            <Card P={P} style={{ padding: 16, boxShadow: "none", background: P.redSoft }}>
              <div style={{ color: P.text, fontSize: 13.5, fontWeight: 900 }}>Mentor Takeaways</div>
              <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
                {[
                  analysis.recurring[0] ? `Highest recurrence: ${analysis.recurring[0].label} (${analysis.recurring[0].count} mapped PYQs).` : "Build recurrence data by mapping more sub-topics.",
                  analysis.themes[0] ? `Most represented theme here: ${analysis.themes[0].label}.` : "No dominant theme in this filter.",
                  "Prepare reusable dimensions, but adapt them to the exact proposition.",
                  "Move from analysis to writing: select one PYQ and produce a complete essay attempt.",
                ].map((line) => (
                  <div key={line} style={{ display: "flex", gap: 8, color: P.text2, fontSize: 10.5, lineHeight: 1.5 }}><span style={{ color: P.red, fontWeight: 900 }}>›</span><span>{line}</span></div>
                ))}
              </div>
            </Card>

            <Card P={P} style={{ padding: 16, boxShadow: "none" }}>
              <div style={{ color: P.text, fontSize: 13.5, fontWeight: 900 }}>Selected PYQ</div>
              {selectedQuestion ? (
                <>
                  <div style={{ color: P.primary, fontSize: 10, fontWeight: 850, marginTop: 10 }}>{selectedQuestion.year || "—"} · {THEMES[selectedQuestion.themeCategory] || "Essay"}</div>
                  <div style={{ color: P.text2, fontSize: 11.2, fontWeight: 750, lineHeight: 1.5, marginTop: 6 }}>{normalizeQuestionText(selectedQuestion)}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
                    {questionSubtopics(selectedQuestion).slice(0, 5).map((tag) => <Pill P={P} key={tag}>{tag}</Pill>)}
                  </div>
                  <Button P={P} primary onClick={() => openAnswerWriting(selectedQuestion)} style={{ width: "100%", marginTop: 12 }}>Write this Essay →</Button>
                </>
              ) : (
                <div style={{ color: P.muted, fontSize: 10.5, lineHeight: 1.55, marginTop: 8 }}>Select any PYQ from the list or ask MentorOS to suggest one from recurring topics.</div>
              )}
            </Card>

            <Card P={P} style={{ padding: 16, boxShadow: "none", background: P.primarySoft2 }}>
              <div style={{ color: P.primary, fontSize: 10, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".08em" }}>From analysis to execution</div>
              <div style={{ color: P.text, fontSize: 13, fontWeight: 850, lineHeight: 1.35, marginTop: 5 }}>Do not stop at trends.</div>
              <div style={{ color: P.muted, fontSize: 10.5, lineHeight: 1.55, marginTop: 6 }}>The purpose of this page is to help the user pick the right PYQ and immediately enter Answer Writing.</div>
              <Button P={P} onClick={pickRecommendedQuestion} style={{ width: "100%", marginTop: 12 }}>Suggest a PYQ for me →</Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
