// backend/brain/timeUtils.js
export function hhmmToMin(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

export function minToHHMM(min) {
  const m = Math.max(0, Math.round(min));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function minutesBetween(startHHMM, endHHMM) {
  const s = hhmmToMin(startHHMM);
  const e = hhmmToMin(endHHMM);
  return Math.max(0, e - s);
}