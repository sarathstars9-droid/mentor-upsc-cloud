import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as telegramService from './telegramService.js';
import * as consistencyService from './consistencyService.js';
import { getPrelimsDaysLeft, getMainsDaysLeft } from '../config/examCalendar.js';

// Normalizes incoming user message text by stripping leading slashes, converting 
// underscores to spaces, and collapsing whitespace to match commands flexibly.
export function normalizeCommand(txt) {
  if (!txt) return "";
  return txt
    .toLowerCase()
    .replace(/^\//, '') // strip leading slash if present
    .replace(/_/g, ' ') // convert underscores to spaces
    .replace(/\s+/g, ' ') // collapse multi-spaces
    .trim();
}

// Routes and processes incoming text commands
export async function handleCommand(userId, destinationId, rawText) {
  const command = normalizeCommand(rawText);
  let replyText = "";

  console.log(`[BotCommandService] Routing command: "${command}" (raw: "${rawText}") for user ${userId}`);

  try {
    const userRes = await query(`SELECT name FROM public.users WHERE id = $1`, [userId]);
    const userName = userRes.rows[0]?.name || "Moulika";

    switch (command) {
      case 'hi':
      case 'hello':
      case 'hey':
      case 'start':
        replyText = `Hello. ${userName} 👋
I’m your MentorOS progress mentor.

You can ask me:
• geography optional status
• weekly report
• syllabus track
• revision due
• backlog
• today report
• consistency
• heatmap
• day status
• mission status
• days left
• gs1 status
• gs2 status
• gs3 status
• polity left
• economy progress

I’ll help you know what is completed, what is pending, and what to correct next.`;
        break;

      case 'help':
      case 'commands':
        replyText = `👋 *Available commands:*
• geography optional status
• weekly report
• syllabus track
• revision due
• backlog
• today report
• consistency
• heatmap
• day status
• mission status
• days left
• gs1 status
• gs2 status
• gs3 status
• polity left
• economy progress`;
        break;

      case 'geography status':
      case 'geography optional status':
      case 'optional status':
      case 'optional left':
      case 'geo status': {
        const data = await progressService.getAreaProgress(userId, "Geography Optional");
        replyText = reportGeneratorService.generateAreaReport(data, userName);
        break;
      }

      case 'today report': {
        const data = await progressService.getDailyProgressReport(userId);
        replyText = reportGeneratorService.generateDailyReport(data, userName);
        break;
      }

      case 'weekly report': {
        const data = await progressService.getWeeklyProgressReport(userId);
        replyText = reportGeneratorService.generateWeeklyReport(data, userName, { fullBreakdown: false });
        break;
      }

      case 'subject breakdown':
      case 'full weekly report':
      case 'full weekly breakdown':
      case 'all subjects': {
        const data = await progressService.getWeeklyProgressReport(userId);
        replyText = reportGeneratorService.generateWeeklyReport(data, userName, { fullBreakdown: true });
        break;
      }

      case 'revision due': {
        const data = await progressService.getRevisionDueReport(userId);
        replyText = reportGeneratorService.generateRevisionReport(data, userName);
        break;
      }

      case 'backlog': {
        const data = await progressService.getBacklogReport(userId);
        replyText = reportGeneratorService.generateBacklogReport(data);
        break;
      }

      case 'syllabus track': {
        const data = await progressService.getSyllabusTrack(userId);
        replyText = reportGeneratorService.generateSyllabusReport(data, userName);
        break;
      }

      case 'csat status': {
        const data = await progressService.getAreaProgress(userId, "CSAT");
        replyText = reportGeneratorService.generateAreaReport(data, userName);
        break;
      }

      case 'mains answer status': {
        const data = await progressService.getMainsAnswerStatus(userId);
        replyText = reportGeneratorService.generateMainsStatusReport(data, userName);
        break;
      }

      case 'how much left': {
        const data = await progressService.getAllSubjectProgress(userId);
        replyText = reportGeneratorService.generateHowMuchLeftReport(data, userName);
        break;
      }

      case 'consistency': {
        const daily = await progressService.getDailyProgressReport(userId);
        const streak = daily.streak || 0;
        const heatmap = await consistencyService.getHeatmap(userId, 14);
        const strongCount = heatmap.filter(h => h.status === 'strong').length;
        const partialCount = heatmap.filter(h => h.status === 'partial').length;
        const weakCount = heatmap.filter(h => h.status === 'weak').length;
        
        replyText = `🔥 *Consistency Stats: ${userName}*

• Current Streak: *${streak}* day(s)
• Last 14 Days Summary:
  • ✅ Strong Days: ${strongCount}
  • 🟡 Partial Days: ${partialCount}
  • 🔴 Weak/Missed Days: ${weakCount}`;
        break;
      }

      case 'heatmap': {
        const heatmap = await consistencyService.getHeatmap(userId, 14);
        const emojiMap = { strong: '✅', partial: '🟡', weak: '🔴' };
        
        let report = `📅 *Recent Consistency Heatmap*\n\n`;
        const emojis = heatmap.map(h => emojiMap[h.status] || '🔴').join(' ');
        report += `${emojis}\n\n`;
        
        for (const day of heatmap) {
          const dateLabel = new Date(day.day_key).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short"
          });
          report += `${emojiMap[day.status] || '🔴'} ${dateLabel} (${day.status})\n`;
        }
        replyText = report;
        break;
      }

      case 'day status': {
        const data = await progressService.getDailyProgressReport(userId);
        replyText = reportGeneratorService.generateDailyReport(data, userName);
        break;
      }

      case 'mission status': {
        const data = await progressService.getGoodMorningReportData(userId);
        const percent = data.target_hours > 0 ? ((data.completed_hours / data.target_hours) * 100).toFixed(1) : 0;
        replyText = `🎯 *Mission Status: ${userName}*

• Mission Day: ${data.mission_day} / 325 🚀
• Total Target: ${data.target_hours}h
• Completed Hours: ${data.completed_hours}h (${percent}%)
• Remaining Hours: ${data.remaining_hours}h
• Required daily pace: ${data.today_required_pace}h/day`;
        break;
      }

      case 'days left': {
        replyText = `📅 *Countdown to UPSC CSE 2027*

• Prelims 2027: *${getPrelimsDaysLeft()}* days left (23 May 2027)
• Mains 2027: *${getMainsDaysLeft()}* days left (20 Aug 2027)`;
        break;
      }

      case 'gs1 status': {
        const subTargets = await progressService.getSubjectSubTargetsProgress(userId, 'GS1');
        let report = `📚 *GS1 Sub-targets Progress*\n\n`;
        let totalTarget = 0;
        let totalCompleted = 0;
        for (const st of subTargets) {
          totalTarget += st.target_hours;
          totalCompleted += st.completed_hours;
          report += `• *${st.sub_area}*: ${st.completed_hours}h / ${st.target_hours}h (${st.completion_percent}%)\n`;
        }
        report += `\n*Total GS1*: ${totalCompleted.toFixed(1)}h / ${totalTarget.toFixed(1)}h`;
        replyText = report;
        break;
      }

      case 'gs2 status': {
        const subTargets = await progressService.getSubjectSubTargetsProgress(userId, 'GS2');
        let report = `📚 *GS2 Sub-targets Progress*\n\n`;
        let totalTarget = 0;
        let totalCompleted = 0;
        for (const st of subTargets) {
          totalTarget += st.target_hours;
          totalCompleted += st.completed_hours;
          report += `• *${st.sub_area}*: ${st.completed_hours}h / ${st.target_hours}h (${st.completion_percent}%)\n`;
        }
        report += `\n*Total GS2*: ${totalCompleted.toFixed(1)}h / ${totalTarget.toFixed(1)}h\n\n_Revision Sheets: embedded inside GS2 blocks_`;
        replyText = report;
        break;
      }

      case 'gs3 status': {
        const subTargets = await progressService.getSubjectSubTargetsProgress(userId, 'GS3');
        let report = `📚 *GS3 Sub-targets Progress*\n\n`;
        let totalTarget = 0;
        let totalCompleted = 0;
        for (const st of subTargets) {
          totalTarget += st.target_hours;
          totalCompleted += st.completed_hours;
          report += `• *${st.sub_area}*: ${st.completed_hours}h / ${st.target_hours}h (${st.completion_percent}%)\n`;
        }
        report += `\n*Total GS3*: ${totalCompleted.toFixed(1)}h / ${totalTarget.toFixed(1)}h`;
        replyText = report;
        break;
      }

      case 'polity left': {
        const subTargets = await progressService.getSubjectSubTargetsProgress(userId, 'GS2');
        const polity = subTargets.find(st => st.sub_area === 'Polity & Constitution Static');
        if (polity) {
          replyText = `⚖️ *Polity & Constitution Static Progress*

• Target Hours: ${polity.target_hours}h
• Completed Hours: ${polity.completed_hours}h (${polity.completion_percent}%)
• Remaining Hours: ${polity.remaining_hours}h`;
        } else {
          replyText = `⚖️ *Polity & Constitution Static Progress*
No sub-target configured in the system.`;
        }
        break;
      }

      case 'economy progress': {
        const subTargets = await progressService.getSubjectSubTargetsProgress(userId, 'GS3');
        const economy = subTargets.find(st => st.sub_area === 'Economy');
        if (economy) {
          replyText = `📈 *Economy Progress*

• Target Hours: ${economy.target_hours}h
• Completed Hours: ${economy.completed_hours}h (${economy.completion_percent}%)
• Remaining Hours: ${economy.remaining_hours}h`;
        } else {
          replyText = `📈 *Economy Progress*
No sub-target configured in the system.`;
        }
        break;
      }

      default:
        replyText = `Hello. ${userName} 👋
I’m your MentorOS progress mentor.

You can ask me:
• geography optional status
• weekly report
• syllabus track
• revision due
• backlog
• today report

I’ll help you know what is completed, what is pending, and what to correct next.`;
        break;
    }
  } catch (err) {
    console.error(`[BotCommandService ERROR] Failed to process command "${rawText}":`, err);
    replyText = `❌ *Error processing command:*
_${err.message || String(err)}_`;
  }

  // Send the reply back to the user
  await telegramService.sendTelegramMessage(destinationId, replyText);
}
