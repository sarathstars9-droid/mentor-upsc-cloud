const AUTH_KEY = "mentor_os_logged_in";
const APP_PASSWORD = "mentor2026";

export function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function login() {
  localStorage.setItem(AUTH_KEY, "true");
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function checkPassword(value) {
  return String(value || "") === APP_PASSWORD;
}