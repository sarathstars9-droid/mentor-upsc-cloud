import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const THEME_ICONS = {
  PHILOSOPHICAL: "◇",
  SOCIAL: "◎",
  POLITICAL: "▦",
  ECONOMIC: "↗",
  SCIENCE_TECH: "⌁",
  ENVIRONMENT: "◒",
  INTERNATIONAL: "⊕",
  ETHICS: "✦",
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
    shadow: dark ? "none" : "0 12px 32px rgba(15,23,42,.055)",
  };
}

function Card({ P, children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 18,
        boxShadow: P.shadow,
        ...style,
      }}
    >
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

function normalizeQuestionText(q) {
  return q?.topic || q?.question || q?.questionText || "Untitled Essay PYQ";
}

export default function EssayPyqPage() {
  const navigate = useNavigate();
  const mode = useMentorTheme();
  const P = useMemo(() => makePalette(mode), [mode]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);
  const [pyqList, setPyqList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTheme, setActiveTheme] = useState("all");
  const [activeSubtopic, setActiveSubtopic] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [yearFilter, setYearFilter] = useState("all");

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth < 900);
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

  const themeCounts = useMemo(() => {
    const counts = {};
    Object.keys(THEMES).forEach((key) => {
      counts[key] = pyqList.filter((q) => q.themeCategory === key).length;
    });
    return counts;
  }, [pyqList]);

  const availableYears = useMemo(() => {
    return [...new Set(pyqList.map((q) => Number(q.year)).filter(Boolean))].sort((a, b) => b - a);
  }, [pyqList]);

  const subtopicCounts = useMemo(() => {
    const counts = new Map();
    pyqList
      .filter((q) => activeTheme === "all" || q.themeCategory === activeTheme)
      .forEach((q) => {
        questionSubtopics(q).slice(0, 6).forEach((label) => {
          counts.set(label, (counts.get(label) || 0) + 1);
        });
      });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 24);
  }, [pyqList, activeTheme]);

  useEffect(() => {
    setActiveSubtopic("all");
  }, [activeTheme]);

  const filtered = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return pyqList
      .filter((q) => activeTheme === "all" || q.themeCategory === activeTheme)
      .filter((q) => yearFilter === "all" || String(q.year) === yearFilter)
      .filter((q) => {
        if (activeSubtopic === "all") return true;
        return questionSubtopics(q).some((item) => item.toLowerCase() === activeSubtopic.toLowerCase());
      })
      .filter((q) => {
        if (!search) return true;
        const haystack = [
          normalizeQuestionText(q),
          THEMES[q.themeCategory],
          ...questionSubtopics(q),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  }, [pyqList, activeTheme, activeSubtopic, yearFilter, searchText]);

  const recurringSubtopics = useMemo(
    () => subtopicCounts.filter(([, count]) => count >= 2).length,
    [subtopicCounts]
  );

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

  function openAnalysis(q = null) {
    navigate("/essay/pyq-analysis", {
      state: q
        ? {
            questionId: q.id,
            themeCategory: q.themeCategory,
            questionText: normalizeQuestionText(q),
          }
        : undefined,
    });
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: P.bg,
        color: P.text,
        fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",
      }}
    >
      <div style={{ maxWidth: 1380, margin: "0 auto", padding: isMobile ? "18px 14px 36px" : "26px 30px 48px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ color: P.primary, fontSize: 10, fontWeight: 850, letterSpacing: ".12em", textTransform: "uppercase" }}>
              MentorOS · Essay
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: isMobile ? 27 : 38, letterSpacing: "-.04em", lineHeight: 1.08, fontWeight: 900 }}>
              Essay PYQs
            </h1>
            <div style={{ color: P.muted, fontSize: 13, marginTop: 8, maxWidth: 650, lineHeight: 1.55 }}>
              Browse topic-wise and sub-topic-wise PYQs, choose a question, and move directly into the common MentorOS Answer Writing workspace.
            </div>
          </div>

          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            <Button P={P} onClick={() => navigate("/essay")}>← Essay Home</Button>
            <Button P={P} primary onClick={() => openAnalysis()}>
              PYQ Analysis&nbsp; →
            </Button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            [pyqList.length, "Total Essay PYQs", "Mapped questions"],
            [Object.keys(THEMES).filter((key) => themeCounts[key] > 0).length, "Main Themes", "Topic-wise browsing"],
            [recurringSubtopics, "Recurring Sub-topics", "Repeated 2+ times"],
            [availableYears[0] || "—", "Latest PYQ Year", "Current dataset"],
          ].map(([value, label, sub]) => (
            <Card P={P} key={label} style={{ padding: isMobile ? 14 : 18, boxShadow: "none" }}>
              <div style={{ color: P.text, fontSize: isMobile ? 24 : 29, fontWeight: 900, letterSpacing: "-.035em" }}>{value}</div>
              <div style={{ color: P.text2, fontSize: 11.5, fontWeight: 800, marginTop: 4 }}>{label}</div>
              <div style={{ color: P.faint, fontSize: 10, marginTop: 3 }}>{sub}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: P.text, fontSize: 20, fontWeight: 900, letterSpacing: "-.025em" }}>Browse by Essay Theme</div>
            <div style={{ color: P.muted, fontSize: 11.5, marginTop: 4 }}>Choose a theme first. Then narrow it using the recurring sub-topics below.</div>
          </div>
          <Button P={P} subtle onClick={() => { setActiveTheme("all"); setActiveSubtopic("all"); setYearFilter("all"); setSearchText(""); }}>
            Clear filters
          </Button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,minmax(0,1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Card
            P={P}
            onClick={() => setActiveTheme("all")}
            style={{
              padding: 15,
              cursor: "pointer",
              borderColor: activeTheme === "all" ? P.primary : P.border,
              background: activeTheme === "all" ? P.primarySoft2 : P.surface,
              boxShadow: "none",
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: P.primary, background: P.primarySoft, fontWeight: 900 }}>□</div>
            <div style={{ color: P.text, fontSize: 12.5, fontWeight: 850, marginTop: 12 }}>All Essay Themes</div>
            <div style={{ color: P.muted, fontSize: 10.5, marginTop: 4 }}>{pyqList.length} questions</div>
          </Card>

          {Object.entries(THEMES).map(([key, label]) => {
            const active = activeTheme === key;
            return (
              <Card
                P={P}
                key={key}
                onClick={() => setActiveTheme(key)}
                style={{
                  padding: 15,
                  cursor: "pointer",
                  borderColor: active ? P.primary : P.border,
                  background: active ? P.primarySoft2 : P.surface,
                  boxShadow: "none",
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: P.primary, background: P.primarySoft, fontWeight: 900, fontSize: 15 }}>
                  {THEME_ICONS[key] || "◇"}
                </div>
                <div style={{ color: P.text, fontSize: 12.5, fontWeight: 850, marginTop: 12, lineHeight: 1.25 }}>{label}</div>
                <div style={{ color: P.muted, fontSize: 10.5, marginTop: 4 }}>{themeCounts[key] || 0} questions</div>
              </Card>
            );
          })}
        </div>

        <Card P={P} style={{ padding: 14, marginBottom: 18, boxShadow: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: P.text2, fontSize: 11.5, fontWeight: 850 }}>Sub-topics</div>
              <div style={{ color: P.faint, fontSize: 10, marginTop: 2 }}>Repeated concepts inside the selected theme</div>
            </div>
            <div style={{ color: P.muted, fontSize: 10.5 }}>{subtopicCounts.length} mapped</div>
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
            <Pill P={P} active={activeSubtopic === "all"} onClick={() => setActiveSubtopic("all")}>All sub-topics</Pill>
            {subtopicCounts.map(([label, count]) => (
              <Pill key={label} P={P} active={activeSubtopic === label} onClick={() => setActiveSubtopic(label)}>
                {label} · {count}
              </Pill>
            ))}
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 180px 190px",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 13, top: 11, color: P.faint, fontSize: 13 }}>⌕</span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search question, topic or sub-topic..."
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="all">All years</option>
            {availableYears.map((year) => <option key={year} value={String(year)}>{year}</option>)}
          </select>
          <Button P={P} onClick={() => openAnalysis()} style={{ width: "100%" }}>Open PYQ Analysis →</Button>
        </div>

        <Card P={P} style={{ overflow: "hidden", boxShadow: "none" }}>
          <div style={{ padding: "15px 17px", borderBottom: `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: P.text, fontSize: 15, fontWeight: 900 }}>Essay PYQs</div>
              <div style={{ color: P.muted, fontSize: 10.5, marginTop: 3 }}>{filtered.length} questions match your selection</div>
            </div>
            <div style={{ color: P.faint, fontSize: 10.5 }}>Analyse pattern or start writing immediately</div>
          </div>

          {loading ? <div style={{ padding: 28, color: P.muted, fontSize: 12 }}>Loading Essay PYQs…</div> : null}
          {error ? <div style={{ padding: 28, color: "#EF4444", fontSize: 12 }}>{error}</div> : null}

          {!loading && !error && filtered.length === 0 ? (
            <div style={{ padding: 34, textAlign: "center" }}>
              <div style={{ color: P.text, fontWeight: 850 }}>No PYQs found for this selection.</div>
              <div style={{ color: P.muted, fontSize: 11, marginTop: 5 }}>Try another theme, sub-topic, year or search term.</div>
            </div>
          ) : null}

          {!loading && !error && filtered.map((q, index) => {
            const tags = questionSubtopics(q).slice(0, 4);
            return (
              <div
                key={q.id || `${q.year}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "74px minmax(0,1fr) auto",
                  gap: isMobile ? 10 : 14,
                  padding: isMobile ? "15px" : "16px 17px",
                  borderBottom: index === filtered.length - 1 ? "none" : `1px solid ${P.border}`,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ color: P.primary, fontSize: 12, fontWeight: 900 }}>{q.year || "—"}</div>
                  <div style={{ color: P.faint, fontSize: 9.5, marginTop: 2 }}>UPSC Essay</div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ color: P.text, fontSize: 13, fontWeight: 750, lineHeight: 1.48 }}>{normalizeQuestionText(q)}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <Pill P={P}>{THEMES[q.themeCategory] || "Essay"}</Pill>
                    {tags.map((tag) => <Pill P={P} key={tag}>{tag}</Pill>)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                  <Button P={P} onClick={() => openAnalysis(q)}>Analyse</Button>
                  <Button P={P} primary onClick={() => openAnswerWriting(q)}>Write Answer →</Button>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
