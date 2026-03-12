import { getLostMinutes } from "../utils/dashboard";

export default function RealityPanel({
  planMin = 0,
  doneMin = 0,
  delayCount = 0,
  deepWorkBlocks = 0,
  totalBlocks = 0,
}) {
  const lost = getLostMinutes(doneMin, planMin);

  return (
    <div className="reality-card">
      <div className="reality-title">Reality Panel</div>

      <div className="reality-grid">
        <div className="reality-item">
          <div className="reality-label">Planned</div>
          <div className="reality-value">{planMin} min</div>
        </div>

        <div className="reality-item">
          <div className="reality-label">Done</div>
          <div className="reality-value">{doneMin} min</div>
        </div>

        <div className="reality-item">
          <div className="reality-label">Lost</div>
          <div className="reality-value">{lost} min</div>
        </div>

        <div className="reality-item">
          <div className="reality-label">Delay Starts</div>
          <div className="reality-value">{delayCount}</div>
        </div>

        <div className="reality-item full">
          <div className="reality-label">Deep Work Blocks</div>
          <div className="reality-value">
            {deepWorkBlocks}/{totalBlocks}
          </div>
        </div>
      </div>
    </div>
  );
}