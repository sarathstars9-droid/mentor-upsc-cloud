import { query } from './db/index.js';
import * as progressService from './services/progressService.js';
import * as reportGeneratorService from './services/reportGeneratorService.js';
import { normalizeCommand } from './services/botCommandService.js';

async function runTests() {
  console.log("=== STARTING PROGRESS SYSTEM VERIFICATION ===");

  try {
    const users = ['moulika', 'user_1'];

    for (const userId of users) {
      console.log(`\n================== USER: ${userId} ==================`);
      
      // 1. Verify Seed Targets
      console.log("\n1. Verifying Seed Targets in DB...");
      const targetsRes = await query(
        `SELECT * FROM public.subject_targets WHERE user_id = $1 ORDER BY subject ASC`,
        [userId]
      );
      console.log(`Found ${targetsRes.rows.length} seeded subject targets for '${userId}'.`);
      for (const r of targetsRes.rows) {
        console.log(` - Subject: ${r.subject} | Target Hours: ${r.target_hours}h | Mission: ${r.mission_start_date.toISOString().substring(0,10)} to ${r.mission_end_date.toISOString().substring(0,10)}`);
      }

      // 2. Test progressService: getAreaProgress for Geography Optional
      console.log(`\n2. Testing getAreaProgress('${userId}', 'Geography Optional')...`);
      const geoProgress = await progressService.getAreaProgress(userId, "Geography Optional");
      console.log("Geography Optional Progress Calculations:", geoProgress);

      // 3. Test reportGeneratorService: generateAreaReport
      console.log("\n3. Testing generateAreaReport with Geography Optional data...");
      const geoReport = reportGeneratorService.generateAreaReport(geoProgress);
      console.log("--- Geography Optional Report Output ---");
      console.log(geoReport);
      console.log("----------------------------------------");

      // 4. Test HTML conversion formatting
      console.log("\n4. Testing Telegram HTML Converter output...");
      const { convertMarkdownToHtml } = await import('./services/telegramService.js');
      const htmlOutput = convertMarkdownToHtml(geoReport);
      console.log("--- HTML Output for Telegram ---");
      console.log(htmlOutput);
      console.log("--------------------------------");

      // 5. Test progressService: getDailyProgressReport
      console.log("\n5. Testing getDailyProgressReport()...");
      const dailyData = await progressService.getDailyProgressReport(userId);
      console.log("Daily Progress Aggregate:", {
        date: dailyData.date,
        total_blocks: dailyData.total_blocks,
        started_blocks: dailyData.started_blocks,
        completed_blocks: dailyData.completed_blocks,
        total_actual_hours: dailyData.total_actual_hours,
        streak: dailyData.streak
      });

      // 6. Test progressService: getWeeklyProgressReport
      console.log("\n6. Testing getWeeklyProgressReport()...");
      const weeklyData = await progressService.getWeeklyProgressReport(userId);
      console.log("Weekly Progress Aggregate:", {
        total_target: weeklyData.total_target,
        completed_till_now: weeklyData.completed_till_now,
        remaining: weeklyData.remaining,
        deficit: weeklyData.deficit,
        readiness_percent: weeklyData.readiness_percent
      });
    }

    // 7. Test command normalization in botCommandService
    console.log("\n7. Testing Command Normalization...");
    const testCommands = [
      "/syllabus_track",
      "geography status",
      "optional left",
      "/today_report",
      "CSAT STATUS",
      "how much left"
    ];
    for (const cmd of testCommands) {
      console.log(` - Raw: "${cmd}" => Normalized: "${normalizeCommand(cmd)}"`);
    }

    console.log("\n=== VERIFICATION SUCCESSFULLY COMPLETED ===");
    process.exit(0);

  } catch (err) {
    console.error("❌ Verification Failed:", err);
    process.exit(1);
  }
}

runTests();
