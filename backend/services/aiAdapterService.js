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
  const lower = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Ambiguous / non-answers (clarification allowed)
  if (/^(i don'?t know|not sure|mixed feelings?|confused|can'?t say|maybe)$/i.test(lower) ||
      /\b(don'?t know|not sure|mixed feeling|mixed feelings)\b/i.test(lower)) {
    return null;
  }

  // 1. Medium phrases (check compound expressions first e.g. "somewhat tired but okay", "energy okay")
  if (
    /\b(somewhat tired but (?:ok|okay|manageable)|energy (?:is )?(?:ok|okay|manageable|fine|average|normal)|manageable|average|moderate|normal|not bad|parledu|paravaledu|so-so|soso|decent|fair|fine|adequate)\b/i.test(lower) ||
    /\b(okay ga unna|ok ga unna|normal ga unna|manageable ga|middle|in between|energy okay|energy ok)\b/i.test(lower) ||
    /^(medium|miriam|midium|median|midi|ok|okay|ఓకే)$/i.test(lower)
  ) {
    return 'medium';
  }

  // 2. High phrases (fresh, energetic, active, well rested, etc.)
  if (
    /\b(high|energetic|super|great|active|fresh|well rested|fully awake|full of energy|full energy|very good energy|pumped|sharp|peak energy|100%|బాగుంది|చాలా బాగుంది|chala bagundi|bagundi|baga unna|fresh ga unna|fresh ga undi|full active|good energy)\b/i.test(lower)
  ) {
    return 'high';
  }

  // 3. Low phrases & ASR phonetic variants (sleepy, sleeping, slepy, slipy, tired, exhausted, drained, barely slept, dull, etc.)
  if (
    /\b(low|sleepy|sleeping|slepy|slipy|sleping|tired|very tired|exhausted|drained|low energy|feeling dull|dull|barely awake|lethargic|sluggish|weary|fatigued|fatigue|burned out|burnt out|groggy|lazy|heavy eyes)\b/i.test(lower) ||
    /\b(invachal|in fact chala|chala sleeping|chaala sleeping|chala sleepy|chaala sleepy)\b/i.test(lower) ||
    /\b(didn'?t sleep well|did not sleep well|had bad sleep|poor sleep|couldn'?t sleep|insomnia|less sleep|not enough sleep|lack of sleep|barely slept|broken sleep)\b/i.test(lower) ||
    /\b(unwell|headache|sick|feverish|weak|no energy|zero energy|low on energy|down|lowest)\b/i.test(lower) ||
    /\b(nidra vastundi|nidra vastundhi|nidrostondi|nindra vastundi|nindra vastundhi|nidra pothunna|baga nidra|chaala nidra|chaala sleepy|sleepy ga unna|sleepy ga undi)\b/i.test(lower) ||
    /\b(alisipoyanu|alisipoya|tired ga unna|tired ga undi|dull ga unna|dull ga undi|energy ledu|energy ledhu|takkuva energy|thakkuva energy|takkuva|thakkuva|తక్కువ|డల్|sarigga nidra poledu|nidra saripoledu|nidra ledu)\b/i.test(lower)
  ) {
    return 'low';
  }

  // Fallback single keywords
  if (/\b(medium|ok|okay)\b/i.test(lower)) return 'medium';

  return null;
}

export function parseAvailableHours(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  if (/^(yes|hello|hi|ok|okay)$/i.test(lower)) return null;

  // 1. Check for explicit hour phrases: "six hours", "4 hours", "four hours only", "4.5 hrs"
  const hourPhraseRegex = /(?:actually\s+)?(\d+(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|ఒక|రెండు|మూడు|నాలుగు|ఐదు|ఆరు|ఏడు|ఎనిమిది|తొమ్మిది|పది)\b)\s*(?:hours|hour|hrs|hr|గంటలు|గంటల)/i;
  const phraseMatch = lower.match(hourPhraseRegex);
  if (phraseMatch) {
    const rawVal = phraseMatch[1];
    let num = parseFloat(rawVal);
    if (!Number.isFinite(num) && WORD_TO_NUMBER[rawVal.toLowerCase()] !== undefined) {
      num = WORD_TO_NUMBER[rawVal.toLowerCase()];
    }
    if (Number.isFinite(num) && num > 0 && num <= 16) {
      return num;
    }
  }

  // 2. Check for contextual hours: "have four", "giving 6", "available 6", "only 4", "realistic 4"
  const contextRegex = /(?:have|giving|available|planned|only|realistic|give|got)\s+(?:about\s+)?(\d+(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|ఒక|రెండు|మూడు|నాలుగు|ఐదు|ఆరు|ఏడు|ఎనిమిది|తొమ్మిది|పది)\b)/i;
  const contextMatch = lower.match(contextRegex);
  if (contextMatch) {
    const rawVal = contextMatch[1];
    let num = parseFloat(rawVal);
    if (!Number.isFinite(num) && WORD_TO_NUMBER[rawVal.toLowerCase()] !== undefined) {
      num = WORD_TO_NUMBER[rawVal.toLowerCase()];
    }
    if (Number.isFinite(num) && num > 0 && num <= 16) {
      return num;
    }
  }

  // 3. Fallback: single number at start or exact number input e.g. "6", "four", "6 hrs"
  const directDigitMatch = lower.match(/^(\d+(\.\d+)?)\s*(?:hours|hrs|hour)?$/);
  if (directDigitMatch) {
    const val = parseFloat(directDigitMatch[1]);
    if (Number.isFinite(val) && val > 0 && val <= 16) {
      return val;
    }
  }

  return null;
}

export function extractObstacle(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  const obstaclePatterns = [
    /((?:evening|morning|afternoon|night)?\s*(?:family work|family function|relatives|headache|fever|health issue|travel|office work|house work|errands|personal work|college work)[^\.\n,]*?(?:undi|valla|unayi|today)?)/i,
    /(?:obstacle|blocker|issue|problem|constraint|delay)\s*(?:is|undi|ante)?\s*([^\.\n,]+)/i
  ];

  for (const pat of obstaclePatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const cleaned = m[1].trim();
      if (cleaned.length >= 3) {
        return cleaned;
      }
    }
  }

  if (/\b(family work|family function|relatives|headache|health|travel|office work|fatigue)\b/i.test(lower)) {
    if (lower.includes('evening') && lower.includes('family')) return 'evening family work';
    if (lower.includes('family')) return 'family commitments';
    if (lower.includes('headache')) return 'headache / health issue';
    if (lower.includes('travel')) return 'traveling';
  }

  return null;
}

export function extractUtteranceFacts(userMessage, sessionState = {}) {
  const extracted = {};
  if (!userMessage || typeof userMessage !== 'string') return extracted;

  // 1. Energy
  const energy = normalizeEnergy(userMessage);
  if (energy) {
    extracted.energy_level = energy;
  }

  // 2. Available hours (handles corrections e.g. "Actually four hours only")
  const hours = parseAvailableHours(userMessage);
  if (hours !== null) {
    extracted.available_hours = String(hours);
  }

  // 3. Obstacle
  const obs = extractObstacle(userMessage);
  if (obs) {
    extracted.obstacle = obs;
  }

  const lower = userMessage.toLowerCase();

  // 4. Commitments & Intent
  if (/\b(commit|starting at|start at|will start|first block|polity at|gs2 at)\b/i.test(lower)) {
    extracted.first_block_commitment = userMessage.trim();
  }

  if (/\b(csat commit|will do csat|practice csat|csat for|1\.5h csat|1\.5 hours csat)\b/i.test(lower)) {
    extracted.csat_commitment = userMessage.trim();
  }

  if (/\b(yes|sure|will do|ok|okay|agreed|committed|accepted|done)\b/i.test(lower) && !/\b(not|no|cannot|cant|can't)\b/i.test(lower)) {
    extracted.instruction_accepted = true;
  }

  return extracted;
}

export function classifyUserIntent(userMessage, currentStage = 'energy', sessionState = {}) {
  if (!userMessage || typeof userMessage !== 'string') return 'mentor_answer';
  const lower = userMessage.toLowerCase().trim();

  // 1. Meta-Conversation detection (language preference, audio/hearing, pacing, repetition)
  if (
    /\b(english|telugu|language|matlad|speak|talk in|telugu and english|english and telugu|mixed)\b.*\b(right|kదా|kada|cheyala|matladala|supposed to|can we|shall we|allow|ok|okay)\b/i.test(lower) ||
    /\b(we supposed to talk|can we talk in telugu|can i speak in telugu|english lo matladala|telugu lo matladala|telugu and english|language preference|which language|telugu mix)\b/i.test(lower) ||
    /\b(can you hear me|hear me|vinipistunda|vinabadutunda|are you there|am i audible|can you hear)\b/i.test(lower) ||
    /\b(speak slower|speak slow|slow ga|repeat that|once again|malli cheppandi|what did you say|could you repeat|pardon|repeat)\b/i.test(lower)
  ) {
    return 'meta_conversation';
  }

  // 2. Correction detection
  if (
    /\b(actually|wait|no|not|change|instead|correction|wrong|sorry)\b/i.test(lower) &&
    (parseAvailableHours(userMessage) !== null || normalizeEnergy(userMessage) !== null || extractObstacle(userMessage) !== null)
  ) {
    return 'correction';
  }

  // 3. Question to mentor (seeking priority / advice / guidance)
  if (
    /\b(what should i|what to do|how should i|em cheyali|guide me|which one|first em|first edi|should i do|can you tell|how to|why)\b/i.test(lower) ||
    lower.endsWith('?')
  ) {
    return 'question_to_mentor';
  }

  // 4. Interruption or context addition
  if (
    /\b(also|in addition|one more thing|plus|by the way|gurthochindi|another thing)\b/i.test(lower)
  ) {
    return 'interruption/context_addition';
  }

  // 5. Default: mentor answer
  return 'mentor_answer';
}

// Configuration constants
const MAX_USER_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 10;
const MAX_REPLY_LENGTH = 1000;
const DEFAULT_TIMEOUT_MS = process.env.MENTOR_AI_TIMEOUT_MS ? parseInt(process.env.MENTOR_AI_TIMEOUT_MS, 10) : 20000;

export async function generateMentorReply({
  profile,
  mentorState,
  sessionState = {},
  conversationHistory = [],
  currentStage,
  userMessage
}) {
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
    provider === 'deepseek' ? (process.env.DEEPSEEK_VISUAL_MODEL || 'deepseek-flash') :
    provider === 'gemini' ? (process.env.GEMINI_VISUAL_MODEL || 'gemini-3.8-flash') : 'gpt-4o-mini'
  );

  // 1. Classify intent upfront
  const userIntent = classifyUserIntent(userMessage, currentStage, sessionState);
  const localExtracted = extractUtteranceFacts(userMessage, sessionState);
  const mergedState = { ...sessionState, ...localExtracted };

  // 2. Handle Meta-Conversation: acknowledge naturally and retain the SAME stage
  if (userIntent === 'meta_conversation') {
    const lower = userMessage.toLowerCase();
    let replyText = '';
    if (/\b(english|telugu|language|matlad|speak|talk)\b/i.test(lower)) {
      replyText = "Yes Moulika, English and Telugu rendu mix chesi matladachu. I'll keep the mentoring concise and use whichever language feels natural.";
    } else if (/\b(hear|vinipistunda|audible)\b/i.test(lower)) {
      replyText = "Yes Moulika, I can hear you clearly. Vinipistundi.";
    } else if (/\b(slower|slow|repeat|malli|pardon)\b/i.test(lower)) {
      replyText = "Understood. I will speak at a steady, clear pace.";
    } else {
      replyText = "Understood Moulika. We can talk naturally in English and Telugu mix.";
    }

    if (currentStage === 'energy' && !mergedState.energy_level) {
      replyText += " Now, what is your present energy level: low, medium, or high?";
    } else if (currentStage === 'available_hours' && !mergedState.available_hours) {
      replyText += " How many focused study hours can you realistically give today?";
    } else if (currentStage === 'obstacle' && !mergedState.obstacle) {
      replyText += " What is the main obstacle you foresee in completing your schedule?";
    } else if (currentStage === 'first_block_commitment') {
      replyText += " Let's look at your schedule. Will you commit to starting your first block now?";
    } else {
      replyText += " Let's continue with today's plan.";
    }

    return {
      message: replyText,
      nextStage: currentStage,
      extracted: localExtracted,
      source: 'deterministic',
      safetyFlags: [],
      modelMetadata: { provider, userIntent, metaAcknowledged: true }
    };
  }

  // Truncate user message
  const safeUserMessage = userMessage.substring(0, MAX_USER_MESSAGE_LENGTH);

  // Deterministic mode or missing key
  if (provider === 'deterministic' || !apiKey) {
    if (provider !== 'deterministic' && !apiKey) {
      console.log(`[AI Adapter] Missing API key for provider ${provider}. Falling back to deterministic.`);
    }
    return generateDeterministicReply(currentStage, safeUserMessage, mentorState, mergedState, localExtracted, userIntent);
  }

  const startTime = Date.now();
  try {
    const systemPrompt = buildSystemPrompt(profile, mentorState, currentStage, mergedState);
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
      return generateDeterministicReply(currentStage, safeUserMessage, mentorState, mergedState, localExtracted);
    }

    const structuredResult = apiResponse.result || apiResponse;
    const usage = apiResponse.usage || null;
    if (usage) {
      modelMeta.usage = usage;
    }

    const duration = Date.now() - startTime;
    console.log(`[AI Adapter] Provider ${provider} (${model}) succeeded in ${duration}ms.`);

    const validatedResult = validateAndFormatOutput(structuredResult, currentStage, safeUserMessage, mentorState, mergedState, localExtracted);
    if (!validatedResult.isValid) {
      console.log(`[AI Adapter] Validation failed: ${validatedResult.reason}. Falling back to deterministic.`);
      const fallback = generateDeterministicReply(currentStage, safeUserMessage, mentorState, mergedState, localExtracted);
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
    const fallback = generateDeterministicReply(currentStage, safeUserMessage, mentorState, mergedState, localExtracted);
    fallback.modelMetadata = { provider, fallbackReason: error.name === 'AbortError' ? 'timeout' : 'error' };
    return fallback;
  }
}

export function determineNextStage(currentStage, mergedState, userMessage) {
  const intent = classifyUserIntent(userMessage, currentStage, mergedState);
  if (intent === 'meta_conversation') {
    return currentStage;
  }

  const lower = (userMessage || '').toLowerCase();
  
  // Backlog or priority inquiries jump straight into first_block_commitment
  if (/\b(csat|polity|gs2|pending|miss|backlog|prioritize|priority|what should i|em cheyali)\b/i.test(lower)) {
    if (!mergedState.first_block_commitment) return 'first_block_commitment';
    if (!mergedState.csat_commitment) return 'csat_commitment';
    return 'confirmation';
  }

  // If energy missing -> ask energy
  if (!mergedState.energy_level) {
    return 'energy';
  }

  // If hours missing -> ask available_hours
  if (!mergedState.available_hours) {
    return 'available_hours';
  }

  // If both energy and hours are known:
  if (['greeting', 'energy', 'available_hours'].includes(currentStage)) {
    return 'mentor_command';
  }

  if (currentStage === 'mentor_command') {
    if (!mergedState.obstacle) return 'obstacle';
    return 'first_block_commitment';
  }

  if (currentStage === 'obstacle') {
    return 'first_block_commitment';
  }

  if (currentStage === 'first_block_commitment') {
    return 'csat_commitment';
  }

  if (currentStage === 'csat_commitment') {
    return 'confirmation';
  }

  if (currentStage === 'confirmation') {
    return 'close';
  }

  return currentStage || 'mentor_command';
}

function generateDeterministicReply(currentStage, userMessage, mentorState, sessionState = {}, localExtracted = {}, userIntent = 'mentor_answer') {
  const mergedState = { ...sessionState, ...localExtracted };
  const lower = (userMessage || '').toLowerCase();
  let nextStage = determineNextStage(currentStage, mergedState, userMessage);
  let message = '';

  const hours = mergedState.available_hours || '4';
  const energy = mergedState.energy_level || 'medium';
  const hasObstacle = Boolean(mergedState.obstacle);
  const obstacleText = mergedState.obstacle || 'your schedule constraint';

  // 1. Meta-conversation handling
  if (userIntent === 'meta_conversation') {
    if (/\b(english|telugu|language|matlad|speak|talk)\b/i.test(lower)) {
      message = "Yes Moulika, English and Telugu rendu mix chesi matladachu. I'll keep the mentoring concise and natural.";
    } else if (/\b(hear|vinipistunda|audible)\b/i.test(lower)) {
      message = "Yes Moulika, I can hear you clearly. Vinipistundi.";
    } else {
      message = "Understood Moulika. We can talk naturally in English and Telugu mix.";
    }

    if (currentStage === 'energy' && !mergedState.energy_level) {
      message += " Now, what is your present energy level: low, medium, or high?";
    } else if (currentStage === 'available_hours' && !mergedState.available_hours) {
      message += " How many focused study hours can you realistically give today?";
    } else if (currentStage === 'obstacle' && !mergedState.obstacle) {
      message += " What is the main obstacle you foresee in completing your schedule?";
    } else if (currentStage === 'first_block_commitment') {
      message += " Let's look at your schedule. Will you commit to starting your first block now?";
    } else {
      message += " Let's continue with today's plan.";
    }
    return {
      message,
      nextStage: currentStage,
      extracted: localExtracted,
      source: 'deterministic',
      safetyFlags: [],
      modelMetadata: { provider: 'deterministic', userIntent }
    };
  }

  // 2. Specific questions / Turn scenarios
  const hasCsatMissed = /\b(csat|c-sat)\b.*\b(miss|pending|backlog|kaledu|pola)\b/i.test(lower) || (lower.includes('csat') && lower.includes('miss'));
  const hasPolityPending = /\b(polity|gs2)\b.*\b(pending|miss|backlog|undi)\b/i.test(lower) || (lower.includes('polity') && lower.includes('pending'));
  const isPriorityInquiry = /\b(prioritize|priority|what should i|em cheyali|guide)\b/i.test(lower) || userIntent === 'question_to_mentor';

  if (hasPolityPending || hasCsatMissed || isPriorityInquiry) {
    message = `Since yesterday CSAT miss ayindi, that backlog compound avvakudadu. Today peak morning fresh energy tho first 2.5 hours Polity core revision lock cheyyi, then second slot lo strictly 1.5 hours CSAT problem-solving finish cheddam. Secondary subjects or optional touch cheyyoddu. Will you commit to starting your first block now?`;
    nextStage = 'first_block_commitment';
  } else if (mergedState.energy_level && (currentStage === 'energy' || localExtracted.available_hours)) {
    if (localExtracted.available_hours) {
      const cmd = mentorState?.mentorCommand;
      let capacityNote = '';
      if (energy === 'low') {
        capacityNote = `Got it Moulika, energy low ga undi and ${hours} hours realistic time noted. Low capacity unna roju burnout avvakunda high-yield core blocks ni protect cheyyadam crucial.`;
      } else if (energy === 'high') {
        capacityNote = `Great Moulika, high energy and ${hours} hours realistic time noted. Let's make the most of this peak focus.`;
      } else {
        capacityNote = `Got it, ${energy} energy and ${hours} hours realistic time noted.`;
      }
      if (hasObstacle) {
        message = `${capacityNote} Eroju core priority ${cmd?.title || 'GS2 Polity revision'}. What is the main obstacle you foresee today?`;
      } else {
        message = `${capacityNote} Eroju core priority ${cmd?.title || 'GS2 Polity revision'} ni protect cheddam. What is the main obstacle you foresee in completing this?`;
      }
      nextStage = 'mentor_command';
    } else {
      if (energy === 'low') {
        message = `Got it — energy is low today. Low capacity unnapudu we will keep the target realistic and protect you from burnout. Before we set the plan, how many focused study hours can you realistically give today?`;
      } else if (energy === 'high') {
        message = `Great, high energy noted! Let's leverage your peak focus today. How many focused study hours can you realistically give today?`;
      } else {
        message = `Understood, energy manageable ga undi. How many focused study hours can you realistically give today?`;
      }
      nextStage = 'available_hours';
    }
  } else if (mergedState.available_hours && (currentStage === 'available_hours' || localExtracted.available_hours)) {
    const cmd = mentorState?.mentorCommand || { title: 'GS2 Polity revision', instruction: 'Complete core Articles revision.' };
    if (hasObstacle) {
      message = `Understood, adjusting to ${hours} hours due to ${obstacleText}. Eroju priority: ${cmd.title}. ${cmd.instruction} Are you ready to proceed?`;
    } else {
      message = `Got it, ${hours} hours realistic time noted. Eroju core priority ${cmd.title} ni protect cheddam. What is the main obstacle you foresee today?`;
    }
    nextStage = 'mentor_command';
  } else if (currentStage === 'obstacle' || hasObstacle) {
    message = `We can manage ${obstacleText}. With ${hours} realistic hours, focus strictly on core revision and CSAT. Will you commit to starting your first block now?`;
    nextStage = 'first_block_commitment';
  } else if (currentStage === 'first_block_commitment') {
    message = `Good. First block commitment record chesaanu. Will you also commit to 1.5 hours of CSAT practice today?`;
    nextStage = 'csat_commitment';
  } else if (currentStage === 'csat_commitment') {
    message = `Excellent. Confirm your final commitment to today's ${hours}-hour plan, and we can close this session.`;
    nextStage = 'confirmation';
  } else if (currentStage === 'energy' && !mergedState.energy_level) {
    message = "Please choose your present energy level: low, medium, or high.";
    nextStage = 'energy';
  } else if (currentStage === 'available_hours' && !mergedState.available_hours) {
    message = "Please tell me how many focused study hours you can realistically give today.";
    nextStage = 'available_hours';
  } else {
    message = `Let's stick to the ${hours}-hour plan. Execute your core blocks.`;
    nextStage = 'close';
  }

  return {
    message,
    nextStage,
    extracted: localExtracted,
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

function buildSystemPrompt(profile, mentorState, currentStage, sessionState = {}) {
  const evidencePacket = buildCompactEvidencePacket(mentorState);

  const knownFacts = [];
  const missingFacts = [];

  if (sessionState.energy_level) knownFacts.push(`Energy: ${sessionState.energy_level}`);
  else missingFacts.push('Energy level');

  if (sessionState.available_hours) knownFacts.push(`Available Hours: ${sessionState.available_hours}`);
  else missingFacts.push('Available study hours');

  if (sessionState.obstacle) knownFacts.push(`Obstacle: ${sessionState.obstacle}`);
  else missingFacts.push('Potential obstacle/constraint');

  if (sessionState.first_block_commitment) knownFacts.push(`First Block: ${sessionState.first_block_commitment}`);
  if (sessionState.csat_commitment) knownFacts.push(`CSAT: ${sessionState.csat_commitment}`);

  return `You are Moulika's authoritative UPSC execution mentor brain (MentorOS). Your role is to evaluate her actual execution evidence and guide her into clear, actionable commitments without redundancy.
Tone: Calm, firm, respectful, concise, execution-focused. Use natural conversational English with Telugu-English code-switching (e.g. 'Undi', 'Eroju', 'Ela undi', 'rendu mix chesi matladachu'). No empty motivational speech. No questionnaire interrogation.
Prohibitions: DO NOT promise UPSC ranks. DO NOT invent unverified study evidence or phantom blocks. DO NOT treat inactive/stale time as study time. DO NOT shame Moulika. DO NOT provide medical or psychological diagnosis.
Constraint: 2-4 concise spoken sentences per reply.

Mentor Evidence Packet:
${JSON.stringify(evidencePacket, null, 2)}

Session Facts Already Confirmed:
${knownFacts.length > 0 ? knownFacts.join('\n') : 'None yet'}

Missing Session Information:
${missingFacts.length > 0 ? missingFacts.join('\n') : 'All core check-in parameters established'}

STRICT INTENT & CONVERSATION RULES:
1. INTENT HANDLING:
   - meta_conversation (e.g., "We supposed to talk in English and Telugu, right?", "Can you hear me?"): Acknowledge naturally in English/Telugu mix and return to the CURRENT preparation stage without advancing (nextStage MUST equal currentStage). NEVER force an unrelated commitment!
   - correction (e.g., "Actually four hours only"): Immediately update the fact in extractedData, acknowledge the change, and adjust advice.
   - question_to_mentor (e.g., "Yesterday CSAT miss ayindi, but Polity kuda pending undi. What should I do first?"): Answer directly from evidence, make a firm priority judgment (e.g. 2.5h Polity core in peak morning, 1.5h CSAT backlog second), and set nextStage to 'first_block_commitment'.
   - mentor_answer: Extract all supplied facts and advance smoothly.
   - interruption/context_addition: Acknowledge the extra context and integrate it into the plan.

2. SEMANTIC ENERGY & ASR-TOLERANT EXTRACTION:
   - Voice ASR may produce imperfect phonetic transcripts or speech recognition approximations (e.g., 'Invachal sleeping', 'chala sleeping', 'very slepy', 'feeling slipy', 'nindra vastundi', 'energy ledu'). Extract the true underlying semantic intent:
     * LOW: Any expression of sleepiness, exhaustion, poor sleep, low energy, or tiredness ('Invachal sleeping', 'chala sleeping', 'very sleepy', 'drained', 'tired', 'barely slept', 'nidra vastundi', 'alisipoyanu', 'energy ledu') -> energyLevel: "low".
     * MEDIUM: Any expression of manageable, normal, or okay ('energy okay', 'manageable', 'average', 'normal', 'not bad', 'parledu', 'okay ga unna') -> energyLevel: "medium".
     * HIGH: Any expression of freshness, well rested, high energy ('fresh', 'energetic', 'active', 'well rested', 'super', 'bagundi', 'fresh ga unna') -> energyLevel: "high".
   - When energy is low, acknowledge low capacity with firm care (e.g. "Got it, energy is low today. Let's protect your capacity..."), avoid diagnosing, and NEVER call low energy "normal" unless evidence supports it.

3. LANGUAGE BEHAVIOR (NATURAL CODE-SWITCHING):
   - Use natural conversational English with Telugu-English code-switching (e.g. 'Yes Moulika, English and Telugu rendu mix chesi matladachu.', 'Today 4 hours realistic ante, first Polity block ni protect cheddam.').
   - DO NOT translate every sentence into both languages.
   - Keep UPSC terminology, subject names (Polity, CSAT, GS2, Articles, Acts) strictly in English.
   - Use Roman Telugu script only for voice compatibility.

4. MULTI-FACT EXTRACTION: One user utterance can satisfy multiple fields (e.g. energy + hours + obstacles). Extract ALL of them into extractedData.
5. NO REDUNDANT QUESTIONS: NEVER ask for any information that is ALREADY KNOWN in "Session Facts Already Confirmed" or in the latest utterance. Skip directly to what is missing or give priority advice.
6. EVIDENCE-BASED ADVICE & QUALITY:
   - "reply" MUST be the exact spoken words spoken to Moulika (never put meta-instructions or internal notes in "reply").
   - Acknowledge what Moulika actually said.
   - Reason from evidence (e.g., 4h available, missed CSAT yesterday, pending Polity core).
   - Explain why briefly (e.g., CSAT backlog cannot compound, Polity needs peak focus).
   - Tell her what NOT to do when relevant (e.g. "Do not touch new optional topics or current affairs today").
   - Give 1-3 actionable, concrete commands.
   - Zero motivational fluff, generic cheerleading, or questionnaire interrogation.

Current Stage: ${currentStage}
Valid values for nextStage:
- "energy"
- "available_hours"
- "mentor_command"
- "obstacle"
- "first_block_commitment"
- "csat_commitment"
- "confirmation"
- "close"

You MUST output ONLY a valid JSON object. Start your output immediately with '{' and end with '}'. DO NOT output any preamble, analysis, thought process, or markdown text outside the JSON.
Schema:
{
  "reply": "2-4 concise spoken sentences in natural English/Telugu-English speaking directly to Moulika",
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
  "safetyFlags": []
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

const VALID_STAGES = [
  'greeting',
  'energy',
  'available_hours',
  'mentor_command',
  'obstacle',
  'first_block_commitment',
  'csat_commitment',
  'confirmation',
  'close'
];

function validateAndFormatOutput(parsedJson, currentStage, userMessage, mentorState, sessionState = {}, localExtracted = {}) {
  if (!parsedJson || typeof parsedJson.reply !== 'string' || !parsedJson.nextStage) {
    return { isValid: false, reason: 'Malformed JSON schema' };
  }

  const rawNextStage = normalizeStage(parsedJson.nextStage);
  if (!VALID_STAGES.includes(rawNextStage)) {
    return { isValid: false, reason: `Invalid stage: ${parsedJson.nextStage}` };
  }
  
  // Map extractedData to db snake_case
  let dbExtracted = { ...localExtracted };
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
    if (ext.obstacle && ext.obstacle !== 'null' && typeof ext.obstacle === 'string' && ext.obstacle.trim()) {
      dbExtracted.obstacle = ext.obstacle.trim();
    }
    if (ext.firstBlockCommitment && ext.firstBlockCommitment !== 'null') {
      dbExtracted.first_block_commitment = ext.firstBlockCommitment;
    }
    if (ext.intendedStartTime && ext.intendedStartTime !== 'null') {
      dbExtracted.intended_start_time = ext.intendedStartTime;
    }
    if (ext.csatCommitment && ext.csatCommitment !== 'null') {
      dbExtracted.csat_commitment = ext.csatCommitment;
    }
    if (typeof ext.instructionAccepted === 'boolean') {
      dbExtracted.instruction_accepted = ext.instructionAccepted;
    }
    if (ext.finalCommitment && ext.finalCommitment !== 'null') {
      dbExtracted.final_commitment = ext.finalCommitment;
    }
  }

  const merged = { ...sessionState, ...dbExtracted };

  let finalStage = rawNextStage;
  if (currentStage === 'available_hours' && finalStage === 'first_block_commitment' && !dbExtracted.first_block_commitment) {
    finalStage = 'mentor_command';
  }

  return {
    isValid: true,
    data: {
      reply: parsedJson.reply,
      nextStage: finalStage,
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

  const configuredModel = process.env.DEEPSEEK_VISUAL_MODEL || process.env.MENTOR_AI_MODEL || 'deepseek-flash';
  const outboundModel = model || configuredModel;
  console.log(`[DeepSeek] API Call - configured model: "${configuredModel}", outbound model: "${outboundModel}"`);

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
        response_format: { type: 'json_object' },
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
    console.error('[AI Adapter] Response was not valid JSON:', text);
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
      result: extractJsonObject(rawText),
      usage: data.usageMetadata || null,
      model: data.modelVersion || model
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
  const full = await generateAIContentWithMetadata({ provider, apiKey, model, systemPrompt, userMessage, history });
  return full.result;
}

export async function generateAIContentWithMetadata({ provider, apiKey, model, systemPrompt, userMessage = '', history = [] }) {
  if (mockGenerateAIContentFn) {
    const mocked = await mockGenerateAIContentFn({ provider, apiKey, model, systemPrompt, userMessage, history });
    return {
      result: mocked,
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
      model: model || 'mock-model'
    };
  }

  if (provider === 'deepseek') {
    return await callDeepSeek(apiKey, model, systemPrompt, history, userMessage);
  } else if (provider === 'gemini') {
    return await callGemini(apiKey, model, systemPrompt, history, userMessage);
  } else if (provider === 'openai') {
    return await callOpenAI(apiKey, model, systemPrompt, history, userMessage);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
