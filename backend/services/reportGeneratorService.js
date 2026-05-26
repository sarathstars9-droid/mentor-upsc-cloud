// Helper to format decimal hours into hours & minutes (e.g. 17.25 -> 17h 15m)
export function formatHoursAndMins(decimalHours) {
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
• Studied: ${formatHoursAndMins(data.total_actual_hours)} (Planned: ${formatHoursAndMins(data.total_planned_hours)})

*Execution log:*`;

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
export function generateMainsStatusReport(data, userName = "Moulika") {
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
