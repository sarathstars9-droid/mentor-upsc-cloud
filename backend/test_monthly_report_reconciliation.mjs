import assert from 'assert';
import { getCanonicalMonthlyReportDataset } from './services/reportExecutionSummaryService.js';

// Mock DB queries for testing reconciliation
async function mockQuerySuccess(sql, params) {
  if (sql.includes('study_blocks') && sql.includes('day_key >= $2')) {
    // Return mock study blocks for July 2026
    return {
      rows: [
        {
          id: 'block-july-1',
          block_id: 'b-july-1',
          day_key: '2026-07-10',
          subject: 'Geography Optional',
          planned_minutes: 60,
          actual_minutes: 60,
          status: 'completed',
          started_at: '2026-07-10T09:00:00Z',
          ended_at: '2026-07-10T10:00:00Z',
          total_pause_seconds: 0
        },
        {
          id: 'block-july-2',
          block_id: 'b-july-2',
          day_key: '2026-07-11',
          subject: 'Geography Optional',
          planned_minutes: 66,
          actual_minutes: 66,
          status: 'completed',
          started_at: '2026-07-11T09:00:00Z',
          ended_at: '2026-07-11T10:06:00Z',
          total_pause_seconds: 0
        }
      ]
    };
  }
  if (sql.includes('block_logs')) {
    return { rows: [] };
  }
  if (sql.includes('study_events')) {
    return { rows: [] };
  }
  if (sql.includes('subject_targets')) {
    return {
      rows: [
        { subject: 'Geography Optional', target_hours: 500, mission_start_date: '2026-05-25', mission_end_date: '2027-04-15', total_target: 3500 }
      ]
    };
  }
  if (sql.includes('study_blocks')) {
    // All-time blocks
    return {
      rows: [
        {
          id: 'block-july-1',
          block_id: 'b-july-1',
          day_key: '2026-07-10',
          subject: 'Geography Optional',
          planned_minutes: 60,
          actual_minutes: 60,
          status: 'completed',
          started_at: '2026-07-10T09:00:00Z',
          ended_at: '2026-07-10T10:00:00Z',
          total_pause_seconds: 0
        },
        {
          id: 'block-july-2',
          block_id: 'b-july-2',
          day_key: '2026-07-11',
          subject: 'Geography Optional',
          planned_minutes: 66,
          actual_minutes: 66,
          status: 'completed',
          started_at: '2026-07-11T09:00:00Z',
          ended_at: '2026-07-11T10:06:00Z',
          total_pause_seconds: 0
        }
      ]
    };
  }
  return { rows: [] };
}

async function runReconciliationTests() {
  console.log("=== Running Monthly Reconciliation Tests ===");

  // 1. Assert separate monthly and lifetime values, and no 0m headline with 2h 6m subject execution
  {
    const dataset = await getCanonicalMonthlyReportDataset({ userId: 'user-1', monthKey: '2026-07', queryFn: mockQuerySuccess });
    
    // Total execution is 60 + 66 = 126 minutes (2h 6m = 7560 seconds)
    assert.strictEqual(dataset.thisMonth.recordedSeconds, 7560, "Headline should show 7560 seconds (2h 6m)");
    
    const geoSub = dataset.thisMonth.subjects.find(s => s.subject === 'Geography Optional');
    assert.ok(geoSub, "Geography Optional should be in subject list");
    assert.strictEqual(geoSub.recordedSeconds, 7560, "Subject execution should match headline total");
    
    // Ensure separate from cumulative (missionToDate)
    assert.strictEqual(dataset.missionToDate.cumulativeCompletedHours, 2.1); // 126 mins = 2.1 hours
    
    console.log("✓ Test 1 Passed: Separated monthly vs lifetime figures, correct July totals");
  }

  // 2. Reconciliation failure simulation
  {
    const mockDataset = {
      monthKey: '2026-07',
      thisMonth: {
        recordedSeconds: 5000,
        subjects: [
          { subject: 'Geography Optional', recordedSeconds: 4000 } // Divergence of 1000s!
        ]
      }
    };

    const runReconciliationCheck = (dataset) => {
      const sumSubjectSeconds = dataset.thisMonth.subjects.reduce((sum, s) => sum + s.recordedSeconds, 0);
      if (sumSubjectSeconds !== dataset.thisMonth.recordedSeconds) {
        throw new Error("MONTHLY_RECONCILIATION_FAILED");
      }
    };

    assert.throws(() => runReconciliationCheck(mockDataset), /MONTHLY_RECONCILIATION_FAILED/);
    console.log("✓ Test 2 Passed: Reconciliation mismatch correctly throws error");
  }

  console.log("All monthly report reconciliation tests passed!");
}

runReconciliationTests();
