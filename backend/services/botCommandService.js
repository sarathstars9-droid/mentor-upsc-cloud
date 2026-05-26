import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as telegramService from './telegramService.js';

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
• today report`;
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
