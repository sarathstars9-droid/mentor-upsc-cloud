import {
  Calendar,
  Play,
  RefreshCw,
  BarChart2,
  BookOpen,
  FileText,
  Map,
  Layers,
  AlertTriangle,
  Archive,
  PieChart,
  Clock,
  Settings,
  User,
  LogOut,
} from "lucide-react";
import "../../styles/mos-sidebar-v2.css";

const navGroups = [
  {
    key: "command",
    label: "Command",
    items: [
      { id: "plan", key: "plan", icon: Calendar, label: "Plan" },
      { id: "execution", key: "execution", icon: Play, label: "Execute" },
      { id: "revision-cmd", key: "revision", icon: RefreshCw, label: "Review" },
      { id: "performance", key: "performance", icon: BarChart2, label: "Performance" },
    ],
  },
  {
    key: "prelims",
    label: "Prelims",
    items: [
      { id: "prelims", key: "prelims", icon: BookOpen, label: "Practice" },
      { id: "prelims_mistakes", key: "prelims_mistakes", icon: AlertTriangle, label: "Mistakes" },
      { id: "prelims_institutional", key: "prelims_institutional", icon: Archive, label: "Institute Tests" },
    ],
  },
  {
    key: "mains",
    label: "Mains",
    items: [
      { id: "mains", key: "mains", icon: FileText, label: "Answer Writing" },
      { id: "mains_mistakes", key: "mains_mistakes", icon: AlertTriangle, label: "Mains Mistakes" },
      { id: "essay", key: "essay", icon: FileText, label: "Essay" },
      { id: "ethics", key: "ethics", icon: FileText, label: "Ethics" },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge",
    items: [
      { id: "syllabus", key: "syllabus", icon: Layers, label: "Syllabus" },
      { id: "optional", key: "optional", icon: Map, label: "Optional Geography" },
      { id: "revision-know", key: "revision", icon: RefreshCw, label: "Revision", activeKey: null },
      { id: "backlog", key: "backlog", icon: Archive, label: "Backlog" },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [
      { id: "focus", key: "focus", icon: Clock, label: "Focus" },
      { id: "reports", key: "reports", icon: PieChart, label: "Reports" },
      { id: "settings", key: "settings", icon: Settings, label: "Settings" },
    ],
  },
];

import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function MentorSidebar({ currentPage, onNavigate, onLogout }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="mos-sidebar-v2" role="navigation" aria-label="MentorOS navigation">
      {/* ... existing header ... */}
      <header className="mos-sidebar-header-v2">
        <div className="mos-logo-tile-v2">M</div>
        <div>
          <div className="mos-header-title-v2">MENTORSHIP OS</div>
          <div className="mos-header-sub-v2">AIR-1 Execution System</div>
        </div>
        <button 
          className="mos-theme-toggle-v2" 
          onClick={toggleTheme} 
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === 'dark' ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
        </button>
      </header>

      <div className="mos-nav-scroll-v2">
          {navGroups.map((group) => (
            <section className="mos-nav-section-v2" key={group.key} aria-labelledby={`mos-sec-${group.key}`}>
              <div id={`mos-sec-${group.key}`} className="mos-nav-section-label-v2">{group.label}</div>
              <div>
                {group.items.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = item.activeKey !== undefined
                    ? (item.activeKey === null ? false : currentPage === item.activeKey)
                    : currentPage === item.key;

                  return (
                    <button
                      key={`${group.key}-${item.id || item.key}-${idx}`}
                      type="button"
                      className={`mos-nav-item-v2 ${isActive ? "active" : ""}`}
                      onClick={() => onNavigate?.(item.key)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="mos-nav-item-left-v2">
                        <span className="mos-nav-item-icon-v2"><Icon size={18} strokeWidth={1.8} /></span>
                        <span className="mos-nav-item-label-v2">{item.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
      </div>

      <footer className="mos-profile-v2">
        <div className="mos-profile-avatar-v2">M</div>
        <div className="mos-profile-info-v2">
          <div className="mos-profile-name-v2">Moulika</div>
          <div className="mos-profile-role-v2">Active Aspirant</div>
        </div>
        <button className="mos-logout-v2" type="button" onClick={onLogout}>Logout</button>
      </footer>
    </aside>
  );
}
