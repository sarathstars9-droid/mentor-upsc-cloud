import { useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";

export default function Navbar({ onLogout, mobileOpen, setMobileOpen }) {
  const location = useLocation();

  const menu = useMemo(
    () => [
      { path: "/plan", label: "Plan", mobile: true, desktop: true },
      { path: "/execution", label: "Execution", mobile: false, desktop: true },
      { path: "/performance", label: "Performance", mobile: true, desktop: true },
      { path: "/mistake", label: "mistake", mobile: true, desktop: true },
      { path: "/revision", label: "Revision", mobile: true, desktop: true },
      { path: "/syllabus", label: "Syllabus", mobile: true, desktop: true },
      { path: "/csat", label: "CSAT", mobile: false, desktop: true },
      { path: "/geography-optional", label: "Optional (Geo)", mobile: false, desktop: true },
      { path: "/backlog", label: "Backlog", mobile: false, desktop: true },
      { path: "/focus", label: "Focus", mobile: true, desktop: true },
      { path: "/prelims", label: "Prelims", mobile: false, desktop: true },
      { path: "/mains", label: "Mains", mobile: false, desktop: true },
      { path: "/ethics", label: "Ethics", mobile: false, desktop: true },
      { path: "/essay", label: "Essay", mobile: false, desktop: true },
      { path: "/settings", label: "Settings", mobile: true, desktop: true },
    ],
    []
  );

  useEffect(() => {
    setMobileOpen?.(false);
  }, [location.pathname, setMobileOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const mobileMenu = menu.filter((item) => item.mobile);
  const desktopMenu = menu.filter((item) => item.desktop);

  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand-block">
            <div className="brand-logo">M</div>
            <div>
              <div className="brand-title">MENTORSHIP OS</div>
              <div className="brand-subtitle">AIR-1 Execution System</div>
            </div>
          </div>

          <button
            className="sidebar-close"
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen?.(false)}
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-menu sidebar-menu-desktop">
          {desktopMenu.map((item) => (
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

        <nav className="sidebar-menu sidebar-menu-mobile">
          {mobileMenu.map((item) => (
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
          <button
            className="logout-button"
            onClick={() => {
              setMobileOpen?.(false);
              onLogout?.();
            }}
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}