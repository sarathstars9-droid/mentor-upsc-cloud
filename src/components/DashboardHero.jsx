import StreakCard from "./StreakCard";
import TargetRing from "./TargetRing";

export default function DashboardHero({
  name = "Moulika",
  prelimsDays = 0,
  mainsDays = 0,
  planMin = 0,
  doneMin = 0,
  streak = 0,
  sankalpa = "I will honor each study block with steadiness, clarity, and courage.",
}) {
  return (
    <section className="dashboard-hero-shell">
      <div className="dashboard-hero-left">
        <div className="dashboard-badge">Sacred Performance Dashboard</div>

        <h1 className="dashboard-hero-title">
          Welcome, {name}
        </h1>

        <div className="dashboard-hero-subtitle">
          AIR-1 is built block by block.
        </div>

<div className="syllabus-progress">
  <div className="progress-label">
    Syllabus Progress <span>62%</span>
  </div>

  <div className="progress-bar">
    <div className="progress-fill" style={{width:"62%"}} />
  </div>
</div>

        <div className="dashboard-countdown-row">
          <div className="dashboard-chip">Prelims: {prelimsDays} days</div>
          <div className="dashboard-chip">Mains: {mainsDays} days</div>
        </div>

        <div className="sankalpa-card">
          <div className="sankalpa-label">Today’s Sankalpa</div>
          <div className="sankalpa-text">“{sankalpa}”</div>
        </div>
      </div>

      <div className="dashboard-hero-right">
        <TargetRing planMin={planMin} doneMin={doneMin} />
        <StreakCard streak={streak} />
      </div>
    </section>
  );
}