import React from "react";
import {
  UPSC_EXAM_CALENDAR,
  APPSC_EXAM_CALENDAR,
  ACTIVE_ATTEMPT_YEAR,
  getCalendarDaysLeftIST
} from "../../config/examCalendar";

export default function ExamCountdowns() {
  const upsc = UPSC_EXAM_CALENDAR[ACTIVE_ATTEMPT_YEAR] || UPSC_EXAM_CALENDAR[2027];
  const appsc = APPSC_EXAM_CALENDAR;

  const upscPreDays = getCalendarDaysLeftIST(upsc?.prelims?.date);
  const upscMainsDays = getCalendarDaysLeftIST(upsc?.mains?.startDate);

  // Determine nearest upcoming milestone among announced dates
  const milestones = [
    { id: "upsc-pre", days: upscPreDays, label: "UPSC Prelims" },
    { id: "upsc-mains", days: upscMainsDays, label: "UPSC Mains" }
  ].filter(m => m.days != null && m.days > 0);

  milestones.sort((a, b) => a.days - b.days);
  const nearestId = milestones[0]?.id;

  return (
    <section className="mos-exam-countdowns" style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 14,
      marginBottom: 20
    }}>
      {/* Card 1: UPSC CSE 2027 */}
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🏛️</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
              {upsc.label || "UPSC CSE 2027"}
            </span>
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--brand-primary)",
            background: "var(--brand-primary-soft)",
            padding: "2px 8px",
            borderRadius: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}>
            Civil Services
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          {/* Prelims Milestone */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
                Prelims
              </span>
              {nearestId === "upsc-pre" && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: "var(--warning)",
                  background: "rgba(234, 179, 8, 0.15)",
                  padding: "1px 5px",
                  borderRadius: 4
                }}>
                  NEAREST
                </span>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 2, fontFamily: "var(--mono, monospace)" }}>
              {upscPreDays != null ? `${upscPreDays}d` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {upsc.prelims.displayDate} • <span style={{ color: "var(--warning)" }}>Tentative</span>
            </div>
          </div>

          {/* Mains Milestone */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Mains
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginTop: 2, fontFamily: "var(--mono, monospace)" }}>
              {upscMainsDays != null ? `${upscMainsDays}d` : "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
              {upsc.mains.displayDate} • <span style={{ color: "var(--warning)" }}>Tentative</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: APPSC Group-1 */}
      <div style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "16px 20px",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🏛️</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
              {appsc.label || "APPSC Group-1 Services"}
            </span>
          </div>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--success, #16a34a)",
            background: "rgba(34, 197, 94, 0.1)",
            padding: "2px 8px",
            borderRadius: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}>
            State Services
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          {/* APPSC Prelims */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Prelims
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginTop: 4 }}>
              Official date: Not announced
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              Prep Target: 2026–27 Cycle
            </div>
          </div>

          {/* APPSC Mains */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>
              Mains
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginTop: 4 }}>
              Official date: Not announced
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
              Prep Target: 2026–27 Cycle
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
