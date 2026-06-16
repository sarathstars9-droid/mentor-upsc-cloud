import { query } from '../db/index.js';
import * as progressService from './progressService.js';
import * as reportGeneratorService from './reportGeneratorService.js';
import * as telegramService from './telegramService.js';
import * as consistencyService from './consistencyService.js';
import { getPrelimsDaysLeft, getMainsDaysLeft } from '../config/examCalendar.js';
import * as psychologyMessageService from './psychologyMessageService.js';

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
    const userRes = await query(
      `SELECT name, mission_health_state, recovery_wizard_step, recovery_wizard_duration, recovery_wizard_subject 
       FROM public.users WHERE id = $1`,
      [userId]
    );
    const user = userRes.rows[0] || {};
    const userName = user.name || "Moulika";
    const state = user.mission_health_state || "HEALTHY";
    const wizardStep = user.recovery_wizard_step || 0;

    const isDeveloperCommand = command.startsWith('debug ') || command.startsWith('test ') || command.startsWith('sync ');
    if (isDeveloperCommand) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
      if (String(destinationId) !== String(adminChatId)) {
        console.log(`[BotCommandService] Unauthorized developer command attempt by ${destinationId}`);
        await telegramService.sendMessage(destinationId, "❌ You are not authorized to run developer commands.");
        return;
      }
    }

    if (command.startsWith('debug daily summary')) {
      const parts = command.split(' ');
      let todayKey;
      if (parts.length >= 4 && parts[3].match(/^\d{4}-\d{2}-\d{2}$/)) {
        todayKey = parts[3];
      } else {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        todayKey = `${yyyy}-${mm}-${dd}`;
      }

      const { getDailyExecutionSummary } = await import('./dailyExecutionSummaryService.js');
      const summary = await getDailyExecutionSummary(userId, todayKey);

      let report = `⏱️ *Debug Daily Summary (${todayKey})*\n`;
      report += `Total Blocks: ${summary.totalBlocks}\n`;
      report += `Completed: ${summary.completedBlocks}\n`;
      report += `Missed: ${summary.missedBlocks}\n`;
      report += `Studied Minutes: ${summary.studiedMinutes}\n`;
      report += `Planned Minutes: ${summary.plannedMinutes}\n`;
      report += `Subjects Completed: ${summary.subjectsCompleted.join(', ') || 'None'}\n\n`;

      for (const b of summary.blockRows) {
        report += `*${b.title}* | ${b.subject}\n`;
        report += `Status: ${b.status}\n`;
        report += `Planned: ${b.plannedMinutes}m | Actual: ${b.actualMinutes}m | Effective: ${b.effectiveMinutes}m\n`;
        report += `Completed: ${b.isCompleted ? 'YES' : 'NO'} | Missed: ${b.isMissed ? 'YES' : 'NO'}\n`;
        if (b.skipReason) {
          report += `Reason: ${b.skipReason}\n`;
        }
        report += `\n`;
      }

      await telegramService.sendMessage(destinationId, report, { parse_mode: 'Markdown' });
      return;
    }

    if (command.startsWith('debug behavior state ')) {
      const parts = command.split(' ');
      const state = parts[3].toUpperCase();
      let zeroDays = 0;
      let missedPlans = 0;
      let recDay = 0;
      
      if (state === 'SLIGHT_RISK') {
        zeroDays = 1;
      } else if (state === 'AT_RISK') {
        zeroDays = 3;
      } else if (state === 'HIGH_RISK') {
        zeroDays = 7;
      } else if (state === 'CRITICAL') {
        zeroDays = 14;
      } else if (state === 'MISSION_FAILURE') {
        zeroDays = 21;
      } else if (state === 'RECOVERY') {
        recDay = 1;
      }
      
      await query(
        `UPDATE public.users 
         SET mission_health_state = $2, 
             consecutive_zero_study_days = $3, 
             consecutive_missed_plan_days = $4,
             recovery_day = $5,
             recovery_score = 100,
             notification_count_today = 0
         WHERE id = $1`,
        [userId, state, zeroDays, missedPlans, recDay]
      );
      await telegramService.sendMessage(destinationId, `✅ Updated behavior state to ${state} for ${userId}. Streaks updated.`);
      return;
    }

    if (command === 'test daily analyzer') {
      const now = new Date();
      const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const d = new Date(kolkataStr);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const todayKey = `${yyyy}-${mm}-${dd}`;
      
      const { analyzeDailyRisk } = await import('./behaviorEscalationService.js');
      const newState = await analyzeDailyRisk(userId, todayKey);
      await telegramService.sendMessage(destinationId, `✅ Executed analyzeDailyRisk. New health state: ${newState}`);
      return;
    }

    if (command.startsWith('test night report')) {
      const parts = command.split(' ');
      let todayKey;
      if (parts.length >= 4 && parts[3].match(/^\d{4}-\d{2}-\d{2}$/)) {
        todayKey = parts[3];
      } else {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        todayKey = `${yyyy}-${mm}-${dd}`;
      }

      const data = await progressService.getDailyNightReportData(userId, todayKey);
      const report = reportGeneratorService.generateDailyNightReport(data, userName);
      await telegramService.sendMessage(destinationId, report, { parse_mode: 'Markdown' });
      return;
    }

    if (command.startsWith('debug raw blocks')) {
      const parts = command.split(' ');
      let todayKey;
      if (parts.length >= 4 && parts[3].match(/^\d{4}-\d{2}-\d{2}$/)) {
        todayKey = parts[3];
      } else {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        todayKey = `${yyyy}-${mm}-${dd}`;
      }

      const { query } = await import('../db/index.js');
      const { rows } = await query(
        `SELECT id, title, subject, status, planned_minutes, actual_minutes, day_key, planned_start, planned_end, updated_at, block_id
         FROM study_blocks WHERE user_id = $1 AND day_key = $2 ORDER BY planned_start, updated_at`,
        [userId, todayKey]
      );
      
      let report = `🗄️ *Raw DB Blocks (${todayKey})*\n\n`;
      if (rows.length === 0) report += "No rows found.";
      for (const r of rows) {
        report += `*${r.title || r.subject}*\nid: \`${r.id}\`\nblock_id: \`${r.block_id}\`\nstatus: ${r.status} | planned: ${r.planned_minutes} | actual: ${r.actual_minutes}\nstart: ${r.planned_start} | end: ${r.planned_end}\nupdated: ${r.updated_at}\n\n`;
      }
      await telegramService.sendMessage(destinationId, report.substring(0, 4000), { parse_mode: 'Markdown' });
      return;
    }

    if (command.startsWith('debug sheet blocks')) {
      const parts = command.split(' ');
      let todayKey;
      if (parts.length >= 4 && parts[3].match(/^\d{4}-\d{2}-\d{2}$/)) {
        todayKey = parts[3];
      } else {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        todayKey = `${yyyy}-${mm}-${dd}`;
      }

      const payload = { action: 'getBlocksForDate', date: todayKey, userId };
      const url = process.env.SCRIPT_URL;
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({data: JSON.stringify(payload)}) });
      const data = await res.json();
      const gasBlocks = data.blocks || [];
      
      let report = `📄 *Raw GAS Blocks (${todayKey})*\nTotal Fetched: ${gasBlocks.length}\n\n`;
      
      // Print keys of first block to know exact fields returned
      if (gasBlocks.length > 0) {
         report += `*Available Keys (First Block):*\n\`${Object.keys(gasBlocks[0]).join(', ')}\`\n\n`;
      }

      gasBlocks.forEach((b, i) => {
        report += `*Row ${i+1}* | ${b.Subject || b.Title || 'No Subject'}\n`;
        report += `BlockId: \`${b.BlockId}\`\n`;
        report += `Status (raw): ${b.Status} | CompletionStatus: ${b.CompletionStatus}\n`;
        report += `Planned Mins: ${b.Minutes || b.PlannedMinutes} | Actual Mins: ${b.ActualMinutes || b.actual_minutes}\n`;
        report += `Start: ${b.Start || b.PlannedStart} | End: ${b.End || b.PlannedEnd}\n`;
        report += `\n`;
      });
      await telegramService.sendMessage(destinationId, report.substring(0, 4000), { parse_mode: 'Markdown' });
      return;
    }

    if (command.startsWith('sync today from sheet') || command.startsWith('sync date ')) {
      let dateStr;
      if (command.startsWith('sync date ')) {
        const parts = command.split(' ');
        if (parts.length >= 3 && parts[2].match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateStr = parts[2];
        } else {
          await telegramService.sendMessage(destinationId, "❌ Invalid format. Use: sync date YYYY-MM-DD from sheet");
          return;
        }
      } else {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      }

      await telegramService.sendMessage(destinationId, `Syncing blocks from Google Sheets for ${dateStr}...`);

      const scriptUrl = process.env.SCRIPT_URL;
      if (!scriptUrl) {
        await telegramService.sendMessage(destinationId, "❌ SCRIPT_URL not found in environment variables.");
        return;
      }

      try {
        const payload = { action: 'getBlocksForDate', date: dateStr, userId };
        const body = new URLSearchParams();
        body.set("data", JSON.stringify(payload));
        
        const r = await fetch(scriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        
        const text = await r.text();
        let gasResult = {};
        try { gasResult = JSON.parse(text); } catch { gasResult = { ok: true, raw: text }; }
        
        if (Array.isArray(gasResult?.blocks) && gasResult.blocks.length) {
          const { mergeLifecycleIntoGasBlocks } = await import('./blockLifecycleService.js');
          const mergedBlocks = await mergeLifecycleIntoGasBlocks(gasResult.blocks, userId, dateStr);
          const stats = mergedBlocks._stats || { mergedCount: gasResult.blocks.length, doneCount: 0, plannedCount: gasResult.blocks.length };
          await telegramService.sendMessage(destinationId, `✅ Fetched ${gasResult.blocks.length} sheet rows\nMerged into ${stats.mergedCount} canonical blocks\nUpdated done blocks: ${stats.doneCount}\nPlanned-only blocks: ${stats.plannedCount}`);
        } else {
          await telegramService.sendMessage(destinationId, `✅ Sheet returned 0 blocks for ${dateStr}. Nothing to sync.`);
        }
      } catch (err) {
        console.error("[SyncCommand Error]", err);
        await telegramService.sendMessage(destinationId, `❌ Sync failed: ${err.message}`);
      }
      return;
    }

    // -- 21+ Day Recovery System / Restart Mode & Wizard --
    if (state === 'MISSION_RECOVERY') {
      const lowerRaw = rawText.trim().toLowerCase();
      const isOption1 = command === '1' || command === 'restart today' || command === 'restart' || command.startsWith('restart');
      const isOption2 = command === '2' || command === 'i\'m overwhelmed' || command === 'im overwhelmed' || command === 'overwhelmed';
      const isOption3 = command === '3' || command === 'i don\'t have time' || command === 'i dont have time' || command === 'no time' || command === 'dont have time' || command === 'don\'t have time';
      const isOption4 = command === '4' || command === 'i\'m not motivated' || command === 'im not motivated' || command === 'not motivated' || command === 'no motivation' || command === 'motivation';
      const isOption5 = command === '5' || command === 'pause my mission' || command === 'pause';

      if (isOption1) {
        // Transition to RECOVERY_WIZARD step 1
        await query(
          `UPDATE public.users 
           SET mission_health_state = 'RECOVERY_WIZARD', 
               recovery_wizard_step = 1,
               recovery_wizard_duration = NULL,
               recovery_wizard_subject = NULL
           WHERE id = $1`,
          [userId]
        );
        const responseText = psychologyMessageService.getRecoveryOptionResponse(1);
        const promptText = `How long can you study today? (Reply with a number in minutes, or choose:\n1. 15m\n2. 25m\n3. 40m\n4. 60m)`;
        await telegramService.sendTelegramMessage(destinationId, `${responseText}\n\n${promptText}`);
        return;
      } else if (isOption2) {
        const text = psychologyMessageService.getRecoveryOptionResponse(2);
        await telegramService.sendTelegramMessage(destinationId, text);
        return;
      } else if (isOption3) {
        const text = psychologyMessageService.getRecoveryOptionResponse(3);
        await telegramService.sendTelegramMessage(destinationId, text);
        return;
      } else if (isOption4) {
        const text = psychologyMessageService.getRecoveryOptionResponse(4);
        await telegramService.sendTelegramMessage(destinationId, text);
        return;
      } else if (isOption5) {
        const text = psychologyMessageService.getRecoveryOptionResponse(5);
        await telegramService.sendTelegramMessage(destinationId, text);
        return;
      } else {
        // Any other messages in MISSION_RECOVERY show the invitation options
        const text = psychologyMessageService.getRecoveryInvitationMessage(userName);
        await telegramService.sendTelegramMessage(destinationId, text);
        return;
      }
    }

    if (state === 'RECOVERY_WIZARD') {
      if (wizardStep === 1) {
        // Parsing duration
        let duration = null;
        if (command === '1') duration = 15;
        else if (command === '2') duration = 25;
        else if (command === '3') duration = 40;
        else if (command === '4') duration = 60;
        else {
          const match = command.match(/(\d+)/);
          if (match) {
            duration = parseInt(match[1], 10);
          }
        }

        if (duration && duration > 0 && duration <= 480) {
          await query(
            `UPDATE public.users 
             SET recovery_wizard_step = 2,
                 recovery_wizard_duration = $2
             WHERE id = $1`,
            [userId, duration]
          );
          const promptText = `Which subject will you study? (Reply with subject name, or choose:\n1. Geography\n2. Polity\n3. Economy\n4. History\n5. CSAT)`;
          await telegramService.sendTelegramMessage(destinationId, promptText);
          return;
        } else {
          const promptText = `Please enter a valid duration in minutes (e.g., 25 or 25m), or choose:\n1. 15m\n2. 25m\n3. 40m\n4. 60m`;
          await telegramService.sendTelegramMessage(destinationId, promptText);
          return;
        }
      }

      if (wizardStep === 2) {
        // Parsing subject
        let subject = null;
        if (command === '1' || command === 'geography') subject = "Geography";
        else if (command === '2' || command === 'polity') subject = "Polity";
        else if (command === '3' || command === 'economy') subject = "Economy";
        else if (command === '4' || command === 'history') subject = "History";
        else if (command === '5' || command === 'csat') subject = "CSAT";
        else {
          subject = rawText.trim();
        }

        if (subject && subject.length > 0) {
          const duration = user.recovery_wizard_duration || 25;
          
          // Generate block_id by counting today's study blocks
          const now = new Date();
          const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
          const d = new Date(kolkataStr);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const todayKey = `${yyyy}-${mm}-${dd}`;

          const countRes = await query(
            `SELECT COUNT(*) as count FROM public.study_blocks WHERE user_id = $1 AND day_key = $2`,
            [userId, todayKey]
          );
          const nextIdx = Number(countRes.rows[0]?.count || 0) + 1;
          const blockId = `B${nextIdx}`;

          // Insert study block
          await query(
            `INSERT INTO public.study_blocks (
               user_id, block_id, day_key, title, subject, planned_minutes, status, date, created_at, updated_at
             )
             VALUES ($1, $2, $3::TEXT, $4, $5, $6, 'planned', $3::DATE, NOW(), NOW())`,
            [userId, blockId, todayKey, `Recovery ${subject}`, subject, duration]
          );

          // Update user wizard details and set wizard_step to 0 (user remains in RECOVERY_WIZARD state waiting to complete the block)
          await query(
            `UPDATE public.users 
             SET recovery_wizard_step = 0,
                 recovery_wizard_subject = $2
             WHERE id = $1`,
            [userId, subject]
          );

          const confirmText = `Perfect. I have created a ${duration}-minute block for ${subject} today. Start it whenever you are ready. Reply 'start' to begin, or mark it completed in the app when done.`;
          await telegramService.sendTelegramMessage(destinationId, confirmText);
          return;
        } else {
          const promptText = `Please enter a valid subject name, or choose:\n1. Geography\n2. Polity\n3. Economy\n4. History\n5. CSAT`;
          await telegramService.sendTelegramMessage(destinationId, promptText);
          return;
        }
      }
    }

    if (state === 'RECOVERY_WIZARD' && wizardStep === 0 && (command === 'restart' || command.startsWith('restart'))) {
      await query(
        `UPDATE public.users 
         SET recovery_wizard_step = 1,
             recovery_wizard_duration = NULL,
             recovery_wizard_subject = NULL
         WHERE id = $1`,
        [userId]
      );
      const promptText = `How long can you study today? (Reply with a number in minutes, or choose:\n1. 15m\n2. 25m\n3. 40m\n4. 60m)`;
      await telegramService.sendTelegramMessage(destinationId, promptText);
      return;
    }

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
• subject breakdown
• prelims status
• mains status
• monthly report
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
• subject breakdown
• prelims status
• mains status
• monthly report
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

      case 'today report':
      case 'daily summary':
      case 'what did i study today':
      case 'how much did i study today': {
        const data = await progressService.getDailyProgressReport(userId);
        replyText = reportGeneratorService.generateDailyReport(data, userName);
        break;
      }

      case 'yesterday report':
      case 'what did i study yesterday':
      case 'how much did i study yesterday': {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yesterdayKey = `${yyyy}-${mm}-${dd}`;
        const data = await progressService.getDailyNightReportData(userId, yesterdayKey);
        replyText = reportGeneratorService.generateDailyNightReport(data, userName);
        break;
      }

      case 'night report': {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const todayKey = `${yyyy}-${mm}-${dd}`;
        const data = await progressService.getDailyNightReportData(userId, todayKey);
        replyText = reportGeneratorService.generateDailyNightReport(data, userName);
        break;
      }

      case 'today plan audit': {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const yesterdaySummary = await progressService.getYesterdayStudySummary(userId);
        const todayAudit = await progressService.auditTodayPlan(userId, dateStr);
        replyText = reportGeneratorService.generatePlanAcceptedSummaryReport(yesterdaySummary, todayAudit, userName);
        break;
      }

      case 'test weekly report':
      case 'weekly report': {
        const data = await progressService.getWeeklyExecutionSummary(userId);
        replyText = reportGeneratorService.generateWeeklyMentorReport(data, userName);
        break;
      }

      case 'subject breakdown':
      case 'weekly subject breakdown':
      case 'full weekly report':
      case 'full weekly breakdown':
      case 'all subjects': {
        const data = await progressService.getWeeklySubjectBreakdown(userId);
        replyText = reportGeneratorService.generateWeeklySubjectBreakdownReport(data, userName);
        break;
      }

      case 'prelims status': {
        const data = await progressService.getPrelimsStatus(userId);
        replyText = reportGeneratorService.generatePrelimsStatusReport(data, userName);
        break;
      }
      
      case 'mains status': {
        const data = await progressService.getMainsStatus(userId);
        replyText = reportGeneratorService.generateMainsStatusReport(data, userName);
        break;
      }
      
      case 'monthly report': {
        const data = await progressService.getMonthlyMentorSummary(userId);
        replyText = reportGeneratorService.generateMonthlyMentorTextReport(data, userName);
        break;
      }

      case 'monthly pdf':
      case 'test monthly pdf': {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${yyyy}-${mm}`;
        
        await telegramService.sendTelegramMessage(destinationId, `Generating PDF for ${monthKey}... Please wait.`);
        const { sendMonthlyPdfReport } = await import('./monthlyPdfReportService.js');
        await sendMonthlyPdfReport(userId, monthKey, destinationId);
        return; // Early return since we send document directly
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
        replyText = reportGeneratorService.generateMainsAnswerStatusReport(data, userName);
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


      case 'debug block reminders': {
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const todayKey = `${yyyy}-${mm}-${dd}`;
        
        let report = `⏱️ *Current IST time:* ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}\n\n`;

        const { rows: todayBlocks } = await query(
          `SELECT id, title, subject, topic, status, planned_start, planned_end, planned_minutes,
                  COALESCE(actual_minutes, 0) AS actual_minutes,
                  day_key, started_at, ended_at
           FROM public.study_blocks
           WHERE user_id = $1
             AND day_key = $2
           ORDER BY planned_start ASC`,
          [userId, todayKey]
        );

        let eligibleCount = 0;

        if (todayBlocks.length === 0) {
          report += "No blocks found for today.";
        } else {
          for (const b of todayBlocks) {
            const titleOrTopic = b.title || b.topic || b.subject;
            report += `*${titleOrTopic}*\n`;
            report += `Status: ${b.status}\n`;
            report += `Start: ${b.planned_start}\n`;
            report += `End: ${b.planned_end}\n`;
            report += `Actual: ${b.actual_minutes || 0}m\n`;

            if (!b.planned_start) {
              report += `Skip reason: no planned_start\n\n`;
              continue;
            }

            const [startH, startM] = b.planned_start.split(':').map(Number);
            const blockStartDate = new Date(d);
            blockStartDate.setHours(startH, startM, 0, 0);

            const blockEndDate = b.planned_end ? new Date(d) : new Date(blockStartDate.getTime() + (b.planned_minutes || 60) * 60000);
            if (b.planned_end) {
               const [endH, endM] = b.planned_end.split(':').map(Number);
               blockEndDate.setHours(endH, endM, 0, 0);
            }

            const actualMins = b.actual_minutes || 0;
            const isCompleted = ['completed', 'done', 'partial'].includes(b.status) || actualMins > 0;
            
            if (isCompleted) {
              report += `Skip reason: completed/done/partial or actual_minutes>0\n\n`;
              continue;
            }

            if (['active', 'paused'].includes(b.status)) {
              report += `Skip reason: active/paused (eligible only for pause-too-long)\n\n`;
              continue;
            }
            
            if (!['planned', 'upcoming', 'ready'].includes(b.status)) {
              report += `Skip reason: status not planned/ready/upcoming\n\n`;
              continue;
            }

            const timeDiffMins = (d.getTime() - blockStartDate.getTime()) / 60000;
            const endsInMins = (blockEndDate.getTime() - d.getTime()) / 60000;

            if (timeDiffMins >= 0 && timeDiffMins <= 10) {
              report += `Eligible for: BLOCK_START_REMINDER\n\n`;
              eligibleCount++;
            } else if (timeDiffMins >= 15 && endsInMins > 0) {
              report += `Eligible for: CURRENT_BLOCK_NOT_STARTED\n\n`;
              eligibleCount++;
            } else if (timeDiffMins >= 15 && endsInMins <= 0) {
              report += `Eligible for: Missed silently (past planned_end)\n\n`;
            } else if (timeDiffMins < 0) {
              report += `Skip reason: wait_for_start_time\n\n`;
            } else {
              report += `Skip reason: wait_15_mins\n\n`;
            }
          }
          
          report = `⏱️ *Current IST time:* ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}\nBlocks found: ${todayBlocks.length}, eligible: ${eligibleCount}\n\n` + report.replace(/^⏱️.*?\n\n/m, '');
        }
        
        replyText = report;
        break;
      }

      case 'test block started': {
        const { sendNotification } = await import('./notificationService.js');
        await sendNotification(userId, 'BLOCK_STARTED', 'test', '123', `🚀 *Block Started*\nMoulika, Test Subject has started.\nTarget: 60m\nFocus: create output, not just reading.`);
        replyText = "Sent BLOCK_STARTED test notification.";
        break;
      }

      case 'test block completed': {
        const { sendNotification } = await import('./notificationService.js');
        await sendNotification(userId, 'BLOCK_COMPLETED', 'test', '123', `✅ *Block Completed*\nSubject: Test Subject\nPlanned: 60m\nActual: 55m\nThis counts toward your target.`);
        replyText = "Sent BLOCK_COMPLETED test notification.";
        break;
      }

      case 'test pause long': {
        const { sendNotification } = await import('./notificationService.js');
        await sendNotification(userId, 'BLOCK_PAUSED_TOO_LONG', 'test', '123', `⏸️ *Pause Alert*\nMoulika, this block has been paused for 25 minutes.\nRestart with just 25 minutes. No perfection needed.`);
        replyText = "Sent BLOCK_PAUSED_TOO_LONG test notification.";
        break;
      }

      case 'debug day blocks': {
        const { query } = await import('../db/index.js');
        const now = new Date();
        const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const d = new Date(kolkataStr);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const todayKey = `${yyyy}-${mm}-${dd}`;
        
        const { rows } = await query(`SELECT subject, status, planned_minutes, actual_minutes, started_at, ended_at FROM study_blocks WHERE user_id=$1 AND day_key=$2 ORDER BY planned_start ASC`, [userId, todayKey]);
        
        replyText = `🐛 *DEBUG: ${todayKey}*\n\n`;
        if (!rows.length) {
          replyText += "No blocks found today.";
        } else {
          rows.forEach((r, i) => {
            replyText += `${i+1}. ${r.subject || 'No Subject'} | Status: ${r.status} | Plan: ${r.planned_minutes}m | Actual: ${r.actual_minutes}m | Start: ${r.started_at ? 'Yes' : 'No'}\n`;
          });
        }
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
• subject breakdown
• prelims status
• mains status
• monthly report
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

export async function handleCallbackQuery(userId, destinationId, cb) {
  const payload = cb.data;
  console.log(`[BotCommandService] Routing callback: "${payload}" for user ${userId}`);
  
  // Example for BLOCK_TOO_MUCH_PAUSED options
  if (payload === 'CONTINUE_BLOCK_25') {
    await telegramService.sendTelegramMessage(destinationId, "Excellent. Put your phone away and focus for 25 minutes without pause.");
  } else if (payload === 'REDUCE_BLOCK') {
    await telegramService.sendTelegramMessage(destinationId, "Okay. End the current block in the app and create a smaller 25-minute block. Take a 5-minute break first.");
  } else if (payload === 'START_RESCUE_MODE') {
    // Dynamic import to avoid circular dependency
    const { startRescueMode } = await import('./rescueModeService.js');
    await startRescueMode(userId);
    await telegramService.sendTelegramMessage(destinationId, "Rescue Mode started. Check the app for your 3 strict blocks.");
  }
}
