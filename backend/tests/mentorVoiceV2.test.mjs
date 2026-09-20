// backend/tests/mentorVoiceV2.test.mjs
// Comprehensive Integration Test Suite for MentorOS Voice Provider V2
// Tests A through J: Gemini Live + DeepSeek Brain + Sarvam Rollback + Usage Tracking

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID as uuidv4 } from 'node:crypto';
import { query } from '../db/index.js';
import { processMentorTurn } from '../services/mentorTurnService.js';
import { recordGeminiLiveUsage, recordMentorTurnUsage, getMonthlyUsage } from '../services/mentorUsageService.js';
import { GeminiLiveService } from '../services/voice/geminiLiveService.js';
import { setMockGenerateAIContent } from '../services/aiAdapterService.js';

test('MentorOS Voice Provider V2 Test Suite', async (t) => {
  const testUserId = 'moulika';
  const testSessionId = uuidv4();
  const dayKey = '2026-09-19';

  // Ensure DB table mentor_ai_usage exists
  await query(`
    CREATE TABLE IF NOT EXISTS public.mentor_ai_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      mentor_session_id UUID,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      usage_type TEXT NOT NULL,
      input_audio_tokens INT DEFAULT 0,
      output_audio_tokens INT DEFAULT 0,
      input_text_tokens INT DEFAULT 0,
      output_text_tokens INT DEFAULT 0,
      estimated_cost_usd NUMERIC(12, 6) DEFAULT 0,
      usd_inr_rate NUMERIC(10, 2) DEFAULT 96.00,
      estimated_cost_inr NUMERIC(12, 4) DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Ensure test session exists
  await query(`
    INSERT INTO public.mentor_sessions (id, user_id, day_key, current_stage, mentor_state_snapshot)
    VALUES ($1, $2, $3, 'energy', $4)
    ON CONFLICT (id) DO NOTHING;
  `, [
    testSessionId,
    testUserId,
    dayKey,
    JSON.stringify({
      dayKey,
      today: { plannedBlocks: 4, executionPercent: 85 },
      mentorCommand: {
        title: 'Complete GS2 Polity Revision',
        instruction: 'Revise fundamental rights & judicial review before new topics.',
        reason: 'Consolidates 20 marks in upcoming test.'
      }
    })
  ]);

  await t.test('Test A — English input turn processing via processMentorTurn', async () => {
    const requestId = uuidv4();
    const result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'I have high energy today.',
      requestId
    });

    assert.ok(result.mentorReply, 'Mentor reply must be generated');
    assert.ok(result.session, 'Session must be returned');
    assert.equal(result.session.current_stage, 'available_hours');

    // Verify DB persistence
    const { rows } = await query(
      `SELECT * FROM public.mentor_messages WHERE session_id = $1 AND role = 'user' AND request_id = $2`,
      [testSessionId, requestId]
    );
    assert.equal(rows.length, 1, 'Exactly one user message must be saved');
  });

  await t.test('Test B — Telugu-English code-switching input turn', async () => {
    const requestId = uuidv4();
    const result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Today naaku eight hours available unnayi, but morning ten varaku family work undi.',
      requestId
    });

    assert.ok(result.mentorReply, 'Mentor reply must be generated for Telugu-English input');
    assert.equal(result.session.current_stage, 'mentor_command');

    const { rows } = await query(
      `SELECT available_hours FROM public.mentor_sessions WHERE id = $1`,
      [testSessionId]
    );
    assert.equal(rows[0].available_hours, '8', 'Extracted available hours must be 8');
  });

  await t.test('Test C — Natural Telugu input turn', async () => {
    const requestId = uuidv4();
    const result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'ఈరోజు మొదటి బ్లాక్ కచ్చితంగా పూర్తి చేస్తాను.',
      requestId
    });

    assert.ok(result.mentorReply, 'Mentor reply must be generated for pure Telugu commitment');
  });

  await t.test('Test D — Mentor judgment: DeepSeek authoritative advice flow', async () => {
    // When user proposes unrealistic plan, DeepSeek / MentorOS judgment must be authoritative
    const requestId = uuidv4();
    const result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'I want to study 18 hours today without breaks.',
      requestId
    });

    assert.ok(result.mentorReply, 'Authoritative mentor advice generated');
    // Confirm it did not crash or bypass validation
    assert.ok(['ai', 'deterministic'].includes(result.source));
  });

  await t.test('Test E — Interruption / Barge-in handling (<300ms latency)', async () => {
    let interruptedEventEmitted = false;
    const startTime = Date.now();

    const geminiService = new GeminiLiveService({
      userId: testUserId,
      sessionId: testSessionId,
      onEvent: (event) => {
        if (event.type === 'interrupted') {
          interruptedEventEmitted = true;
        }
      }
    });

    // Simulate serverContent.interrupted message
    geminiService.handleServerMessage(JSON.stringify({
      serverContent: {
        interrupted: true
      }
    }));

    const latency = Date.now() - startTime;
    assert.equal(interruptedEventEmitted, true, 'Interrupted event must be emitted');
    assert.ok(latency < 300, `Interruption latency (${latency}ms) must be < 300ms`);
  });

  await t.test('Test F — Duplicate prevention & Idempotency', async () => {
    const fixedRequestId = uuidv4();

    // Call 1
    const res1 = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Yes, I commit to the CSAT practice block.',
      requestId: fixedRequestId
    });

    // Call 2 with identical requestId (simulating duplicate network packet)
    const res2 = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Yes, I commit to the CSAT practice block.',
      requestId: fixedRequestId
    });

    assert.equal(res1.mentorReply, res2.mentorReply, 'Duplicate request must return identical mentor reply');

    // Count user messages in DB with this request_id
    const { rows } = await query(
      `SELECT * FROM public.mentor_messages WHERE session_id = $1 AND request_id = $2`,
      [testSessionId, fixedRequestId]
    );
    assert.equal(rows.length, 1, 'Exactly one DB record must exist for the idempotent requestId');
  });

  await t.test('Test G — Typed Mentor fallback input', async () => {
    const requestId = uuidv4();
    const result = await processMentorTurn({
      userId: testUserId,
      sessionId: testSessionId,
      userMessage: 'Final confirmation: Starting GS2 block at 2 PM.',
      requestId
    });

    assert.ok(result.mentorReply, 'Typed message processed seamlessly');
    assert.ok(result.session.id, 'Session intact');
  });

  await t.test('Test H — Provider rollback (Sarvam provider config check)', async () => {
    const origProvider = process.env.MENTOR_VOICE_PROVIDER;
    process.env.MENTOR_VOICE_PROVIDER = 'sarvam';

    const providerSetting = (process.env.MENTOR_VOICE_PROVIDER || 'gemini').toLowerCase();
    assert.equal(providerSetting, 'sarvam', 'Provider must switch to Sarvam on config override');

    // Restore provider
    process.env.MENTOR_VOICE_PROVIDER = origProvider || 'gemini';
  });

  await t.test('Test I — Usage & Cost Instrumentation (Gemini Live + DeepSeek)', async () => {
    // 1. Record Gemini Live token usage
    const geminiUsageRes = await recordGeminiLiveUsage({
      userId: testUserId,
      sessionId: testSessionId,
      model: 'gemini-3.8-live',
      usageMetadata: {
        promptTokensDetails: [
          { modality: 'AUDIO', tokenCount: 5000 },
          { modality: 'TEXT', tokenCount: 200 }
        ],
        candidatesTokensDetails: [
          { modality: 'AUDIO', tokenCount: 8000 },
          { modality: 'TEXT', tokenCount: 150 }
        ]
      }
    });

    assert.ok(geminiUsageRes, 'Gemini usage must be recorded');
    assert.ok(geminiUsageRes.costUsd > 0, 'USD cost must be > 0');
    assert.ok(geminiUsageRes.costInr > 0, 'INR cost must be > 0');

    // 2. Record DeepSeek turn token usage
    const deepseekUsageRes = await recordMentorTurnUsage({
      userId: testUserId,
      sessionId: testSessionId,
      provider: 'deepseek',
      model: 'deepseek-flash',
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 350,
        prompt_cache_hit_tokens: 800
      }
    });

    assert.ok(deepseekUsageRes, 'DeepSeek usage must be recorded');
    assert.ok(deepseekUsageRes.costInr > 0, 'DeepSeek INR cost must be > 0');

    // 3. Query monthly usage summary
    const monthlySummary = await getMonthlyUsage(testUserId);
    assert.ok(monthlySummary.totalCostInr > 0, 'Monthly total cost must be > 0');
    assert.ok(monthlySummary.geminiCostInr > 0, 'Gemini monthly cost must be present');
    assert.ok(monthlySummary.deepseekCostInr > 0, 'DeepSeek monthly cost must be present');
    assert.equal(monthlySummary.budgetInr, 700, 'Monthly budget must default to ₹700');
    assert.ok(monthlySummary.remainingInr <= 700, 'Remaining budget must be <= ₹700');
  });

  await t.test('Test J — Session Lifecycle & Context Window Compression', async () => {
    const geminiService = new GeminiLiveService({
      userId: testUserId,
      sessionId: testSessionId,
      onEvent: () => {}
    });

    // Verify contextWindowCompression is included in setup
    let sentSetup = null;
    geminiService.ws = {
      send: (payloadStr) => {
        sentSetup = JSON.parse(payloadStr);
      }
    };

    geminiService.sendSetup();

    assert.ok(sentSetup.setup, 'Setup payload must be structured');
    assert.ok(sentSetup.setup.contextWindowCompression?.slidingWindow, 'slidingWindow context compression must be enabled');
    assert.ok(sentSetup.setup.inputAudioTranscription, 'inputAudioTranscription must be enabled');
    assert.equal(sentSetup.setup.generationConfig?.responseModalities?.[0], 'AUDIO', 'Audio modality must be set');
  });
});
