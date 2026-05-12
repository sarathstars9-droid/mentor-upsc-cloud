export default function HeroSection({
    dPre,
    dMains,
    streakToday,
    completionToday,
    dailyMotivation,
}) {
    return (
        <section className="dashboard-hero mos-hero-card">
            <div className="hero-left">
                <h1 className="hero-title">
                    Good morning, <span className="hero-highlight">Moulika</span>
                </h1>

                <p className="hero-sub">
                    Quiet consistency compounds. The system handles the structure — you focus on execution.
                </p>

                <div className="hero-chips">
                    <div className="chip primary">Prelims in {dPre} days</div>
                    <div className="chip">Mains in {dMains} days</div>
                    {streakToday > 1 && (
                        <div className="chip">{streakToday} day streak</div>
                    )}
                </div>
            </div>

            <div className="hero-right mos-hero-stat-block">
                <div className="hero-stat-label">Today</div>
                <div className="hero-stat-value">{completionToday}%</div>
                <div className="hero-stat-note">{dailyMotivation}</div>
            </div>
        </section>
    );
}
