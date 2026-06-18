import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import React, { useState } from "react";

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
import EthicsPage from "./pages/ethics/EthicsPage";
import EthicsPyqPage from "./pages/ethics/EthicsPyqPage";
import EthicsInstitutionalPage from "./pages/ethics/EthicsInstitutionalPage";
import EthicsMistakePage from "./pages/ethics/EthicsMistakePage";
import EssayPage from "./pages/essay/EssayPage";
import EssayPyqPage from "./pages/essay/EssayPyqPage";
import EssayInstitutionalPage from "./pages/essay/EssayInstitutionalPage";
import EssayMistakePage from "./pages/essay/EssayMistakePage";
import GeographyOptionalPage from "./pages/geographyOptional/GeographyOptionalPage";
import GeographyOptionalPyqPage from "./pages/geographyOptional/GeographyOptionalPyqPage";
import GeographyOptionalInstitutionalPage from "./pages/geographyOptional/GeographyOptionalInstitutionalPage";
import GeographyOptionalMistakePage from "./pages/geographyOptional/GeographyOptionalMistakePage";
import SettingsPage from "./pages/SettingsPage";
import PyqTopicPage from "./pages/PyqTopicPage.jsx";
import ExecutionPage from "./pages/ExecutionPage";
import RevisionPage from "./pages/RevisionPage";
import SyllabusPage from "./pages/SyllabusPage";
import CsatPage from "./pages/CSATPage";
import BacklogPage from "./pages/BacklogPage";
import FocusPage from "./pages/FocusPage";
import ReportsPage from "./pages/ReportsPage";
import PrelimsMistakesPage from "./pages/PrelimsMistakesPage";
import MistakeBookPage from "./pages/MistakeBookPage";
import PrelimsInstitutionalTestsPage from "./pages/PrelimsInstitutionalTestsPage";
import MentorOSLayout from "./layouts/MentorOSLayout";
import PyqIngestionPage from "./pages/admin/PyqIngestionPage";
import PrelimsTestPage from "./pages/PrelimsTestPage";
import PrelimsTestAttemptPage from "./pages/PrelimsTestAttemptPage";
import PrelimsTestResultPage from "./pages/PrelimsTestResultPage";
import { isLoggedIn, login, logout } from "./utils/auth";
import NotificationBanner from "./components/Notifications/NotificationBanner";

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
    "/geography-optional/pyq": "optional",
    "/geography-optional/institutional": "optional",
    "/geography-optional/mistakes": "optional",
    "/backlog": "backlog",
    "/focus": "focus",
    "/reports":  "reports",
    "/prelims": "prelims",
    "/prelims/mistakes": "prelims_mistakes",
    "/prelims/institutional-tests": "prelims_institutional",
    "/mains": "mains",
    "/mains/answer-writing": "mains",
    "/mains/mistakes": "mains_mistakes",
    "/ethics": "ethics",
    "/ethics/pyq": "ethics",
    "/ethics/institutional": "ethics",
    "/ethics/mistakes": "ethics",
    "/essay": "essay",
    "/essay/pyq": "essay",
    "/essay/institutional": "essay",
    "/essay/mistakes": "essay",
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
    reports: "/reports",
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
        <Route path="/plan" element={<ErrorBoundary><PlanPage /></ErrorBoundary>} />
        <Route path="/execution" element={<ExecutionPage />} />
        <Route path="/mistakes" element={<MistakeBookPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/revision" element={<RevisionPage />} />
        <Route path="/syllabus" element={<SyllabusPage />} />
        <Route path="/csat" element={<CsatPage />} />
        <Route path="/geography-optional" element={<GeographyOptionalPage />} />
        <Route path="/geography-optional/pyq" element={<GeographyOptionalPyqPage />} />
        <Route path="/geography-optional/institutional" element={<GeographyOptionalInstitutionalPage />} />
        <Route path="/geography-optional/mistakes" element={<GeographyOptionalMistakePage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/prelims" element={<PrelimsPage />} />
        <Route path="/mains" element={<MainsPage />} />
        <Route path="/mains/gs1" element={<MainsGS1Page />} />
        <Route path="/mains/gs2" element={<MainsGS2Page />} />
        <Route path="/mains/gs3" element={<MainsGS3Page />} />
        <Route path="/mains/answer-writing" element={<AnswerWritingPage />} />
        <Route path="/mains/mistakes" element={<MainsMistakeBookPage />} />
        <Route path="/ethics" element={<EthicsPage />} />
        <Route path="/ethics/pyq" element={<EthicsPyqPage />} />
        <Route path="/ethics/institutional" element={<EthicsInstitutionalPage />} />
        <Route path="/ethics/mistakes" element={<EthicsMistakePage />} />
        <Route path="/essay" element={<EssayPage />} />
        <Route path="/essay/pyq" element={<EssayPyqPage />} />
        <Route path="/essay/institutional" element={<EssayInstitutionalPage />} />
        <Route path="/essay/mistakes" element={<EssayMistakePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/pyq/topic" element={<PyqTopicPage />} />
        <Route path="/pyq/topic/:syllabusNodeId" element={<PyqTopicPage />} />
        {/* Admin-only utility routes — not in sidebar nav */}
        <Route path="/admin/pyq-ingestion" element={<PyqIngestionPage />} />
        {/* Prelims Test Engine */}
        <Route path="/prelims/test" element={<PrelimsTestPage />} />
        <Route path="/prelims/test/:attemptId" element={<PrelimsTestAttemptPage />} />
        <Route path="/prelims/test/result/:attemptId" element={<PrelimsTestResultPage />} />
        <Route path="*" element={<Navigate to="/plan" replace />} />
      </Routes>
    </MentorOSLayout>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#111", color: "#fff", padding: 12, borderRadius: 8 }}>{String(this.state.error)}</pre>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => this.setState({ hasError: false, error: null })}>Dismiss</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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

  console.log("localStorage keys", Object.keys(localStorage));
  console.log("localStorage values", localStorage);

  const currentUserId = localStorage.getItem("userId");

  return (
    <BrowserRouter>
      <NotificationBanner userId={currentUserId} />
      <AppRoutes onLogout={handleLogout} />
    </BrowserRouter>
  );
}