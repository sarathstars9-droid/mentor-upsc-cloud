import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

import PlanPage from "./pages/PlanPage";
import LoginPage from "./pages/LoginPage";
import PerformancePage from "./pages/PerformancePage";
import PrelimsPage from "./pages/PrelimsPage";
import MainsPage from "./pages/MainsPage";
import MainsGS1Page from "./pages/MainsGS1Page";
import MainsGS2Page from "./pages/MainsGS2Page";
import MainsGS3Page from "./pages/MainsGS3Page";
import AnswerWritingPage from "./pages/AnswerWritingPage";
import MainsMistakeBookPage from "./pages/MainsMistakeBookPage";
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
import MistakeBookPage from "./pages/MistakeBookPage";
import PrelimsInstitutionalTestsPage from "./pages/PrelimsInstitutionalTestsPage";
import MentorOSLayout from "./layouts/MentorOSLayout";
import { isLoggedIn, login, logout } from "./utils/auth";

function AppRoutes({ onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;

  const routeToPageMap = {
    "/plan": "plan",
    "/execution": "execution",
    "/performance": "performance",
    "/mistakes": "mistakes",
    "/revision": "revision",
    "/syllabus": "syllabus",
    "/csat": "csat",
    "/geography-optional": "optional",
    "/backlog": "backlog",
    "/focus": "focus",
    "/prelims": "prelims",
    "/prelims/mistakes": "prelims_mistakes",
    "/prelims/institutional-tests": "prelims_institutional",
    "/mains": "mains",
    "/mains/answer-writing": "mains",
    "/mains/mistakes": "mains_mistakes",
    "/ethics": "ethics",
    "/essay": "essay",
    "/settings": "settings",
  };

  const pageToRouteMap = {
    plan: "/plan",
    execution: "/execution",
    performance: "/performance",
    mistakes: "/mistakes",
    revision: "/revision",
    syllabus: "/syllabus",
    csat: "/csat",
    optional: "/geography-optional",
    backlog: "/backlog",
    focus: "/focus",
    prelims: "/prelims",
    prelims_mistakes: "/mistakes",
    prelims_institutional: "/prelims/institutional-tests",
    mains: "/mains",
    mains_mistakes: "/mains/mistakes",
    ethics: "/ethics",
    essay: "/essay",
    settings: "/settings",
  };

  const currentPage =
    path.startsWith("/pyq/topic/")
      ? "prelims"
      : path.startsWith("/prelims/institutional-tests")
      ? "prelims_institutional"
      : path === "/mistakes"
      ? "prelims_mistakes"
      : path === "/mains/mistakes"
      ? "mains_mistakes"
      : path.startsWith("/mains/")
      ? "mains"
      : routeToPageMap[path] || "plan";

  function handleNavigate(pageKey) {
    const targetRoute = pageToRouteMap[pageKey];
    if (targetRoute) navigate(targetRoute);
  }

  return (
    <MentorOSLayout currentPage={currentPage} onNavigate={handleNavigate}>
      <Routes>
        <Route path="/" element={<Navigate to="/plan" replace />} />
        <Route path="/prelims/mistakes" element={<PrelimsMistakesPage />} />
        <Route path="/prelims/institutional-tests" element={<PrelimsInstitutionalTestsPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/execution" element={<ExecutionPage />} />
        <Route path="/mistakes" element={<MistakeBookPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/revision" element={<RevisionPage />} />
        <Route path="/syllabus" element={<SyllabusPage />} />
        <Route path="/csat" element={<CsatPage />} />
        <Route path="/geography-optional" element={<GeographyOptionalPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route path="/prelims" element={<PrelimsPage />} />
        <Route path="/mains" element={<MainsPage />} />
        <Route path="/mains/gs1" element={<MainsGS1Page />} />
        <Route path="/mains/gs2" element={<MainsGS2Page />} />
        <Route path="/mains/gs3" element={<MainsGS3Page />} />
        <Route path="/mains/answer-writing" element={<AnswerWritingPage />} />
        <Route path="/mains/mistakes" element={<MainsMistakeBookPage />} />
        <Route path="/ethics" element={<EthicsPage />} />
        <Route path="/essay" element={<EssayPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/pyq/topic" element={<PyqTopicPage />} />
        <Route path="/pyq/topic/:syllabusNodeId" element={<PyqTopicPage />} />
        <Route path="*" element={<Navigate to="/plan" replace />} />
      </Routes>
    </MentorOSLayout>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());

  function handleLogin() {
    login();
    setAuthenticated(true);
  }

  function handleLogout() {
    logout();
    setAuthenticated(false);
  }

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <AppRoutes onLogout={handleLogout} />
    </BrowserRouter>
  );
}