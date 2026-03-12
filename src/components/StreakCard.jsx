export default function StreakCard({ streak = 0 }) {
  return (
    <div className="discipline-card">
      <div className="discipline-label">Discipline Streak</div>
      <div className="discipline-value">🔥 {streak} Days</div>
      <div className="discipline-note">
        Consistency is built block by block.
      </div>
    </div>
  );
}