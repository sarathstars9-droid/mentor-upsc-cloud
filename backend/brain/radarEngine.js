// backend/brain/radarEngine.js
import fs from "fs";
import path from "path";
import { clamp } from "./timeUtils.js";

const DATA_DIR = path.join(process.cwd(), "data");
const HISTORY_FILE = path.join(DATA_DIR, "loopHistory.json");

function safeReadHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return { days: [], activeLoops: {} };
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  } catch {
    return { days: [], activeLoops: {} };
  }
}

function completionPct(planMin, doneMin) {
  const p = Number(planMin) || 0;
  const d = Number(doneMin) || 0;
  if (p <= 0) return 0;
  return clamp(Math.round((d / p) * 100), 0, 200);
}

function hasTestSignal(text) {
  const t = String(text || "").toLowerCase();
  return (
    t.includes("test") ||
    t.includes("mock") ||
    t.includes("pyq") ||
    t.includes("answer writing") ||
    t.includes("csat sectional") ||
    t.includes("sectional") ||
    t.includes("timed")
  );
}

export function buildRadar({ windowDays = 7 } = {}) {
  const hist = safeReadHistory();
  const days = Array.isArray(hist.days) ? hist.days : [];
  const last = days.slice(-windowDays);

  const execAvg =
    last.length === 0
      ? 0
      : Math.round(last.reduce((s, d) => s + completionPct(d.planMin, d.doneMin), 0) / last.length);

  const csatAvg =
    last.length === 0
      ? 0
      : Math.round(last.reduce((s, d) => s + Math.min(100, Math.round(((Number(d.csatMin) || 0) / 60) * 100)), 0) / last.length);

  const testScore =
    last.length === 0
      ? 0
      : Math.round(
          (last.filter((d) => hasTestSignal(d.reflection)).length / last.length) * 100
        );

  const revisionScore =
    last.length === 0
      ? 0
      : Math.round(
          (last.filter((d) => String(d.reflection || "").toLowerCase().includes("rev")).length / last.length) * 100
        );

  // Spread v1: count “MappingCode” keywords if present in reflection (simple)
  const spreadScore = clamp(Math.round((new Set(last.map((d) => String(d.mappingCode || ""))).size / Math.max(1, last.length)) * 100), 0, 100);

  const activeLoops = hist.activeLoops ? Object.values(hist.activeLoops) : [];
  const loopRisk = clamp(100 - activeLoops.length * 15, 0, 100);

  return {
    ok: true,
    windowDays: last.length,
    radar: {
      execution: clamp(execAvg, 0, 100),
      csat: clamp(csatAvg, 0, 100),
      test: clamp(testScore, 0, 100),
      revision: clamp(revisionScore, 0, 100),
      spread: clamp(spreadScore, 0, 100),
      loopRisk,
    },
    activeLoops,
  };
}