import { normalizeArray, getRecommendationLabel } from "./prelimsDashboardUtils";

export default function RecommendationsPanel({ recommendations = [] }) {
  const items = normalizeArray(recommendations);
  return (
    <section className="mos-practice-card mos-list-panel">
      <div className="mos-practice-section-head">
        <div><h2>Next Best Actions</h2><div className="mos-practice-small mos-practice-muted" style={{ marginTop: 3 }}>Turn analysis into the next concrete study move.</div></div>
      </div>
      <div className="mos-list-panel__list">
        {items.length ? items.slice(0, 6).map((item, index) => (
          <div className="mos-list-row" key={`recommendation_${index}`} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 10, alignItems: "start" }}>
            <span className="mos-pr-badge mos-pr-badge--primary" style={{ width: 26, height: 26, padding: 0, justifyContent: "center" }}>{index + 1}</span>
            <span>{getRecommendationLabel(item)}</span>
          </div>
        )) : <div className="mos-list-row">Complete more questions to unlock ranked next actions.</div>}
      </div>
    </section>
  );
}
