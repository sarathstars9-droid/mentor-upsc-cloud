import { query } from './db/index.js';
import * as progressService from './services/progressService.js';
import * as reportGeneratorService from './services/reportGeneratorService.js';

async function run() {
  const userId = 1;
  const subjects = await progressService.getAllSubjectProgress(userId);
  console.log("Subjects length:", subjects.length);
  const weeklyData = await progressService.getWeeklyExecutionSummary(userId);
  console.log("weeklyData:", weeklyData);
  process.exit(0);
}

run().catch(console.error);
