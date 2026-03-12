import { NavLink } from "react-router-dom";

export default function Navbar({ onLogout }) {
  const menu = [
  
    { path: "/plan", label: "Daily Plan" },
    { path: "/execution", label: "Execution" },
	{ path: "/performance", label: "Performance" },
    { path: "/revision", label: "Revision" },
    { path: "/syllabus", label: "Syllabus Map" },
    { path: "/csat", label: "CSAT" },
    { path: "/geography-optional", label: "Optional (Geo)" },

    { path: "/backlog", label: "Backlog" },
    { path: "/focus", label: "Focus Mode" },
    { path: "/prelims", label: "Prelims" },
    { path: "/mains", label: "Mains" },
    { path: "/ethics", label: "Ethics" },
    { path: "/essay", label: "Essay" },
    { path: "/settings", label: "Settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-block">
          <div className="brand-logo">M</div>
          <div>
            <div className="brand-title">MENTORSHIP OS</div>
            <div className="brand-subtitle">AIR-1 Execution System</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive ? "sidebar-item active" : "sidebar-item"
            }
          >
            <span className="sidebar-dot" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}