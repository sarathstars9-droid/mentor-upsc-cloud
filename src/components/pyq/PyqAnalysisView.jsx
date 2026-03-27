function StatCard({ label, value, tone = "blue" }) {
  const toneMap = {
    blue: {
      bg: "rgba(59,130,246,0.10)",
      border: "rgba(96,165,250,0.20)",
      label: "#93c5fd",
      value: "#eff6ff",
    },
    green: {
      bg: "rgba(16,185,129,0.10)",
      border: "rgba(52,211,153,0.20)",
      label: "#86efac",
      value: "#ecfdf5",
    },
    amber: {
      bg: "rgba(245,158,11,0.10)",
      border: "rgba(251,191,36,0.20)",
      label: "#fcd34d",
      value: "#fffbeb",
    },
    purple: {
      bg: "rgba(168,85,247,0.10)",
      border: "rgba(192,132,252,0.20)",
      label: "#d8b4fe",
      value: "#faf5ff",
    },
    red: {
      bg: "rgba(239,68,68,0.10)",
      border: "rgba(248,113,113,0.20)",
      label: "#fca5a5",
      value: "#fef2f2",
    },
  };

  const c = toneMap[tone] || toneMap.blue;

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 16,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: c.label,
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: c.value,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, right, children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 20,
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "#93c5fd",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 14,
                color: "#cbd5e1",
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? <div>{right}</div> : null}
      </div>

      {children}
    </div>
  );
}

function SmallPill({ children, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(96,165,250,0.35)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active
          ? "rgba(59,130,246,0.16)"
          : "rgba(255,255,255,0.04)",
        color: active ? "#dbeafe" : "#cbd5e1",
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function getTimelineSignal(timeline = []) {
  if (!timeline.length) return "No timeline data";
  if (timeline.length === 1) return "Single visible year";

  const counts = timeline.map((x) => x.count || 0);
  const last = counts[counts.length - 1];
  const prev = counts[counts.length - 2];

  if (last > prev) return "Recent years show stronger recurrence";
  if (last < prev) return "Recent years show lower recurrence";
  return "Stable recurrence across visible years";
}

function getTopLinkedQuestions(questions = [], linkedQuestionsMap = {}) {
  return questions
    .map((q) => ({
      ...q,
      linkedCount: Array.isArray(linkedQuestionsMap[q.id]) ? linkedQuestionsMap[q.id].length : 0,
    }))
    .filter((q) => q.linkedCount > 0)
    .sort((a, b) => b.linkedCount - a.linkedCount || (b.year || 0) - (a.year || 0))
    .slice(0, 8);
}

function getRecurrenceStrength(total) {
  if (total >= 12) return { label: "High", tone: "green" };
  if (total >= 5) return { label: "Medium", tone: "amber" };
  return { label: "Low", tone: "red" };
}

function getExamBias(summary) {
  const prelims = Number(summary?.prelims || 0);
  const mains = Number(summary?.mains || 0);

  if (prelims > 0 && mains === 0) return { label: "Prelims-led", tone: "blue" };
  if (mains > 0 && prelims === 0) return { label: "Mains-led", tone: "purple" };

  if (prelims > mains * 1.5) return { label: "Prelims-heavy", tone: "blue" };
  if (mains > prelims * 1.5) return { label: "Mains-heavy", tone: "purple" };
  return { label: "Mixed", tone: "green" };
}

function getYearSpread(timeline = []) {
  if (!timeline.length) return { label: "Unknown", tone: "red" };

  const years = timeline.map((t) => Number(t.year)).filter(Boolean);
  if (!years.length) return { label: "Unknown", tone: "red" };

  const spread = Math.max(...years) - Math.min(...years);

  if (spread >= 10) return { label: "Wide", tone: "green" };
  if (spread >= 4) return { label: "Moderate", tone: "amber" };
  return { label: "Narrow", tone: "red" };
}

function getThemeConcentration(themes = [], totalQuestions = 0) {
  if (!themes.length || !totalQuestions) return { label: "Unknown", tone: "red" };

  const topThemeShare = (themes[0]?.count || 0) / totalQuestions;

  if (topThemeShare >= 0.6) return { label: "Focused", tone: "amber" };
  if (topThemeShare >= 0.35) return { label: "Balanced", tone: "green" };
  return { label: "Fragmented", tone: "purple" };
}

function getPatternAdvice({ summary, themes, timeline }) {
  const recurrence = getRecurrenceStrength(summary?.total || 0).label;
  const examBias = getExamBias(summary).label;
  const yearSpread = getYearSpread(timeline).label;
  const concentration = getThemeConcentration(themes, summary?.total || 0).label;

  if (recurrence === "High" && concentration === "Focused") {
    return "This is a high-return topic. Master its dominant micro themes deeply and revise repeatedly.";
  }

  if (examBias.includes("Prelims")) {
    return "Study this with factual precision, elimination practice, and PYQ pattern recall.";
  }

  if (examBias.includes("Mains")) {
    return "Study this with conceptual depth, structure, and answer-framing angles.";
  }

  if (yearSpread === "Wide") {
    return "This topic has long-cycle relevance. Treat it as foundational, not temporary.";
  }

  return "Study this topic as a pattern cluster: identify repeated ideas, not just isolated questions.";
}

function normalizeMicroThemeLabel(value = "") {
  return String(value || "").trim();
}

function buildMicroThemeStats(questions = []) {
  const map = new Map();

  for (const q of questions) {
    const label = normalizeMicroThemeLabel(q.microTheme || q.subtopic || q.themeLabel || "");
    if (!label) continue;

    if (!map.has(label)) {
      map.set(label, {
        label,
        count: 0,
        years: new Set(),
        prelims: 0,
        mains: 0,
        latestYear: null,
        sampleQuestion: q.questionText || "",
      });
    }

    const item = map.get(label);
    item.count += 1;

    if (q.year) {
      item.years.add(Number(q.year));
      item.latestYear = item.latestYear
        ? Math.max(item.latestYear, Number(q.year))
        : Number(q.year);
    }

    if (q.paper === "prelims") item.prelims += 1;
    if (q.paper === "mains") item.mains += 1;
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      yearCount: item.years.size,
      years: [...item.years].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count || (b.latestYear || 0) - (a.latestYear || 0));
}

function getMicroThemePriority(item) {
  if (!item) return { label: "Low", tone: "red" };

  if (item.count >= 3 && item.latestYear && item.latestYear >= 2022) {
    return { label: "Revise First", tone: "green" };
  }

  if (item.count >= 2) {
    return { label: "Important", tone: "amber" };
  }

  return { label: "Single-hit", tone: "purple" };
}

function getMicroThemeAdvice(microThemeStats = []) {
  if (!microThemeStats.length) {
    return "No micro-theme data yet. Strengthen backend/graph mapping to unlock this layer.";
  }

  const top = microThemeStats[0];
  if (top.count >= 3) {
    return `The strongest revision candidate is "${top.label}". It repeats enough to deserve dedicated revision and PYQ linkage.`;
  }

  if (microThemeStats.length >= 5) {
    return "This topic is spread across many micro-themes. Revise by buckets, not as one flat chapter.";
  }

  return "Use micro-themes as revision anchors. They reveal how UPSC actually slices the topic.";
}

export default function PyqAnalysisView({
  summary,
  themes = [],
  timeline = [],
  questions = [],
  selectedTheme = "all",
  setSelectedTheme,
  linkedQuestionsMap = {},
}) {
  const linkedLeaders = getTopLinkedQuestions(questions, linkedQuestionsMap);

  const recurrence = getRecurrenceStrength(summary?.total || 0);
  const examBias = getExamBias(summary);
  const yearSpread = getYearSpread(timeline);
  const concentration = getThemeConcentration(themes, summary?.total || 0);
  const patternAdvice = getPatternAdvice({ summary, themes, timeline });

  const microThemeStats = buildMicroThemeStats(questions);
  const topMicroThemes = microThemeStats.slice(0, 8);
  const microThemeAdvice = getMicroThemeAdvice(microThemeStats);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <SectionCard
        title="Analysis Summary"
        subtitle="This view reveals how UPSC revisits, clusters, and evolves questions inside this topic."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <StatCard label="Total Questions" value={summary?.total || 0} tone="blue" />
          <StatCard label="Prelims" value={summary?.prelims || 0} tone="green" />
          <StatCard label="Mains" value={summary?.mains || 0} tone="amber" />
          <StatCard
            label="Peak Years"
            value={summary?.peakYears?.length ? summary.peakYears.join(", ") : "—"}
            tone="purple"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#93c5fd",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Pattern Signal
            </div>
            <div
              style={{
                color: "#f8fafc",
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {summary?.trendLabel || "Trend building"}
            </div>
            <div
              style={{
                color: "#cbd5e1",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              This topic should be studied as a recurring pattern, not as isolated PYQs.
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "#93c5fd",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Reading Cue
            </div>
            <div
              style={{
                color: "#f8fafc",
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Study for recurrence
            </div>
            <div
              style={{
                color: "#cbd5e1",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Focus on concepts, repeated patterns, and how UPSC changes framing across years.
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Pattern Insights Engine"
        subtitle="This layer converts visible PYQs into exam intelligence."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <StatCard label="Recurrence Strength" value={recurrence.label} tone={recurrence.tone} />
          <StatCard label="Exam Bias" value={examBias.label} tone={examBias.tone} />
          <StatCard label="Year Spread" value={yearSpread.label} tone={yearSpread.tone} />
          <StatCard label="Theme Concentration" value={concentration.label} tone={concentration.tone} />
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(30,41,59,0.58) 0%, rgba(15,23,42,0.58) 100%)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#93c5fd",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            Strategic Advice
          </div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {patternAdvice}
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Treat this block as a signal of UPSC thinking. Your goal is not only to remember the answer, but to identify the recurring frame behind the question.
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Micro-theme Intelligence"
        subtitle="This layer shows which exact micro-themes recur inside the visible question set."
        right={
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(168,85,247,0.22)",
              background: "rgba(168,85,247,0.10)",
              color: "#f3e8ff",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {microThemeStats.length} micro-theme{microThemeStats.length === 1 ? "" : "s"}
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <StatCard
            label="Recurring Micro-themes"
            value={microThemeStats.filter((x) => x.count >= 2).length}
            tone="purple"
          />
          <StatCard
            label="Single-hit Micro-themes"
            value={microThemeStats.filter((x) => x.count === 1).length}
            tone="amber"
          />
          <StatCard
            label="Top Micro-theme Count"
            value={microThemeStats[0]?.count || 0}
            tone="green"
          />
          <StatCard
            label="Latest Dominant Year"
            value={microThemeStats[0]?.latestYear || "—"}
            tone="blue"
          />
        </div>

        <div
          style={{
            padding: "16px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#d8b4fe",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            Revision Advice
          </div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            {microThemeAdvice}
          </div>
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Micro-themes should become the revision unit, because they map closer to how UPSC repeats concepts.
          </div>
        </div>

        {topMicroThemes.length === 0 ? (
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 15,
            }}
          >
            No micro-theme data available yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {topMicroThemes.map((item) => {
              const priority = getMicroThemePriority(item);
              const width = Math.max(
                8,
                Math.min(
                  100,
                  Math.round((item.count / Math.max(topMicroThemes[0]?.count || 1, 1)) * 100)
                )
              );

              return (
                <div
                  key={item.label}
                  style={{
                    padding: "16px",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        color: "#f5f3ff",
                        fontSize: 16,
                        fontWeight: 800,
                      }}
                    >
                      {item.label}
                    </div>

                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background:
                          priority.tone === "green"
                            ? "rgba(16,185,129,0.12)"
                            : priority.tone === "amber"
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(168,85,247,0.12)",
                        border:
                          priority.tone === "green"
                            ? "1px solid rgba(52,211,153,0.22)"
                            : priority.tone === "amber"
                              ? "1px solid rgba(251,191,36,0.22)"
                              : "1px solid rgba(192,132,252,0.22)",
                        color:
                          priority.tone === "green"
                            ? "#dcfce7"
                            : priority.tone === "amber"
                              ? "#fde68a"
                              : "#f3e8ff",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {priority.label}
                    </div>
                  </div>

                  <div
                    style={{
                      height: 12,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.05)",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: `${width}%`,
                        height: "100%",
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, rgba(168,85,247,0.85), rgba(59,130,246,0.85))",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(96,165,250,0.20)",
                        color: "#dbeafe",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Count: {item.count}
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(16,185,129,0.12)",
                        border: "1px solid rgba(52,211,153,0.20)",
                        color: "#d1fae5",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Latest: {item.latestYear || "—"}
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(251,191,36,0.20)",
                        color: "#fde68a",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Year Spread: {item.yearCount}
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(168,85,247,0.12)",
                        border: "1px solid rgba(192,132,252,0.20)",
                        color: "#f3e8ff",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      P: {item.prelims} | M: {item.mains}
                    </span>
                  </div>

                  {item.sampleQuestion ? (
                    <div
                      style={{
                        color: "#cbd5e1",
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      Sample signal: {item.sampleQuestion}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Theme Distribution"
        subtitle="Theme buckets help reveal where this topic concentrates its questioning."
        right={
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <SmallPill
              active={selectedTheme === "all"}
              onClick={() => setSelectedTheme?.("all")}
            >
              All Themes
            </SmallPill>
            {themes.slice(0, 6).map((theme) => (
              <SmallPill
                key={theme.id}
                active={selectedTheme === theme.id}
                onClick={() => setSelectedTheme?.(theme.id)}
              >
                {theme.label} · {theme.count}
              </SmallPill>
            ))}
          </div>
        }
      >
        {themes.length === 0 ? (
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 15,
            }}
          >
            No theme data available.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {themes.map((theme) => {
              const width = Math.max(
                8,
                Math.min(100, Math.round((theme.count / Math.max(themes[0]?.count || 1, 1)) * 100))
              );

              return (
                <div
                  key={theme.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr 56px",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      color: "#e5e7eb",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {theme.label}
                  </div>

                  <div
                    style={{
                      height: 12,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div
                      style={{
                        width: `${width}%`,
                        height: "100%",
                        borderRadius: 999,
                        background:
                          "linear-gradient(90deg, rgba(59,130,246,0.8), rgba(168,85,247,0.8))",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      color: "#93c5fd",
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {theme.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Timeline Evolution"
        subtitle="Time Travel view for how this topic appears across years."
        right={
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#cbd5e1",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {getTimelineSignal(timeline)}
          </div>
        }
      >
        {timeline.length === 0 ? (
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 15,
            }}
          >
            No timeline data available.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {timeline.map((item) => (
              <div
                key={item.year}
                style={{
                  padding: "16px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#93c5fd",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                    fontWeight: 700,
                  }}
                >
                  Year
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#f8fafc",
                    marginBottom: 10,
                  }}
                >
                  {item.year}
                </div>

                <div
                  style={{
                    color: "#cbd5e1",
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  Questions: <span style={{ color: "#fff", fontWeight: 700 }}>{item.count}</span>
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {item.patternLabel || "Asked in this year"}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Recurring / Linked Question Signals"
        subtitle="These are the strongest repeated or connected question signals inside the visible set."
      >
        {linkedLeaders.length === 0 ? (
          <div
            style={{
              color: "#cbd5e1",
              fontSize: 15,
            }}
          >
            No strong linked-question signals yet. This will improve as your theme linking grows.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {linkedLeaders.map((q, idx) => (
              <div
                key={q.id || idx}
                style={{
                  padding: "16px",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(59,130,246,0.16)",
                      border: "1px solid rgba(96,165,250,0.24)",
                      color: "#dbeafe",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {q.year || "—"}
                  </span>

                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(245,158,11,0.14)",
                      border: "1px solid rgba(251,191,36,0.22)",
                      color: "#fde68a",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Linked: {q.linkedCount}
                  </span>

                  {q.microTheme ? (
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(168,85,247,0.14)",
                        border: "1px solid rgba(192,132,252,0.22)",
                        color: "#f3e8ff",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {q.microTheme}
                    </span>
                  ) : null}
                </div>

                <div
                  style={{
                    color: "#f8fafc",
                    fontSize: 16,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {q.questionText}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}