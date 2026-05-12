const AUTH_KEY = "mentor_os_logged_in";
const APP_PASSWORD = "mentor2026";

// Fallback to memory since localStorage is removed
let isLoggedInMemory = false;

export function isLoggedIn() {
  // Try to use sessionStorage instead if possible, else memory
  try {
    return sessionStorage.getItem(AUTH_KEY) === "true" || isLoggedInMemory;
  } catch {
    return isLoggedInMemory;
  }
}

export function login() {
  isLoggedInMemory = true;
  try {
    sessionStorage.setItem(AUTH_KEY, "true");
  } catch {}
}

export function logout() {
  isLoggedInMemory = false;
  try {
    sessionStorage.removeItem(AUTH_KEY);
  } catch {}
}

export function checkPassword(value) {
  return String(value || "") === APP_PASSWORD;
}