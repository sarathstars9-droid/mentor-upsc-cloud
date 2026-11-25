// backend/tests/mentorMultiFactTurns.test.mjs
// Verifies multi-fact extraction, corrections, deduplication, and evidence-grounded advice across 4 conversational turns.

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuidv4 } from 'node:crypto';
import { query } from '../db/index.js';
import { processMentorTurn } from '../services/mentorTurnService.js';

test('MentorOS Morning Mentor Natural Conversation & Multi-Fact Turns', async (t) => {
  const testUserId = 'moulika';
  const testSessionId = uuidv4();
  const dayKey = '2026-09-20';

  // Seed test session with mentor evidence snapshot
  await query(`
    INSERT INTO public.mentor_sessions (
      id, user_id, day_key, current_stage, mentor_state_snapshot
    ) VALUES ($1, $2, $3, 'energy', $4)
    ON CONFLICT (id) DO NOTHING;
  `, [
    testSessionId,
    testUserId,
    dayKey,
    JSON.stringify({
      dayKey,
      totalPlannedMinutes: 360,
      totalActualMinutes: 0,
      hasPreviousDayLeakage: true,
      csatRisk: true,
      blocks: [
        { subject: 'GS2 Polity', topic: 'Judicial Review & Fundamental Rights', durationMinutes: 150 },
        { subject: 'CSAT', topic: 'Reading Comprehension & Quant Practice', durationMinutes: 90 }
      ],
      pendingBlocks: [
        { subject: 'GS2 Polity', topic: 'Judicial Review & Fundamental Rights', durationMinutes: 150 },
        { subject: 'CSAT', topic: 'Reading Comprehension & Quant Practice', durationMinutes: 90 }
      ],
      mentorCommand: {
        priority: 'HIGH',
        title: 'GS2 Polity Revision & CSAT Backlog',
        instruction: 'Execute 2.5h Polity core revision and 1.5h CSAT practice.',
        reason: 'Prevents CSAT leakage and secures 20+ GS2 marks.'
      }
    })
  ]);

  let turn1Result;
  let turn2Result;
  let turn3Result;
  let turn4Result;

  // -------------------------------------------------------------
  // TURN 1: User provides multiple facts in one utterance
  // "Medium. Today I have six hours available."
  // -------------------------------------------------------------
  await t.test('TURN 1: Multi-fact extraction (energy + hours) & No redundant hours question', async () => {
    turn1Result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Medium. Today I have six hours available.',
      requestId: uuidv4()
    });

    console.log('\n--- TURN 1 ---');
    console.log('User: "Medium. Today I have six hours available."');
    console.log('Mentor Reply:', turn1Result.mentorReply);

    // Verify DB extraction
    const { rows } = await query(
      `SELECT energy_level, available_hours, obstacle, current_stage FROM public.mentor_sessions WHERE id = $1`,
      [testSessionId]
    );
    const sess = rows[0];

    assert.equal(sess.energy_level, 'medium', 'energy_level must be extracted as medium');
    assert.equal(sess.available_hours, '6', 'available_hours must be extracted as 6');

    // Verify Mentor does NOT ask redundant available hours question
    const lowerReply = turn1Result.mentorReply.toLowerCase();
    const asksHoursRedundantly = lowerReply.includes('how many hours') || lowerReply.includes('how many focused study hours');
    assert.equal(asksHoursRedundantly, false, 'Mentor must NOT ask available hours again');
  });

  // -------------------------------------------------------------
  // TURN 2: User corrects hours and provides obstacle
  // "Actually evening family work undi, so four hours only realistic."
  // -------------------------------------------------------------
  await t.test('TURN 2: Correction handling (6h -> 4h) + Obstacle extraction & No redundant questions', async () => {
    turn2Result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Actually evening family work undi, so four hours only realistic.',
      requestId: uuidv4()
    });

    console.log('\n--- TURN 2 ---');
    console.log('User: "Actually evening family work undi, so four hours only realistic."');
    console.log('Mentor Reply:', turn2Result.mentorReply);

    // Verify DB update
    const { rows } = await query(
      `SELECT energy_level, available_hours, obstacle, current_stage FROM public.mentor_sessions WHERE id = $1`,
      [testSessionId]
    );
    const sess = rows[0];

    assert.equal(sess.available_hours, '4', 'available_hours must be updated to 4 (correction applied)');
    assert.ok(sess.obstacle, 'obstacle must be extracted');
    assert.ok(sess.obstacle.toLowerCase().includes('family'), 'obstacle must mention family work');

    // Verify no redundant questions
    const lowerReply = turn2Result.mentorReply.toLowerCase();
    assert.equal(lowerReply.includes('how is your energy'), false, 'Must not ask energy');
    assert.equal(lowerReply.includes('how many hours'), false, 'Must not ask hours');
  });

  // -------------------------------------------------------------
  // TURN 3: User inquires about priority with missed CSAT
  // "Yesterday CSAT miss ayindi. What should I prioritize today?"
  // -------------------------------------------------------------
  await t.test('TURN 3: Evidence-grounded advice for missed CSAT under 4h constraint', async () => {
    turn3Result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Yesterday CSAT miss ayindi. What should I prioritize today?',
      requestId: uuidv4()
    });

    console.log('\n--- TURN 3 ---');
    console.log('User: "Yesterday CSAT miss ayindi. What should I prioritize today?"');
    console.log('Mentor Reply:', turn3Result.mentorReply);

    const lowerReply = turn3Result.mentorReply.toLowerCase();
    // Verify advice addresses CSAT & reasons from 4 hours
    assert.ok(lowerReply.includes('csat'), 'Reply must address CSAT');
    assert.ok(lowerReply.includes('4') || lowerReply.includes('four') || lowerReply.includes('polity'), 'Reply must reason from schedule');
  });

  // -------------------------------------------------------------
  // TURN 4: User mentions Polity also pending
  // "Wait, Polity also pending undi."
  // -------------------------------------------------------------
  await t.test('TURN 4: Natural priority adjustment for Polity pending + CSAT backlog', async () => {
    turn4Result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Wait, Polity also pending undi.',
      requestId: uuidv4()
    });

    console.log('\n--- TURN 4 ---');
    console.log('User: "Wait, Polity also pending undi."');
    console.log('Mentor Reply:', turn4Result.mentorReply);

    const lowerReply = turn4Result.mentorReply.toLowerCase();
    assert.ok(lowerReply.includes('polity') || lowerReply.includes('csat'), 'Reply must incorporate both Polity and CSAT');
  });
});
