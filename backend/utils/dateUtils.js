export function getKolkataDateKey(date = new Date()) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function getTodayKey() {
  return getKolkataDateKey(new Date());
}
