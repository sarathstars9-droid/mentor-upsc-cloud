import { getReportsDashboardData } from './services/reportsDashboardService.js';

async function runTests() {
  console.log('=== RUNNING REPORTS DASHBOARD SERVICE TESTS ===');

  // Test 1: Check validation for a non-existent test user (should return clean empty state, not crash)
  try {
    const data = await getReportsDashboardData('nonexistent_user_xyz_123', 'week', 'all');
    console.log('Test 1 (Empty State) - SUCCESS');
    if (data.execution.plannedBlocks !== 0 || data.answers.totalWritten !== 0 || data.mistakes.totalOpen !== 0) {
      throw new Error('Expected zeroed KPIs for non-existent user');
    }
  } catch (err) {
    console.error('Test 1 (Empty State) - FAILED:', err.message);
    process.exit(1);
  }

  // Test 2: Check query outputs for default user 'moulika' across ranges
  const ranges = ['today', 'week', 'month', 'all'];
  for (const range of ranges) {
    try {
      const data = await getReportsDashboardData('moulika', range, 'all');
      console.log(`Test 2 (Range: ${range}) - SUCCESS`);
      console.log(`  - Execution Rate: ${data.execution.executionRate}%`);
      console.log(`  - Avg Score: ${data.answers.averageScore}`);
      console.log(`  - Open Mistakes: ${data.mistakes.totalOpen}`);
      console.log(`  - Overdue Revisions: ${data.revisions.overdue}`);
      console.log(`  - Prescription length: ${data.prescription.length}`);
    } catch (err) {
      console.error(`Test 2 (Range: ${range}) - FAILED:`, err.message);
      process.exit(1);
    }
  }

  // Test 3: Check query outputs for different papers
  const papers = ['GS1', 'Essay', 'Ethics', 'Geography Optional'];
  for (const paper of papers) {
    try {
      const data = await getReportsDashboardData('moulika', 'all', paper);
      console.log(`Test 3 (Paper: ${paper}) - SUCCESS`);
      console.log(`  - Mistakes: ${data.mistakes.totalOpen}`);
      console.log(`  - Revisions Due: ${data.revisions.dueToday}`);
    } catch (err) {
      console.error(`Test 3 (Paper: ${paper}) - FAILED:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n=== ALL REPORTS DASHBOARD TESTS PASSED ===');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite crashed:', err);
  process.exit(1);
});
