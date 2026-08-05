import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMentorCommand } from '../services/mentorStateService.js';
import { MOULIKA_PROFILE } from '../services/mentorProfile.js';

test('Pure Mentor State Command Builder', async (t) => {
  await t.test('Stale recovery has highest priority', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [],
      staleBlock: { subject: 'History' },
      activeBlock: { subject: 'Polity' },
      pausedBlock: null,
      hasPreviousDayLeakage: false
    });
    assert.strictEqual(cmd.title, 'Stale Session Recovery Required');
  });

  await t.test('Active block comes before paused', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [],
      staleBlock: null,
      activeBlock: { subject: 'Polity' },
      pausedBlock: { subject: 'History' },
      hasPreviousDayLeakage: true
    });
    assert.strictEqual(cmd.title, 'Active Block in Progress');
  });

  await t.test('Paused comes before previous-day leakage', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [{}],
      staleBlock: null,
      activeBlock: null,
      pausedBlock: { subject: 'History' },
      hasPreviousDayLeakage: true
    });
    assert.strictEqual(cmd.title, 'Paused Block Waiting');
  });

  await t.test('Previous-day leakage comes before CSAT', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [{ subject: 'CSAT' }],
      staleBlock: null,
      activeBlock: null,
      pausedBlock: null,
      hasPreviousDayLeakage: true
    });
    assert.strictEqual(cmd.title, 'Previous Day Leakage');
  });

  await t.test('CSAT comes before revision', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [{ subject: 'Revision' }, { subject: 'CSAT' }],
      staleBlock: null,
      activeBlock: null,
      pausedBlock: null,
      hasPreviousDayLeakage: false
    });
    assert.strictEqual(cmd.title, 'CSAT Risk');
  });

  await t.test('Revision comes before first pending block', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [{ subject: 'History' }, { subject: 'Revision' }],
      staleBlock: null,
      activeBlock: null,
      pausedBlock: null,
      hasPreviousDayLeakage: false
    });
    assert.strictEqual(cmd.title, 'Revision Due');
  });

  await t.test('No-plan state', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [],
      pendingBlocks: [],
      staleBlock: null,
      activeBlock: null,
      pausedBlock: null,
      hasPreviousDayLeakage: false
    });
    assert.strictEqual(cmd.title, 'No Accepted Plan');
  });

  await t.test('Day-complete state', () => {
    const cmd = buildMentorCommand({
      profile: MOULIKA_PROFILE,
      blocks: [{}],
      pendingBlocks: [],
      staleBlock: null,
      activeBlock: null,
      pausedBlock: null,
      hasPreviousDayLeakage: false
    });
    assert.strictEqual(cmd.title, 'Day Complete');
  });
});
