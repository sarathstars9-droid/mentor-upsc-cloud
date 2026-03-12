import { BLOCK_STATUS } from "../blockConstants";

export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function daysLeft(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  return Math.max(0, diff);
}

export function getCompletionPercent(planMin, doneMin) {
  const p = safeNumber(planMin, 0);
  const d = safeNumber(doneMin, 0);

  if (p <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((d / p) * 100)));
}

export function getDailyMotivation(completionPercent) {
  if (completionPercent >= 80) {
    return "Excellent consistency today. This is topper behaviour.";
  }

  if (completionPercent >= 50) {
    return "Good effort. Tomorrow tighten execution.";
  }

  return "No guilt. Reset tomorrow. Small correction makes big change.";
}

export function getBacklogSummary(blocks = []) {

  let missed = 0;
  let partial = 0;

  blocks.forEach((b) => {
    const status = String(b.Status || "").toLowerCase();

    if (status === "missed") missed++;
    if (status === "partial") partial++;
  });

  const insights = [];

  if (missed > 0) {
    insights.push(`${missed} missed block${missed > 1 ? "s" : ""}`);
  }

  if (partial > 0) {
    insights.push(`${partial} partial block${partial > 1 ? "s" : ""}`);
  }

  if (missed > 0 || partial > 0) {
    insights.push("Recover one serious block tomorrow morning");
  } else {
    insights.push("No backlog pressure detected");
  }

  return insights;
}

export function buildPlanItemMappingPath(item) {
  const m = item?.mapped;
  if (!m) return "";

  const parts = [m.gsPaper, m.gsHeading, m.macroTheme, m.microTheme].filter(Boolean);
  return parts.join(" > ");
}

export function makeStableBlockId(dateStr, item, index) {
  const d = String(dateStr || "");
  const s = String(item?.startTime || item?.PlannedStart || item?.start || "").replace(
    /[^\dA-Za-z]/g,
    ""
  );
  const subj = String(item?.subject || item?.PlannedSubject || "Unknown")
    .replace(/\W+/g, "_")
    .slice(0, 20);

  return `${d}__${s}__${subj}__${index + 1}`;
}

export function buildTodayBlocksFromParsed(out) {
  const items = Array.isArray(out?.items) ? out.items : [];

  return items.map((item, index) => ({
    BlockId: makeStableBlockId(out?.date || "", item, index),
    Date: out?.date || "",
    PlannedSubject: item?.subject || "Unknown",
    PlannedTopic: item?.topic || "",
    PlannedStart: item?.startTime || "",
    PlannedEnd: item?.endTime || "",
    PlannedMinutes: safeNumber(item?.minutes, 0),

    ActualSubject: "",
    ActualTopic: "",
    ActualStart: "",
    ActualEnd: "",
    ActualMinutes: 0,

    PauseCount: 0,
    TotalPauseMinutes: 0,
    LastPauseAt: "",
    LastResumeAt: "",

    Status: BLOCK_STATUS.PLANNED,
    CompletionStatus: "",
    TopicMatchStatus: "",
    DelayMinutes: 0,
    GraceState: "",

    OutputType: "",
    OutputCount: 0,
    FocusRating: "",
    InterruptionReason: "",
    ReviewNotes: "",

    BacklogBucket: "",
    CarriedToNextDay: "no",
    CarryTargetDate: "",
    ParentBlockId: "",

    SyllabusTop1Code: item?.mapped?.code ? String(item.mapped.code) : "",
    SyllabusTop1Path: buildPlanItemMappingPath(item),
    Top3Codes: "",
    Top3Paths: "",
    Top3Names: "",

    MasterySignal: "",
    ConfidenceScore: "",
    FakeStudyRisk: "",

    PlanSource: "photo_ocr",
  }));
}

export function formatTimeOnly(isoString) {
  if (!isoString) return "";

  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function hhmmToMinutes(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  return Number(m[1]) * 60 + Number(m[2]);
}

export function sumActualMinutes(blocks) {
  return (blocks || []).reduce((sum, block) => {
    return sum + safeNumber(block?.ActualMinutes, 0);
  }, 0);
}

export function nowMinutesOfDay() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function getDisplayStatus(status) {
  return String(status || BLOCK_STATUS.PLANNED).toLowerCase();
}

export function getStatusBadgeColor(status) {
  const s = getDisplayStatus(status);

  if (s === BLOCK_STATUS.COMPLETED) return "#7B888A";
  if (s === BLOCK_STATUS.PARTIAL) return "#565C61";
  if (s === BLOCK_STATUS.MISSED) return "#393E43";
  if (s === BLOCK_STATUS.ACTIVE) return "#7B888A";
  if (s === BLOCK_STATUS.PAUSED) return "#565C61";
  if (s === BLOCK_STATUS.SKIPPED || s === "skipped") return "#2D3038";

  return "#393E43";
}

export function plannedMinFromParsed(out) {
  const total = safeNumber(out?.totalMinutes, 0);
  if (total > 0) return total;

  const items = Array.isArray(out?.items) ? out.items : [];
  return items.reduce((sum, item) => sum + safeNumber(item?.minutes, 0), 0);
}

export function sumCsatMinutesFromParsed(out) {
  const items = Array.isArray(out?.items) ? out.items : [];

  return items.reduce((sum, item) => {
    const subject = String(item?.subject ?? "").toLowerCase();
    const topic = String(item?.topic ?? item?.task ?? "").toLowerCase();
    const mins = safeNumber(item?.minutes, 0);

    const isCsat =
      subject.includes("csat") ||
      topic.includes("csat") ||
      topic.includes("quant") ||
      topic.includes("reasoning") ||
      topic.includes("rc") ||
      topic.includes("comprehension") ||
      topic.includes("aptitude") ||
      topic.includes("number system") ||
      topic.includes("seating arrangement");

    return sum + (isCsat ? mins : 0);
  }, 0);
}

export function buildApprovedOcrBlocks(date, ocrDraftBlocks) {
  return (ocrDraftBlocks || []).map((block, index) => {
    const stableLike = {
      startTime: block.PlannedStart || "",
      subject: block.PlannedSubject || "Unknown",
    };

    return {
      ...block,
      BlockId: makeStableBlockId(date, stableLike, index),
      Date: date,
      PlannedMinutes: safeNumber(block.PlannedMinutes, 0),
    };
  });
}

export function buildScheduleBlocksPayload(blocks) {
  return (blocks || []).map((block) => ({
    blockId: block.BlockId,
    startTime: block.PlannedStart || "",
    endTime: block.PlannedEnd || "",
    minutes: safeNumber(block.PlannedMinutes, 0),
    subject: block.PlannedSubject || "Unknown",
    topic: block.PlannedTopic || "",
    mappingCode: block.SyllabusTop1Code || "",
    mappingPath: block.SyllabusTop1Path || "",
    topMatchesCodes: "",
  }));
}

/* ---------------- Performance helpers ---------------- */

export function getStatusCounts(blocks) {
  return (blocks || []).reduce(
    (acc, block) => {
      const status = getDisplayStatus(block?.Status);

      if (status === BLOCK_STATUS.COMPLETED) acc.completed += 1;
      else if (status === BLOCK_STATUS.PARTIAL) acc.partial += 1;
      else if (status === BLOCK_STATUS.MISSED) acc.missed += 1;
      else if (status === BLOCK_STATUS.PLANNED) acc.planned += 1;
      else if (status === BLOCK_STATUS.ACTIVE) acc.active += 1;
      else if (status === BLOCK_STATUS.PAUSED) acc.paused += 1;
      else if (status === BLOCK_STATUS.SKIPPED || status === "skipped") acc.skipped += 1;
      else acc.other += 1;

      return acc;
    },
    {
      completed: 0,
      partial: 0,
      missed: 0,
      planned: 0,
      active: 0,
      paused: 0,
      skipped: 0,
      other: 0,
    }
  );
}

export function countDelayedStarts(blocks) {
  return (blocks || []).filter((block) => safeNumber(block?.DelayMinutes, 0) > 0).length;
}

export function getTotalStudyHours(doneMin) {
  return (safeNumber(doneMin, 0) / 60).toFixed(1);
}

export function getSimpleStreakDays(blocks, doneMin) {
  const counts = getStatusCounts(blocks);
  return safeNumber(doneMin, 0) >= 180 || counts.completed > 0 ? 1 : 0;
}

export function getSubjectDistribution(blocks) {
  const distribution = {};

  for (const block of blocks || []) {
    const subject = String(block?.PlannedSubject || "Unknown").trim() || "Unknown";
    distribution[subject] = (distribution[subject] || 0) + safeNumber(block?.PlannedMinutes, 0);
  }

  return distribution;
}

export function getSubjectDistributionText(blocks) {
  const distribution = getSubjectDistribution(blocks);
  const entries = Object.entries(distribution);

  if (!entries.length) return "No subject data yet.";

  return entries.map(([subject, minutes]) => `${subject}: ${minutes} min`).join(" • ");
}

export function getWeakAreas(blocks) {
  const counts = getStatusCounts(blocks);
  const weakAreas = [];

  if (countDelayedStarts(blocks) > 0) {
    weakAreas.push("Delayed starts affecting first serious block");
  }

  if (counts.partial > 0) {
    weakAreas.push("Partial block conversion is still leaking time");
  }

  if (counts.missed > 0 || counts.skipped > 0) {
    weakAreas.push("Missed blocks are becoming backlog risk");
  }

  if (!weakAreas.length) {
    weakAreas.push("No major weak area detected yet");
  }

  return weakAreas;
}

export function getTimeLeakSummary(blocks) {
  const delayedStarts = countDelayedStarts(blocks);
  const counts = getStatusCounts(blocks);
  const leaks = [];

  if (delayedStarts > 0) {
    leaks.push(`Delay before start: ${delayedStarts} block${delayedStarts > 1 ? "s" : ""} affected`);
  }

  if (counts.partial > 0) {
    leaks.push(`Partial completion in ${counts.partial} block${counts.partial > 1 ? "s" : ""}`);
  }

  if (counts.missed > 0 || counts.skipped > 0) {
    const missedTotal = counts.missed + counts.skipped;
    leaks.push(`Unrecovered missed/skipped blocks: ${missedTotal}`);
  }

  if (!leaks.length) {
    leaks.push("No major time leak visible yet");
  }

  return leaks;
}

export function getLoopFrequencySummary(blocks) {
  const delayedStarts = countDelayedStarts(blocks);
  const counts = getStatusCounts(blocks);

  return [
    `Start friction: ${delayedStarts >= 2 ? "medium" : delayedStarts === 1 ? "low" : "stable"}`,
    `Pause drift: ${counts.paused >= 2 ? "medium" : counts.paused === 1 ? "low" : "stable"}`,
    `Backlog carry risk: ${counts.missed + counts.skipped >= 2 ? "medium" : counts.missed + counts.skipped === 1 ? "low" : "stable"}`,
  ];
}

export function getRevisionDueSummary(blocks = []) {
  const items = [];

  for (const block of blocks) {
    const status = String(block?.Status || "").toLowerCase();
    const subject = String(block?.PlannedSubject || "Unknown").trim();
    const topic = String(block?.PlannedTopic || "").trim();

    if (status === "completed") {
      if (topic) {
        items.push(`${subject} — ${topic} revision due soon`);
      } else {
        items.push(`${subject} revision due soon`);
      }
    }

    if (status === "partial") {
      if (topic) {
        items.push(`${subject} — ${topic} needs quick recovery + revision`);
      } else {
        items.push(`${subject} needs quick recovery + revision`);
      }
    }
  }

  if (!items.length) {
    return ["No revision items detected yet"];
  }

  return items.slice(0, 4);
}

export function getTopicCoverageSummary(blocks) {
  const distribution = getSubjectDistribution(blocks);
  const entries = Object.entries(distribution);

  if (!entries.length) return ["No subject coverage tracked yet"];

  return entries.map(([subject, minutes]) => {
    if (minutes >= 120) return `${subject}: strong coverage`;
    if (minutes >= 60) return `${subject}: progressing`;
    return `${subject}: light coverage`;
  });
}