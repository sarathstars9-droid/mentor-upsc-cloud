import test from 'node:test';
import assert from 'node:assert';
import { generateMentorReply } from '../services/aiAdapterService.js';
import { MOULIKA_PROFILE } from '../services/mentorProfile.js';

test('AI Adapter Unit Tests', async (t) => {
  const mockState = { mentorCommand: { title: 'plan', instruction: 'Do it.', reason: 'Important.' } };

  // Store original env
  const origEnv = { ...process.env };
  const origFetch = globalThis.fetch;

  // Clean up after each subtest if needed, or set explicitly per test
  t.afterEach(() => {
    process.env = { ...origEnv };
    globalThis.fetch = origFetch;
  });

  await t.test('Missing API key uses deterministic fallback', async () => {
    process.env.MENTOR_AI_PROVIDER = 'gemini';
    delete process.env.MENTOR_AI_API_KEY;
    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'deterministic');
    assert.strictEqual(res.nextStage, 'available_hours');
  });

  await t.test('Deterministic mode avoids network', async () => {
    process.env.MENTOR_AI_PROVIDER = 'deterministic';
    process.env.MENTOR_AI_API_KEY = 'fake-key';
    let fetchCalled = false;
    globalThis.fetch = async () => { fetchCalled = true; return new Response(); };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'deterministic');
    assert.strictEqual(fetchCalled, false);
  });

  await t.test('Provider timeout uses fallback', async () => {
    process.env.MENTOR_AI_PROVIDER = 'gemini';
    process.env.MENTOR_AI_API_KEY = 'fake-key';
    process.env.MENTOR_AI_TIMEOUT_MS = '100';

    globalThis.fetch = async (url, options) => {
      return new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 200);
      });
    };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'deterministic');
    assert.strictEqual(res.modelMetadata.fallbackReason, 'error');
  });

  await t.test('Provider 5xx uses fallback', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake-key';

    globalThis.fetch = async () => {
      return { ok: false, status: 500 };
    };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'deterministic');
  });

  await t.test('Malformed JSON uses fallback', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake-key';

    globalThis.fetch = async () => {
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'not-json' } }] }) };
    };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'deterministic');
  });

  await t.test('Invalid stage transition uses fallback', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake-key';

    globalThis.fetch = async () => {
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        reply: 'Ok',
        nextStage: 'invalid_jump'
      }) } }] }) };
    };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'deterministic');
  });

  await t.test('Valid extraction is parsed and source is AI', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake-key';

    globalThis.fetch = async () => {
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        reply: 'Good energy.',
        nextStage: 'available_hours',
        extractedData: {
          energyLevel: 'high'
        }
      }) } }] }) };
    };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: [],
      currentStage: 'energy',
      userMessage: 'I feel energetic'
    });
    assert.strictEqual(res.source, 'ai');
    assert.strictEqual(res.nextStage, 'available_hours');
    assert.strictEqual(res.extracted.energy_level, 'high');
  });

  await t.test('Input and Output limits are enforced', async () => {
    process.env.MENTOR_AI_PROVIDER = 'openai';
    process.env.MENTOR_AI_API_KEY = 'fake-key';

    let receivedPayload = null;
    globalThis.fetch = async (url, opts) => {
      receivedPayload = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        reply: 'A'.repeat(2000), // Exceeds max length
        nextStage: 'available_hours'
      }) } }] }) };
    };

    const res = await generateMentorReply({
      profile: MOULIKA_PROFILE,
      mentorState: mockState,
      conversationHistory: new Array(20).fill({ role: 'user', content: 'test' }), // Exceeds history
      currentStage: 'energy',
      userMessage: 'B'.repeat(1000) // Exceeds 500 chars
    });

    assert.strictEqual(res.source, 'ai');
    // Input cap to 500
    const userMsgReceived = receivedPayload.messages[receivedPayload.messages.length - 1].content;
    assert.strictEqual(userMsgReceived.length, 500);
    // History cap to 10 + 1 user message + 1 system prompt = 12 total messages sent to OpenAI
    assert.strictEqual(receivedPayload.messages.length, 12);
    // Reply capped to 1000
    assert.strictEqual(res.message.length, 1000);
  });
});
