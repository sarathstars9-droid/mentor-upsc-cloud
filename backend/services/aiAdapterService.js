// backend/services/aiAdapterService.js
// Authoritative Mentor Reasoning Engine supporting DeepSeek V4.1 Flash, Gemini, and OpenAI

import { MOULIKA_PROFILE } from './mentorProfile.js';

const WORD_TO_NUMBER = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  'ఒక': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5, 'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10
};

export function normalizeEnergy(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/\b(low|తక్కువ|డల్|down)\b/.test(lower)) return 'low';
  if (/\b(medium|miriam|midium|median|midi|ok|okay|ఓకే|parledu|average|moderate)\b/.test(lower)) return 'medium';
  if (/\b(high|బాగుంది|full|great|good|active)\b/.test(lower)) return 'high';
  return null;
}

export function parseAvailableHours(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  if (/^(yes|hello|medium|low|high|ok|okay)$/i.test(lower)) return null;

  // Check digits first
  const digitMatch = lower.match(/(\d+(\.\d+)?)/);
  if (digitMatch) {
    const val = parseFloat(digitMatch[1]);
    if (Number.isFinite(val) && val > 0 && val <= 16) {
      return val;
    }
  }

  // Check word numbers
  for (const [word, num] of Object.entries(WORD_TO_NUMBER)) {
    const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
    if (wordRegex.test(lower)) {
      return num;
    }
  }

  return null;
}

// Configuration constants
const MAX_USER_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 10;
const MAX_REPLY_LENGTH = 1000;
const DEFAULT_TIMEOUT_MS = process.env.MENTOR_AI_TIMEOUT_MS ? parseInt(process.env.MENTOR_AI_TIMEOUT_MS, 10) : 20000;

export async function generateMentorReply({ profile, mentorState, conversationHistory = [], currentStage, userMessage }) {
  const provider = (process.env.MENTOR_AI_PROVIDER || 'deepseek').toLowerCase();
  let apiKey = process.env.MENTOR_AI_API_KEY;
  if (provider === 'deepseek' && !apiKey) {
    apiKey = process.env.DEEPSEEK_API_KEY;
  } else if (provider === 'gemini' && !apiKey) {
    apiKey = process.env.GEMINI_API_KEY;
  } else if (provider === 'openai' && !apiKey) {
    apiKey = process.env.OPENAI_API_KEY;
  }

  const model = process.env.MENTOR_AI_MODEL || (
    provider === 'deepseek' ? 'deepseek-flash' :
    provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'
  );

  // Input validation stage safeguards
  if (currentStage === 'energy') {
    const normEnergy = normalizeEnergy(userMessage);
    if (!normEnergy) {
      return {
        message: "Please choose your present energy level: low, medium, or high.",
        nextStage: 'energy',
        extracted: {},
        source: 'deterministic',
        safetyFlags: [],
        modelMetadata: { provider, fallbackReason: 'invalid_energy_input' }
      };
    }
  }

  if (currentStage === 'available_hours') {
    const hours = parseAvailableHours(userMessage);
    if (hours === null) {
      return {
        message: "Please tell me how many focused study hours you can realistically give today.",
        nextStage: 'available_hours',
        extracted: {},
        source: 'deterministic',
        safetyFlags: [],
        modelMetadata: { provider, fallbackReason: 'invalid_hours_input' }
      };
    }
  }

  // Truncate user message
  const safeUserMessage = userMessage.substring(0, MAX_USER_MESSAGE_LENGTH);

  // Deterministic mode or missing key
  if (provider === 'deterministic' || !apiKey) {
    if (provider !== 'deterministic' && !apiKey) {
      console.log(`[AI Adapter] Missing API key for provider ${provider}. Falling back to deterministic.`);
    }
    return generateDeterministicReply(currentStage, safeUserMessage, mentorState);
  }

  const startTime = Date.now();
  try {
    const systemPrompt = buildSystemPrompt(profile, mentorState, currentStage);
    const recentHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);

    let apiResponse = null;
    let modelMeta = { provider, model };

    if (provider === 'deepseek') {
      apiResponse = await callDeepSeek(apiKey, model, systemPrompt, recentHistory, safeUserMessage);
    } else if (provider === 'gemini') {
      apiResponse = await callGemini(apiKey, model, systemPrompt, recentHistory, safeUserMessage);
    } else if (provider === 'openai') {
      apiResponse = await callOpenAI(apiKey, model, systemPrompt, recentHistory, safeUserMessage);
    } else {
      console.log(`[AI Adapter] Unknown provider ${provider}. Falling back to deterministic.`);
      return generateDeterministicReply(currentStage, safeUserMessage, mentorState);
    }

    const structuredResult = apiResponse.result || apiResponse;
    const usage = apiResponse.usage || null;
    if (usage) {
      modelMeta.usage = usage;
    }

    const duration = Date.now() - startTime;
    console.log(`[AI Adapter] Provider ${provider} (${model}) succeeded in ${duration}ms.`);

    const validatedResult = validateAndFormatOutput(structuredResult, currentStage, safeUserMessage, mentorState);
    if (!validatedResult.isValid) {
      console.log(`[AI Adapter] Validation failed: ${validatedResult.reason}. Falling back to deterministic.`);
      const fallback = generateDeterministicReply(currentStage, safeUserMessage, mentorState);
      fallback.modelMetadata = { ...modelMeta, fallbackReason: 'validation_failed' };
      return fallback;
    }

    return {
      message: validatedResult.data.reply.substring(0, MAX_REPLY_LENGTH),
      nextStage: validatedResult.data.nextStage,
      extracted: validatedResult.data.extractedData,
      source: 'ai',
      safetyFlags: [],
      modelMetadata: { ...modelMeta, latency: duration }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`[AI Adapter] Provider ${provider} failed after ${duration}ms: ${error.message}. Falling back to deterministic.`);
    const fallback = generateDeterministicReply(currentStage, safeUserMessage, mentorState);
    fallback.modelMetadata = { provider, fallbackReason: error.name === 'AbortError' ? 'timeout' : 'error' };
    return fallback;
  }
}

function generateDeterministicReply(currentStage, userMessage, mentorState) {
  let nextStage = currentStage;
  let message = '';
  let extracted = {};
  const lowerUser = userMessage.toLowerCase();

  switch (currentStage) {
    case 'greeting':
      message = `Good morning. How is your energy today?`;
      nextStage = 'energy';
      break;
    case 'energy':
      const normEnergy = normalizeEnergy(userMessage);
      extracted.energy_level = normEnergy;
      message = `Understood. Now, how many hours do you realistically have available to study today?`;
      nextStage = 'available_hours';
      break;
    case 'available_hours':
      const hours = parseAvailableHours(userMessage);
      extracted.available_hours = String(hours);
      nextStage = 'mentor_command';
      const command = mentorState?.mentorCommand || { title: 'plan', instruction: 'Do it.', reason: 'Important.' };
      message = `I see. Here is your priority right now: ${command.title}. ${command.instruction} ${command.reason} Are you ready to proceed?`;
      break;
    case 'mentor_command':
      nextStage = 'obstacle';
      message = `What is the main obstacle you foresee in completing this?`;
      break;
    case 'obstacle':
      extracted.obstacle = userMessage;
      nextStage = 'first_block_commitment';
      message = `We can manage that obstacle. Will you commit to starting this block immediately after we finish here?`;
      break;
    case 'first_block_commitment':
      extracted.first_block_commitment = userMessage;
      extracted.instruction_accepted = lowerUser.includes('yes') || lowerUser.includes('will') || lowerUser.includes('ok') || lowerUser.includes('sure');
      nextStage = 'csat_commitment';
      message = `Good. I have recorded your commitment. Will you also commit to completing your CSAT practice today?`;
      break;
    case 'csat_commitment':
      extracted.csat_commitment = userMessage;
      nextStage = 'confirmation';
      message = `Excellent. Confirm your final commitment to today's plan, and we can close this session.`;
      break;
    case 'confirmation':
      extracted.final_commitment = userMessage;
      nextStage = 'close';
      message = `Good. Start the first block now. MentorOS will expect completion evidence after the block.`;
      break;
    case 'close':
      message = `The check-in is complete. Focus on your execution.`;
      break;
    default:
      message = `Let's stick to the plan. Execute the blocks.`;
      break;
  }

  return {
    message,
    nextStage,
    extracted,
    source: 'deterministic',
    safetyFlags: [],
    modelMetadata: { provider: 'deterministic' }
  };
}

function buildCompactEvidencePacket(mentorState) {
  if (!mentorState) return { status: 'UNKNOWN' };

  const cmd = mentorState.mentorCommand || null;
  const blocks = Array.isArray(mentorState.blocks) ? mentorState.blocks : [];
  const pending = Array.isArray(mentorState.pendingBlocks) ? mentorState.pendingBlocks : [];

  return {
    dayKey: mentorState.dayKey || 'UNKNOWN',
    totalPlannedMinutes: mentorState.totalPlannedMinutes || 0,
    totalActualMinutes: mentorState.totalActualMinutes || 0,
    plannedBlocksCount: blocks.length,
    pendingBlocksCount: pending.length,
    nextPendingBlock: pending[0] ? { subject: pending[0].subject, topic: pending[0].topic || pending[0].title } : null,
    hasPreviousDayLeakage: Boolean(mentorState.hasPreviousDayLeakage),
    csatRisk: Boolean(mentorState.csatRisk || pending.some(b => (b.subject || '').toUpperCase().includes('CSAT'))),
    activeBlock: mentorState.activeBlock ? { subject: mentorState.activeBlock.subject, topic: mentorState.activeBlock.topic } : null,
    staleBlock: mentorState.staleBlock ? { subject: mentorState.staleBlock.subject } : null,
    mentorCommand: cmd ? {
      priority: cmd.priority,
      title: cmd.title,
      instruction: cmd.instruction,
      reason: cmd.reason
    } : null
  };
}

function buildSystemPrompt(profile, mentorState, currentStage) {
  const evidencePacket = buildCompactEvidencePacket(mentorState);

  return `You are Moulika's authoritative UPSC execution mentor brain (MentorOS). Your role is to evaluate her actual execution evidence and guide her into one clear next commitment.
Tone: Calm, firm, respectful, concise, execution-focused. Use natural Telugu-English code-switching where helpful (e.g. 'Good morning Moulika. Energy ela undi today?'). No empty motivational speech.
Prohibitions: DO NOT promise UPSC ranks. DO NOT invent unverified study evidence or phantom blocks. DO NOT treat inactive/stale time as study time. DO NOT shame Moulika. DO NOT provide medical or psychological diagnosis.
Constraint: 2-4 concise spoken sentences per reply.

Mentor Evidence Packet:
${JSON.stringify(evidencePacket, null, 2)}

Current Stage: ${currentStage}
Valid values for nextStage (MUST pick strictly one of these):
- "energy" (assess energy)
- "available_hours" (establish realistic hours)
- "mentor_command" (deliver priority command / today's focus)
- "obstacle" (identify potential blockers, e.g. fatigue, family work)
- "first_block_commitment" (commit to first study block & timing)
- "csat_commitment" (address CSAT priority & lock commitment)
- "confirmation" (review complete day's commitment)
- "close" (session finalized)

You MUST output ONLY a valid JSON object. Start your output immediately with '{' and end with '}'. DO NOT output any preamble, analysis, thought process, or markdown text outside the JSON.
Schema:
{
  "reply": "2-4 concise spoken sentences in natural English/Telugu-English",
  "acknowledgedUserAnswer": true,
  "nextStage": "energy|available_hours|mentor_command|obstacle|first_block_commitment|csat_commitment|confirmation|close",
  "extractedData": {
    "energyLevel": "low|medium|high|null",
    "availableHours": "number as string (e.g. '6', '4') or null",
    "obstacle": "string or null",
    "firstBlockCommitment": "string or null",
    "intendedStartTime": "string or null",
    "csatCommitment": "string or null",
    "instructionAccepted": true|false|null,
    "finalCommitment": "string or null"
  },
  "requiresClarification": false,
  "safetyFlags": [],
  "clarificationQuestion": "string or null"
}
`;
}

function normalizeStage(stage) {
  if (!stage) return null;
  const s = stage.toLowerCase().trim().replace(/-/g, '_');
  if (['energy'].includes(s)) return 'energy';
  if (['available_hours', 'hours', 'availablehours'].includes(s)) return 'available_hours';
  if (['mentor_command', 'command', 'mentorcommand', 'priority'].includes(s)) return 'mentor_command';
  if (['obstacle', 'blocker', 'obstacles'].includes(s)) return 'obstacle';
  if (['first_block_commitment', 'first_block', 'firstblock', 'plan_upload', 'await_plan_upload', 'plan'].includes(s)) return 'first_block_commitment';
  if (['csat_commitment', 'csat', 'csatcommitment'].includes(s)) return 'csat_commitment';
  if (['confirmation', 'confirm', 'review'].includes(s)) return 'confirmation';
  if (['close', 'end', 'completed', 'finished'].includes(s)) return 'close';
  return s;
}

function validateAndFormatOutput(parsedJson, currentStage, userMessage, mentorState) {
  if (!parsedJson || typeof parsedJson.reply !== 'string' || !parsedJson.nextStage) {
    return { isValid: false, reason: 'Malformed JSON schema' };
  }

  const rawNextStage = normalizeStage(parsedJson.nextStage);
  parsedJson.nextStage = rawNextStage;

  const MENTOR_TRANSITIONS = {
    greeting: ['greeting', 'energy', 'available_hours', 'mentor_command'],
    energy: ['energy', 'available_hours', 'mentor_command', 'obstacle'],
    available_hours: ['available_hours', 'mentor_command', 'obstacle', 'first_block_commitment'],
    mentor_command: ['mentor_command', 'obstacle', 'first_block_commitment', 'csat_commitment'],
    obstacle: ['obstacle', 'first_block_commitment', 'csat_commitment', 'confirmation'],
    first_block_commitment: [
      'first_block_commitment',
      'csat_commitment',
      'confirmation',
      'close'
    ],
    csat_commitment: ['csat_commitment', 'confirmation', 'close', 'first_block_commitment'],
    confirmation: ['confirmation', 'close'],
    close: ['close']
  };

  const allowed = MENTOR_TRANSITIONS[currentStage] || [currentStage];
  console.log('[VALIDATION]', { currentStage, proposedNextStage: parsedJson.nextStage, allowed });

  if (!allowed.includes(parsedJson.nextStage)) {
    if (parsedJson.requiresClarification || parsedJson.nextStage === currentStage) {
      parsedJson.nextStage = currentStage;
    } else {
      // Default to standard next stage if within reason
      parsedJson.nextStage = allowed[1] || currentStage;
    }
  }

  if (parsedJson.requiresClarification && parsedJson.nextStage !== currentStage) {
    parsedJson.nextStage = currentStage;
  }

  // Map extractedData to db snake_case
  let dbExtracted = {};
  if (parsedJson.extractedData) {
    const ext = parsedJson.extractedData;
    if (ext.energyLevel && ext.energyLevel !== 'null') {
      const norm = normalizeEnergy(ext.energyLevel);
      if (norm) dbExtracted.energy_level = norm;
    }
    if (ext.availableHours && ext.availableHours !== 'null') {
      const parsed = parseAvailableHours(String(ext.availableHours));
      if (parsed !== null) dbExtracted.available_hours = String(parsed);
    }
    if (ext.obstacle && ext.obstacle !== 'null') dbExtracted.obstacle = ext.obstacle;
    if (ext.firstBlockCommitment && ext.firstBlockCommitment !== 'null') dbExtracted.first_block_commitment = ext.firstBlockCommitment;
    if (ext.intendedStartTime && ext.intendedStartTime !== 'null') dbExtracted.intended_start_time = ext.intendedStartTime;
    if (ext.csatCommitment && ext.csatCommitment !== 'null') dbExtracted.csat_commitment = ext.csatCommitment;
    if (typeof ext.instructionAccepted === 'boolean') dbExtracted.instruction_accepted = ext.instructionAccepted;
    if (ext.finalCommitment && ext.finalCommitment !== 'null') dbExtracted.final_commitment = ext.finalCommitment;
  }

  return {
    isValid: true,
    data: {
      reply: parsedJson.reply,
      nextStage: parsedJson.nextStage,
      extractedData: dbExtracted
    }
  };
}

// Helpers for API calls

async function callDeepSeek(apiKey, model, systemPrompt, history, userMessage) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    messages.push({ role: m.role === 'mentor' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: userMessage });

  const configuredModel = process.env.MENTOR_AI_MODEL || 'deepseek-flash';
  const outboundModel = model || configuredModel;
  console.log(`[DeepSeek] Reasoning turn - configured MENTOR_AI_MODEL: "${configuredModel}", outbound model: "${outboundModel}"`);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: outboundModel,
        messages,
        max_tokens: 4000,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(id);
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`DeepSeek API Error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    console.log(`[DeepSeek] Response received - returned model: "${data.model || outboundModel}", prompt_tokens: ${data.usage?.prompt_tokens}, completion_tokens: ${data.usage?.completion_tokens}`);

    let rawText = (data.choices?.[0]?.message?.content || '').trim();
    if (!rawText && data.choices?.[0]?.message?.reasoning_content) {
      rawText = data.choices[0].message.reasoning_content.trim();
    }
    if (!rawText) throw new Error('Empty response from DeepSeek');

    return {
      result: extractJsonObject(rawText),
      usage: data.usage || null,
      model: data.model || outboundModel
    };
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') throw new Error('Empty response from AI');
  let clean = text.trim();
  
  // Strip DeepSeek/Reasoning <think>...</think> blocks
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  try {
    return JSON.parse(clean);
  } catch (parseErr) {
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sliced = clean.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }
    console.error('[AI Adapter] Raw text was:', text);
    throw parseErr;
  }
}

async function callGemini(apiKey, model, systemPrompt, history, userMessage) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const contents = history.map(m => ({
    role: m.role === 'mentor' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { response_mime_type: 'application/json' }
      }),
      signal: controller.signal
    });

    clearTimeout(id);
    if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty response from Gemini');

    return {
      result: JSON.parse(rawText),
      usage: data.usageMetadata || null
    };
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function callOpenAI(apiKey, model, systemPrompt, history, userMessage) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const messages = [{ role: 'system', content: systemPrompt }];
  for (const m of history) {
    messages.push({ role: m.role === 'mentor' ? 'assistant' : 'user', content: m.content });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    clearTimeout(id);
    if (!res.ok) throw new Error(`OpenAI API Error: ${res.status}`);

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error('Empty response from OpenAI');

    return {
      result: JSON.parse(rawText),
      usage: data.usage || null
    };
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

let mockGenerateAIContentFn = null;

export function setMockGenerateAIContent(fn) {
  mockGenerateAIContentFn = fn;
}

/**
 * Provider-neutral wrapper for other systems (like Knowledge Builder)
 * that need to call the AI without the mentor chat state.
 */
export async function generateAIContent({ provider, apiKey, model, systemPrompt, userMessage = '', history = [] }) {
  if (mockGenerateAIContentFn) {
    return mockGenerateAIContentFn({ provider, apiKey, model, systemPrompt, userMessage, history });
  }

  if (provider === 'deepseek') {
    const res = await callDeepSeek(apiKey, model, systemPrompt, history, userMessage);
    return res.result;
  } else if (provider === 'gemini') {
    const res = await callGemini(apiKey, model, systemPrompt, history, userMessage);
    return res.result;
  } else if (provider === 'openai') {
    const res = await callOpenAI(apiKey, model, systemPrompt, history, userMessage);
    return res.result;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
