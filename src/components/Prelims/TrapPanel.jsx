import { normalizeArray, getTrapLabel, getTrapCount } from "./prelimsDashboardUtils";

export default function TrapPanel({ trapAlerts = [], trapStats = {} }) {
  const alerts = normalizeArray(trapAlerts);
  const trapRows = Array.isArray(trapStats)
    ? trapStats
    : Object.entries(trapStats || {}).map(([key, value]) => ({ trapType: key, ...(typeof value === "object" && value !== null ? value : { count: value }) }));

  return (
    <section className="mos-practice-card mos-list-panel">
      <div className="mos-practice-section-head">
        <div><h2>Trap Intelligence</h2><div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>Where wording, elimination or confidence patterns are costing marks.</div></div>
      </div>
      <div className="mos-breakdown-grid">
        <div>
          <div className="mos-pr-field__label" style={{ marginBottom: 7 }}>Alerts</div>
          <div className="mos-list-panel__list">
            {alerts.length ? alerts.slice(0, 5).map((alert, index) => (
              <div className="mos-list-row" key={`trap_alert_${index}`}>
                {typeof alert === "string" ? alert : alert.message || alert.text || (alert.trap ? `${String(alert.trap).replaceAll("_", " ")} · accuracy ${alert.accuracy ?? 0}%` : "Trap signal detected")}
              </div>
            )) : <div className="mos-list-row">No trap alert is strong enough yet.</div>}
          </div>
        </div>
        <div>
          <div className="mos-pr-field__label" style={{ marginBottom: 7 }}>Breakdown</div>
          <div className="mos-list-panel__list">
            {trapRows.length ? trapRows.slice(0, 6).map((item, index) => (
              <div className="mos-list-row" key={`trap_${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong>{getTrapLabel(item)}</strong><span className="mos-pr-badge mos-pr-badge--danger">{getTrapCount(item) ?? 0}</span>
              </div>
            )) : <div className="mos-list-row">No trap statistics available.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
