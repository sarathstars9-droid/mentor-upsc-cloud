import { useMemo } from "react";

export function hhmmTo12Hour(hhmm) {
  const s = String(hhmm || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: "09", minute: "00", ampm: "AM" };

  let h24 = parseInt(m[1], 10);
  let min = m[2];
  let ampm = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  return {
    hour: String(h12).padStart(2, "0"),
    minute: min,
    ampm,
  };
}

export function twelveHourToHhmm(hourStr, minuteStr, ampm) {
  let h = parseInt(hourStr || "12", 10);
  const m = String(minuteStr || "00").padStart(2, "0");

  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h = h + 12;
  }

  return `${String(h).padStart(2, "0")}:${m}`;
}

export default function TimePicker12Hour({ value, onChange, label, disabled = false }) {
  const { hour, minute, ampm } = useMemo(() => hhmmTo12Hour(value), [value]);

  function handleHourChange(e) {
    const newHour = e.target.value;
    const new24 = twelveHourToHhmm(newHour, minute, ampm);
    onChange?.(new24);
  }

  function handleMinuteChange(e) {
    const newMin = e.target.value;
    const new24 = twelveHourToHhmm(hour, newMin, ampm);
    onChange?.(new24);
  }

  function handleAmpmChange(newAmpm) {
    const new24 = twelveHourToHhmm(hour, minute, newAmpm);
    onChange?.(new24);
  }

  const hourOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minuteOptions = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label className="field-label" style={{ fontSize: 13, fontWeight: 700, color: "var(--mos-text, #1e293b)" }}>
          {label}
        </label>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Hour Dropdown */}
        <select
          value={hour}
          onChange={handleHourChange}
          disabled={disabled}
          style={{
            height: 42,
            padding: "0 8px",
            borderRadius: 8,
            border: "1px solid var(--mos-border, #cbd5e1)",
            background: "var(--mos-surface, #ffffff)",
            color: "var(--mos-text, #0f172a)",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {hourOptions.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span style={{ fontWeight: 800, color: "var(--mos-text-soft, #64748b)" }}>:</span>

        {/* Minute Dropdown */}
        <select
          value={minute}
          onChange={handleMinuteChange}
          disabled={disabled}
          style={{
            height: 42,
            padding: "0 8px",
            borderRadius: 8,
            border: "1px solid var(--mos-border, #cbd5e1)",
            background: "var(--mos-surface, #ffffff)",
            color: "var(--mos-text, #0f172a)",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {minuteOptions.includes(minute) ? null : <option value={minute}>{minute}</option>}
          {minuteOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* AM/PM Toggle */}
        <div style={{ display: "flex", border: "1px solid var(--mos-border, #cbd5e1)", borderRadius: 8, overflow: "hidden" }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAmpmChange("AM")}
            style={{
              padding: "0 10px",
              height: 40,
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              background: ampm === "AM" ? "#0A64F5" : "transparent",
              color: ampm === "AM" ? "#ffffff" : "var(--mos-text-soft, #475569)",
              transition: "all 0.15s ease",
            }}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAmpmChange("PM")}
            style={{
              padding: "0 10px",
              height: 40,
              fontSize: 13,
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              background: ampm === "PM" ? "#0A64F5" : "transparent",
              color: ampm === "PM" ? "#ffffff" : "var(--mos-text-soft, #475569)",
              transition: "all 0.15s ease",
            }}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
}
