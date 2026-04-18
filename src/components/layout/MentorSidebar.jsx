const navItems = [
  { key: "plan", icon: "📋", label: "Plan" },
  { key: "execution", icon: "⚡", label: "Execution" },
  { key: "performance", icon: "📊", label: "Performance" },
  { key: "revision", icon: "🔁", label: "Revision" },
  { key: "syllabus", icon: "📚", label: "Syllabus" },
  { key: "optional", icon: "🗺️", label: "Optional (Geo)" },
  { key: "backlog", icon: "📦", label: "Backlog" },
  { key: "focus", icon: "⏱️", label: "Focus" },
  { key: "prelims", icon: "📝", label: "Prelims" },
  { key: "prelims_mistakes", icon: "📒", label: "Pre Mistakes" },
  { key: "prelims_institutional", icon: "🏛️", label: "Pre Inst.Test" },
  { key: "mains", icon: "✍️", label: "Mains" },
  { key: "mains_mistakes", icon: "📕", label: "Mains Mistakes" },
  { key: "ethics", icon: "⚖️", label: "Ethics" },
  { key: "essay", icon: "📄", label: "Essay" },
  { key: "settings", icon: "⚙️", label: "Settings" },
];

export default function MentorSidebar({ currentPage, onNavigate, mobileOpen }) {
  return (
    <aside className="mentoros-sidebar">
      <div className="sb-logo">
        <div className="logo-chip">M</div>
        <div className="sb-name">Mentorship OS</div>
        <div className="sb-sub">AIR-1 Execution System</div>
      </div>

      <nav className="sb-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`nav-item ${currentPage === item.key ? "active" : ""}`}
            onClick={() => onNavigate?.(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-user">
          <div className="sb-avatar">M</div>
          <div className="sb-uname">Moulika</div>
        </div>
        <button className="logout-btn" type="button">⏻ Logout</button>
      </div>
    </aside>
  );
}
