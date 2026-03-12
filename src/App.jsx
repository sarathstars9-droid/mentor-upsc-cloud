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
import Navbar from "./components/Navbar";
import { isLoggedIn, login, logout } from "./utils/auth";

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
      <div className="app-layout">
        <Navbar onLogout={handleLogout} />

        <div className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/plan" replace />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/prelims" element={<PrelimsPage />} />
            <Route path="/mains" element={<MainsPage />} />
            <Route path="/ethics" element={<EthicsPage />} />
            <Route path="/essay" element={<EssayPage />} />
            <Route path="/geography-optional" element={<GeographyOptionalPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/plan" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}