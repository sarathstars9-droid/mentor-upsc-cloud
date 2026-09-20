// backend/services/mentorUsageService.js
// Centralized pricing, token usage instrumentation, and monthly cost calculations

import { query } from '../db/index.js';

export const PRICING_CONFIG = {
  USD_INR_RATE: parseFloat(process.env.MENTOR_USD_INR || '96.0'),
  MONTHLY_BUDGET_INR: parseFloat(process.env.MENTOR_MONTHLY_BUDGET_INR || '700.0'),

  // Rates per 1,000,000 tokens (USD)
  GEMINI_LIVE: {
    TEXT_INPUT_PER_1M: 0.75,
    AUDIO_INPUT_PER_1M: 3.00,
    TEXT_OUTPUT_PER_1M: 4.50,
    AUDIO_OUTPUT_PER_1M: 12.00,
  },

  DEEPSEEK: {
    INPUT_PER_1M: 0.14,
    INPUT_CACHE_HIT_PER_1M: 0.014,
    OUTPUT_PER_1M: 0.28,
  },

  OPENAI_FALLBACK: {
    INPUT_PER_1M: 0.15,
    OUTPUT_PER_1M: 0.60,
  }
};

/**
 * Record token usage from Gemini Multimodal Live API
 */
export async function recordGeminiLiveUsage({
  userId,
  sessionId = null,
  model = process.env.MENTOR_LIVE_MODEL || 'gemini-3.8-live',
  usageMetadata = {},
  metadata = {}
}) {
  try {
    const usdInrRate = PRICING_CONFIG.USD_INR_RATE;

    let inputTextTokens = 0;
    let inputAudioTokens = 0;
    let outputTextTokens = 0;
    let outputAudioTokens = 0;

    // Parse usageMetadata structure from Gemini Live
    // Can contain promptTokensDetails and candidatesTokensDetails
    if (Array.isArray(usageMetadata.promptTokensDetails)) {
      for (const d of usageMetadata.promptTokensDetails) {
        if (d.modality === 'AUDIO') inputAudioTokens += (d.tokenCount || 0);
        else if (d.modality === 'TEXT') inputTextTokens += (d.tokenCount || 0);
      }
    } else if (usageMetadata.promptTokenCount) {
      // If breakdown not detailed, default to audio input in voice session
      inputAudioTokens = usageMetadata.promptTokenCount;
    }

    if (Array.isArray(usageMetadata.candidatesTokensDetails)) {
      for (const d of usageMetadata.candidatesTokensDetails) {
        if (d.modality === 'AUDIO') outputAudioTokens += (d.tokenCount || 0);
        else if (d.modality === 'TEXT') outputTextTokens += (d.tokenCount || 0);
      }
    } else if (usageMetadata.candidatesTokenCount) {
      outputAudioTokens = usageMetadata.candidatesTokenCount;
    }

    const costUsd =
      (inputTextTokens / 1_000_000) * PRICING_CONFIG.GEMINI_LIVE.TEXT_INPUT_PER_1M +
      (inputAudioTokens / 1_000_000) * PRICING_CONFIG.GEMINI_LIVE.AUDIO_INPUT_PER_1M +
      (outputTextTokens / 1_000_000) * PRICING_CONFIG.GEMINI_LIVE.TEXT_OUTPUT_PER_1M +
      (outputAudioTokens / 1_000_000) * PRICING_CONFIG.GEMINI_LIVE.AUDIO_OUTPUT_PER_1M;

    const costInr = costUsd * usdInrRate;

    await query(
      `INSERT INTO public.mentor_ai_usage (
        user_id, mentor_session_id, provider, model, usage_type,
        input_audio_tokens, output_audio_tokens, input_text_tokens, output_text_tokens,
        estimated_cost_usd, usd_inr_rate, estimated_cost_inr, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        userId,
        sessionId,
        'gemini',
        model,
        'voice_live',
        inputAudioTokens,
        outputAudioTokens,
        inputTextTokens,
        outputTextTokens,
        costUsd,
        usdInrRate,
        costInr,
        JSON.stringify({ ...metadata, rawUsage: usageMetadata })
      ]
    );

    return { costUsd, costInr };
  } catch (err) {
    console.error('[MentorUsage] Error recording Gemini Live usage:', err.message);
    return null;
  }
}

/**
 * Record token usage from DeepSeek / OpenAI Turn Reasoning
 */
export async function recordMentorTurnUsage({
  userId,
  sessionId = null,
  provider = 'deepseek',
  model = process.env.MENTOR_AI_MODEL || 'deepseek-flash',
  usage = {},
  metadata = {}
}) {
  try {
    const usdInrRate = PRICING_CONFIG.USD_INR_RATE;
    const promptTokens = usage.prompt_tokens || usage.promptTokens || usage.input_tokens || 0;
    const completionTokens = usage.completion_tokens || usage.completionTokens || usage.output_tokens || 0;
    const promptCachedTokens = usage.prompt_cache_hit_tokens || 0;

    let costUsd = 0;
    if (provider === 'deepseek') {
      const nonCached = Math.max(0, promptTokens - promptCachedTokens);
      costUsd =
        (nonCached / 1_000_000) * PRICING_CONFIG.DEEPSEEK.INPUT_PER_1M +
        (promptCachedTokens / 1_000_000) * PRICING_CONFIG.DEEPSEEK.INPUT_CACHE_HIT_PER_1M +
        (completionTokens / 1_000_000) * PRICING_CONFIG.DEEPSEEK.OUTPUT_PER_1M;
    } else {
      costUsd =
        (promptTokens / 1_000_000) * PRICING_CONFIG.OPENAI_FALLBACK.INPUT_PER_1M +
        (completionTokens / 1_000_000) * PRICING_CONFIG.OPENAI_FALLBACK.OUTPUT_PER_1M;
    }

    const costInr = costUsd * usdInrRate;

    await query(
      `INSERT INTO public.mentor_ai_usage (
        user_id, mentor_session_id, provider, model, usage_type,
        input_audio_tokens, output_audio_tokens, input_text_tokens, output_text_tokens,
        estimated_cost_usd, usd_inr_rate, estimated_cost_inr, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        userId,
        sessionId,
        provider,
        model,
        'mentor_turn',
        0,
        0,
        promptTokens,
        completionTokens,
        costUsd,
        usdInrRate,
        costInr,
        JSON.stringify({ ...metadata, rawUsage: usage })
      ]
    );

    return { costUsd, costInr };
  } catch (err) {
    console.error('[MentorUsage] Error recording turn usage:', err.message);
    return null;
  }
}

/**
 * Fetch aggregated monthly usage and budget progress
 */
export async function getMonthlyUsage(userId, monthKey = null) {
  try {
    const budgetInr = PRICING_CONFIG.MONTHLY_BUDGET_INR;
    const now = new Date();
    const currentMonthKey = monthKey || now.toISOString().slice(0, 7); // e.g. "2026-09"
    const startOfMonth = `${currentMonthKey}-01T00:00:00Z`;

    // Compute end of month
    const parts = currentMonthKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const nextMonth = month === 12 ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1));
    const endOfMonth = nextMonth.toISOString();

    const { rows } = await query(
      `SELECT 
        provider,
        usage_type,
        COUNT(*) as total_calls,
        COALESCE(SUM(input_audio_tokens), 0) as total_input_audio_tokens,
        COALESCE(SUM(output_audio_tokens), 0) as total_output_audio_tokens,
        COALESCE(SUM(input_text_tokens), 0) as total_input_text_tokens,
        COALESCE(SUM(output_text_tokens), 0) as total_output_text_tokens,
        COALESCE(SUM(estimated_cost_usd), 0) as total_cost_usd,
        COALESCE(SUM(estimated_cost_inr), 0) as total_cost_inr
       FROM public.mentor_ai_usage
       WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
       GROUP BY provider, usage_type`,
      [userId, startOfMonth, endOfMonth]
    );

    let geminiCostInr = 0;
    let deepseekCostInr = 0;
    let otherCostInr = 0;
    let totalCostInr = 0;
    let totalCostUsd = 0;

    for (const r of rows) {
      const costInr = parseFloat(r.total_cost_inr || '0');
      const costUsd = parseFloat(r.total_cost_usd || '0');
      totalCostInr += costInr;
      totalCostUsd += costUsd;

      if (r.provider === 'gemini') {
        geminiCostInr += costInr;
      } else if (r.provider === 'deepseek') {
        deepseekCostInr += costInr;
      } else {
        otherCostInr += costInr;
      }
    }

    // Days elapsed in current month for projection
    const dayOfMonth = now.getUTCDate();
    const daysInMonth = new Date(year, month, 0).getDate();
    const projectedMonthCostInr = dayOfMonth > 0 ? (totalCostInr / dayOfMonth) * daysInMonth : totalCostInr;
    const remainingInr = Math.max(0, budgetInr - totalCostInr);

    return {
      monthKey: currentMonthKey,
      budgetInr,
      totalCostInr: Math.round(totalCostInr * 100) / 100,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      geminiCostInr: Math.round(geminiCostInr * 100) / 100,
      deepseekCostInr: Math.round(deepseekCostInr * 100) / 100,
      otherCostInr: Math.round(otherCostInr * 100) / 100,
      remainingInr: Math.round(remainingInr * 100) / 100,
      projectedMonthCostInr: Math.round(projectedMonthCostInr * 100) / 100,
      breakdown: rows
    };
  } catch (err) {
    console.error('[MentorUsage] Error getting monthly usage:', err.message);
    return {
      budgetInr: PRICING_CONFIG.MONTHLY_BUDGET_INR,
      totalCostInr: 0,
      geminiCostInr: 0,
      deepseekCostInr: 0,
      remainingInr: PRICING_CONFIG.MONTHLY_BUDGET_INR,
      projectedMonthCostInr: 0,
      breakdown: []
    };
  }
}
