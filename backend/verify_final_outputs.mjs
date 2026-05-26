// backend/verify_final_outputs.mjs
import { query } from './db/index.js';
import * as progressService from './services/progressService.js';
import * as reportGeneratorService from './services/reportGeneratorService.js';
import * as consistencyService from './services/consistencyService.js';

async function test() {
  console.log("================================================================");
  console.log("             VERIFYING UPDATED TELEGRAM COMMANDS                ");
  console.log("================================================================\n");

  const userName = "Moulika";
  const userId = "moulika";

  console.log("--- 1. [COMMAND: gs2 status] ---");
  const subTargets = await progressService.getSubjectSubTargetsProgress(userId, 'GS2');
  let gs2Report = `📚 *GS2 Sub-targets Progress*\n\n`;
  let totalTarget = 0;
  let totalCompleted = 0;
  for (const st of subTargets) {
    totalTarget += st.target_hours;
    totalCompleted += st.completed_hours;
    gs2Report += `• *${st.sub_area}*: ${st.completed_hours}h / ${st.target_hours}h (${st.completion_percent}%)\n`;
  }
  gs2Report += `\n*Total GS2*: ${totalCompleted.toFixed(1)}h / ${totalTarget.toFixed(1)}h\n\n_Revision Sheets: embedded inside GS2 blocks_`;
  console.log(gs2Report);
  console.log('\n----------------------------------------------------------------\n');


  console.log("--- 2. [COMMAND: heatmap] ---");
  const heatmap = await consistencyService.getHeatmap(userId, 14);
  const emojiMap = { strong: '✅', partial: '🟡', weak: '🔴' };
  
  let heatmapReport = `📅 *Recent Consistency Heatmap*\n\n`;
  const emojis = heatmap.map(h => emojiMap[h.status] || '🔴').join(' ');
  heatmapReport += `${emojis}\n\n`;
  
  for (const day of heatmap) {
    const dateLabel = new Date(day.day_key).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short"
    });
    heatmapReport += `${emojiMap[day.status] || '🔴'} ${dateLabel} (${day.status})\n`;
  }
  console.log(heatmapReport);
  console.log('\n----------------------------------------------------------------\n');


  console.log("--- 3. [COMMAND: day status (Normal, planned hours <= 12h)] ---");
  const now = new Date();
  const kolkataStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const todayDate = new Date(kolkataStr);
  const yyyy = todayDate.getFullYear();
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const dd = String(todayDate.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;

  // Clean up any stray test blocks
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND block_id LIKE 'test_block_%'`, [userId]);

  // Rename real blocks temporarily to avoid interfering with planned hours calculations
  await query(`UPDATE public.study_blocks SET day_key = '1970-01-01' WHERE user_id = $1 AND day_key = $2`, [userId, todayKey]);

  // Insert 10 hours planned blocks (normal)
  await query(`
    INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, status, planned_start, planned_end)
    VALUES 
      ('moulika', 'test_block_1', $1, 'GS2', 360, 'pending', '08:00', '14:00'),
      ('moulika', 'test_block_2', $1, 'Current Affairs', 240, 'pending', '15:00', '19:00')
  `, [todayKey]);

  const normalData = await progressService.getDailyProgressReport(userId);
  const normalReport = reportGeneratorService.generateDailyReport(normalData, userName);
  console.log(normalReport);
  console.log('\n----------------------------------------------------------------\n');


  console.log("--- 4. [COMMAND: day status (Overloaded, planned hours > 12h)] ---");
  // Exceed 12h (add a 3 hour block to make it 13h)
  await query(`
    INSERT INTO public.study_blocks (user_id, block_id, day_key, subject, planned_minutes, status, planned_start, planned_end)
    VALUES ('moulika', 'test_block_3', $1, 'Geography Optional', 180, 'pending', '20:00', '23:00')
  `, [todayKey]);

  const overloadedData = await progressService.getDailyProgressReport(userId);
  const overloadedReport = reportGeneratorService.generateDailyReport(overloadedData, userName);
  console.log(overloadedReport);
  console.log('\n----------------------------------------------------------------\n');


  // Clean up test blocks and restore real blocks
  await query(`DELETE FROM public.study_blocks WHERE user_id = $1 AND block_id LIKE 'test_block_%'`, [userId]);
  await query(`UPDATE public.study_blocks SET day_key = $2 WHERE user_id = $1 AND day_key = '1970-01-01'`, [userId, todayKey]);

  console.log("================================================================");
  console.log("                    VERIFICATION COMPLETE                       ");
  console.log("================================================================\n");
  process.exit(0);
}

test().catch(err => {
  console.error("Test execution crashed:", err);
  process.exit(1);
});
