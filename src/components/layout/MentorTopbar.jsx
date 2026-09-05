import { CalendarDays, Clock3, Flame } from "lucide-react";

export default function MentorTopbar({ title, clock, onMenuClick, mobileOpen }) {
  const dateLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

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
        <div className="mobile-page-title">{(title || "Plan · Daily Execution").split("·")[0].trim()}</div>
        <div className="chip live"><Clock3 size={12} /><span>{clock}</span></div>
      </div>

      <div className="mentoros-topbar">
        <div className="tb-title">{title}</div>
        <div className="tb-right">
          <div className="chip live"><Clock3 size={12} /><span>{clock}</span></div>
          <div className="chip"><Flame size={12} /><span>0 Day Streak</span></div>
          <div className="chip"><CalendarDays size={12} /><span>{dateLabel}</span></div>
        </div>
      </div>
    </>
  );
}
