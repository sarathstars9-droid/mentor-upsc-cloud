export function clampPercent(value) {
  const n = Number(value || 0);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getCompletionPercent(doneMin, planMin) {
  const done = Number(doneMin || 0);
  const plan = Number(planMin || 0);
  if (plan <= 0) return 0;
  return clampPercent((done / plan) * 100);
}

export function getRemainingMinutes(doneMin, planMin) {
  const done = Number(doneMin || 0);
  const plan = Number(planMin || 0);
  return Math.max(0, plan - done);
}

export function getLostMinutes(doneMin, planMin) {
  const done = Number(doneMin || 0);
  const plan = Number(planMin || 0);
  return Math.max(0, plan - done);
}

export function getHeatmapClass(score) {
  if (score >= 3) return "heat-cell level-4";
  if (score === 2) return "heat-cell level-3";
  if (score === 1) return "heat-cell level-2";
  return "heat-cell level-1";
}

export function getRealStreakFromBlocks(todayBlocks = [], doneMin = 0) {
  const hasCompletedBlock = (todayBlocks || []).some((b) => {
    const status = String(b?.Status || "").toLowerCase();
    return status === "completed" || status === "partial";
  });

  const meaningfulStudy = Number(doneMin || 0) >= 180;

  if (hasCompletedBlock || meaningfulStudy) {
    return 1;
  }

  return 0;
}

export function buildHeatmapFromBlocks(todayBlocks = [], doneMin = 0) {
  const data = [];
  const today = new Date();

  const completedCount = (todayBlocks || []).filter((b) => {
    const status = String(b?.Status || "").toLowerCase();
    return status === "completed";
  }).length;

  let todayScore = 0;
  if (Number(doneMin || 0) >= 360 || completedCount >= 4) {
    todayScore = 3;
  } else if (Number(doneMin || 0) >= 240 || completedCount >= 3) {
    todayScore = 2;
  } else if (Number(doneMin || 0) >= 120 || completedCount >= 1) {
    todayScore = 1;
  }

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    data.push({
      date: d.toISOString().slice(0, 10),
      score: i === 0 ? todayScore : 0,
    });
  }

  return data;
}