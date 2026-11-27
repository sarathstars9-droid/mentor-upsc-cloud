export const ACTIVE_ATTEMPT_YEAR = 2027;

export const UPSC_EXAM_CALENDAR = {
  2027: {
    attemptYear: 2027,
    label: "UPSC CSE 2027",
    seriousAttempt: true,
    notificationDate: "2027-01-13",
    applicationLastDate: "2027-02-02",
    prelims: {
      date: "2027-05-23T09:30:00+05:30",
      displayDate: "23 May 2027",
      label: "UPSC Prelims 2027",
      isAnnounced: true,
      isTentative: true,
    },
    mains: {
      startDate: "2027-08-20T09:00:00+05:30",
      displayDate: "20 Aug 2027",
      durationDays: 5,
      label: "UPSC Mains 2027",
      isAnnounced: true,
      isTentative: true,
    },
  },
};

export const APPSC_EXAM_CALENDAR = {
  label: "APPSC Group-1 Services",
  prelims: {
    date: null,
    displayDate: "Date not announced",
    label: "APPSC Prelims",
    isAnnounced: false,
    isTentative: false,
  },
  mains: {
    startDate: null,
    displayDate: "Date not announced",
    label: "APPSC Mains",
    isAnnounced: false,
    isTentative: false,
  },
};

export const ACTIVE_EXAM = UPSC_EXAM_CALENDAR[ACTIVE_ATTEMPT_YEAR];

export function getCalendarDaysLeftIST(targetDateStr) {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  const getISTDay = (d) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  };
  const nowDayStr = getISTDay(now);
  const targetDayStr = getISTDay(target);

  const dNow = new Date(nowDayStr + "T00:00:00Z");
  const dTarget = new Date(targetDayStr + "T00:00:00Z");
  const diffDays = Math.round((dTarget.getTime() - dNow.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function getDaysLeft(targetDate) {
  return getCalendarDaysLeftIST(targetDate);
}

export function getPrelimsDaysLeft() {
  return getCalendarDaysLeftIST(ACTIVE_EXAM.prelims.date);
}

export function getMainsDaysLeft() {
  return getCalendarDaysLeftIST(ACTIVE_EXAM.mains.startDate);
}

