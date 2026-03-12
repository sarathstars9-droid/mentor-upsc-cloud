import { getCompletionPercent, getRemainingMinutes } from "../utils/dashboard";

export default function TargetRing({ planMin = 0, doneMin = 0 }) {
  const percent = getCompletionPercent(doneMin, planMin);
  const remaining = getRemainingMinutes(doneMin, planMin);

  const radius = 54;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (percent / 100) * circumference;

  return (
    <div className="target-ring-card">
      <div className="target-ring-wrap">
        <svg height={radius * 2} width={radius * 2} className="target-ring-svg">
          <circle
            stroke="#D9E2EC"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="#4A90E2"
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        <div className="target-ring-center">
          <div className="target-ring-percent">{percent}%</div>
          <div className="target-ring-sub">done</div>
        </div>
      </div>

      <div className="target-ring-info">
        <div className="target-ring-title">Daily Target</div>
        <div className="target-ring-line">Planned: {planMin} min</div>
        <div className="target-ring-line">Done: {doneMin} min</div>
        <div className="target-ring-line">Remaining: {remaining} min</div>
      </div>
    </div>
  );
}