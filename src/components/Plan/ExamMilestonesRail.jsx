import React from "react";
import {
  UPSC_EXAM_CALENDAR,
  APPSC_EXAM_CALENDAR,
  ACTIVE_ATTEMPT_YEAR,
  getCalendarDaysLeftIST
} from "../../config/examCalendar";

export default function ExamMilestonesRail() {
  const upsc = UPSC_EXAM_CALENDAR[ACTIVE_ATTEMPT_YEAR] || UPSC_EXAM_CALENDAR[2027];
  const appsc = APPSC_EXAM_CALENDAR;

  const upscPreDays = getCalendarDaysLeftIST(upsc?.prelims?.date);
  const upscMainsDays = getCalendarDaysLeftIST(upsc?.mains?.startDate);

  const rows = [
    {
      exam: "UPSC CSE 2027",
      stage: "Prelims",
      dateStr: upsc.prelims.displayDate,
      daysLeft: upscPreDays != null ? `${upscPreDays}d` : "—",
      status: "Official Tentative Date",
      isOfficial: true
    },
    {
      exam: "UPSC CSE 2027",
      stage: "Mains",
      dateStr: upsc.mains.displayDate,
      daysLeft: upscMainsDays != null ? `${upscMainsDays}d` : "—",
      status: "Official Tentative Date",
      isOfficial: true
    },
    {
      exam: "APPSC Group-1",
      stage: "Prelims",
      dateStr: "Date not announced",
      daysLeft: "2026–27 Cycle",
      status: "Prep Target (Notification pending)",
      isOfficial: false
    },
    {
      exam: "APPSC Group-1",
      stage: "Mains",
      dateStr: "Date not announced",
      daysLeft: "2026–27 Cycle",
      status: "Prep Target (Notification pending)",
      isOfficial: false
    }
  ];

  return (
    <div
      className="mos-milestones-rail"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "18px 20px",
        marginBottom: 16,
        boxShadow: "var(--shadow-card)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
          EXAMINATION MILESTONES
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-primary)" }}>
          UPSC & APPSC
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row, idx) => (
          <div
            key={idx}
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)" }}>
                  {row.exam} {row.stage}
                </span>
                {!row.isOfficial && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "var(--text-tertiary)",
                      background: "var(--border-subtle)",
                      padding: "1px 5px",
                      borderRadius: 4
                    }}
                  >
                    Target
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                {row.dateStr}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: "var(--mono, monospace)",
                  color: row.isOfficial ? "var(--brand-primary)" : "var(--text-secondary)"
                }}
              >
                {row.daysLeft}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
                {row.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
