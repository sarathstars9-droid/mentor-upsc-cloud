export function parseBlockTimeIST(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  }

  const [year, month, day] = String(dateStr).split("-").map(Number);
  if (!year || !month || !day) return null;

  const pad = (v) => String(v).padStart(2, "0");
  const d = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  const pad = (v) => String(v).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatConciseDuration(totalSeconds) {
  if (totalSeconds <= 0) return "0 min";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);

  if (h > 0) return `${h} hr ${m} min`;
  if (m > 0) return `${m} min`;
  return `00:${String(s).padStart(2, '0')}`;
}

function getEffectiveBlockStatus(block) {
  return block.Status || 'planned';
}

export function calculateBlockTiming(block, nowMs) {
    if (!block) return null;

    const status = getEffectiveBlockStatus(block).toLowerCase();

    // Rule: Use the existing engine's true completed statuses only.
    const isCompleted = status === "completed" || status === "done";

    const plannedStart = parseBlockTimeIST(block.Date, block.PlannedStart);
    const plannedEnd = parseBlockTimeIST(block.Date, block.PlannedEnd);

    // Rule: Resolve planned duration without assuming PlannedMinutes always exists
    let plannedDurationSeconds = 0;
    if (typeof block.PlannedMinutes === 'number' && block.PlannedMinutes > 0) {
        plannedDurationSeconds = block.PlannedMinutes * 60;
    } else if (plannedStart && plannedEnd) {
        plannedDurationSeconds = Math.max(0, Math.floor((plannedEnd.getTime() - plannedStart.getTime()) / 1000));
    }

    const actualStart = block.ActualStart ? new Date(block.ActualStart) : null;
    const actualEnd = block.ActualEnd ? new Date(block.ActualEnd) : null;
    const lastResumedAt = block.LastResumeAt ? new Date(block.LastResumeAt) : (actualStart || null);

    // Contract verification: ActualMinutes represents the exact sum of finalized active intervals
    // saved by the backend. It does NOT include the live session currently ticking.
    // If ACTIVE, we calculate the time since LastResumeAt and add it to base.
    let baseAccumulatedSeconds = (block.ActualMinutes || 0) * 60;
    let liveAccumulatedSeconds = baseAccumulatedSeconds;

    if (status === "active" && lastResumedAt && !isCompleted && !actualEnd) {
       const sessionActiveSeconds = Math.max(0, Math.floor((nowMs - lastResumedAt.getTime()) / 1000));
       liveAccumulatedSeconds += sessionActiveSeconds;
    }

    let remainingStudySeconds = 0;
    if (plannedDurationSeconds > 0) {
        remainingStudySeconds = Math.max(0, plannedDurationSeconds - liveAccumulatedSeconds);
    }

    if (isCompleted) {
        remainingStudySeconds = 0;
    }

    let completionPercentage = 0;
    if (isCompleted) {
        completionPercentage = 100;
    } else if (plannedDurationSeconds > 0) {
       completionPercentage = Math.min(100, Math.round((liveAccumulatedSeconds / plannedDurationSeconds) * 100));
    }

    const secondsUntilStart = plannedStart ? Math.floor((plannedStart.getTime() - nowMs) / 1000) : 0;
    const overdueSeconds = plannedStart ? Math.floor((nowMs - plannedStart.getTime()) / 1000) : 0;
    const secondsUntilPlannedEnd = plannedEnd ? Math.floor((plannedEnd.getTime() - nowMs) / 1000) : 0;
    const plannedWindowOverdueSeconds = plannedEnd ? Math.floor((nowMs - plannedEnd.getTime()) / 1000) : 0;
    const startDelaySeconds = (actualStart && plannedStart) ? Math.floor((actualStart.getTime() - plannedStart.getTime()) / 1000) : 0;

    let timingState = "UPCOMING";

    if (isCompleted) {
        timingState = "COMPLETED";
    } else if (plannedDurationSeconds > 0 && remainingStudySeconds <= 0 && actualStart) {
        timingState = "DURATION_REACHED";
    } else if (!actualStart) {
        if (plannedEnd && nowMs > plannedEnd.getTime()) {
            timingState = "MISSED";
        } else if (plannedStart && nowMs >= plannedStart.getTime()) {
            timingState = "OVERDUE_NOT_STARTED";
        } else {
            timingState = "UPCOMING";
        }
    } else {
        if (status === "paused") {
            timingState = "PAUSED";
        } else if (plannedEnd && nowMs > plannedEnd.getTime()) {
            timingState = "OVERDUE_ACTIVE";
        } else {
            timingState = "ACTIVE";
        }
    }

    let displayPrimary = "";
    let displaySecondary = "";
    let badgeText = timingState;
    let severity = "neutral";
    let plannedWindowLabel = "";

    // Generate Planned Window Label
    if (plannedEnd) {
        if (nowMs > plannedEnd.getTime()) {
            plannedWindowLabel = `Planned window ended ${Math.floor(plannedWindowOverdueSeconds / 60)} min ago`;
        } else {
            plannedWindowLabel = `Planned window ends in ${Math.floor(secondsUntilPlannedEnd / 60)} min`;
        }
    }

    switch (timingState) {
        case "UPCOMING":
            badgeText = "NEXT";
            displayPrimary = `Starts in ${formatConciseDuration(secondsUntilStart)}`;
            displaySecondary = `Scheduled for ${block.PlannedStart}`;
            break;
        case "OVERDUE_NOT_STARTED":
            badgeText = "START OVERDUE";
            severity = overdueSeconds > 600 ? "error" : "warning";
            displayPrimary = `${Math.floor(overdueSeconds / 60)} min overdue`;
            displaySecondary = `Scheduled start was ${block.PlannedStart}`;
            break;
        case "ACTIVE":
        case "OVERDUE_ACTIVE":
        case "DURATION_REACHED":
            badgeText = "ACTIVE";
            severity = "active";
            displayPrimary = `${formatConciseDuration(remainingStudySeconds)} study remaining`;
            if (startDelaySeconds > 60) {
                displaySecondary = `Started ${Math.floor(startDelaySeconds / 60)} min late Â· ${Math.floor(liveAccumulatedSeconds / 60)} min completed`;
            } else {
                displaySecondary = `${Math.floor(liveAccumulatedSeconds / 60)} min completed`;
            }
            break;
        case "PAUSED":
            badgeText = "PAUSED";
            severity = "warning";
            const pausedAt = block.LastPauseAt ? new Date(block.LastPauseAt).getTime() : nowMs;
            const pausedSeconds = Math.max(0, Math.floor((nowMs - pausedAt) / 1000));
            displayPrimary = `Paused for ${formatDuration(pausedSeconds)}`;
            displaySecondary = `${formatConciseDuration(remainingStudySeconds)} study remaining`;
            break;
        case "MISSED":
            badgeText = "BLOCK MISSED";
            severity = "error";
            displayPrimary = `Scheduled window ended ${Math.floor(plannedWindowOverdueSeconds / 60)} min ago`;
            displaySecondary = `${Math.floor(plannedDurationSeconds / 60)} min study still pending`;
            break;
        case "COMPLETED":
            badgeText = "COMPLETED";
            severity = "success";
            displayPrimary = "Block completed";
            const doneTime = block.ActualEnd ? new Date(block.ActualEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : "";
            displaySecondary = `${Math.floor(liveAccumulatedSeconds / 60)} focused minutes${doneTime ? ` Â· Completed at ${doneTime}` : ''}`;
            break;
    }

    return {
      timingState,
      severity,
      badgeText,
      secondsUntilStart,
      startOverdueSeconds: overdueSeconds,
      accumulatedActiveSeconds: liveAccumulatedSeconds,
      remainingStudySeconds,
      pausedSeconds: timingState === "PAUSED" ? Math.max(0, Math.floor((nowMs - (block.LastPauseAt ? new Date(block.LastPauseAt).getTime() : nowMs)) / 1000)) : 0,
      secondsUntilPlannedEnd,
      plannedWindowOverdueSeconds,
      startDelaySeconds,
      completionPercentage,
      displayPrimary,
      displaySecondary,
      plannedWindowLabel
    };
}

function testScenario(name, block, nowMs, expected) {
  const result = calculateBlockTiming(block, nowMs);

  const passed =
    result.timingState === expected.timingState &&
    result.displayPrimary === expected.displayPrimary &&
    result.displaySecondary === expected.displaySecondary &&
    result.completionPercentage === expected.completionPercentage &&
    (!expected.plannedWindowLabel || result.plannedWindowLabel === expected.plannedWindowLabel);

  if (passed) {
    console.log(`[PASS] ${name}`);
  } else {
    console.log(`[FAIL] ${name}`);
    console.log(`  Expected:`, expected);
    console.log(`  Got:     `, {
      timingState: result.timingState,
      displayPrimary: result.displayPrimary,
      displaySecondary: result.displaySecondary,
      completionPercentage: result.completionPercentage,
      plannedWindowLabel: result.plannedWindowLabel
    });
  }
}

const mockDate = "2026-07-24";
const baseTime = new Date("2026-07-24T00:00:00+05:30").getTime();
const time_10_30 = baseTime + (10 * 3600 + 30 * 60) * 1000;
const time_11_21 = baseTime + (11 * 3600 + 21 * 60) * 1000;
const time_11_22 = baseTime + (11 * 3600 + 22 * 60) * 1000;

console.log("Running deterministic timing tests...\n");

testScenario("A. Upcoming block (less than one minute)",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "planned" },
  time_10_30 - 42 * 1000,
  { timingState: "UPCOMING", displayPrimary: "Starts in 00:42", displaySecondary: "Scheduled for 10:30 AM", completionPercentage: 0 }
);

testScenario("B. Start overdue by 52 minutes (11:22 AM)",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "planned" },
  time_11_22,
  { timingState: "OVERDUE_NOT_STARTED", displayPrimary: "52 min overdue", displaySecondary: "Scheduled start was 10:30 AM", completionPercentage: 0 }
);

testScenario("C. Started 51 minutes late with 1 minute completed",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "active", ActualStart: new Date(time_11_21).toISOString(), LastResumeAt: new Date(time_11_21).toISOString(), ActualMinutes: 0 },
  time_11_22,
  { timingState: "ACTIVE", displayPrimary: "1 hr 59 min study remaining", displaySecondary: "Started 51 min late Â· 1 min completed", completionPercentage: 1, plannedWindowLabel: "Planned window ends in 68 min" }
);

// D. Paused block whose remaining time does not decrease
testScenario("D. Paused block whose remaining time does not decrease",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "paused", ActualStart: new Date(time_10_30).toISOString(), LastResumeAt: new Date(time_10_30).toISOString(), LastPauseAt: new Date(time_11_21).toISOString(), ActualMinutes: 51 },
  time_11_22,
  { timingState: "PAUSED", displayPrimary: "Paused for 01:00", displaySecondary: "1 hr 9 min study remaining", completionPercentage: 43 }
);

// E. Planned window ended while study remains
testScenario("E. Planned window ended while study remains",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "active", ActualStart: new Date(time_11_21).toISOString(), LastResumeAt: new Date(time_11_21).toISOString(), ActualMinutes: 0 },
  baseTime + (12 * 3600 + 46 * 60) * 1000,
  { timingState: "OVERDUE_ACTIVE", displayPrimary: "35 min study remaining", displaySecondary: "Started 51 min late Â· 85 min completed", completionPercentage: 71, plannedWindowLabel: "Planned window ended 16 min ago" }
);

// F. Stopped early block is not completed
testScenario("F. Stopped early block is not completed",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "stopped", ActualStart: new Date(time_10_30).toISOString(), LastResumeAt: new Date(time_10_30).toISOString(), ActualMinutes: 60, ActualEnd: new Date(time_11_21).toISOString() },
  time_11_22,
  { timingState: "ACTIVE", displayPrimary: "1 hr 0 min study remaining", displaySecondary: "60 min completed", completionPercentage: 50, plannedWindowLabel: "Planned window ends in 68 min" }
);

// G. Missing PlannedMinutes does not auto-complete
testScenario("G. Missing PlannedMinutes does not auto-complete",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", Status: "active", ActualStart: new Date(time_10_30).toISOString(), LastResumeAt: new Date(time_10_30).toISOString(), ActualMinutes: 15 },
  time_11_22,
  { timingState: "ACTIVE", displayPrimary: "53 min study remaining", displaySecondary: "67 min completed", completionPercentage: 56, plannedWindowLabel: "Planned window ends in 68 min" }
);

// H. Duration reached while backend remains ACTIVE
testScenario("H. Duration reached while backend remains ACTIVE",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "active", ActualStart: new Date(time_10_30).toISOString(), LastResumeAt: new Date(time_10_30).toISOString(), ActualMinutes: 120 },
  time_11_22,
  { timingState: "DURATION_REACHED", displayPrimary: "0 min study remaining", displaySecondary: "172 min completed", completionPercentage: 100, plannedWindowLabel: "Planned window ends in 68 min" }
);

// I. Backend completed block returns 100%
testScenario("I. Backend completed block returns 100%",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "completed", ActualStart: new Date(time_10_30).toISOString(), LastResumeAt: new Date(time_10_30).toISOString(), ActualMinutes: 60, ActualEnd: new Date(time_11_21).toISOString() },
  time_11_22,
  { timingState: "COMPLETED", displayPrimary: "Block completed", displaySecondary: "60 focused minutes Â· Completed at 11:21 AM", completionPercentage: 100 }
);

// J. Server/device clock offset
testScenario("J. Server/device clock offset",
  { Date: mockDate, PlannedStart: "10:30 AM", PlannedEnd: "12:30 PM", PlannedMinutes: 120, Status: "active", ActualStart: new Date(time_10_30).toISOString(), LastResumeAt: new Date(time_10_30).toISOString(), ActualMinutes: 52 },
  time_11_22,
  { timingState: "ACTIVE", displayPrimary: "16 min study remaining", displaySecondary: "104 min completed", completionPercentage: 87, plannedWindowLabel: "Planned window ends in 68 min" }
);
