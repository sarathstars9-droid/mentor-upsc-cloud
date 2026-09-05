/**
 * Centralized Gemini Cost Tracker
 */

const PRICING_REGISTRY = {
  'gemini-1.5-flash': {
    service_tier: 'STANDARD',
    input_usd_per_million: 0.075,
    output_usd_per_million: 0.30
  },
  'gemini-1.5-pro': {
    service_tier: 'STANDARD',
    input_usd_per_million: 1.25,
    output_usd_per_million: 5.00
  },
  'gemini-2.5-flash': {
    service_tier: 'STANDARD',
    input_usd_per_million: 0.30,
    output_usd_per_million: 2.50
  }
};

const pricing_effective_date = new Date().toISOString().split('T')[0];

export function parseGeminiUsage(usageMetadata, operation, actualModel) {
  if (!usageMetadata) {
    return {
      usage_available: false,
      operation,
      timestamp: new Date().toISOString()
    };
  }

  // Clean model name (e.g. models/gemini-2.5-flash -> gemini-2.5-flash)
  let cleanModel = actualModel || "unknown";
  if (cleanModel.startsWith("models/")) {
    cleanModel = cleanModel.replace("models/", "");
  }

  const pricing = PRICING_REGISTRY[cleanModel];

  if (!pricing) {
    console.warn(`[geminiCostTracker] Unknown model: ${cleanModel}. Cannot estimate cost.`);
    return {
      usage_available: false,
      operation,
      model: cleanModel,
      timestamp: new Date().toISOString(),
      error: "Unknown model pricing"
    };
  }

  const promptTokenCount = usageMetadata.promptTokenCount || 0;
  const candidatesTokenCount = usageMetadata.candidatesTokenCount || 0;
  const thoughtsTokenCount = usageMetadata.thoughtsTokenCount || 0;
  const cachedContentTokenCount = usageMetadata.cachedContentTokenCount || 0;
  const toolUsePromptTokenCount = usageMetadata.toolUsePromptTokenCount || 0;
  const totalTokenCount = usageMetadata.totalTokenCount || 0;

  if (cachedContentTokenCount > 0) {
    console.warn(`[geminiCostTracker] Unexpected cached content tokens > 0 in operation: ${operation}`);
  }

  const billable_input_tokens = promptTokenCount;
  const billable_output_tokens = candidatesTokenCount + thoughtsTokenCount;

  const estimated_cost_usd = (billable_input_tokens / 1000000 * pricing.input_usd_per_million) 
                           + (billable_output_tokens / 1000000 * pricing.output_usd_per_million);

  const usd_to_inr_rate = parseFloat(process.env.USD_TO_INR_RATE || "83.50");

  return {
    usage_available: true,
    operation,
    model: cleanModel,
    pricing_version: pricing_effective_date,
    input_rate_usd_per_million: pricing.input_usd_per_million,
    output_rate_usd_per_million: pricing.output_usd_per_million,
    usd_to_inr_rate: usd_to_inr_rate,
    timestamp: new Date().toISOString(),
    promptTokenCount,
    candidatesTokenCount,
    thoughtsTokenCount,
    cachedContentTokenCount,
    toolUsePromptTokenCount,
    totalTokenCount,
    billable_input_tokens,
    billable_output_tokens,
    estimated_cost_usd
  };
}

export function aggregateCosts(aiCalls) {
  const calls = aiCalls.filter(c => c && c.usage_available);
  if (calls.length === 0) {
    return {
      calls: 0,
      input_tokens: 0,
      output_tokens: 0,
      thinking_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      usd_to_inr_rate: parseFloat(process.env.USD_TO_INR_RATE || "83.50"),
      estimated_cost_inr: 0
    };
  }

  const estimated_cost_usd = calls.reduce((sum, c) => sum + (c.estimated_cost_usd || 0), 0);
  const usd_to_inr_rate = calls[0].usd_to_inr_rate || parseFloat(process.env.USD_TO_INR_RATE || "83.50");
  const estimated_cost_inr = estimated_cost_usd * usd_to_inr_rate;

  return {
    calls: calls.length,
    input_tokens: calls.reduce((sum, c) => sum + (c.promptTokenCount || 0), 0),
    output_tokens: calls.reduce((sum, c) => sum + (c.candidatesTokenCount || 0), 0),
    thinking_tokens: calls.reduce((sum, c) => sum + (c.thoughtsTokenCount || 0), 0),
    total_tokens: calls.reduce((sum, c) => sum + (c.totalTokenCount || 0), 0),
    estimated_cost_usd,
    usd_to_inr_rate,
    estimated_cost_inr
  };
}
