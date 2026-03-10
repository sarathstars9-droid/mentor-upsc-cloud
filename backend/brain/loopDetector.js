// backend/brain/loopDetector.js
// Loop Detector (Option A): starts building evidence from "today onward"
// Stores local history so it works even if Sheets doesn't have 7 days yet.

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "loopHistory.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, JSON.stringify({ days: [], activeLoops: {} }, null, 2));
}

function readHistory() {
  ensureStore();
  try {
    const j = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    j.days = Array.isArray(j.days) ? j.days : [];
    j.activeLoops = j.activeLoops && typeof j.activeLoops === "object" ? j.activeLoops : {};
    return j;
  } catch {
    return { days: [], activeLoops: {} };
  }
}

function writeHistory(hist) {
  ensureStore();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist, null, 2));
}

function uniqByCode(flags) {
  const map = new Map();
  for (const f of flags) map.set(f.code, f);
  return Array.from(map.values());
}

function severityRank(sev) {
  return sev === "RED" ? 3 : sev === "YELLOW" ? 2 : 1;
}

function sortFlags(flags) {
  return [...flags].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function completionPct(planMin, doneMin) {
  const p = Number(planMin) || 0;
  const d = Number(doneMin) || 0;
  if (p <= 0) return 0;
  return clamp(Math.round((d / p) * 100), 0, 200);
}

function isLikelyTestWork(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("test") ||
    t.includes("mock") ||
    t.includes("pyq") ||
    t.includes("answer writing") ||
    t.includes("mains") ||
    t.includes("csat sectional") ||
    t.includes("full length") ||
    t.includes("essay writing")
  );
}

export function detectLoops(input) {
  // input: { date, planMin, doneMin, csatMin, reflection, review:{...} }
  const date = String(input?.date || "").trim();
  const planMin = Number(input?.planMin) || 0;
  const doneMin = Number(input?.doneMin) || 0;
  const csatMin = Number(input?.csatMin) || 0;
  const reflection = String(input?.reflection || "").trim();

  const review = input?.review || {};
  const planCompleted = String(review?.planCompleted || "").trim(); // Yes|Partial|No
  const wentWrongReason = String(review?.wentWrongReason || "").trim();
  const extraDone = String(review?.extraDone || "").trim(); // Yes|No

  // 1) Load history
  const hist = readHistory();

  // 2) Upsert today's row (so loops can include today)
  const dayRow = {
    date,
    planMin,
    doneMin,
    csatMin,
    reflection,
    planCompleted,
    wentWrongReason,
    extraDone,
    ts: Date.now(),
  };

  hist.days = hist.days.filter((d) => d.date !== date);
  hist.days.push(dayRow);
  hist.days.sort((a, b) => (a.date > b.date ? 1 : -1));
  if (hist.days.length > 30) hist.days = hist.days.slice(hist.days.length - 30);

  // 3) Evidence window (Option A): last up to 5 days available
  const last = hist.days.slice(-5);

  // 4) Compute flags
  const flags = [];

  // Loop 1: CSAT avoidance
  const lowCsatDays = last.filter((d) => (Number(d.csatMin) || 0) < 30).length;
  if (last.length >= 3 && lowCsatDays >= 3) {
    flags.push({
      code: "LOOP_CSAT_AVOID",
      severity: "RED",
      title: "CSAT avoidance loop",
      evidence: `Last ${last.length} days: CSAT <30 min on ${lowCsatDays} days.`,
      fix: "Non-negotiable: 30–45 min CSAT daily before lunch.",
    });
  }

  // Loop 2: Overplanning
  const lowCompletionDays = last.filter((d) => completionPct(d.planMin, d.doneMin) < 60).length;
  const avgPlan = Math.round(last.reduce((s, d) => s + (Number(d.planMin) || 0), 0) / Math.max(1, last.length));
  if (last.length >= 3 && lowCompletionDays >= 3 && avgPlan >= 600) {
    flags.push({
      code: "LOOP_OVERPLAN",
      severity: "YELLOW",
      title: "Overplanning loop",
      evidence: `Avg plan ≈ ${avgPlan} min. Completion <60% on ${lowCompletionDays}/${last.length} days.`,
      fix: "Cap tomorrow plan to 540–600 min. Keep only 3 deep blocks + CSAT.",
    });
  }

  // Loop 3: Distraction/Phone loop
  const distractionDays = last.filter((d) => {
    const r = String(d.wentWrongReason || "").toLowerCase();
    return r.includes("phone") || r.includes("distraction");
  }).length;
  if (last.length >= 3 && distractionDays >= 3) {
    flags.push({
      code: "LOOP_DISTRACTION",
      severity: "YELLOW",
      title: "Distraction loop",
      evidence: `Went-wrong reason was Phone/Distraction on ${distractionDays}/${last.length} days.`,
      fix: "2×90-min Deep Work blocks. Phone outside room. One planned break window only.",
    });
  }

  // Loop 4: Test avoidance
  const testSignals = last.filter((d) => isLikelyTestWork(d.reflection)).length;
  if (last.length >= 5 && testSignals === 0) {
    flags.push({
      code: "LOOP_TEST_AVOID",
      severity: "RED",
      title: "Test avoidance loop",
      evidence: `No “test/mock/PYQ/answer writing” signals found in last ${last.length} reflections.`,
      fix: "Tomorrow: 30 min PYQ + 30 min review (must).",
    });
  }

  // Loop 5: Chaos loop
  const chaosDays = last.filter((d) => String(d.extraDone || "") === "Yes" && completionPct(d.planMin, d.doneMin) < 60).length;
  if (last.length >= 3 && chaosDays >= 2) {
    flags.push({
      code: "LOOP_CHAOS",
      severity: "YELLOW",
      title: "Chaos loop (extra work but targets missed)",
      evidence: `Extra done + low completion on ${chaosDays}/${last.length} days.`,
      fix: "No new topics until planned targets are closed. 1 buffer slot only.",
    });
  }

  // 5) Dedup + sort today's flags
  const todayFlags = sortFlags(uniqByCode(flags));

  // 6) Active loop memory (prevents ever-growing display)
  hist.activeLoops = hist.activeLoops || {};

  // mark loops seen today
  for (const f of todayFlags) {
    hist.activeLoops[f.code] = {
      code: f.code,
      title: f.title,
      severity: f.severity,
      lastSeenDate: date,
      lastSeverity: f.severity,
      fix: f.fix,
    };
  }

  // expire loops not seen in last 2 logged dates
  const lastDates = hist.days.slice(-3).map((d) => d.date);
  for (const code of Object.keys(hist.activeLoops)) {
    const seen = hist.activeLoops[code]?.lastSeenDate;
    const isRecent = lastDates.slice(-2).includes(seen);
    if (!isRecent) delete hist.activeLoops[code];
  }

  // 7) Prepare outputs
  const activeFlags = sortFlags(Object.values(hist.activeLoops));
  const loopFlagsText = todayFlags.map((f) => `${f.severity}:${f.code}`).join(" | ");

  const correction =
    activeFlags.find((f) => f.severity === "RED")?.fix ||
    todayFlags[0]?.fix ||
    "Maintain momentum: 2 deep blocks + CSAT 30–45 min.";

  // 8) Save history once
  writeHistory(hist);

  return {
    ok: true,
    date,
    windowDays: last.length,
    loopFlagsText,
    flags: todayFlags,       // today’s detected loops
    activeFlags,             // persistent but expiring loops
    tomorrowCorrection: correction,
    historyCount: hist.days.length,
  };
}