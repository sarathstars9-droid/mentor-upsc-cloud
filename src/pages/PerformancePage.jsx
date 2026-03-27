import { useMemo } from "react";

const ATTEMPTS_STORAGE_KEY = "prelims_test_attempts_v1";

function readAttempts() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pct(num, den) {
  if (!den) return 0;
  return Number(((num / den) * 100).toFixed(2));
}

function aggregateBy(attempts, getter) {
  const map = new Map();
  for (const attempt of attempts) {
    for (const q of attempt.questions || []) {
      const key = getter(q);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { label: key, total: 0, correct: 0, wrong: 0, unattempted: 0 });
      }
      const row = map.get(key);
      row.total += 1;
      row[q.status] += 1;
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      accuracy: pct(row.correct, row.correct + row.wrong),
      painScore: row.wrong * 2 + row.unattempted,
    }))
    .sort((a, b) => b.painScore - a.painScore);
}

function latestTrend(attempts) {
  return attempts
    .slice(0, 10)
    .reverse()
    .map((attempt, index) => ({
      label: `${index + 1}`,
      score: attempt.summary?.score || 0,
      accuracy: attempt.summary?.accuracy || 0,
      risk: attempt.summary?.riskTendency || "low",
    }));
}

export default function PerformancePage() {
  const attempts = readAttempts();

  const metrics = useMemo(() => {
    const totalAttempts = attempts.length;
    const totalQuestions = attempts.reduce((sum, a) => sum + (a.summary?.total || 0), 0);
    const totalCorrect = attempts.reduce((sum, a) => sum + (a.summary?.correct || 0), 0);
    const totalWrong = attempts.reduce((sum, a) => sum + (a.summary?.wrong || 0), 0);
    const totalSkipped = attempts.reduce((sum, a) => sum + (a.summary?.unattempted || 0), 0);

    const avgAccuracy = totalAttempts
      ? Number(
        (
          attempts.reduce((sum, a) => sum + Number(a.summary?.accuracy || 0), 0) / totalAttempts
        ).toFixed(2)
      )
      : 0;

    const weakThemes = aggregateBy(attempts, (q) => q.microThemeLabel).slice(0, 8);
    const weakNodes = aggregateBy(attempts, (q) => q.syllabusNodeId).slice(0, 8);
    const weakSubjects = aggregateBy(attempts, (q) => q.subjectId).slice(0, 8);
    const weakQuestionTypes = aggregateBy(attempts, (q) => q.questionType).slice(0, 8);

    return {
      totalAttempts,
      totalQuestions,
      totalCorrect,
      totalWrong,
      totalSkipped,
      avgAccuracy,
      weakThemes,
      weakNodes,
      weakSubjects,
      weakQuestionTypes,
      trend: latestTrend(attempts),
    };
  }, [attempts]);

  return (
    <div style={page}>
      <div style={headerCard}>
        <div style={kicker}>PHASE 3A</div>
        <h2 style={{ margin: 0 }}>Prelims Performance Intelligence</h2>
        <p style={sub}>
          Accuracy trends, weak clusters, and question-pattern analytics from stored prelims attempts.
        </p>
      </div>

      {!metrics.totalAttempts ? (
        <div style={emptyCard}>No prelims attempts yet. Complete a test to unlock the dashboard.</div>
      ) : (
        <>
          <div style={statsGrid}>
            <Stat title="Attempts" value={metrics.totalAttempts} />
            <Stat title="Questions Seen" value={metrics.totalQuestions} />
            <Stat title="Average Accuracy" value={`${metrics.avgAccuracy}%`} />
            <Stat title="Wrong" value={metrics.totalWrong} />
            <Stat title="Skipped" value={metrics.totalSkipped} />
          </div>

          <div style={twoCol}>
            <Panel title="Last 10 Attempts Trend">
              <div style={{ display: "grid", gap: 10 }}>
                {metrics.trend.map((row) => (
                  <div key={row.label} style={rowCard}>
                    <strong>Attempt {row.label}</strong>
                    <span>Score: {row.score}</span>
                    <span>Accuracy: {row.accuracy}%</span>
                    <span style={{ textTransform: "capitalize" }}>Risk: {row.risk}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Weak Subjects">
              <List rows={metrics.weakSubjects} />
            </Panel>
          </div>

          <div style={twoCol}>
            <Panel title="Weak Micro-themes">
              <List rows={metrics.weakThemes} />
            </Panel>

            <Panel title="Weak Syllabus Nodes">
              <List rows={metrics.weakNodes} />
            </Panel>
          </div>

          <Panel title="Weak Question Types">
            <List rows={metrics.weakQuestionTypes} />
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function List({ rows }) {
  if (!rows.length) {
    return <div style={{ opacity: 0.7 }}>No data yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => (
        <div key={row.label} style={rowCard}>
          <strong>{row.label}</strong>
          <span>Correct: {row.correct}</span>
          <span>Wrong: {row.wrong}</span>
          <span>Skipped: {row.unattempted}</span>
          <span>Accuracy: {row.accuracy}%</span>
        </div>
      ))}
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#0b1020",
  color: "#e5e7eb",
  padding: "24px 16px 56px",
};

const headerCard = {
  maxWidth: 1200,
  margin: "0 auto 18px",
  padding: 20,
  borderRadius: 20,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const kicker = { fontSize: 12, opacity: 0.75, marginBottom: 8 };
const sub = { margin: "8px 0 0", fontSize: 14, opacity: 0.8 };
const statsGrid = {
  maxWidth: 1200,
  margin: "0 auto 18px",
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 14,
};
const statCard = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};
const twoCol = {
  maxWidth: 1200,
  margin: "0 auto 18px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
};
const panel = {
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};
const rowCard = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  display: "grid",
  gridTemplateColumns: "1.5fr repeat(4, auto)",
  gap: 10,
  alignItems: "center",
};
const emptyCard = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 18,
  borderRadius: 18,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};
