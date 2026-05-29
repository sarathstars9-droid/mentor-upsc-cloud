import { query } from './db/index.js';
import * as botCommandService from './services/botCommandService.js';
import * as progressService from './services/progressService.js';
import * as reportGeneratorService from './services/reportGeneratorService.js';

async function testReports() {
  const userId = 'moulika'; // Testing with Moulika
  const userName = "Moulika";

  try {
    console.log("=========================================");
    console.log("1. WEEKLY REPORT");
    console.log("=========================================");
    const weeklyData = await progressService.getWeeklyExecutionSummary(userId);
    console.log(reportGeneratorService.generateWeeklyMentorReport(weeklyData, userName));

    console.log("\n=========================================");
    console.log("2. SUBJECT BREAKDOWN");
    console.log("=========================================");
    const breakdownData = await progressService.getWeeklySubjectBreakdown(userId);
    console.log(reportGeneratorService.generateWeeklySubjectBreakdownReport(breakdownData, userName));

    console.log("\n=========================================");
    console.log("3. PRELIMS STATUS");
    console.log("=========================================");
    const prelimsData = await progressService.getPrelimsStatus(userId);
    console.log(reportGeneratorService.generatePrelimsStatusReport(prelimsData, userName));

    console.log("\n=========================================");
    console.log("4. MAINS STATUS");
    console.log("=========================================");
    const mainsData = await progressService.getMainsStatus(userId);
    console.log(reportGeneratorService.generateMainsStatusReport(mainsData, userName));

    console.log("\n=========================================");
    console.log("5. MONTHLY REPORT");
    console.log("=========================================");
    const monthlyData = await progressService.getMonthlyMentorSummary(userId);
    console.log(reportGeneratorService.generateMonthlyMentorTextReport(monthlyData, userName));

    console.log("\n=========================================");
  } catch (err) {
    console.error("ERROR IN SCRIPT:", err);
  }
}

testReports()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
