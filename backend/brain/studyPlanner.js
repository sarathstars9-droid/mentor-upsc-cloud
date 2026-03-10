// backend/brain/studyPlanner.js
import { hhmmToMin, minToHHMM, minutesBetween, clamp } from "./timeUtils.js";

function hasLoop(loops, code) {
  return Array.isArray(loops) && loops.some((f) => String(f.code) === code);
}

function pickDeepBlockSize(budgetMin) {
  // Dynamic sizes based on budget
  if (budgetMin >= 900) return [120, 90, 90, 75, 60];
  if (budgetMin >= 720) return [120, 90, 75, 60];
  if (budgetMin >= 600) return [90, 75, 75, 60];
  if (budgetMin >= 480) return [90, 75, 60];
  return [75, 60];
}

function pushBlock(blocks, curMin, minutes, obj) {
  const startTime = minToHHMM(curMin);
  const endTime = minToHHMM(curMin + minutes);
  blocks.push({ startTime, endTime, minutes, ...obj });
  return curMin + minutes;
}

export function buildStudyPlan(input) {
  const date = String(input?.date || "").trim();
  const dayStart = String(input?.dayStart || "04:30").trim();
  const dayEnd = String(input?.dayEnd || "22:30").trim();

  const planMin = Number(input?.planMin) || 600; // target
  const loops = input?.loops || [];              // from loop detector
  const radar = input?.radar || {};              // from radarEngine
  const focus = input?.focus || {};              // mapped focus/weakness hint

  const availableMin = minutesBetween(dayStart, dayEnd);
  const fixedBreakMin = 120; // meals + routine combined (dynamic system assumes this)
  const usableMin = Math.max(0, availableMin - fixedBreakMin);
  const effectivePlanMin = clamp(planMin, 180, usableMin);

  const flags = {
    csatAvoid: hasLoop(loops, "LOOP_CSAT_AVOID"),
    testAvoid: hasLoop(loops, "LOOP_TEST_AVOID"),
    distraction: hasLoop(loops, "LOOP_DISTRACTION"),
    overplan: hasLoop(loops, "LOOP_OVERPLAN"),
    chaos: hasLoop(loops, "LOOP_CHAOS"),
  };

  // ---- minimum allocations ----
  let csatMin = flags.csatAvoid ? 60 : 45;
  let testMin = flags.testAvoid ? 60 : 30;
  let revisionMin = 60;
  let bufferMin = 20;

  // If execution has been weak, reduce aggression
  const exec = Number(radar.execution || 0);
  if (exec < 50) {
    revisionMin = 75;
    bufferMin = 30;
    testMin = Math.max(testMin, 45);
    csatMin = Math.max(csatMin, 45);
  }

  // Ensure allocations fit inside effectivePlanMin
  const base = csatMin + testMin + revisionMin + bufferMin;
  const remaining = Math.max(0, effectivePlanMin - base);

  // Deep work blocks sum to remaining
  const deepSizes = pickDeepBlockSize(remaining);
  let deepTotal = deepSizes.reduce((s, x) => s + x, 0);
  // Trim if overshoot
  while (deepTotal > remaining && deepSizes.length) {
    deepSizes[deepSizes.length - 1] -= 15;
    if (deepSizes[deepSizes.length - 1] < 45) deepSizes.pop();
    deepTotal = deepSizes.reduce((s, x) => s + x, 0);
  }

  // ---- Build blocks on timeline ----
  const blocks = [];
  let cur = hhmmToMin(dayStart);

  // A) Deep blocks (topics)
  const gsSubject = focus?.gsSubject || "GS";
  const gsTopic = focus?.gsTopic || "Core coverage + PYQ linkage";

  deepSizes.forEach((mins, idx) => {
    cur = pushBlock(blocks, cur, mins, {
      type: "DEEP",
      subject: gsSubject,
      topic: idx === 0 ? gsTopic : `${gsTopic} (continue)`,
      priority: idx < 2 ? "MUST" : "SHOULD",
    });
    // micro break 10 min after each deep block
    cur = pushBlock(blocks, cur, 10, { type: "BREAK", subject: "Break", topic: "Reset", priority: "MUST" });
  });

  // B) CSAT block
  cur = pushBlock(blocks, cur, csatMin, {
    type: "CSAT",
    subject: "CSAT",
    topic: flags.csatAvoid ? "Non-negotiable CSAT (accuracy)" : "CSAT practice",
    priority: "MUST",
  });
  cur = pushBlock(blocks, cur, 10, { type: "BREAK", subject: "Break", topic: "Reset", priority: "MUST" });

  // C) Revision block
  cur = pushBlock(blocks, cur, revisionMin, {
    type: "REVISION",
    subject: gsSubject,
    topic: "Revision + short notes + 10 PYQs scan",
    priority: "MUST",
  });
  cur = pushBlock(blocks, cur, 10, { type: "BREAK", subject: "Break", topic: "Reset", priority: "MUST" });

  // D) Test / PYQ block
  cur = pushBlock(blocks, cur, testMin, {
    type: "TEST",
    subject: gsSubject,
    topic: flags.testAvoid ? "Timed PYQ + Review (must)" : "PYQ drill / answer writing",
    priority: "MUST",
  });
  cur = pushBlock(blocks, cur, 10, { type: "BREAK", subject: "Break", topic: "Reset", priority: "MUST" });

  // E) Buffer
  cur = pushBlock(blocks, cur, bufferMin, {
    type: "BUFFER",
    subject: "Buffer",
    topic: "Backlog / spillover / closure",
    priority: "MUST",
  });

  // Coach note (based on loops)
  let coachNote = "Protect momentum. One clean day.";
  if (flags.csatAvoid) coachNote = "CSAT is non-negotiable tomorrow. Do it early.";
  if (flags.testAvoid) coachNote = "No escape: timed PYQ + review tomorrow.";
  if (flags.distraction) coachNote = "Phone outside room. 2 deep blocks only.";
  if (flags.overplan) coachNote = "Cap plan. Close targets first.";
  if (flags.chaos) coachNote = "No extra topics until planned targets are done.";

  return {
    ok: true,
    date,
    meta: {
      dayStart,
      dayEnd,
      availableMin,
      usableMin,
      effectivePlanMin,
      allocations: { deepTotal, csatMin, revisionMin, testMin, bufferMin },
    },
    coachNote,
    blocks,
  };
}