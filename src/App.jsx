import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";

import PlanPage from "./pages/PlanPage";
import LoginPage from "./pages/LoginPage";
import PerformancePage from "./pages/PerformancePage";
import PrelimsPage from "./pages/PrelimsPage";
import MainsPage from "./pages/MainsPage";
import EthicsPage from "./pages/EthicsPage";
import EssayPage from "./pages/EssayPage";
import GeographyOptionalPage from "./pages/GeographyOptionalPage";
import SettingsPage from "./pages/SettingsPage";
import PyqTopicPage from "./pages/PyqTopicPage.jsx";
import ExecutionPage from "./pages/ExecutionPage";
import RevisionPage from "./pages/RevisionPage";
import SyllabusPage from "./pages/SyllabusPage";
import CsatPage from "./pages/CSATPage";
import BacklogPage from "./pages/BacklogPage";
import FocusPage from "./pages/FocusPage";
import PrelimsMistakesPage from "./pages/PrelimsMistakesPage";
import Navbar from "./components/Navbar";
import { isLoggedIn, login, logout } from "./utils/auth";

export default function App() {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogin() {
    login();
    setAuthenticated(true);
  }

  function handleLogout() {
    setMobileOpen(false);
    logout();
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <div className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>

          <div className="mobile-topbar-title">Mentorship OS</div>
        </div>

        <main className="page-shell">
          <Routes>
            <Route path="/" element={<Navigate to="/plan" replace />} />
            <Route path="/prelims/mistakes" element={<PrelimsMistakesPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/execution" element={<ExecutionPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/revision" element={<RevisionPage />} />
            <Route path="/syllabus" element={<SyllabusPage />} />
            <Route path="/csat" element={<CsatPage />} />
            <Route path="/geography-optional" element={<GeographyOptionalPage />} />
            <Route path="/backlog" element={<BacklogPage />} />
            <Route path="/focus" element={<FocusPage />} />
            <Route path="/prelims" element={<PrelimsPage />} />
            <Route path="/mains" element={<MainsPage />} />
            <Route path="/ethics" element={<EthicsPage />} />
            <Route path="/essay" element={<EssayPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/pyq/topic/:syllabusNodeId" element={<PyqTopicPage />} />
            <Route path="*" element={<Navigate to="/plan" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}