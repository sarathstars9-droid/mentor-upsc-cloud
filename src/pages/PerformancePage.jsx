import { useEffect, useMemo, useState } from "react";
import ExecutionHeatmap from "../components/ExecutionHeatmap";
import { buildHeatmapFromBlocks } from "../utils/dashboard";
import { BACKEND_URL } from "../config";
import { getBacklogSummary } from "../utils/studyEngine";
import {
  getCompletionPercent,
  getStatusCounts,
  countDelayedStarts,
  getTotalStudyHours,
  getSimpleStreakDays,
  getSubjectDistributionText,
  getWeakAreas,
  getTimeLeakSummary,
  getLoopFrequencySummary,
  getTopicCoverageSummary,
  getRevisionDueSummary
} from "../utils/studyEngine";

async function post(action, payload = {}) {
  const res = await fetch(`${BACKEND_URL}/api/sheets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: "Backend proxy did not return JSON", raw: text };
  }
}

export default function PerformancePage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [realBlocks, setRealBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState("");

  const mockBlocks = [
    { Status: "completed", PlannedSubject: "GS2", PlannedMinutes: 120, ActualMinutes: 110, DelayMinutes: 10 },
    { Status: "completed", PlannedSubject: "CSAT", PlannedMinutes: 90, ActualMinutes: 90, DelayMinutes: 0 },
    { Status: "partial", PlannedSubject: "Essay", PlannedMinutes: 60, ActualMinutes: 27, DelayMinutes: 15 },
    { Status: "missed", PlannedSubject: "Optional", PlannedMinutes: 90, ActualMinutes: 0, DelayMinutes: 20 },
    { Status: "planned", PlannedSubject: "Revision", PlannedMinutes: 90, ActualMinutes: 0, DelayMinutes: 0 },
  ];

  useEffect(() => {
    if (!selectedDate) return;

    async function loadBlocks() {
      setLoading(true);
      setLoadMessage("Loading performance blocks...");

      try {
        const res = await post("getBlocksForDate", { date: selectedDate });

        if (!res?.ok && !Array.isArray(res?.blocks)) {
          setRealBlocks([]);
          setLoadMessage("No real data found yet. Showing fallback mode.");
          return;
        }

        const blocks = Array.isArray(res?.blocks) ? res.blocks : [];

        const mapped = blocks.map((b) => ({
          BlockId: b.BlockId,
          PlannedSubject: b.Subject || "Unknown",
          PlannedTopic: b.Topic || "",
          PlannedStart: b.Start || "",
          PlannedEnd: b.End || "",
          PlannedMinutes: Number(b.Minutes || 0),

          ActualStart: b.ActualStart || "",
          ActualEnd: b.ActualEnd || "",
          ActualMinutes: Number(b.ActualMinutes || 0),

          PauseCount: Number(b.PauseCount || 0),
          TotalPauseMinutes: Number(b.TotalPauseMinutes || 0),
          LastPauseAt: b.LastPauseAt || "",
          LastResumeAt: b.LastResumeAt || "",

          Status: b.Status || "planned",
          CompletionStatus: b.CompletionStatus || "",
          TopicMatchStatus: b.TopicMatchStatus || "",
          DelayMinutes: Number(b.DelayMinutes || 0),

          OutputType: b.OutputType || "",
          OutputCount: Number(b.OutputCount || 0),
          FocusRating: b.FocusRating || "",
          InterruptionReason: b.InterruptionReason || "",
          ReviewNotes: b.ReviewNotes || "",
          BacklogBucket: b.BacklogBucket || "",

          ActualSubject: b.ActualSubject || "",
          ActualTopic: b.ActualTopic || "",

          SyllabusTop1Code: b.MappingCode || "",
          SyllabusTop1Path: b.MappingPath || "",
        }));

        setRealBlocks(mapped);

        if (mapped.length > 0) {
          setLoadMessage(`Loaded ${mapped.length} block${mapped.length > 1 ? "s" : ""} for ${selectedDate}.`);
        } else {
          setLoadMessage("No real data found yet. Showing fallback mode.");
        }
      } catch (err) {
        console.error("PerformancePage load failed", err);
        setRealBlocks([]);
        setLoadMessage("Could not load real data. Showing fallback mode.");
      } finally {
        setLoading(false);
      }
    }

    loadBlocks();
  }, [selectedDate]);

  const hasRealData = Array.isArray(realBlocks) && realBlocks.length > 0;

  const blocks = hasRealData ? realBlocks : mockBlocks;

  const doneMin = useMemo(() => {
    if (!hasRealData) return 227;
    return blocks.reduce((sum, block) => sum + Number(block.ActualMinutes || 0), 0);
  }, [blocks, hasRealData]);

  const planMin = useMemo(() => {
    if (!hasRealData) return 360;
    return blocks.reduce((sum, block) => sum + Number(block.PlannedMinutes || 0), 0);
  }, [blocks, hasRealData]);

  const csatMin = useMemo(() => {
    if (!hasRealData) return 60;

    return blocks.reduce((sum, block) => {
      const subject = String(block?.PlannedSubject || "").toLowerCase();
      const topic = String(block?.PlannedTopic || "").toLowerCase();
      const mins = Number(block?.ActualMinutes || block?.PlannedMinutes || 0);

      const isCsat =
        subject.includes("csat") ||
        topic.includes("csat") ||
        topic.includes("quant") ||
        topic.includes("reasoning") ||
        topic.includes("rc") ||
        topic.includes("comprehension") ||
        topic.includes("aptitude");

      return sum + (isCsat ? mins : 0);
    }, 0);
  }, [blocks, hasRealData]);

  const completion = useMemo(() => {
    return getCompletionPercent(planMin, doneMin);
  }, [planMin, doneMin]);

  const counts = useMemo(() => getStatusCounts(blocks), [blocks]);
  const delayedStarts = useMemo(() => countDelayedStarts(blocks), [blocks]);
  const totalStudyHours = useMemo(() => getTotalStudyHours(doneMin), [doneMin]);
  const streakDays = useMemo(() => getSimpleStreakDays(blocks, doneMin), [blocks, doneMin]);
  const subjectDistributionText = useMemo(() => getSubjectDistributionText(blocks), [blocks]);

  const weakAreas = useMemo(() => getWeakAreas(blocks), [blocks]);
  const timeLeaks = useMemo(() => getTimeLeakSummary(blocks), [blocks]);
  const loopFrequency = useMemo(() => getLoopFrequencySummary(blocks), [blocks]);
  const topicCoverage = useMemo(() => getTopicCoverageSummary(blocks), [blocks]);
  const backlogSummary = useMemo(() => getBacklogSummary(blocks), [blocks]);
  const revisionDueSummary = useMemo(() => getRevisionDueSummary(blocks), [blocks]);

  const completedPercentText = `${completion}%`;
  const pendingPercentText = `${Math.max(0, 100 - completion)}%`;

  return (
    <div className="page-wrap">
      <div className="surface-card">
        <h1 className="page-title">Performance</h1>
        <p className="page-subtitle">
          Quiet consistency matters more than dramatic days.
        </p>

        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <label className="field-label" style={{ minWidth: 220 }}>
            Performance Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <div className="footer-note" style={{ marginTop: 20 }}>
            Data mode: <b>{hasRealData ? "Real" : "Fallback / Mock"}</b>
          </div>

          <div className="footer-note" style={{ marginTop: 20 }}>
            {loading ? "Loading..." : loadMessage}
          </div>
        </div>
      </div>

      <ExecutionHeatmap data={buildHeatmapFromBlocks(blocks, doneMin)} />

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Completion %</div>
          <div className="metric-value">{completion}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Study Hours</div>
          <div className="metric-value">{totalStudyHours}h</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Completed Blocks</div>
          <div className="metric-value">{counts.completed}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Partial Blocks</div>
          <div className="metric-value">{counts.partial}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Missed Blocks</div>
          <div className="metric-value">{counts.missed}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Delayed Starts</div>
          <div className="metric-value">{delayedStarts}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">CSAT Minutes</div>
          <div className="metric-value">{csatMin}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Study Streak</div>
          <div className="metric-value">{streakDays} Day</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="surface-card">
          <h3 className="section-title">Subject Distribution</h3>
          <div className="placeholder-chart">{subjectDistributionText}</div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Daily Hours Snapshot</h3>
          <div className="placeholder-chart">
            For {selectedDate}: {totalStudyHours}h tracked. Weekly trend can be added after a few real days accumulate.
          </div>
        </div>

        <div className="surface-card chart-wide">
          <h3 className="section-title">Syllabus Completion Bar</h3>
          <div className="progress-shell">
            <div className="progress-bar" style={{ width: `${completion}%` }} />
          </div>
          <div className="progress-meta">
            <span>Completed: {completedPercentText}</span>
            <span>Pending: {pendingPercentText}</span>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="surface-card">
          <h3 className="section-title">Pending Syllabus</h3>
          <div className="insight-list">
            <div>GS2 Polity — Parliament revision pending</div>
            <div>Essay — 2 frameworks pending</div>
            <div>Optional Geography — Mapping practice pending</div>
          </div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Revision Due</h3>
         <div className="insight-list">
  {revisionDueSummary.map((item, idx) => (
    <div key={idx}>{item}</div>
  ))}
</div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Backlog Rescue</h3>
         <div className="insight-list">
  {backlogSummary.map((item, idx) => (
    <div key={idx}>{item}</div>
  ))}
</div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">What More to Study</h3>
          <div className="insight-list">
            <div>Finish pending GS2 topic</div>
            <div>Add one CSAT reasoning block</div>
            <div>Close one revision loop before new content</div>
          </div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Weak Areas</h3>
          <div className="insight-list">
            {weakAreas.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Where Time Is Leaking</h3>
          <div className="insight-list">
            {timeLeaks.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Loop Frequency</h3>
          <div className="insight-list">
            {loopFrequency.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        </div>

        <div className="surface-card">
          <h3 className="section-title">Topic Coverage by Subject</h3>
          <div className="insight-list">
            {topicCoverage.map((item, idx) => (
              <div key={idx}>{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}