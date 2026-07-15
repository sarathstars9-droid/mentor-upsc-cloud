// Set process env to test
process.env.NODE_ENV = 'test';

import { 
  resolveDailyPlanState, 
  getSafeDailyPlanState, 
  shouldSendMissingPlanReminder, 
  buildMissingPlanReminder
} from './services/dailyPlanStateService.js';
import { generateCanonicalGoodMorningReport } from './services/reportGeneratorService.js';
import { buildCanonicalGoodMorningData } from './services/progressNormalizer.js';

console.log("=== Pure Daily Plan State Unit Tests ===");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function runTestCase(name, fn) {
  try {
    fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    console.error(`✘ ${name} failed:`, err.message);
    process.exit(1);
  }
}

// ── 1. Pure Resolver Tests (No DB connection is opened for these) ───────────

runTestCase("stale PLAN_ACCEPTED event (ignored)", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', source_type: 'ocr', title: 'Polity Study' }
    ],
    planEvents: [
      { event_type: 'PLAN_ACCEPTED', metadata_json: { date: '2026-07-14' } } // Stale!
    ]
  });

  assert(result.state === 'AMBIGUOUS', `expected AMBIGUOUS, got ${result.state}`);
});

runTestCase("matching PLAN_ACCEPTED event", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    planEvents: [
      { event_type: 'PLAN_ACCEPTED', metadata_json: { date: '2026-07-15' } }
    ],
    blocks: [
      { id: '1', source_type: 'ocr', title: 'Polity Study' }
    ]
  });

  assert(result.state === 'USER_PLAN_PRESENT', `expected USER_PLAN_PRESENT, got ${result.state}`);
});

runTestCase("acceptance event with missing blocks (empty blocks list -> AMBIGUOUS)", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [],
    planEvents: [
      { event_type: 'PLAN_ACCEPTED', metadata_json: { date: '2026-07-15' } }
    ]
  });

  assert(result.state === 'AMBIGUOUS', `expected AMBIGUOUS, got ${result.state}`);
});

runTestCase("genuine uploaded_plan blocks", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', source_type: 'uploaded_plan', title: 'Geography study' }
    ],
    planEvents: []
  });

  assert(result.state === 'USER_PLAN_PRESENT', `expected USER_PLAN_PRESENT, got ${result.state}`);
});

runTestCase("genuine OCR upload with proven acceptance", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', source_type: 'ocr', title: 'Ethics review' }
    ],
    planEvents: [
      { event_type: 'PLAN_ACCEPTED', metadata_json: { date: '2026-07-15' } }
    ]
  });

  assert(result.state === 'USER_PLAN_PRESENT', `expected USER_PLAN_PRESENT, got ${result.state}`);
});

runTestCase("unproven OCR block", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', source_type: 'ocr', title: 'Ethics review' }
    ],
    planEvents: [] // Missing acceptance event!
  });

  assert(result.state === 'AMBIGUOUS', `expected AMBIGUOUS, got ${result.state}`);
});

runTestCase("OCR recovery + matching PLAN_ACCEPTED remains RECOVERY_ONLY", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', source_type: 'ocr', block_type: 'recovery', title: 'Recovery: Polity' }
    ],
    planEvents: [
      { event_type: 'PLAN_ACCEPTED', metadata_json: { date: '2026-07-15' } }
    ]
  });

  assert(result.state === 'RECOVERY_ONLY', `expected RECOVERY_ONLY, got ${result.state}`);
});

runTestCase("unknown block + matching PLAN_ACCEPTED remains AMBIGUOUS", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', title: 'Unknown task format' }
    ],
    planEvents: [
      { event_type: 'PLAN_ACCEPTED', metadata_json: { date: '2026-07-15' } }
    ]
  });

  assert(result.state === 'AMBIGUOUS', `expected AMBIGUOUS, got ${result.state}`);
});

runTestCase("recovery + system suggestion becomes SYSTEM_PLAN_ONLY", () => {
  const result = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', block_type: 'recovery', title: 'Recovery Task' },
      { id: '2', source_type: 'system', title: 'Suggested History' }
    ],
    planEvents: []
  });

  assert(result.state === 'SYSTEM_PLAN_ONLY', `expected SYSTEM_PLAN_ONLY, got ${result.state}`);
});

runTestCase("recovery task completed but no full plan -> 9 AM reminder still required", () => {
  const planState = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks: [
      { id: '1', block_type: 'recovery', title: 'Recovery Task' }
    ],
    planEvents: []
  });

  const shouldSend = shouldSendMissingPlanReminder(planState);
  assert(shouldSend === true, "should send 9 AM reminder even if recovery task exists/is completed");
});

runTestCase("recovery block classification boundaries (hasUserPlan vs hasActionableBlocks)", () => {
  const planState = resolveDailyPlanState({
    userId: 'test_user', dayKey: '2026-07-15',
    blocks: [{ id: '1', block_type: 'recovery' }]
  });

  const hasUserPlan = planState.state === 'USER_PLAN_PRESENT';
  const hasActionableBlocks = planState.state === 'USER_PLAN_PRESENT' || 
                               planState.state === 'RECOVERY_ONLY' || 
                               planState.state === 'SYSTEM_PLAN_ONLY';

  assert(hasUserPlan === false, "recovery block must never satisfy hasUserPlan");
  assert(hasActionableBlocks === true, "recovery block must satisfy hasActionableBlocks");
});

// ── 2. Decision Helper Tests ─────────────────────────────────────────────

runTestCase("real exported 6 AM and 9 AM decision helpers", () => {
  const stateUser = { state: 'USER_PLAN_PRESENT' };
  const stateNo = { state: 'NO_PLAN' };
  
  assert(!shouldSendMissingPlanReminder(stateUser), "should suppress reminder when user plan present");
  assert(shouldSendMissingPlanReminder(stateNo), "should send reminder when no plan");
});

runTestCase("dynamic display name / missing display name in messages", () => {
  const planState = { state: 'NO_PLAN' };
  const msg1 = buildMissingPlanReminder({ planState, userName: 'Moulika', notificationType: 'PLAN_NOT_UPLOADED' });
  assert(msg1.includes("Good morning Moulika"), "Missing dynamic name in 6 AM reminder");

  const msg2 = buildMissingPlanReminder({ planState, userName: '', notificationType: 'PLAN_NOT_UPLOADED' });
  assert(msg2.includes("Good morning User"), "Failed to fallback to User when userName is empty");
  assert(!msg2.includes("Moulika"), "Should not default to Moulika when missing");
});

// ── 3. 5 AM Good Morning Report Formatting Tests ─────────────────────────────

runTestCase("5 AM report templates for all states", () => {
  const baseData = {
    yesterdayVerifiedSeconds: 3600,
    last7DaysVerifiedSeconds: 7200,
    immediateAction: "Study Polity"
  };

  // USER_PLAN_PRESENT
  const msgUser = generateCanonicalGoodMorningReport({ ...baseData, planState: { state: 'USER_PLAN_PRESENT' } }, 'User');
  assert(msgUser.includes("Today’s plan is ready ✅"), "USER_PLAN_PRESENT text wrong");

  // RECOVERY_ONLY
  const msgRec = generateCanonicalGoodMorningReport({ ...baseData, planState: { state: 'RECOVERY_ONLY' } }, 'User');
  assert(msgRec.includes("Today’s plan has not been uploaded yet."), "RECOVERY_ONLY plan text wrong");
  assert(msgRec.includes("A recovery task is available"), "RECOVERY_ONLY recovery text wrong");

  // SYSTEM_PLAN_ONLY
  const msgSys = generateCanonicalGoodMorningReport({ ...baseData, planState: { state: 'SYSTEM_PLAN_ONLY' } }, 'User');
  assert(msgSys.includes("MentorOS has prepared suggested tasks"), "SYSTEM_PLAN_ONLY text wrong");

  // NO_PLAN
  const msgNo = generateCanonicalGoodMorningReport({ ...baseData, planState: { state: 'NO_PLAN' } }, 'User');
  assert(msgNo.includes("Upload your study plan so MentorOS can organise your blocks"), "NO_PLAN text wrong");

  // AMBIGUOUS
  const msgAmb = generateCanonicalGoodMorningReport({ ...baseData, planState: { state: 'AMBIGUOUS' } }, 'User');
  assert(msgAmb.includes("MentorOS could not confirm today’s plan."), "AMBIGUOUS text wrong");
});

runTestCase("first action selection is state-aware (provenance filtering)", () => {
  // Scenario 1: USER_PLAN_PRESENT with both recovery and user-plan block.
  // The earliest block overall is a recovery block (07:00), but a genuine user block exists at 08:00.
  // The first action must select the earliest genuine USER block (History at 08:00), NOT the recovery block.
  const planStateUser = resolveDailyPlanState({
    userId: 'u', dayKey: '2026-07-15',
    blocks: [
      { id: '1', block_type: 'recovery', title: 'Recovery Block' },
      { id: '2', source_type: 'uploaded_plan', title: 'GS2 Topic' }
    ]
  });

  const todayBlocks = [
    { id: '1', block_type: 'recovery', status: 'planned', planned_minutes: 60, planned_start: '07:00', subject: 'Polity' },
    { id: '2', source_type: 'uploaded_plan', status: 'planned', planned_minutes: 60, planned_start: '08:00', subject: 'History' }
  ];

  const dataUser = buildCanonicalGoodMorningData({
    now: new Date('2026-07-15T05:00:00Z'),
    user: { name: 'User' },
    todayBlocks,
    planState: planStateUser
  });

  assert(dataUser.immediateAction.includes("History"), "USER_PLAN_PRESENT must select the earliest user plan block (History), not recovery");
  assert(dataUser.immediateAction.includes("08:00"), "USER_PLAN_PRESENT must start at 08:00");

  // Scenario 2: RECOVERY_ONLY
  // Must select the recovery block at 07:00.
  const planStateRec = resolveDailyPlanState({
    userId: 'u', dayKey: '2026-07-15',
    blocks: [
      { id: '1', block_type: 'recovery', title: 'Recovery Block' }
    ]
  });

  const dataRec = buildCanonicalGoodMorningData({
    now: new Date('2026-07-15T05:00:00Z'),
    user: { name: 'User' },
    todayBlocks: [
      { id: '1', block_type: 'recovery', status: 'planned', planned_minutes: 60, planned_start: '07:00', subject: 'Polity' }
    ],
    planState: planStateRec
  });

  assert(dataRec.immediateAction.includes("Polity"), "RECOVERY_ONLY must select the recovery block (Polity)");
  assert(dataRec.immediateAction.includes("07:00"), "RECOVERY_ONLY must start at 07:00");

  // Scenario 3: SYSTEM_PLAN_ONLY
  // Must select the suggested system block at 09:00.
  const planStateSys = resolveDailyPlanState({
    userId: 'u', dayKey: '2026-07-15',
    blocks: [
      { id: '1', source_type: 'system', title: 'System Suggestion' }
    ]
  });

  const dataSys = buildCanonicalGoodMorningData({
    now: new Date('2026-07-15T05:00:00Z'),
    user: { name: 'User' },
    todayBlocks: [
      { id: '1', source_type: 'system', status: 'planned', planned_minutes: 60, planned_start: '09:00', subject: 'Geography' }
    ],
    planState: planStateSys
  });

  assert(dataSys.immediateAction.includes("Geography"), "SYSTEM_PLAN_ONLY must select the system block (Geography)");
  assert(dataSys.immediateAction.includes("09:00"), "SYSTEM_PLAN_ONLY must start at 09:00");
});

runTestCase("Verified progress totals remain unchanged", () => {
  const blocks = [
    { id: '1', day_key: '2026-07-15', status: 'completed', started_at: '2026-07-15T10:00:00Z', ended_at: '2026-07-15T11:00:00Z', planned_minutes: 60, actual_minutes: 60 }
  ];
  const logs = [
    { block_id: '1', completion_status: 'completed', started_at: '2026-07-15T10:00:00Z', ended_at: '2026-07-15T11:00:00Z', actual_minutes: 60 }
  ];
  const events = [
    { block_id: '1', event_type: 'BLOCK_COMPLETED' }
  ];

  const planState = resolveDailyPlanState({
    userId: 'test_user',
    dayKey: '2026-07-15',
    blocks,
    planEvents: []
  });

  const data = buildCanonicalGoodMorningData({
    now: new Date('2026-07-15T05:00:00Z'),
    user: { name: 'User' },
    todayBlocks: blocks,
    yesterdayBlocks: blocks,
    sevenDayBlocks: blocks,
    logs,
    events,
    planState
  });

  assert(data.yesterdayVerifiedSeconds === 3600, "verified seconds should remain 3600");
  assert(data.last7DaysVerifiedSeconds === 3600, "7-day verified seconds should remain 3600");
});

runTestCase("getDailyPlanState failure -> AMBIGUOUS fallback (pure query mock)", async () => {
  // Inject mock queryFn to throw an error
  const fakeQueryFn = () => {
    throw new Error("Simulated Query Exception");
  };

  const fallbackState = await getSafeDailyPlanState({ userId: 'u', dayKey: '2026-07-15', queryFn: fakeQueryFn });

  assert(fallbackState.state === 'AMBIGUOUS', `expected AMBIGUOUS, got ${fallbackState.state}`);
  assert(fallbackState.diagnosticReason === 'PLAN_STATE_RESOLUTION_FAILED', "expected plan state resolution failed diagnostic reason");

  // 5 AM check formatting for fallback
  const reportData = buildCanonicalGoodMorningData({
    now: new Date('2026-07-15T05:00:00Z'),
    user: { name: 'User' },
    todayBlocks: [],
    planState: fallbackState
  });
  const morningMsg = generateCanonicalGoodMorningReport(reportData, 'User');
  assert(morningMsg.includes("MentorOS could not confirm today’s plan."), "morning report must use fallback text");
  assert(!morningMsg.includes("Today's blocks: Available"), "morning report fallback must never say Available");

  // 6 AM & 9 AM checks formatting for fallback
  const shouldSend6 = shouldSendMissingPlanReminder(fallbackState);
  assert(shouldSend6 === true, "fallback state must send 6 AM reminder");
  const msg6 = buildMissingPlanReminder({ planState: fallbackState, userName: 'User', notificationType: 'PLAN_NOT_UPLOADED' });
  assert(msg6.includes("Today’s full study plan is still not uploaded."), "6 AM fallback missing prompt");

  const shouldSend9 = shouldSendMissingPlanReminder(fallbackState);
  assert(shouldSend9 === true, "fallback state must send 9 AM reminder");
  const msg9 = buildMissingPlanReminder({ planState: fallbackState, userName: 'User', notificationType: 'NO_PLAN_STRICT_9AM' });
  assert(msg9.includes("Your study plan is still pending."), "9 AM fallback missing prompt");
});

console.log("\nALL TESTS PASSED SUCCESSFULLY!");
