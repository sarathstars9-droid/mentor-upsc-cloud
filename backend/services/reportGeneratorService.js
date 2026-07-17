import { getUpscCountdownSummary } from '../utils/upscCountdown.js';
import { formatDurationSeconds } from './progressNormalizer.js';

// Helper to format decimal hours into hours & minutes (e.g. 17.25 -> 17h 15m)
export function formatHoursAndMins(decimalHours) {
  if (typeof decimalHours !== 'number' || isNaN(decimalHours) || !isFinite(decimalHours)) decimalHours = 0;
  
  const absoluteHours = Math.abs(decimalHours);
  const hrs = Math.floor(absoluteHours);
  const mins = Math.round((absoluteHours - hrs) * 60);
  
  const sign = decimalHours < 0 ? "-" : "";
  
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hrs}h`;
  return `${sign}${hrs}h ${mins}m`;
}

// 1. Single subject target report (e.g. geography status, optional left)
export function generateAreaReport(data, userName = "Moulika") {
  if (!data) {
    return "❌ No target config found for this subject/area.";
  }
  
  const subject = data.subject;
  const targetHrs = formatHoursAndMins(data.target_hours);
  const completedHrs = formatHoursAndMins(data.completed_hours);
  const remainingHrs = formatHoursAndMins(data.remaining_hours);
  const weeklyTarget = formatHoursAndMins(data.weekly_target);
  const weeklyCompleted = formatHoursAndMins(data.this_week_completed);
  const weeklyDeficit = formatHoursAndMins(Math.max(0, data.weekly_deficit));

  if (subject === "Geography Optional") {
    const gapText = data.weekly_deficit > 0
      ? `${formatHoursAndMins(data.weekly_deficit)} behind`
      : `0m (On track)`;

    return `📚 *Geography Optional Progress*

${userName}, Geography Optional is a high-weight area, so we’ll track it seriously.

*Target:* ${targetHrs}
*Completed:* ${completedHrs}
*Remaining:* ${remainingHrs}

*This week’s required pace:* ${weeklyTarget}
*Completed this week:* ${weeklyCompleted}
*Gap:* ${gapText}

*Mentor note:*
Don’t worry about the big ${targetHrs} number. This week’s job is simple: complete ${weeklyTarget} with output.

*Next correction:*

1. Finish one core topic block
2. Do one PYQ-linked session
3. Create one diagram/value-add sheet`;
  }

  // Other subjects
  const gapText = data.weekly_deficit > 0
    ? `${weeklyDeficit} behind`
    : `0m (On track)`;

  return `📚 *${subject} Progress*

${userName}, ${subject} is a core area of focus.

*Target:* ${targetHrs}
*Completed:* ${completedHrs}
*Remaining:* ${remainingHrs}

*This week’s required pace:* ${weeklyTarget}
*Completed this week:* ${weeklyCompleted}
*Gap:* ${gapText}

*Mentor note:*
Keep your habit alive with daily small blocks. Consistency builds the score.`;
}

// 2. Daily progress report
export function generateDailyReport(data, userName = "Moulika") {
  const dateStr = data.date;
  
  if (data.total_blocks === 0) {
    return `📊 *Daily Study Report*

${userName}, no study blocks were registered for today (${dateStr}). Use the planner to schedule tomorrow's blocks.`;
  }

  let report = `📊 *Daily Study Report*

${userName}, here is your study report for today (${dateStr}).

• Streak: ${data.streak} days 🔥
• Blocks: ${data.completed_blocks}/${data.total_blocks} completed
• Studied: ${formatHoursAndMins(data.total_actual_hours)} (Planned: ${formatHoursAndMins(data.total_planned_hours)})`;

  if (data.total_planned_hours > 12) {
    report += `\n⚠️ *Today’s plan is overloaded. Keep the execution target near 11h. Prioritize the top 5 blocks.*`;
  }

  report += `\n\n*Execution log:*`;

  for (const b of data.blocks) {
    const statusIcon = 
      b.status === 'completed' ? '✅' :
      b.status === 'partial' ? '⚡' :
      b.status === 'active' ? '🔄' :
      b.status === 'paused' ? '⏸️' :
      b.status === 'missed' ? '❌' :
      b.status === 'skipped' ? '⏭️' : '⏳';
    
    report += `\n${statusIcon} *${b.subject}* (${b.actual_minutes}m done)`;
  }

  return report;
}

// 3. Weekly mentor report
export function generateWeeklyReport(data, userName = "Moulika", options = {}) {
  const fullBreakdown = options.fullBreakdown || false;

  const totalTarget = formatHoursAndMins(data.total_target);
  const completedTillNow = formatHoursAndMins(data.completed_till_now);
  const remaining = formatHoursAndMins(data.remaining);
  const thisWeekTarget = formatHoursAndMins(data.this_week_target);
  const thisWeekCompleted = formatHoursAndMins(data.this_week_completed);
  
  let deficitText = "";
  if (data.deficit > 0) {
    deficitText = `Deficit: ${formatHoursAndMins(data.deficit)}`;
  } else {
    deficitText = `Surplus: ${formatHoursAndMins(Math.abs(data.deficit))}`;
  }

  if (!fullBreakdown) {
    let riskAreasText = "";
    const sortedSubjects = [...data.subjects]
      .filter(s => s.weekly_deficit > 0.5)
      .sort((a, b) => b.weekly_deficit - a.weekly_deficit);

    if (sortedSubjects.length > 0) {
      riskAreasText = sortedSubjects.slice(0, 3).map((s, i) => `${i + 1}. ${s.subject} (${formatHoursAndMins(s.weekly_deficit)} deficit)`).join('\n');
    } else {
      riskAreasText = "None. All subjects are on track!";
    }

    let nextActionsText = "";
    if (data.next_actions && data.next_actions.length > 0) {
      nextActionsText = data.next_actions.slice(0, 3).map((action, i) => `${i + 1}. ${action}`).join('\n');
    } else {
      nextActionsText = "No pending actions, maintain your current pace!";
    }

    return `📊 *Weekly Mentor Report*

${userName}, here is your weekly progress overview:

• Mission Target: ${totalTarget}
• Completed till now: ${completedTillNow}
• Remaining: ${remaining}
• This week target: ${thisWeekTarget}
• Completed this week: ${thisWeekCompleted}
• ${deficitText}

*Top 3 risk areas:*
${riskAreasText}

*Next actions:*
${nextActionsText}

Send \`subject breakdown\` to see all subjects.`;
  } else {
    let report = `📊 *Weekly Mentor Report (Full Breakdown)*

${userName}, here is the breakdown of all subjects:

• Mission Target: ${totalTarget}
• Completed till now: ${completedTillNow}
• Remaining: ${remaining}
• This week target: ${thisWeekTarget}
• Completed this week: ${thisWeekCompleted}
• ${deficitText}

*Subject-wise breakdown:*`;

    for (const s of data.subjects) {
      const showWarning = s.weekly_deficit > 0.5 && s.completed_hours > 0;
      const paceIcon = showWarning ? '⚠️' : '✅';
      
      report += `\n\n*${s.subject}* ${paceIcon}
• Target: ${formatHoursAndMins(s.target_hours)} | Completed: ${formatHoursAndMins(s.completed_hours)}
• Remaining: ${formatHoursAndMins(s.remaining_hours)}
• This week target: ${formatHoursAndMins(s.weekly_target)} | Completed: ${formatHoursAndMins(s.this_week_completed)}
• Deficit: ${formatHoursAndMins(Math.max(0, s.weekly_deficit))}
• Required future pace: ${formatHoursAndMins(s.required_future_pace)}/wk`;
    }

    return report;
  }
}

// 4. Syllabus track summary
export function generateSyllabusReport(data, userName = "Moulika") {
  return `🎯 *Syllabus Readiness Summary*

${userName}, you are building a strong foundation across the papers.

• Overall Readiness: ${data.overall_readiness_score}% 🎓
• Syllabus Coverage: ${data.overall_syllabus_coverage_percent}%
• PYQ Coverage: ${data.overall_pyq_coverage_percent}%
• Revision Progress: ${data.overall_revision_percent}%
• Untouched Topics: ${data.untouched_nodes_count}

*Paper Readiness:*
${data.papers.map(p => {
  const icon = p.status === 'exam_ready' ? '🟢' : p.status === 'strong' ? '🔵' : p.status === 'balanced' ? '🟡' : '🔴';
  return `${icon} *${p.paper_label}*: ${p.readiness_score}%`;
}).join('\n')}`;
}

// 5. Revision due report
export function generateRevisionReport(data, userName = "Moulika") {
  if (data.count === 0) {
    return `📅 *Revision Due*

No due revisions found in MentorOS right now.

*Mentor note:*
This is okay only if revision items are being created after blocks/tests. Once you start logging blocks, mistakes, and answer reviews, I’ll remind you automatically.`;
  }

  let report = `📅 *Revision Due Report*
• Total pending items due: ${data.count}

*Top due items:*`;

  for (const item of data.due_items) {
    const priorityLabel = 
      item.priority === 'high' ? '🔴 High' :
      item.priority === 'low' ? '🟢 Low' : '🟡 Med';
    
    const dueStr = new Date(item.next_review_at).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short"
    });

    report += `\n• *${item.subject}* - ${item.title} (${priorityLabel} | Due: ${dueStr})`;
  }

  return report;
}

// 6. Backlog rescue report
export function generateBacklogReport(data) {
  let report = `⚠️ *Backlog Rescue Report*

Pending backlog items: ${data.count + (data.old_unstarted_count || 0)}

*Mentor note:*
This is not failure. These are unfinished promises. We’ll convert them into a rescue plan.`;

  if (data.items.length === 0) {
    report += `\n\nNo active backlog items to act on today. Keep up the rhythm!`;
  } else {
    report += `\n\n*Top rescue items:*\n`;
    data.items.forEach((item, index) => {
      const displaySubject = item.subject || "Revision";
      const displayTopic = item.topic ? ` ${item.topic}` : "";
      const displayMinutes = item.planned_minutes ? ` — ${item.planned_minutes}m planned` : "";
      report += `\n${index + 1}. ${displaySubject}${displayTopic}${displayMinutes}`;
    });

    report += `\n\n*Rescue plan for tomorrow:*
• Pick only 2 backlog items
• Do 90 minutes Geography Optional
• Do 60 minutes Current Affairs
• Don’t try to clear all ${data.count + (data.old_unstarted_count || 0)} in one day`;
  }

  return report;
}

// 7. Mains answer status report
export function generateMainsAnswerStatusReport(data, userName = "Moulika") {
  let greeting = `${userName}, here is your Mains answer writing snapshot.`;
  
  let report = `📝 *Mains Answer Writing*

${greeting}

• Total written: ${data.total_written}
• Avg evaluation score: ${data.average_score !== null ? `${data.average_score}/10` : 'N/A'}`;

  if (data.paper_breakdown.length > 0) {
    report += `\n\n*Paper Breakdown:*`;
    for (const pb of data.paper_breakdown.slice(0, 3)) {
      report += `\n• *${pb.paper}*: ${pb.count} answer(s)`;
    }
  }

  if (data.recent_evaluations.length > 0) {
    report += `\n\n*Latest feedback:*`;
    const r = data.recent_evaluations[0];
    const scoreLabel = r.score !== null ? `${r.score}/10` : 'Not scored';
    report += `\n• *${r.paper}* [Score: ${scoreLabel}]
  "${r.question.length > 40 ? r.question.substring(0, 40) + '...' : r.question}"
  Feedback: _"${r.feedback.length > 80 ? r.feedback.substring(0, 80) + '...' : r.feedback}"_`;
  }

  return report;
}

// 8. How much left report (all subject targets)
export function generateHowMuchLeftReport(subjects, userName = "Moulika") {
  let report = `📊 *Subject Progress Summary*

${userName}, here is your high-level syllabus progress:`;
  
  if (subjects.length === 0) {
    return report + "\n\n_No targets registered in the system._";
  }

  for (const s of subjects) {
    const showWarning = s.weekly_deficit > 0.5 && s.completed_hours > 0;
    const paceIcon = showWarning ? '⚠️' : '✅';
    report += `\n\n*${s.subject}* ${paceIcon}
• Completed: ${formatHoursAndMins(s.completed_hours)} / ${formatHoursAndMins(s.target_hours)} (${s.completion_percent}%)
• Remaining: ${formatHoursAndMins(s.remaining_hours)}`;
  }

  return report;
}

// 9. Good morning report generator
export function generateGoodMorningReport(data, userName = "Moulika") {
  const state = data.mission_health_state || 'HEALTHY';
  let reportText = "";
  
  if (['AT_RISK', 'HIGH_RISK', 'CRITICAL', 'MISSION_FAILURE', 'RECOVERY'].includes(state)) {
    const stateColor = state === 'RECOVERY' ? '🟡' : '🔴';
    const streakDays = data.consecutive_zero_study_days || 0;
    const recoveryTargetStr = formatHoursAndMins(data.adaptive_target_hours || 0);
    const stateLabel = state === 'RECOVERY' ? `RECOVERY (Day ${data.recovery_day})` : state.replace('_', ' ');
    const streakLabel = (data.completed_hours === 0) ? "Zero-study streak" : "Days below minimum target";

    reportText = `Good morning ${userName} 🌅

Mission Status: ${stateColor} *${stateLabel}*
${streakLabel}: ${streakDays} day(s)
Expected progress by today: ${data.expected_hours_till_today} hours
Actual progress: ${formatHoursAndMins(data.completed_hours)}
Backlog: ${data.backlog_hours} hours
Today’s recovery target: ${recoveryTargetStr}
Mission: ${state === 'RECOVERY' ? 'Protect the streak' : 'Break the streak'}`;
  } else {
    let yesterdayText = "No study blocks registered yesterday.";
    let mentorNote = "";
    let todayCorrection = data.today_first_correction;

    if (data.yesterday_summary && data.yesterday_summary.has_data) {
      const ys = data.yesterday_summary;
      const executedStr = ys.actual_hours > 0 ? formatHoursAndMins(ys.actual_hours) : "0h 0m";
      yesterdayText = `• Planned: ${ys.planned_hours}h\n• Executed: ${executedStr}\n• Execution rate: ${ys.execution_rate}%\n• Blocks touched/completed: ${ys.blocks_touched} / ${ys.blocks_completed}`;

      if (ys.execution_rate < 40) {
        mentorNote = `\nMentor note:\nThis is not failure. This is correction data.\n`;
        todayCorrection = `Complete one full 60-minute block before thinking about the whole day.`;
      }
    }

    reportText = `Good morning ${userName} 🌅

Mission Day: ${data.mission_day} / 325
Days left for Prelims: ${data.prelims_days_left}
Days left for Mains: ${data.mains_days_left}

Mission Progress:
• Target: ${data.target_hours}h
• Completed: ${formatHoursAndMins(data.completed_hours)}
• Remaining: ${formatHoursAndMins(data.remaining_hours)}
• Today’s required pace: ${formatHoursAndMins(data.today_required_pace)}

Yesterday:
${yesterdayText}
${mentorNote}
Today’s first correction:
${todayCorrection}`;
  }

  const countdown = getUpscCountdownSummary();
  return `${reportText}\n\n${countdown}`;
}

// 10. Daily night report generator
export function generateDailyNightReport(data, userName = "Moulika") {
  const targetHrs = (data.target_minutes ?? data.planned_minutes ?? 0) / 60.0;
  const actualHrs = (data.actual_minutes ?? data.studied_minutes ?? 0) / 60.0;
  const deficitHrs = (data.deficit_minutes ?? 0) / 60.0;
  const totalBlocks = data.total_blocks || 0;
  const subjectsCompleted = Array.isArray(data.subjects_completed) ? data.subjects_completed : [];
  const missedBlocks = data.missed_blocks || 0;
  const revisionDue = data.revision_due || 0;
  const outputsCreated = data.outputs_created || 0;

  let reportText = "";

  if (data.state === 'NOT_STARTED') {
    reportText = `⚠️ Daily Accountability Report — ${userName}

• Plan uploaded: No
• Study tracked: No
• Target hours: Not available
• Actual hours: 0m
• Deficit: Not calculated

MentorOS could not evaluate today’s preparation because no study plan was uploaded.

🎯 Tomorrow correction:
${data.tomorrow_correction}`;
  } else if (data.state === 'PLAN_UPLOADED_NOT_STARTED') {
    reportText = `⚠️ Plan Created But Execution Missing — ${userName}

• Planned: ${formatHoursAndMins(targetHrs)}
• Actual: 0m
• Blocks started: 0/${totalBlocks}

Main issue:
Plan was created, but execution did not begin.

🎯 Tomorrow correction:
${data.tomorrow_correction}`;
  } else {
    reportText = `📘 Daily Night Report — ${userName}

━━━━━━━━━━━━━━
• target hours: ${formatHoursAndMins(targetHrs)}
• actual hours: ${formatHoursAndMins(actualHrs)}
• deficit: ${formatHoursAndMins(deficitHrs)}
━━━━━━━━━━━━━━

📚 *subjects completed:* ${subjectsCompleted.length > 0 ? subjectsCompleted.join(', ') : 'None'}
📝 *outputs created:* ${outputsCreated}
❌ *missed blocks:* ${missedBlocks}
📅 *revision due:* ${revisionDue} items

💡 *tomorrow correction:*
${data.tomorrow_correction}`;
  }

  const countdown = getUpscCountdownSummary();
  return `${reportText}\n\n${countdown}`;
}

// 11. Monthly report generator
export function generateMonthlyReport(data, userName = "Moulika") {
  return `📊 *Monthly Mentor Report: ${data.month_key}*

${userName}, here is your text summary for the month:

• Planned hours: ${formatHoursAndMins(data.total_planned_hours)}
• Actual hours: ${formatHoursAndMins(data.total_actual_hours)}

🔥 *Consistency Stats:*
• ✅ Strong Days: ${data.strong_days}
• 🟡 Partial Days: ${data.partial_days}
• 🔴 Weak/Missed Days: ${data.weak_days}

📚 *Subject Breakdown:*
${data.subject_breakdown.map((s, i) => `${i + 1}. ${s.subject}: ${formatHoursAndMins(s.hours)}`).join('\n')}

*Mentor note:*
This is your baseline. Analyze weak days and adjust pacing for next month!`;
}

// 12. Plan Accepted Summary
export function generatePlanAcceptedSummaryReport(yesterdaySummary, todayAudit, userName = "Moulika") {
  let report = `Plan received ✅\n\n${userName}, today’s plan is saved. Before starting, here is the correction from yesterday.\n\n`;

  // Yesterday Summary
  report += `Yesterday:\n`;
  const hrs = Math.floor(yesterdaySummary.studied_mins_total / 60);
  const mins = yesterdaySummary.studied_mins_total % 60;
  report += `• Studied: ${hrs}h ${mins}m / ${yesterdaySummary.planned_hours}h\n`;
  report += `• Strong: ${yesterdaySummary.strong_subject}\n`;
  const missedStr = yesterdaySummary.missed_subjects.length > 0 ? yesterdaySummary.missed_subjects.join(', ') : 'None';
  report += `• Missed: ${missedStr}\n`;
  if (yesterdaySummary.output_count > 0) {
    report += `• Output: ${yesterdaySummary.output_count} outputs generated\n`;
  }
  report += `• Pending: ${yesterdaySummary.revision_pending} revision items\n\n`;

  // Today's Check
  report += `Today’s plan check:\n`;
  report += todayAudit.has_geo ? `✅ Geography Optional included\n` : `⚠️ Geography Optional missing\n`;
  report += todayAudit.has_csat ? `✅ CSAT included\n` : `⚠️ No CSAT block found\n`;
  report += todayAudit.has_pyq_mcq ? `✅ PYQ/MCQ included\n` : `⚠️ No PYQ/MCQ block found\n`;
  report += todayAudit.has_revision ? `✅ Revision included\n` : `⚠️ No revision block found\n`;
  report += todayAudit.has_answer_writing ? `✅ Answer writing included\n` : `⚠️ No answer writing block found\n`;

  // Mentor Correction
  report += `\nMentor correction:\n\n`;
  const corrections = [];
  
  if (!todayAudit.has_csat) corrections.push(`Add 60–75 min CSAT block`);
  if (!todayAudit.has_answer_writing) corrections.push(`Add one 45-minute answer writing block`);
  if (!todayAudit.has_revision) corrections.push(`Add 30–45 min revision block for pending items`);
  
  if (todayAudit.total_planned_hours > 12) {
    corrections.push(`Keep today’s target realistic: plan is overloaded (${todayAudit.total_planned_hours}h)`);
  } else if (todayAudit.total_planned_hours < 8 && todayAudit.total_planned_hours > 0) {
    corrections.push(`Plan is too light (${todayAudit.total_planned_hours}h) for 3500h mission, add more blocks`);
  }

  if (corrections.length === 0) {
    corrections.push(`Great plan today, execute with full focus.`);
  }

  corrections.forEach((c, idx) => {
    report += `${idx + 1}. ${c}\n`;
  });

  return report;
}

// 13. Generate Weekly Mentor Report
export function generateWeeklyMentorReport(summary, userName = "Moulika") {
  const weeklyMissionTarget = formatHoursAndMins(summary.weekly_mission_target);
  const recoveryPace = formatHoursAndMins(summary.required_recovery_pace);
  const deficit = summary.deficit;

  // Show deficit vs surplus relative to mission weekly target
  let deficitText = "";
  if (deficit > 0) {
    deficitText = `This week deficit: ${formatHoursAndMins(deficit)} behind mission pace`;
  } else {
    deficitText = `Surplus: ${formatHoursAndMins(Math.abs(deficit))} ahead this week`;
  }

  // Show recovery pace only if behind (recovery > mission target means you need extra effort)
  let recoverLine = "";
  if (summary.required_recovery_pace > summary.weekly_mission_target + 0.5) {
    recoverLine = `\n• Required recovery pace: ${recoveryPace}/wk (mission pace is ${weeklyMissionTarget}/wk)`;
  }
    
  const execRateVal = summary.execution_rate >= 99.9 ? 100 : summary.execution_rate;
  const execRateStr = execRateVal === 100 ? '100%' : `${execRateVal}%`;

  let report = `📊 *Weekly Mentor Report*

${userName}, here is your weekly progress overview:

• Weekly mission target: ${weeklyMissionTarget}/wk
• Planned this week: ${formatHoursAndMins(summary.weekly_planned)}
• Executed this week: ${formatHoursAndMins(summary.weekly_executed)}
• Execution rate: ${execRateStr}
• ${deficitText}${recoverLine}
• Output count: ${summary.output_count}

*Top 3 strong areas:*
${summary.strong_subjects.length > 0 ? summary.strong_subjects.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None yet this week'}

*Top subject-level risks:*
${summary.weak_subjects.length > 0 ? summary.weak_subjects.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None clearly at risk this week'}

*Mentor:*
${summary.next_action}

Send \`subject breakdown\` to see all subjects.`;

  return report;
}

// 14. Generate Weekly Subject Breakdown Report
export function generateWeeklySubjectBreakdownReport(data, userName = "Moulika") {
  let report = `📊 *Weekly Subject Breakdown*\n\n`;
  
  for (const s of data) {
    const showWarning = s.weekly_deficit > 0.5 && s.completed_hours > 0;
    const paceIcon = showWarning ? '⚠️' : '✅';
    
    report += `\n*${s.subject}* ${paceIcon}
• Annual target: ${formatHoursAndMins(s.target_hours)}
• Completed till now: ${formatHoursAndMins(s.completed_hours)}
• Remaining: ${formatHoursAndMins(s.remaining_hours)}
• This week planned: ${formatHoursAndMins(s.this_week_planned)}
• This week executed: ${formatHoursAndMins(s.this_week_completed)}
• Weekly ${s.weekly_deficit > 0 ? 'deficit' : 'surplus'}: ${formatHoursAndMins(Math.abs(s.weekly_deficit))}
• Future pace needed: ${formatHoursAndMins(s.required_future_pace)}/wk\n`;
  }
  return report;
}

// 15. Generate Prelims Status Report
export function generatePrelimsStatusReport(data, userName = "Moulika") {
  let report = `🎯 *Prelims Status*\n\n`;
  if (data.length === 0) return report + "No Prelims targets found.";
  
  for (const s of data) {
    report += `\n*${s.subject}*
• Target: ${formatHoursAndMins(s.target_hours)} | Completed: ${formatHoursAndMins(s.completed_hours)}
• Remaining: ${formatHoursAndMins(s.remaining_hours)}
• Required pace: ${formatHoursAndMins(s.required_future_pace)}/wk\n`;
  }
  return report;
}

// 16. Generate Mains Status Report
export function generateMainsStatusReport(data, userName = "Moulika") {
  let report = `📝 *Mains Status*\n\n`;
  if (data.length === 0) return report + "No Mains targets found.";
  
  for (const s of data) {
    report += `\n*${s.subject}*
• Target: ${formatHoursAndMins(s.target_hours)} | Completed: ${formatHoursAndMins(s.completed_hours)}
• Remaining: ${formatHoursAndMins(s.remaining_hours)}
• Required pace: ${formatHoursAndMins(s.required_future_pace)}/wk\n`;
  }
  return report;
}

// 17. Generate Monthly Mentor Text Report
export function generateMonthlyMentorTextReport(data, userName = "Moulika") {
  return `📊 *Monthly Mentor Report: ${data.month_key}*

${userName}, here is your monthly summary:

• Mission target: 3500h
• Mission completed: ${data.mission_completed_percent}%
• Monthly planned: ${formatHoursAndMins(data.total_planned_hours)}
• Monthly executed: ${formatHoursAndMins(data.total_actual_hours)}
• Execution rate: ${data.execution_rate}%

🔥 *Consistency Heatmap:*
• ✅ Strong Days: ${data.strong_days}
• 🟡 Partial Days: ${data.partial_days}
• 🔴 Weak/Missed Days: ${data.weak_days}

📚 *Top 3 Strong Subjects:*
${data.top3_strong.length > 0 ? data.top3_strong.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None'}

⚠️ *Top 3 Weak Subjects:*
${data.top3_weak.length > 0 ? data.top3_weak.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'None'}

*Next month prescription:*
${data.next_month_prescription}`;
}

// 18. Compatibility wrapper for generateNightReport
export function generateNightReport(data, userName = "Moulika") {
  return generateDailyNightReport(data, userName);
}

/**
 * Generates the canonical Good Morning Telegram report text based on pure read-only calculated metrics.
 *
 * @param {Object} data - Canonical progress report data
 * @param {string} userName - Name of the user (defaults to "Moulika")
 * @returns {string} Formatted report text
 */
export function generateCanonicalGoodMorningReport(data, userName = "User") {
  const ys = data.yesterdaySummary;
  if (!ys) {
    const reportText = `Good morning ${userName} 🌅\n\nNo study recorded yesterday.`;
    const countdown = getUpscCountdownSummary();
    return `${reportText}\n\n${countdown}`;
  }

  let yesterdayText = "";
  if (ys.dataQuality === 'CONFLICT') {
    yesterdayText = "• MentorOS could not fully confirm yesterday’s execution.";
  } else if (ys.totalRecordedSeconds === 0) {
    yesterdayText = "• No study recorded.";
  } else {
    const sortedSubjects = [...ys.subjects].filter(s => s.recordedSeconds > 0).sort((a, b) => b.recordedSeconds - a.recordedSeconds);
    const topSubjects = sortedSubjects.slice(0, 3);
    const subLines = topSubjects.map(s => `• ${s.subject} — ${formatDurationSeconds(s.recordedSeconds)}`).join('\n');
    const remainingCount = sortedSubjects.length - 3;
    const moreText = remainingCount > 0 ? `\n...and ${remainingCount} more` : '';
    yesterdayText = `${subLines}${moreText}`;
  }

  // Pending section
  let pendingText = "";
  const pendingSubjects = ys.subjects.filter(s => s.pendingSeconds > 0);
  if (pendingSubjects.length === 0 && ys.revisionsDue === 0) {
    pendingText = "No pending work.";
  } else {
    const topPending = pendingSubjects.slice(0, 3);
    const pendingLines = topPending.map(s => `• ${s.subject} — ${formatDurationSeconds(s.pendingSeconds)} remaining`).join('\n');
    const remainingCount = pendingSubjects.length - 3;
    const moreText = remainingCount > 0 ? `\n...and ${remainingCount} more` : '';
    const revisionsLine = ys.revisionsDue > 0 ? `\n• Overdue revisions — ${ys.revisionsDue} items` : '';
    pendingText = `${pendingLines}${moreText}${revisionsLine}`;
  }

  // Today section
  let planStatusText = "Plan is still pending.";
  if (data.planState) {
    const state = data.planState.state;
    if (state === 'USER_PLAN_PRESENT') {
      planStatusText = "Plan is ready ✅";
    } else if (state === 'RECOVERY_ONLY') {
      planStatusText = "Plan not uploaded yet (Recovery active).";
    } else if (state === 'SYSTEM_PLAN_ONLY') {
      planStatusText = "Plan not uploaded yet (Suggestions active).";
    } else if (state === 'NO_PLAN') {
      planStatusText = "Plan not uploaded yet.";
    } else {
      planStatusText = "Plan status is ambiguous. Please confirm.";
    }
  }

  let recoveryText = "";
  const recoveryBlocks = data.recoveryBlocks || [];
  if (recoveryBlocks.length > 0) {
    const b = recoveryBlocks[0];
    recoveryText = `\nRecovery block available: ${b.subject || 'GS'} recovery — ${b.planned_start || '09:00'}–${b.planned_end || '10:30'}`;
  }

  const reportText = `Good morning ${userName} 🌅

Yesterday
${yesterdayText}

Total recorded study — ${formatDurationSeconds(ys.totalRecordedSeconds)}
Completed blocks — ${ys.completedBlockCount}
Partial blocks — ${ys.partialBlockCount}

Pending
${pendingText}

Today
Plan Status: ${planStatusText}${recoveryText}

Next action:
${data.immediateAction}`;

  const countdown = getUpscCountdownSummary();
  return `${reportText}\n\n${countdown}`;
}

export function generateCanonicalWeeklyReport(data, userName = "Moulika") {
  const activeDays = data.activeDaysCount;
  const totalRecorded = formatDurationSeconds(data.totalRecordedSeconds);
  const totalPlanned = formatHoursAndMins(data.totalPlannedSeconds / 3600);
  const totalPending = formatDurationSeconds(data.pendingSeconds);
  const execRate = data.totalPlannedSeconds > 0 ? ((data.totalRecordedSeconds / data.totalPlannedSeconds) * 100).toFixed(1) : '0';

  const subLines = data.subjects.map(s =>
    `• ${s.subject}: ${formatDurationSeconds(s.recordedSeconds)} (Planned: ${formatHoursAndMins(s.plannedSeconds / 3600)} | Pending: ${formatDurationSeconds(s.pendingSeconds)})`
  ).join('\n');

  let priorityText = "Keep your daily study blocks aligned with your main plan targets.";
  if (data.revisionsDue > 5) {
    priorityText = "Your overdue revision backlog is growing. Prioritize clearing pending revision items first.";
  } else {
    const geoSub = data.subjects.find(s => s.subject === 'Geography Optional');
    if (geoSub && geoSub.pendingSeconds > 3600 * 3) {
      priorityText = "Geography Optional has significant pending duration this week. Prioritize finishing scheduled optional blocks.";
    }
  }

  const report = `📊 *Weekly Mentor Report*

${userName}, here is your weekly progress overview:

• Active study days: ${activeDays} days
• Total recorded study: ${totalRecorded}
• Execution rate: ${execRate}%

*Subject Breakdown:*
${subLines || "No subjects studied/planned."}

*Completed & Missed Blocks:*
• Completed blocks: ${data.completedBlockCount}
• Partial blocks: ${data.partialBlockCount}
• Missed blocks: ${data.missedBlockCount}

*Pending Work & Revisions:*
• Carried-forward pending work: ${totalPending}
• Revisions due: ${data.revisionsDue} items

*Mentor Priority:*
${priorityText}`;

  return report;
}

export function generateCanonicalMonthlyTextReport(dataset, userName = "Moulika") {
  const thisMonth = dataset.thisMonth;
  const mtd = dataset.missionToDate;
  const totalPlanned = formatHoursAndMins(thisMonth.plannedSeconds / 3600);
  const totalRecorded = formatDurationSeconds(thisMonth.recordedSeconds);
  const execRate = thisMonth.plannedSeconds > 0 ? ((thisMonth.recordedSeconds / thisMonth.plannedSeconds) * 100).toFixed(1) : '0';

  const subLines = thisMonth.subjects.map(s =>
    `• ${s.subject}: ${formatDurationSeconds(s.recordedSeconds)} completed`
  ).join('\n');

  const weakStr = dataset.weakAreas.length > 0 ? dataset.weakAreas.join(', ') : 'None detected';

  const report = `📊 *Monthly Mentor Report: ${dataset.monthKey}*

${userName}, here is your summary for the month:

THIS MONTH:
• Planned study: ${totalPlanned}
• Recorded study: ${totalRecorded}
• Execution rate: ${execRate}%
• Active study days: ${thisMonth.activeDaysCount} days
• Completed blocks: ${thisMonth.completedBlockCount}
• Partial blocks: ${thisMonth.partialBlockCount}
• Missed blocks: ${thisMonth.missedBlockCount}

*Subject execution:*
${subLines || "No subjects studied."}

MISSION TO DATE:
• Overall progress toward 3500 hours: ${mtd.overallProgressPercent}%
• Cumulative completed study: ${mtd.cumulativeCompletedHours}h
• Target remaining: ${mtd.remainingHours}h

*Weak Areas:*
${weakStr}

*Mentor prescription:*
Ensure consistency by limiting consecutive zero-study days.`;

  return report;
}
