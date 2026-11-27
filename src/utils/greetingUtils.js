/**
 * Returns dynamic greeting based on IST hour:
 * 05:00–11:59 -> Good morning
 * 12:00–16:59 -> Good afternoon
 * 17:00–20:59 -> Good evening
 * 21:00–04:59 -> Good night
 */
export function getTimeAwareGreeting(dateObj = new Date()) {
  const istHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false
  }).format(dateObj);
  const hour = parseInt(istHourStr, 10);

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}
