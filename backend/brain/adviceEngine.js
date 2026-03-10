// backend/brain/adviceEngine.js
// Daily Push Targets + Soft Coach Note (dual mode)

import { daysToPrelims, killSwitchMode } from "./findMicroTheme.js";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pct(done, plan) {
  if (!plan || plan <= 0) return 0;
  return clamp(Math.round((done / plan) * 100), 0, 100);
}

function pickGsFromMatches(matches = []) {
  // matches are objects {code,name,path,tags,confidence,...}
  // We'll infer GS from code/path
  const top = matches[0] || null;
  if (!top) return null;

  const code = String(top.code || "");
  const path = String(top.path || "");

  const gsPaper =
    code.startsWith("GS1") || path.includes("GS1") ? "GS1" :
    code.startsWith("GS2") || path.includes("GS2") ? "GS2" :
    code.startsWith("GS3") || path.includes("GS3") ? "GS3" :
    code.startsWith("GS4") || path.includes("GS4") ? "GS4" :
    null;

  return { gsPaper, top };
}

export function buildDailyAdvice({ date, planMin, doneMin, csatMin, matches }) {
  const dPre = daysToPrelims(new Date());
  const kill = killSwitchMode(dPre);

  // Targets depend on combat mode
  const targetPlanMin = kill === "ON" ? 420 : 300; // 7h vs 5h
  const targetCsatMin = kill === "ON" ? 60 : 30;

  const completion = pct(doneMin, planMin);
  const csatOk = (Number(csatMin) || 0) >= targetCsatMin;

  const mapped = pickGsFromMatches(matches);
  const gsPaper = mapped?.gsPaper || "Unknown";
  const topicName = mapped?.top?.name || "";
  const topicPath = mapped?.top?.path || "";

  // Risk (simple + stable)
  let risk = "LOW";
  if (kill === "ON" && (!csatOk || completion < 50)) risk = "HIGH";
  else if (!csatOk || completion < 60) risk = "MEDIUM";

  // Strict pushes (always shown)
  const pushes = [];
  if ((Number(doneMin) || 0) < targetPlanMin) {
    pushes.push(`Target today: ${targetPlanMin} min total study (now: ${doneMin || 0} min).`);
  } else {
    pushes.push(`✅ Target met: ${doneMin || 0} min (goal: ${targetPlanMin} min).`);
  }

  if (!csatOk) pushes.push(`CSAT is non-negotiable: do ${targetCsatMin} min today (now: ${csatMin || 0} min).`);
  else pushes.push(`✅ CSAT done: ${csatMin || 0} min (goal: ${targetCsatMin} min).`);

  if (gsPaper !== "Unknown") {
    pushes.push(`Mapped focus: ${gsPaper}${topicName ? ` → ${topicName}` : ""}`);
  } else {
    pushes.push(`Mapped focus: not detected (write 2–3 clear keywords next time).`);
  }

  // Soft coach note (supportive tone)
  let coachNote = "";
  if (risk === "HIGH") {
    coachNote =
      "Today is a danger day. No guilt — just fix. Do 1 short revision block + CSAT 30–60 min. Protect momentum.";
  } else if (risk === "MEDIUM") {
    coachNote =
      "Decent day, but tighten execution. Add one correction: revise one weak area + keep CSAT steady.";
  } else {
    coachNote =
      "Good stability. Maintain pace. Add 1 PYQ set to convert reading into marks.";
  }

  // Tomorrow focus suggestion (simple)
  const tomorrow = [];
  if (kill === "ON") {
    tomorrow.push("Tomorrow: 2 blocks GS (revision + PYQ) + 1 block CSAT (30–60 min).");
  } else {
    tomorrow.push("Tomorrow: 1 block GS + 1 micro-revision + 30 min CSAT.");
  }
  if (gsPaper === "GS2") tomorrow.push("Add GS1/GS3 touch tomorrow to avoid skew.");
  if (gsPaper === "GS4") tomorrow.push("Add 20 min Polity/History revision tomorrow.");

  return {
    ok: true,
    date: date || "",
    daysToPrelims: dPre,
    killSwitchMode: kill,
    risk,
    targets: { targetPlanMin, targetCsatMin },
    mapping: mapped?.top || null,
    pushes,
    coachNote,
    tomorrow,
    debug: { gsPaper, topicPath, completion },
  };
}