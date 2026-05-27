export default function MentorTopbar({ title, clock, onMenuClick, mobileOpen }) {
  return (
    <>
      <div className="mentoros-mob-bar">
        <button
          className={`ham${mobileOpen ? " ham--open" : ""}`}
          type="button"
          onClick={onMenuClick}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen ? "true" : "false"}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>

        <div className="mobile-page-title">
          {(title || "Plan · Daily Execution").split("·")[0].trim().toUpperCase()}
        </div>

        <div className="chip live">
          <span className="live-dot" />
          <span>{clock}</span>
        </div>
      </div>

      <div className="mentoros-topbar">
        <div className="tb-title">{title}</div>

        <div className="tb-right">
          <div className="chip live">
            <span className="live-dot" />
            <span>{clock}</span>
          </div>
          <div className="chip">🔥 0 Day Streak</div>
          <div className="chip">📅 {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
    </>
  );
}