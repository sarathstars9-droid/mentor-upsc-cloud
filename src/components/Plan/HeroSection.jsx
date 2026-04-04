export default function HeroSection({
    dPre,
    dMains,
    streakToday,
    completionToday,
    dailyMotivation,
    alertPermission,
}) {
    return (
        <section className="dashboard-hero">
            <div className="hero-left">
                <div className="hero-kicker">Daily Execution System</div>

                <h1 className="hero-title">
                    Welcome back, <span className="hero-highlight">Moulika</span>
                </h1>

                <p className="hero-sub">
                    Quiet consistency compounds. The system handles the structure. You focus on execution.
                </p>

                <div className="hero-chips">
                    <div className="chip primary">📅 Prelims in {dPre} days</div>
                    <div className="chip blue">📖 Mains in {dMains} days</div>
                    <div className="chip">🔕 Alerts: {alertPermission}</div>
                    <div className="chip">🔥 {streakToday} Day Streak</div>
                </div>
            </div>

            <div className="hero-right">
                <div className="hero-stat-label">Today Completion</div>
                <div className="hero-stat-value">{completionToday}%</div>
                <div className="hero-stat-note">{dailyMotivation}</div>
            </div>
        </section>
    );
}
