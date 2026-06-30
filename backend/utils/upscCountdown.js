export function getUpscCountdownSummary(now = new Date()) {
  // Convert current time to Kolkata string and parse local parts
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const localDateObj = new Date(kolkataStr);

  // Get local midnight UTC timestamp representation of Kolkata date
  const todayUTC = Date.UTC(
    localDateObj.getFullYear(),
    localDateObj.getMonth(),
    localDateObj.getDate()
  );

  const prelimsUTC = Date.UTC(2027, 4, 23); // May 23, 2027 (Sunday)
  const mainsUTC = Date.UTC(2027, 7, 20);   // August 20, 2027 (Friday)

  const msPerDay = 1000 * 60 * 60 * 24;

  let prelimsText = "";
  if (todayUTC > prelimsUTC) {
    prelimsText = "Exam date passed";
  } else {
    const diff = prelimsUTC - todayUTC;
    const days = Math.max(0, Math.round(diff / msPerDay));
    prelimsText = `${days} days left`;
  }

  let mainsText = "";
  if (todayUTC > mainsUTC) {
    mainsText = "Exam date passed";
  } else {
    const diff = mainsUTC - todayUTC;
    const days = Math.max(0, Math.round(diff / msPerDay));
    mainsText = `${days} days left`;
  }

  return `📅 UPSC Countdown\n` +
         `Prelims 2027: ${prelimsText} — May 23, 2027 (Sunday)\n` +
         `Mains 2027: ${mainsText} — August 20, 2027 (Friday)`;
}
