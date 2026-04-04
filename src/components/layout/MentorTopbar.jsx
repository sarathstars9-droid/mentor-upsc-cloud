export default function MentorTopbar({ title, clock, onMenuClick }) {
  return (
    <>
      <div className="mentoros-mob-bar">
        <button className="ham" type="button" onClick={onMenuClick}>
          ☰
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
          <div className="chip">📅 26 Mar 2026</div>
        </div>
      </div>
    </>
  );
}