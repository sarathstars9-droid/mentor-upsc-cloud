import { getHeatmapClass } from "../utils/dashboard";

export default function ExecutionHeatmap({ data = [] }) {
  return (
    <div className="surface-card">
      <div className="heatmap-header">
        <div className="heatmap-title">Execution Heatmap</div>
        <div className="heatmap-subtitle">Last 30 days</div>
      </div>

      <div className="heatmap-grid">
        {data.map((item) => (
          <div
            key={item.date}
            className={getHeatmapClass(item.score)}
            title={`${item.date} • score ${item.score}`}
          />
        ))}
      </div>

      <div className="heatmap-legend">
        <span>Low</span>
        <div className="heat-cell level-1" />
        <div className="heat-cell level-2" />
        <div className="heat-cell level-3" />
        <div className="heat-cell level-4" />
        <span>High</span>
      </div>
    </div>
  );
}