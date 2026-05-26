import { query } from '../db/index.js';
import { computeSyllabusProgress } from '../brain/syllabusProgressEngine.js';

// Helper to determine Monday of the current week in Asia/Kolkata timezone
export function getMondayOfCurrentWeek() {
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeSubjectLabel(subject) {
  if (!subject) return "Revision/Buffer";
  const lower = subject.trim().toLowerCase();

  if (
    lower === "geography" ||
    lower === "geo" ||
    lower === "optional" ||
    lower.includes("geography optional") ||
    lower.includes("geography")
  ) {
    return "Geography Optional";
  }
  if (lower.includes("csat")) {
    return "CSAT";
  }
  if (lower.includes("mains answer") || lower.includes("answer writing")) {
    return "Mains Answer Writing";
  }
  if (lower.includes("ethics") || lower.includes("gs4") || lower.includes("gs-4")) {
    return "GS4 Ethics";
  }
  if (lower.includes("essay")) {
    return "Essay";
  }
  if (lower.includes("current affairs") || lower.includes("news")) {
    return "Current Affairs";
  }
  if (lower.includes("revision") || lower.includes("reunion") || lower.includes("buffer")) {
    return "Revision/Buffer";
  }
  if (lower.includes("prelims") || lower.includes("mcq") || lower.includes("pyq")) {
    return "Prelims GS MCQ + PYQ";
  }
  if (
    lower.includes("history") || 
    lower.includes("ancient") || 
    lower.includes("culture") || 
    lower.includes("society") || 
    lower.includes("gs1") || 
    lower.includes("gs-1")
  ) {
    return "GS1";
  }
  if (
    lower.includes("polity") || 
    lower.includes("governance") || 
    lower.includes("social justice") || 
    lower.includes("ir ") || 
    lower.includes("international relations") || 
    lower.includes("gs2") || 
    lower.includes("gs-2")
  ) {
    return "GS2";
  }
  if (
    lower.includes("economy") || 
    lower.includes("environment") || 
    lower.includes("security") || 
    lower.includes("science") || 
    lower.includes("s&t") || 
    lower.includes("technology") || 
    lower.includes("gs3") || 
    lower.includes("gs-3")
  ) {
    return "GS3";
  }

  return "Revision/Buffer";
}

// Maps a raw study block to one of the 11 target areas seeded in subject_targets
export function mapBlockToTargetArea(block) {
  const subject = block.subject || block.subject_id || "";
  return normalizeSubjectLabel(subject);
}

// 1. Get progress for a single target area
export async function getAreaProgress(userId, area) {
  // Fetch target config
  const targetRes = await query(
    `SELECT * FROM public.subject_targets WHERE user_id = $1 AND subject = $2`,
    [userId, area]
  );
  if (targetRes.rows.length === 0) {
    return null;
  }
  const target = targetRes.rows[0];

  // Fetch all study blocks for this user that are completed or partial
  const blocksRes = await query(
    `SELECT subject, subject_id, day_key, actual_minutes 
     FROM public.study_blocks 
     WHERE user_id = $1 AND status IN ('completed', 'partial') AND started_at IS NOT NULL`,
    [userId]
  );

  const mondayStr = getMondayOfCurrentWeek();

  let completedMins = 0;
  let thisWeekMins = 0;

  for (const block of blocksRes.rows) {
    const blockArea = mapBlockToTargetArea(block);
    if (blockArea === area) {
      completedMins += block.actual_minutes;
      if (block.day_key >= mondayStr) {
        thisWeekMins += block.actual_minutes;
      }
    }
  }

  // Calculate weeks dynamically based on mission start and end dates
  const start = new Date(target.mission_start_date);
  const end = new Date(target.mission_end_date);

  // Diff in milliseconds
  const totalWeeks = Math.max(1.0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));

  const nowKolkata = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const remainingWeeks = Math.max(1.0, (end.getTime() - nowKolkata.getTime()) / (1000 * 60 * 60 * 24 * 7));

  const targetHours = Number(target.target_hours);
  const completedHours = completedMins / 60.0;
  const remainingHours = Math.max(0, targetHours - completedHours);
  const completionPercent = targetHours > 0 ? (completedHours / targetHours) * 100.0 : 0;
  const weeklyTarget = targetHours / totalWeeks;
  const thisWeekCompleted = thisWeekMins / 60.0;
  const weeklyDeficit = weeklyTarget - thisWeekCompleted;
  const requiredFuturePace = remainingHours / remainingWeeks;

  let paceStatus = "On pace";
  if (weeklyDeficit > 0.5) {
    paceStatus = "Behind pace";
  } else if (thisWeekCompleted > weeklyTarget) {
    paceStatus = "Ahead of pace";
  }

  return {
    subject: target.subject,
    target_hours: targetHours,
    total_weeks: Number(totalWeeks.toFixed(1)),
    remaining_weeks: Number(remainingWeeks.toFixed(1)),
    completed_hours: Number(completedHours.toFixed(1)),
    remaining_hours: Number(remainingHours.toFixed(1)),
    completion_percent: Number(completionPercent.toFixed(1)),
    weekly_target: Number(weeklyTarget.toFixed(1)),
    this_week_completed: Number(thisWeekCompleted.toFixed(1)),
    weekly_deficit: Number(weeklyDeficit.toFixed(1)),
    required_future_pace: Number(requiredFuturePace.toFixed(1)),
    pace_status: paceStatus
  };
}

// 2. Get progress for all seeded subjects
export async function getAllSubjectProgress(userId) {
  const targetsRes = await query(
    `SELECT subject FROM public.subject_targets WHERE user_id = $1 ORDER BY subject ASC`,
    [userId]
  );
  const progressList = [];
  for (const row of targetsRes.rows) {
    const areaProg = await getAreaProgress(userId, row.subject);
    if (areaProg) {
      progressList.push(areaProg);
    }
  }
  return progressList;
}

// 3. Get daily progress report
export async function getDailyProgressReport(userId) {
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const todayDate = new Date(kolkataStr);
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const dd = String(todayDate.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const { rows: blocks } = await query(
    `SELECT * FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2
     ORDER BY planned_start ASC, created_at ASC`,
    [userId, todayKey]
  );

  let totalPlannedMinutes = 0;
  let totalActualSeconds = 0;
  let startedCount = 0;
  let completedCount = 0;
  const list = [];

  for (const b of blocks) {
    totalPlannedMinutes += b.planned_minutes || 0;

    // Derive actual seconds using the standard logic
    let actualSec = 0;
    if (b.started_at) {
      startedCount++;
      if (['completed', 'partial', 'missed', 'skipped'].includes(b.status) && b.ended_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (b.status === 'paused' && b.paused_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.paused_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (b.status === 'active') {
        actualSec = Math.max(0, Math.floor((Date.now() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      }
    }
    totalActualSeconds += actualSec;

    if (['completed', 'partial'].includes(b.status)) {
      completedCount++;
    }

    list.push({
      subject: normalizeSubjectLabel(b.subject || b.subject_id),
      topic: b.topic,
      planned_start: b.planned_start,
      planned_end: b.planned_end,
      status: b.status,
      actual_minutes: Math.round(actualSec / 60.0),
      planned_minutes: b.planned_minutes
    });
  }

  // Get streak
  let streak = 0;
  try {
    const { getStreak } = await import('../repositories/reportRepository.js');
    streak = await getStreak(userId, todayKey);
  } catch (err) {
    console.error('Failed to get streak:', err);
  }

  return {
    date: todayKey,
    total_blocks: blocks.length,
    started_blocks: startedCount,
    completed_blocks: completedCount,
    total_planned_hours: Number((totalPlannedMinutes / 60.0).toFixed(1)),
    total_actual_hours: Number((totalActualSeconds / 3600.0).toFixed(1)),
    streak,
    blocks: list
  };
}

// 4. Get weekly progress report (aggregated targets across all subjects)
export async function getWeeklyProgressReport(userId) {
  const subjects = await getAllSubjectProgress(userId);

  let totalTarget = 0;
  let completedTillNow = 0;
  let remaining = 0;
  let thisWeekTarget = 0;
  let thisWeekCompleted = 0;

  for (const s of subjects) {
    totalTarget += s.target_hours;
    completedTillNow += s.completed_hours;
    remaining += s.remaining_hours;
    thisWeekTarget += s.weekly_target;
    thisWeekCompleted += s.this_week_completed;
  }

  const deficit = thisWeekTarget - thisWeekCompleted;

  // Fetch readiness score and next actions from the syllabus progress engine
  let readiness = 0;
  let nextActions = [];
  try {
    const progress = await computeSyllabusProgress();
    readiness = progress?.summary?.overallReadinessScore || 0;
    nextActions = (progress?.nextActions || []).map(a => a.action);
  } catch (err) {
    console.error('Failed to run computeSyllabusProgress:', err);
  }

  return {
    subjects,
    total_target: Number(totalTarget.toFixed(1)),
    completed_till_now: Number(completedTillNow.toFixed(1)),
    remaining: Number(remaining.toFixed(1)),
    this_week_target: Number(thisWeekTarget.toFixed(1)),
    this_week_completed: Number(thisWeekCompleted.toFixed(1)),
    deficit: Number(deficit.toFixed(1)),
    readiness_percent: readiness,
    next_actions: nextActions.slice(0, 3)
  };
}

// 5. Get syllabus track summary
export async function getSyllabusTrack(userId) {
  const progress = await computeSyllabusProgress();
  return {
    overall_syllabus_coverage_percent: progress?.summary?.overallSyllabusCoveragePercent || 0,
    overall_pyq_coverage_percent: progress?.summary?.overallPyqCoveragePercent || 0,
    overall_revision_percent: progress?.summary?.overallRevisionPercent || 0,
    overall_readiness_score: progress?.summary?.overallReadinessScore || 0,
    untouched_nodes_count: progress?.summary?.untouchedNodes || 0,
    weak_clusters_count: progress?.summary?.weakClusters || 0,
    papers: (progress?.papers || []).map(p => ({
      paper_label: p.paperLabel,
      readiness_score: p.readinessScore,
      status: p.status,
      syllabus_percent: p.progress?.syllabusPercent || 0,
      pyq_percent: p.progress?.pyqPercent || 0
    }))
  };
}

// 6. Get revision due report
export async function getRevisionDueReport(userId) {
  const { rows } = await query(
    `SELECT title, priority, next_review_at, subject 
     FROM public.revision_items 
     WHERE user_id = $1 AND status = 'pending' AND next_review_at <= NOW()
     ORDER BY next_review_at ASC`,
    [userId]
  );

  return {
    count: rows.length,
    due_items: rows.slice(0, 5).map(r => ({
      title: r.title,
      subject: r.subject || "General",
      priority: r.priority,
      next_review_at: r.next_review_at
    }))
  };
}


// 7. Get backlog report
export async function getBacklogReport(userId) {
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const todayDate = new Date(kolkataStr);
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const dd = String(todayDate.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  // Fetch target config to find the minimum mission_start_date for this user
  const targetRes = await query(
    `SELECT MIN(mission_start_date) as start_date FROM public.subject_targets WHERE user_id = $1`,
    [userId]
  );
  let missionStartDateStr = '2026-05-25';
  if (targetRes.rows[0]?.start_date) {
    const d = new Date(targetRes.rows[0].start_date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    missionStartDateStr = `${y}-${m}-${day}`;
  }

  const { rows } = await query(
    `SELECT subject, topic, day_key, planned_minutes, status 
     FROM public.study_blocks 
     WHERE user_id = $1 
       AND day_key < $2
       AND (started_at IS NULL OR status IN ('missed', 'skipped'))
     ORDER BY day_key DESC, planned_start DESC`,
    [userId, todayKey]
  );

  const oldBlocks = rows.filter(r => r.day_key < missionStartDateStr);
  const activeBacklog = rows.filter(r => r.day_key >= missionStartDateStr);

  return {
    old_unstarted_count: oldBlocks.length,
    count: activeBacklog.length,
    items: activeBacklog.slice(0, 3).map(r => ({
      subject: normalizeSubjectLabel(r.subject || r.subject_id),
      topic: r.topic || "Unspecified topic",
      day_key: r.day_key,
      planned_minutes: r.planned_minutes,
      status: r.status
    }))
  };
}

// 8. Get Mains Answer Writing status report
export async function getMainsAnswerStatus(userId) {
  const totalRes = await query(
    `SELECT COUNT(*) as count, AVG(evaluator_score) as avg_score 
     FROM public.mains_answers 
     WHERE user_id = $1`,
    [userId]
  );

  const paperRes = await query(
    `SELECT paper, COUNT(*) as count 
     FROM public.mains_answers 
     WHERE user_id = $1 
     GROUP BY paper 
     ORDER BY count DESC`,
    [userId]
  );

  const recentRes = await query(
    `SELECT paper, question_text, evaluator_score, evaluator_feedback, created_at 
     FROM public.mains_answers 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT 3`,
    [userId]
  );

  return {
    total_written: Number(totalRes.rows[0]?.count || 0),
    average_score: totalRes.rows[0]?.avg_score ? Number(Number(totalRes.rows[0].avg_score).toFixed(2)) : null,
    paper_breakdown: paperRes.rows.map(r => ({
      paper: r.paper || "Unknown",
      count: Number(r.count)
    })),
    recent_evaluations: recentRes.rows.map(r => ({
      paper: r.paper || "Unknown",
      question: r.question_text || "Unspecified question",
      score: r.evaluator_score ? Number(r.evaluator_score) : null,
      feedback: r.evaluator_feedback || "No feedback summary available"
    }))
  };
}

