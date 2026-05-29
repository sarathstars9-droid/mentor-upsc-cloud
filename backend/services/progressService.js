import { query } from '../db/index.js';
import { computeSyllabusProgress } from '../brain/syllabusProgressEngine.js';
import { getPrelimsDaysLeft, getMainsDaysLeft } from '../config/examCalendar.js';

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

// 2. Get progress for all seeded subjects (top-level only, sub_area IS NULL to avoid double-counting)
export async function getAllSubjectProgress(userId) {
  const targetsRes = await query(
    `SELECT subject FROM public.subject_targets WHERE user_id = $1 AND sub_area IS NULL ORDER BY subject ASC`,
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
    
    const st = String(b.status || '').toLowerCase();
    const isCompleted = ['done', 'completed', 'partial'].includes(st) || (b.actual_minutes || 0) > 0;
    
    if (b.started_at || b.actual_minutes > 0 || ['active', 'paused'].includes(st)) {
       startedCount++;
    }

    if (isCompleted) {
      completedCount++;
    }

    let blockMinutes = 0;
    if (b.actual_minutes > 0) {
       blockMinutes = b.actual_minutes;
    } else if (b.started_at) {
      let actualSec = 0;
      if (['done', 'completed', 'partial', 'missed', 'skipped'].includes(st) && b.ended_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (st === 'paused' && b.paused_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.paused_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (st === 'active') {
        actualSec = Math.max(0, Math.floor((Date.now() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      }
      blockMinutes = Math.round(actualSec / 60.0);
    }
    
    if (isCompleted && blockMinutes === 0) {
       blockMinutes = b.planned_minutes || 0;
    }

    totalActualSeconds += (blockMinutes * 60);

    list.push({
      subject: normalizeSubjectLabel(b.subject || b.subject_id),
      topic: b.topic,
      planned_start: b.planned_start,
      planned_end: b.planned_end,
      status: b.status,
      actual_minutes: blockMinutes,
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

// Helper: Match study blocks to GS1/GS2/GS3 sub-areas dynamically
function getSubAreaMatch(block, subAreas, parentSubject) {
  const subtopic = (block.subtopic || '').toLowerCase().trim();
  const subject = (block.subject || '').toLowerCase().trim();
  const topic = (block.topic || '').toLowerCase().trim();
  const combined = `${subject} ${topic} ${subtopic}`;

  // 1. Exact or include match on subtopic/subject against subAreas
  for (const area of subAreas) {
    const lowerArea = area.toLowerCase();
    if (subtopic && (subtopic === lowerArea || subtopic.includes(lowerArea))) {
      return area;
    }
  }

  // 2. Specific keyword rules
  if (parentSubject === 'GS1') {
    if (combined.includes('art') || combined.includes('culture')) return 'Art & Culture';
    if (combined.includes('post-independence') || combined.includes('post independence')) return 'Post-Independence India';
    if (combined.includes('world history')) return 'World History';
    if (combined.includes('society')) return 'Indian Society';
    if (combined.includes('physical geography')) return 'Physical Geography GS Level';
    if (combined.includes('modern')) return 'Modern History';
    if (combined.includes('geography')) return 'Indian & World Geography';
    if (combined.includes('pyq') || combined.includes('answer writing') || combined.includes('mains')) return 'GS1 Mains PYQ + Answer Writing';
    if (combined.includes('revision') || combined.includes('diagram') || combined.includes('sheet')) return 'Revision Sheets + Diagrams';
  } else if (parentSubject === 'GS2') {
    if (combined.includes('governance')) return 'Governance';
    if (combined.includes('social justice') || combined.includes('justice')) return 'Social Justice';
    if (combined.includes('welfare') || combined.includes('scheme')) return 'Welfare Schemes';
    if (combined.includes('international') || combined.includes('ir ') || combined.includes('relations')) return 'International Relations';
    if (combined.includes('judgment') || combined.includes('committee') || combined.includes('report') || combined.includes('commission')) return 'Judgments/Committees/Reports';
    if (combined.includes('polity') || combined.includes('constitution') || combined.includes('static')) return 'Polity & Constitution Static';
    if (combined.includes('pyq') || combined.includes('answer writing') || combined.includes('mains')) return 'GS2 Mains PYQ + Answer Writing';
    if (combined.includes('revision') || combined.includes('sheet')) return 'Polity & Constitution Static';
  } else if (parentSubject === 'GS3') {
    if (combined.includes('agriculture') || combined.includes('agri')) return 'Agriculture';
    if (combined.includes('environment') || combined.includes('env')) return 'Environment';
    if (combined.includes('science') || combined.includes('technology') || combined.includes('s&t')) return 'Science & Technology';
    if (combined.includes('security')) return 'Internal Security';
    if (combined.includes('disaster') || combined.includes('management')) return 'Disaster Management';
    if (combined.includes('infrastructure') || combined.includes('industry') || combined.includes('energy')) return 'Infrastructure/Industry/Energy';
    if (combined.includes('economy')) return 'Economy';
    if (combined.includes('pyq') || combined.includes('answer writing') || combined.includes('mains')) return 'GS3 Mains PYQ + Answer Writing';
    if (combined.includes('revision') || combined.includes('error') || combined.includes('log')) return 'Revision + Error Log';
  }

  // 3. Fallback to generic sub-area matching
  for (const area of subAreas) {
    const words = area.toLowerCase().split(/\s+/).filter(w => w.length > 3 && w !== 'mains' && w !== 'sheets' && w !== 'writing');
    for (const w of words) {
      if (combined.includes(w)) {
        return area;
      }
    }
  }

  // 4. Ultimate default based on parent
  if (parentSubject === 'GS1') return 'Revision Sheets + Diagrams';
  if (parentSubject === 'GS2') return 'Polity & Constitution Static';
  if (parentSubject === 'GS3') return 'Revision + Error Log';
  return subAreas[0];
}

// 9. Get sub-targets progress for a parent subject (GS1/GS2/GS3)
export async function getSubjectSubTargetsProgress(userId, parentSubject) {
  // Fetch sub-targets configuration
  const targetsRes = await query(
    `SELECT sub_area, target_hours, study_flow, roi_priority 
     FROM public.subject_sub_targets 
     WHERE user_id = $1 AND parent_subject = $2
     ORDER BY sub_area ASC`,
    [userId, parentSubject]
  );
  
  if (targetsRes.rows.length === 0) {
    return [];
  }

  const subAreas = targetsRes.rows.map(r => r.sub_area);

  // Fetch all completed/partial study blocks for this user
  const blocksRes = await query(
    `SELECT subject, subject_id, topic, subtopic, actual_minutes 
     FROM public.study_blocks 
     WHERE user_id = $1 AND status IN ('completed', 'partial') AND started_at IS NOT NULL`,
    [userId]
  );

  const subAreaMinutes = {};
  for (const area of subAreas) {
    subAreaMinutes[area] = 0;
  }

  for (const block of blocksRes.rows) {
    const blockParent = mapBlockToTargetArea(block);
    if (blockParent === parentSubject) {
      const matchedSubArea = getSubAreaMatch(block, subAreas, parentSubject);
      if (subAreaMinutes[matchedSubArea] !== undefined) {
        subAreaMinutes[matchedSubArea] += block.actual_minutes;
      }
    }
  }

  return targetsRes.rows.map(t => {
    const targetHours = Number(t.target_hours);
    const completedHours = (subAreaMinutes[t.sub_area] || 0) / 60.0;
    const remainingHours = Math.max(0, targetHours - completedHours);
    return {
      sub_area: t.sub_area,
      target_hours: targetHours,
      completed_hours: Number(completedHours.toFixed(1)),
      remaining_hours: Number(remainingHours.toFixed(1)),
      completion_percent: targetHours > 0 ? Number(((completedHours / targetHours) * 100.0).toFixed(1)) : 0,
      study_flow: t.study_flow,
      roi_priority: t.roi_priority
    };
  });
}

// 10. Get daily night report data
export async function getDailyNightReportData(userId, todayKey) {
  const { rows: blocks } = await query(
    `SELECT * FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, todayKey]
  );

  let totalPlannedMins = 0;
  let totalActualMins = 0;
  let completedCount = 0;
  let missedCount = 0;
  let startedCount = 0;
  let outputsCreated = 0;
  const subjectsStudied = new Set();

  for (const b of blocks) {
    let blockPlanned = b.planned_minutes || 0;
    if (blockPlanned === 0 && b.planned_start && b.planned_end) {
      const [sh, sm] = b.planned_start.split(':').map(Number);
      const [eh, em] = b.planned_end.split(':').map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) blockPlanned = diff;
    }
    totalPlannedMins += blockPlanned;

    if (b.started_at) {
      startedCount++;
    }

    let actualMins = 0;
    if (b.started_at) {
      let actualSec = 0;
      if (['completed', 'partial', 'missed', 'skipped'].includes(b.status) && b.ended_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (b.status === 'paused' && b.paused_at) {
        actualSec = Math.max(0, Math.floor((new Date(b.paused_at).getTime() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      } else if (b.status === 'active') {
        actualSec = Math.max(0, Math.floor((Date.now() - new Date(b.started_at).getTime()) / 1000) - (b.total_pause_seconds || 0));
      }
      actualMins = Math.round(actualSec / 60.0);
    }
    totalActualMins += actualMins;

    if (['completed', 'partial'].includes(b.status)) {
      completedCount++;
      subjectsStudied.add(normalizeSubjectLabel(b.subject || b.subject_id));

      const subLower = (b.subject || '').toLowerCase();
      const topicLower = (b.topic || '').toLowerCase();
      if (
        subLower.includes('answer') || topicLower.includes('answer') ||
        subLower.includes('test') || topicLower.includes('test') ||
        subLower.includes('notes') || topicLower.includes('notes') ||
        subLower.includes('output') || topicLower.includes('output')
      ) {
        outputsCreated++;
      } else if (actualMins >= 30) {
        // Fallback: any substantial study block counts as output effort
        outputsCreated++;
      }
    }

    if (b.status === 'missed') {
      missedCount++;
    }
  }

  // Revision Due count
  const revRes = await query(
    `SELECT COUNT(*) as count FROM public.revision_items 
     WHERE user_id = $1 AND status = 'pending' AND next_review_at <= NOW()`,
    [userId]
  );
  const revisionDueCount = Number(revRes.rows[0]?.count || 0);

  const plannedHours = totalPlannedMins / 60.0;
  const actualHours = totalActualMins / 60.0;
  const deficit = plannedHours - actualHours;

  let day_state = 'ACTIVE';
  if (blocks.length === 0) {
    day_state = 'NOT_STARTED';
  } else if (startedCount === 0) {
    day_state = 'PLAN_UPLOADED_NOT_STARTED';
  } else if (missedCount > 2 || deficit > 3.0) {
    day_state = 'SLIPPING';
  } else if (completedCount >= Math.floor(blocks.length * 0.7)) {
    day_state = 'COMPLETED';
  }

  // Tomorrow correction recommendation
  let tomorrowCorrection = "Stick to the first study block schedule on time.";
  if (day_state === 'NOT_STARTED') {
    tomorrowCorrection = "Upload plan before 6 AM and start the first block on time.";
  } else if (day_state === 'PLAN_UPLOADED_NOT_STARTED') {
    tomorrowCorrection = "Start the first scheduled block immediately. Momentum matters more than perfect planning.";
  } else if (missedCount > 0) {
    const missed = blocks.find(b => b.status === 'missed');
    if (missed) {
      tomorrowCorrection = `Catch up on the missed ${normalizeSubjectLabel(missed.subject || missed.subject_id)} block.`;
    }
  } else if (revisionDueCount > 10) {
    tomorrowCorrection = "Clear the pending revision backlog first.";
  } else if (deficit > 2.0) {
    tomorrowCorrection = "Reduce planned block lengths tomorrow to ensure execution.";
  } else if (actualHours > 0 && completedCount >= Math.floor(blocks.length * 0.7)) {
    tomorrowCorrection = "Fantastic rhythm. Keep consistency alive!";
  } else {
    tomorrowCorrection = "Keep pushing forward. Consistency is key.";
  }

  console.log(`[NightReport] date=${todayKey}, state=${day_state}, total_blocks=${blocks.length}, started_blocks=${startedCount}, completed_blocks=${completedCount}, planned_minutes=${totalPlannedMins}, actual_minutes=${totalActualMins}`);

  return {
    date: todayKey,
    day_state,
    total_blocks: blocks.length,
    started_blocks: startedCount,
    target_hours: day_state === 'NOT_STARTED' ? 0 : Number(plannedHours.toFixed(1)),
    actual_hours: Number(actualHours.toFixed(1)),
    deficit: day_state === 'NOT_STARTED' ? 0 : Number((Math.max(0, deficit)).toFixed(1)),
    subjects_completed: Array.from(subjectsStudied),
    outputs_created: outputsCreated,
    missed_blocks: missedCount,
    revision_due: revisionDueCount,
    tomorrow_correction: tomorrowCorrection
  };
}

// 11. Get monthly progress report
export async function getMonthlyProgressReport(userId, monthKey) {
  const startDayKey = `${monthKey}-01`;
  const [yyyy, mm] = monthKey.split('-').map(Number);
  const lastDay = new Date(yyyy, mm, 0).getDate();
  const endDayKey = `${monthKey}-${String(lastDay).padStart(2, '0')}`;

  // 1. Total Planned & Actual Minutes
  const blocksRes = await query(
    `SELECT status, planned_minutes, actual_minutes, subject, subject_id 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3`,
    [userId, startDayKey, endDayKey]
  );

  let totalPlannedMins = 0;
  let totalActualMins = 0;
  const subjectMinutes = {};

  for (const b of blocksRes.rows) {
    totalPlannedMins += b.planned_minutes || 0;
    if (['completed', 'partial'].includes(b.status)) {
      totalActualMins += b.actual_minutes || 0;
      const subLabel = normalizeSubjectLabel(b.subject || b.subject_id);
      subjectMinutes[subLabel] = (subjectMinutes[subLabel] || 0) + (b.actual_minutes || 0);
    }
  }

  // 2. Consistency Stats
  const consistencyRes = await query(
    `SELECT status, COUNT(*) as count 
     FROM public.daily_consistency 
     WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3 
     GROUP BY status`,
    [userId, startDayKey, endDayKey]
  );

  let strongDays = 0;
  let partialDays = 0;
  let weakDays = 0;

  for (const row of consistencyRes.rows) {
    if (row.status === 'strong') strongDays = Number(row.count);
    else if (row.status === 'partial') partialDays = Number(row.count);
    else if (row.status === 'weak') weakDays = Number(row.count);
  }

  const subjectBreakdown = Object.entries(subjectMinutes)
    .map(([subject, mins]) => ({
      subject,
      hours: Number((mins / 60.0).toFixed(1))
    }))
    .sort((a, b) => b.hours - a.hours);

  return {
    month_key: monthKey,
    total_planned_hours: Number((totalPlannedMins / 60.0).toFixed(1)),
    total_actual_hours: Number((totalActualMins / 60.0).toFixed(1)),
    strong_days: strongDays,
    partial_days: partialDays,
    weak_days: weakDays,
    subject_breakdown: subjectBreakdown
  };
}

// 12. Get good morning report data
export async function getGoodMorningReportData(userId) {
  const now = new Date();
  
  // 1. Get Kolkata timezone details
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  // Get yesterday's key
  const prevDate = new Date(d);
  prevDate.setDate(d.getDate() - 1);
  const yKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

  // 2. Fetch target configs to compute mission start & end dates, target hours
  const targetRes = await query(
    `SELECT MIN(mission_start_date) as start_date, MAX(mission_end_date) as end_date, SUM(target_hours) as total_target
     FROM public.subject_targets 
     WHERE user_id = $1 AND sub_area IS NULL`,
    [userId]
  );
  
  const startDateStr = targetRes.rows[0]?.start_date ? new Date(targetRes.rows[0].start_date).toISOString().slice(0, 10) : '2026-05-25';
  const endDateStr = targetRes.rows[0]?.end_date ? new Date(targetRes.rows[0].end_date).toISOString().slice(0, 10) : '2027-04-15';
  const totalTargetHours = Number(targetRes.rows[0]?.total_target || 3500);

  // 3. Compute mission day
  const missionStart = new Date(`${startDateStr}T00:00:00+05:30`);
  const currentDay = new Date(`${todayKey}T00:00:00+05:30`);
  const diffTime = currentDay.getTime() - missionStart.getTime();
  const missionDay = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

  // 4. Days left for exams
  const prelimsDays = getPrelimsDaysLeft();
  const mainsDays = getMainsDaysLeft();

  // 5. Total completed hours (all time)
  const blocksRes = await query(
    `SELECT SUM(actual_minutes) as completed_mins 
     FROM public.study_blocks 
     WHERE user_id = $1 AND status IN ('completed', 'partial') AND started_at IS NOT NULL`,
    [userId]
  );
  const completedMins = Number(blocksRes.rows[0]?.completed_mins || 0);
  const completedHours = completedMins / 60.0;
  const remainingHours = Math.max(0, totalTargetHours - completedHours);

  // 6. Today required pace
  const missionEnd = new Date(`${endDateStr}T00:00:00+05:30`);
  const totalDaysLeft = Math.max(1, Math.ceil((missionEnd.getTime() - currentDay.getTime()) / (1000 * 60 * 60 * 24)));
  const todayRequiredPace = remainingHours / totalDaysLeft;

  // 7. Yesterday short summary
  const yesterdayBlocks = await query(
    `SELECT status, planned_minutes, actual_minutes, subject, subject_id 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, yKey]
  );
  
  let yPlannedMins = 0;
  let yActualMins = 0;
  let yCompleted = 0;
  let yTouched = 0;
  for (const b of yesterdayBlocks.rows) {
    yPlannedMins += b.planned_minutes || 0;
    if (['completed', 'partial'].includes(b.status) || (b.actual_minutes && b.actual_minutes > 0)) {
      yTouched++;
    }
    if (['completed', 'partial'].includes(b.status)) {
      yActualMins += b.actual_minutes || 0;
      yCompleted++;
    }
  }
  const yesterdaySummary = {
    planned_hours: Number((yPlannedMins / 60.0).toFixed(1)),
    actual_hours: Number((yActualMins / 60.0).toFixed(1)),
    actual_mins_total: yActualMins,
    blocks_touched: yTouched,
    blocks_completed: yCompleted,
    blocks_total: yesterdayBlocks.rows.length,
    execution_rate: yPlannedMins > 0 ? Number(((yActualMins / yPlannedMins) * 100).toFixed(1)) : 0,
    has_data: yesterdayBlocks.rows.length > 0
  };

  // 8. Today's first correction
  let todayCorrection = "Focus on starting your first scheduled study block exactly on time.";
  const { rows: todayBlocks } = await query(
    `SELECT subject, subject_id, planned_start FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2 ORDER BY planned_start ASC LIMIT 1`,
    [userId, todayKey]
  );
  if (todayBlocks.length > 0) {
    const earliest = todayBlocks[0];
    const subLabel = normalizeSubjectLabel(earliest.subject || earliest.subject_id);
    todayCorrection = `Ensure you start your first block (${subLabel}) at ${earliest.planned_start} AM sharp.`;
  }

  return {
    mission_day: missionDay,
    prelims_days_left: prelimsDays,
    mains_days_left: mainsDays,
    target_hours: totalTargetHours,
    completed_hours: Number(completedHours.toFixed(1)),
    remaining_hours: Number(remainingHours.toFixed(1)),
    today_required_pace: Number(todayRequiredPace.toFixed(2)),
    yesterday_summary: yesterdaySummary,
    today_first_correction: todayCorrection
  };
}

// 13. Get yesterday study summary (for plan audit)
export async function getYesterdayStudySummary(userId) {
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const prevDate = new Date(d);
  prevDate.setDate(d.getDate() - 1);
  const yKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;

  const { rows: blocks } = await query(
    `SELECT subject, subject_id, planned_minutes, actual_minutes, status, output_expected 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, yKey]
  );

  let totalPlannedMins = 0;
  let totalActualMins = 0;
  let outputCount = 0;
  const missedSubjects = new Set();
  const strongSubjects = {}; 

  for (const b of blocks) {
    totalPlannedMins += b.planned_minutes || 0;
    const actual = b.actual_minutes || 0;

    if (['completed', 'partial'].includes(b.status)) {
      totalActualMins += actual;
      if (actual >= 30 || b.output_expected) {
        outputCount++;
      }
      const subLabel = normalizeSubjectLabel(b.subject || b.subject_id);
      strongSubjects[subLabel] = (strongSubjects[subLabel] || 0) + actual;
    } else if (b.status === 'missed') {
      missedSubjects.add(normalizeSubjectLabel(b.subject || b.subject_id));
    }
  }

  const revRes = await query(
    `SELECT COUNT(*) as count FROM public.revision_items 
     WHERE user_id = $1 AND status = 'pending' AND next_review_at <= NOW()`,
    [userId]
  );
  const revisionDueCount = Number(revRes.rows[0]?.count || 0);

  let bestSubject = "None";
  let maxMins = 0;
  for (const [sub, mins] of Object.entries(strongSubjects)) {
    if (mins > maxMins) {
      maxMins = mins;
      bestSubject = sub;
    }
  }

  return {
    date: yKey,
    studied_hours: Number((totalActualMins / 60.0).toFixed(1)),
    studied_mins_total: totalActualMins,
    planned_hours: Number((totalPlannedMins / 60.0).toFixed(1)),
    strong_subject: maxMins > 0 ? bestSubject : "None",
    missed_subjects: Array.from(missedSubjects),
    output_count: outputCount,
    revision_pending: revisionDueCount
  };
}

// 14. Audit today's plan
export async function auditTodayPlan(userId, dateStr) {
  const { rows: blocks } = await query(
    `SELECT subject, subject_id, topic, mode, planned_minutes 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key = $2`,
    [userId, dateStr]
  );

  let hasGeo = false;
  let hasCsat = false;
  let hasPyqMcq = false;
  let hasRevision = false;
  let hasAnswerWriting = false;
  let totalPlannedMins = 0;

  for (const b of blocks) {
    totalPlannedMins += b.planned_minutes || 0;
    const subLabel = normalizeSubjectLabel(b.subject || b.subject_id);
    const text = `${b.subject || ''} ${b.topic || ''} ${b.mode || ''}`.toLowerCase();

    if (subLabel === "Geography Optional") hasGeo = true;
    if (subLabel === "CSAT" || text.includes('csat')) hasCsat = true;
    if (text.includes('pyq') || text.includes('mcq') || text.includes('test') || subLabel === "Prelims GS MCQ + PYQ") hasPyqMcq = true;
    if (text.includes('revision') || text.includes('revise') || text.includes('recall') || b.mode === 'revision' || subLabel === "Revision/Buffer") hasRevision = true;
    if (text.includes('answer') || text.includes('writing') || text.includes('mains') || subLabel === "Mains Answer Writing") hasAnswerWriting = true;
  }

  return {
    date: dateStr,
    total_planned_hours: Number((totalPlannedMins / 60.0).toFixed(1)),
    has_geo: hasGeo,
    has_csat: hasCsat,
    has_pyq_mcq: hasPyqMcq,
    has_revision: hasRevision,
    has_answer_writing: hasAnswerWriting
  };
}

// 15. Get weekly execution summary
export async function getWeeklyExecutionSummary(userId) {
  const subjects = await getAllSubjectProgress(userId);

  let thisWeekPlanned = 0;
  let thisWeekCompleted = 0;

  const mondayStr = getMondayOfCurrentWeek();
  const blocksRes = await query(
    `SELECT subject, subject_id, planned_minutes, actual_minutes, status 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key >= $2`,
    [userId, mondayStr]
  );
  
  let outputCount = 0;

  for (const block of blocksRes.rows) {
    if (block.status !== 'missed' && block.status !== 'skipped') {
      thisWeekPlanned += (block.planned_minutes || 0) / 60.0;
    }
    if (['completed', 'partial'].includes(block.status)) {
      if ((block.actual_minutes || 0) >= 30) {
         outputCount++;
      }
    }
  }

  for (const s of subjects) {
    thisWeekCompleted += s.this_week_completed;
  }

  // Compute weekly mission target from top-level targets only (sub_area IS NULL)
  // This gives the true pace needed per week: totalTarget / totalMissionWeeks
  const targetRes = await query(
    `SELECT SUM(target_hours) as total_target, MIN(mission_start_date) as start_date, MAX(mission_end_date) as end_date 
     FROM public.subject_targets WHERE user_id = $1 AND sub_area IS NULL`,
    [userId]
  );
  const totalMissionHours = Number(targetRes.rows[0]?.total_target || 3500);
  const missionStart = new Date(targetRes.rows[0]?.start_date || '2026-05-25');
  const missionEnd = new Date(targetRes.rows[0]?.end_date || '2027-04-15');
  const totalMissionWeeks = Math.max(1, (missionEnd.getTime() - missionStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const weeklyMissionTarget = totalMissionHours / totalMissionWeeks;  // ~75.4h/week

  // Required recovery pace: remaining hours / remaining weeks (from subjects)
  const totalCompleted = subjects.reduce((acc, s) => acc + s.completed_hours, 0);
  const totalRemaining = subjects.reduce((acc, s) => acc + s.remaining_hours, 0);
  const nowKolkata = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const remainingWeeks = Math.max(1, (missionEnd.getTime() - nowKolkata.getTime()) / (1000 * 60 * 60 * 24 * 7));
  const requiredRecoveryPace = totalRemaining / remainingWeeks;

  // Deficit = mission weekly target - what was executed this week
  const deficit = weeklyMissionTarget - thisWeekCompleted;
  
  const executionRate = thisWeekPlanned > 0 ? (thisWeekCompleted / thisWeekPlanned) * 100 : 0;

  const sortedByPace = [...subjects].sort((a, b) => b.this_week_completed - a.this_week_completed);
  const strongSubjects = sortedByPace.slice(0, 3).filter(s => s.this_week_completed > 0).map(s => s.subject);
  
  const sortedByDeficit = [...subjects].filter(s => s.weekly_deficit > 0).sort((a, b) => b.weekly_deficit - a.weekly_deficit);
  const weakSubjects = sortedByDeficit.slice(0, 3).map(s => s.subject);
  
  // Smart next_action: based on execution rate and plan vs execute gap
  let nextAction;
  if (executionRate === 0 && thisWeekPlanned === 0) {
    nextAction = "Plan is too light for the 3500h mission. Add one high-impact block today.";
  } else if (executionRate < 40) {
    nextAction = "This is not failure. This is correction data. Start with one rescue block today.";
  } else if (thisWeekPlanned > 0 && executionRate < 70) {
    nextAction = `Plan less, execute more. Keep tomorrow near 10h 45m–11h.`;
  } else if (executionRate >= 85 && deficit < 5) {
    nextAction = "Maintain your current pace! You are on track.";
  } else if (weakSubjects.length > 0) {
    nextAction = `Focus on recovering ${weakSubjects[0]} first.`;
  } else {
    nextAction = "This is not failure. This is correction data. Start with one rescue block today.";
  }

  return {
    weekly_mission_target: Number(weeklyMissionTarget.toFixed(1)),  // ~75h/week, fixed mission target
    required_recovery_pace: Number(requiredRecoveryPace.toFixed(1)), // current pace needed to finish by deadline
    weekly_planned: Number(thisWeekPlanned.toFixed(1)),
    weekly_executed: Number(thisWeekCompleted.toFixed(1)),
    execution_rate: Number(executionRate.toFixed(1)),
    deficit: Number(deficit.toFixed(1)),
    output_count: outputCount,
    strong_subjects: strongSubjects,
    weak_subjects: weakSubjects,
    next_action: nextAction
  };
}

// 16. Get weekly subject breakdown
export async function getWeeklySubjectBreakdown(userId) {
  const subjects = await getAllSubjectProgress(userId);
  const mondayStr = getMondayOfCurrentWeek();
  
  const blocksRes = await query(
    `SELECT subject, subject_id, planned_minutes, status 
     FROM public.study_blocks 
     WHERE user_id = $1 AND day_key >= $2`,
    [userId, mondayStr]
  );
  
  const plannedPerSubject = {};
  for (const b of blocksRes.rows) {
    if (b.status !== 'missed' && b.status !== 'skipped') {
      const area = mapBlockToTargetArea(b);
      plannedPerSubject[area] = (plannedPerSubject[area] || 0) + (b.planned_minutes || 0);
    }
  }

  return subjects.map(s => {
    return {
      ...s,
      this_week_planned: Number(((plannedPerSubject[s.subject] || 0) / 60.0).toFixed(1))
    };
  });
}

// 17. Get Prelims Status
export async function getPrelimsStatus(userId) {
  const subjects = await getAllSubjectProgress(userId);
  const prelimsSubjects = ["CSAT", "Prelims GS MCQ + PYQ", "Current Affairs"];
  return subjects.filter(s => prelimsSubjects.includes(s.subject));
}

// 18. Get Mains Status
export async function getMainsStatus(userId) {
  const subjects = await getAllSubjectProgress(userId);
  const mainsSubjects = ["Geography Optional", "GS1", "GS2", "GS3", "GS4 Ethics", "Essay", "Mains Answer Writing"];
  return subjects.filter(s => mainsSubjects.includes(s.subject));
}

// 19. Get Monthly Mentor Summary
export async function getMonthlyMentorSummary(userId) {
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const d = new Date(kolkataStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const monthKey = `${yyyy}-${mm}`;
  const startDayKey = `${monthKey}-01`;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const endDayKey = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  
  const report = await getMonthlyProgressReport(userId, monthKey);
  
  const targetRes = await query(
    `SELECT SUM(target_hours) as total_target FROM public.subject_targets WHERE user_id = $1 AND sub_area IS NULL`,
    [userId]
  );
  const totalTargetHours = Number(targetRes.rows[0]?.total_target || 3500);
  
  const blocksRes = await query(
    `SELECT SUM(actual_minutes) as completed_mins 
     FROM public.study_blocks 
     WHERE user_id = $1 AND status IN ('completed', 'partial') AND started_at IS NOT NULL`,
    [userId]
  );
  const totalCompletedHours = Number(blocksRes.rows[0]?.completed_mins || 0) / 60.0;
  const missionCompletedPercent = totalTargetHours > 0 ? (totalCompletedHours / totalTargetHours) * 100 : 0;
  
  const executionRate = report.total_planned_hours > 0 ? (report.total_actual_hours / report.total_planned_hours) * 100 : 0;
  
  // Strong subjects: sorted by actual hours executed (only those with > 0 actual hours)
  const sortedSubjects = [...report.subject_breakdown].sort((a, b) => b.hours - a.hours);
  const top3Strong = sortedSubjects.filter(s => s.hours > 0).slice(0, 3).map(s => s.subject);

  // Weak subjects: if no execution data, fall back to planned-but-not-executed subjects
  let top3Weak = [];
  if (sortedSubjects.filter(s => s.hours > 0).length === 0 && report.total_planned_hours > 0) {
    // No execution yet but plan exists — show highest planned subjects as 'at risk'
    const plannedSubjectsRes = await query(
      `SELECT 
         COALESCE(subject, subject_id) AS raw_subject,
         SUM(planned_minutes) AS planned_mins
       FROM public.study_blocks
       WHERE user_id = $1 AND day_key >= $2 AND day_key <= $3
       GROUP BY raw_subject
       ORDER BY planned_mins DESC
       LIMIT 5`,
      [userId, startDayKey, endDayKey]
    );
    // Normalize and de-dup by area
    const seen = new Set();
    for (const row of plannedSubjectsRes.rows) {
      const area = normalizeSubjectLabel(row.raw_subject);
      if (!seen.has(area)) {
        seen.add(area);
        top3Weak.push(area);
      }
      if (top3Weak.length >= 3) break;
    }
  } else if (sortedSubjects.length > 0) {
    // Execution exists — show lowest-hour subjects (worst performers)
    const withHours = sortedSubjects.filter(s => s.hours >= 0);
    top3Weak = withHours.slice(-3).map(s => s.subject).reverse();
  }
  
  let prescription = "Keep going steadily.";
  if (executionRate === 0 && report.total_planned_hours === 0) {
    prescription = "Not enough study data yet. Upload and execute today's plan.";
  } else if (executionRate === 0 && report.total_planned_hours > 0) {
    prescription = "Plan exists but execution is zero this month. Start with one block today — that's the only correction needed right now.";
  } else if (report.weak_days > report.strong_days) {
    prescription = "Your consistency has dropped. Focus on 1-hour minimum blocks every single day next month.";
  } else if (executionRate < 70) {
    prescription = "You are over-planning. Plan 20% less next month to increase execution rate.";
  }
  
  return {
    ...report,
    execution_rate: Number(executionRate.toFixed(1)),
    mission_completed_percent: Number(missionCompletedPercent.toFixed(1)),
    top3_strong: top3Strong,
    top3_weak: top3Weak,
    next_month_prescription: prescription
  };
}
