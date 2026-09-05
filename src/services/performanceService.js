import { fetchWithAuth } from "../utils/auth";

export async function fetchRealPerformanceData() {
  const res = await fetchWithAuth("/api/performance", { method: "GET" });

  if (!res.ok) {
    throw new Error(`Performance API failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data?.ok) {
    throw new Error(data?.message || data?.error || "Performance API returned an invalid response");
  }

  return data;
}
