import { useEffect, useMemo, useState } from "react";
import MentorSidebar from "../components/layout/MentorSidebar";
import MentorTopbar from "../components/layout/MentorTopbar";
import MentorMobileDrawer from "../components/layout/MentorMobileDrawer";

const pageTitleMap = {
  plan: "Plan · Daily Execution",
  execution: "Execution · Live Session Control",
  performance: "Performance · Analytics",
  mistakes: "Mistake Book · Error Review",
  revision: "Revision · Spaced Recall",
  syllabus: "Syllabus · Coverage Map",
  csat: "CSAT · Aptitude Engine",
  optional: "Optional · Geography",
  backlog: "Backlog · Rescue Queue",
  focus: "Focus · Deep Work Mode",
  reports: "Reports · Study Analytics",
  prelims: "Prelims · Practice & PYQs",
  prelims_institutional: "Prelims · Institutional Tests",
  mains: "Mains · Answer Writing",
  ethics: "Ethics · Case Practice",
  essay: "Essay · Theme Builder",
  settings: "Settings · System Control",
};

function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MentorOSLayout({
  currentPage,
  onNavigate,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clock, setClock] = useState(formatClock());

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const title = useMemo(
    () => pageTitleMap[currentPage] || "Plan · Daily Execution",
    [currentPage]
  );

  function handleNavigate(pageKey) {
    onNavigate?.(pageKey);
    setMobileOpen(false);
  }

  return (
    <div className="mentoros-shell">
      <MentorSidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileOpen={mobileOpen}
      />

      <div className="mentoros-main">
        <MentorTopbar
          title={title}
          clock={clock}
          onMenuClick={() => setMobileOpen(true)}
        />

        <div className="mentoros-content">{children}</div>
      </div>

      <MentorMobileDrawer
        open={mobileOpen}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onClose={() => setMobileOpen(false)}
      />
    </div>
  );
}