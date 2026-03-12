import { useState } from "react";

export default function SettingsPage() {
  const [attemptYear, setAttemptYear] = useState("2026");
  const [wakeupTime, setWakeupTime] = useState("04:30");
  const [dailyTargetHours, setDailyTargetHours] = useState("8");
  const [csatTargetMinutes, setCsatTargetMinutes] = useState("60");
  const [saved, setSaved] = useState("");

  function handleSave(e) {
    e.preventDefault();

    const payload = {
      attemptYear,
      wakeupTime,
      dailyTargetHours,
      csatTargetMinutes,
    };

    localStorage.setItem("mentor_os_settings", JSON.stringify(payload));
    setSaved("Settings saved locally.");
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Keep this simple. The system should reduce friction, not create it.
          </p>
        </div>
      </div>

      <form className="surface-card settings-form" onSubmit={handleSave}>
        <label className="field-label">
          Attempt year
          <input
            type="number"
            value={attemptYear}
            onChange={(e) => setAttemptYear(e.target.value)}
          />
        </label>

        <label className="field-label">
          Wakeup time
          <input
            type="time"
            value={wakeupTime}
            onChange={(e) => setWakeupTime(e.target.value)}
          />
        </label>

        <label className="field-label">
          Daily target hours
          <input
            type="number"
            value={dailyTargetHours}
            onChange={(e) => setDailyTargetHours(e.target.value)}
          />
        </label>

        <label className="field-label">
          CSAT target minutes
          <input
            type="number"
            value={csatTargetMinutes}
            onChange={(e) => setCsatTargetMinutes(e.target.value)}
          />
        </label>

        <div className="settings-actions">
          <button type="submit" className="primary-button">
            Save settings
          </button>
          {saved ? <span className="success-text">{saved}</span> : null}
        </div>
      </form>
    </div>
  );
}