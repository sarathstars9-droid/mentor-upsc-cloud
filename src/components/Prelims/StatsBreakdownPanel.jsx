import { getStatRows, getRowAccuracy, getRowAttempted, getRowCorrect, getRowLabel, getRowWrong, formatPercent } from "./prelimsDashboardUtils";

function MiniTable({ title, rows }) {
  const safeRows = getStatRows(rows).slice(0, 8);
  return (
    <div className="mos-breakdown-table">
      <div className="mos-breakdown-table__head">{title}</div>
      {safeRows.length ? safeRows.map((row, index) => (
        <div className="mos-breakdown-row" key={`${title}_${index}_${getRowLabel(row)}`}>
          <strong title={getRowLabel(row)}>{getRowLabel(row)}</strong>
          <span>{getRowAttempted(row)} att.</span>
          <span>{getRowCorrect(row)} ✓ / {getRowWrong(row)} ✕</span>
          <span>{formatPercent(getRowAccuracy(row))}</span>
        </div>
      )) : <div className="mos-breakdown-row"><strong>No data</strong><span /><span /><span /></div>}
    </div>
  );
}

export default function StatsBreakdownPanel({ subjectStats = {}, typeStats = {}, difficultyStats = {}, nodeStats = {} }) {
  return (
    <section className="mos-practice-card mos-list-panel">
      <div className="mos-practice-section-head">
        <div><h2>Detailed Analysis</h2><div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>Subject, question type, difficulty and node tables.</div></div>
      </div>
      <div className="mos-breakdown-grid">
        <MiniTable title="Subject" rows={subjectStats} />
        <MiniTable title="Question type" rows={typeStats} />
        <MiniTable title="Difficulty" rows={difficultyStats} />
        <MiniTable title="Node" rows={nodeStats} />
      </div>
    </section>
  );
}
