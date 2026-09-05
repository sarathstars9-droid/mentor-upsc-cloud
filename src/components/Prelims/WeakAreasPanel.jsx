import { formatPercent, normalizeArray, getWeakItemAccuracy, getWeakItemAttempts, getWeakItemLabel } from "./prelimsDashboardUtils";

function WeakColumn({ title, items }) {
  const safeItems = normalizeArray(items);
  return (
    <div>
      <div className="mos-pr-field__label" style={{ marginBottom: 7 }}>{title}</div>
      <div className="mos-list-panel__list">
        {safeItems.length ? safeItems.slice(0, 5).map((item, index) => {
          const label = getWeakItemLabel(item);
          const accuracy = getWeakItemAccuracy(item);
          const attempts = getWeakItemAttempts(item);
          return (
            <div className="mos-list-row" key={`${title}_${label}_${index}`}>
              <strong>{label}</strong>
              <div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>
                {accuracy !== null ? `Accuracy ${formatPercent(accuracy)}` : ""}{attempts !== null ? `${accuracy !== null ? " · " : ""}${attempts} attempts` : ""}
              </div>
            </div>
          );
        }) : <div className="mos-list-row">No reliable weak signal yet.</div>}
      </div>
    </div>
  );
}

export default function WeakAreasPanel({ weakSubjects = [], weakNodes = [], weakTypes = [] }) {
  return (
    <section className="mos-practice-card mos-list-panel">
      <div className="mos-practice-section-head">
        <div><h2>Weak Area Radar</h2><div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>Subject, node and question-pattern weaknesses.</div></div>
      </div>
      <div className="mos-breakdown-grid">
        <WeakColumn title="Subjects" items={weakSubjects} />
        <WeakColumn title="Nodes" items={weakNodes} />
        <WeakColumn title="Question types" items={weakTypes} />
      </div>
    </section>
  );
}
