import { useState } from "react";
import { login } from "../utils/auth";

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError("");

    const result = await login(password);
    setIsLoading(false);

    if (result.success) {
      onLogin();
    } else {
      setError(result.error || "Incorrect password");
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-badge">Private Study OS</div>
        <h1 className="login-title">UPSC Mentor OS</h1>
        <p className="login-subtitle">
          Quiet system. Clear execution. One day at a time.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="field-label">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </label>

          {error ? <div className="error-text">{error}</div> : null}

          <button type="submit" className="primary-button full-width" disabled={isLoading}>
            {isLoading ? "Authenticating..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}