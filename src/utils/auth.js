export const AUTH_KEY = "mentor_os_logged_in";
export const TOKEN_KEY = "mentor_os_auth_token";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === "localhost" ? "http://localhost:8787" : "https://api.mentorupsc.in");

export function isLoggedIn() {
  try {
    return !!sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

export async function login(password) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.ok && data.token) {
      sessionStorage.setItem(AUTH_KEY, "true");
      sessionStorage.setItem(TOKEN_KEY, data.token);
      // Remove insecure storage if present
      localStorage.removeItem("userId");
      localStorage.removeItem("userName");
      localStorage.removeItem("token");
      return { success: true };
    }
    return { success: false, error: data.error || "Login failed" };
  } catch (err) {
    return { success: false, error: "Network error" };
  }
}

export function logout() {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("token");
    window.location.href = "/login";
  } catch {}
}

export async function fetchWithAuth(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY) || "";
  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${token}`
  };
  const url = path.startsWith("http") ? path : `${BACKEND_URL}${path}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    logout();
    throw new Error("Unauthorized");
  }

  return response;
}
