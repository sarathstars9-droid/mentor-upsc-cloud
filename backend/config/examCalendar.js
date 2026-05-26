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
      label: "Prelims 2027",
    },
    mains: {
      startDate: "2027-08-20T09:00:00+05:30",
      displayDate: "20 Aug 2027",
      durationDays: 5,
      label: "Mains 2027",
    },
  },
};

export const ACTIVE_EXAM = UPSC_EXAM_CALENDAR[ACTIVE_ATTEMPT_YEAR];

export function getDaysLeft(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function getPrelimsDaysLeft() {
  return getDaysLeft(ACTIVE_EXAM.prelims.date);
}

export function getMainsDaysLeft() {
  return getDaysLeft(ACTIVE_EXAM.mains.startDate);
}
