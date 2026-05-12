import { geminiModel } from "./geminiClient.js";

export async function evaluateMainsAnswer({ question, answer, paper, marks, wordLimit }) {
  const prompt = `You are an expert UPSC Mains evaluator. 
Evaluate the following answer to the given question.
Paper: ${paper}
Marks: ${marks}
Word Limit: ${wordLimit}

Question:
${question}

Student Answer:
${answer}

Return ONLY a valid JSON object with the following structure, with no markdown formatting, no \`\`\`json blocks, and no text before or after:
{
  "score": <number out of ${marks}>,
  "max_score": ${marks},
  "verdict": "<string: brief overall verdict>",
  "intro_quality": <number 0 to 10>,
  "structure_quality": <number 0 to 10>,
  "analysis_depth": <number 0 to 10>,
  "multidimensionality": <number 0 to 10>,
  "examples_usage": <number 0 to 10>,
  "current_affairs_usage": <boolean>,
  "committee_or_report_usage": <boolean>,
  "constitutional_support": <boolean>,
  "stakeholder_analysis": <boolean>,
  "conclusion_quality": <number 0 to 10>,
  "major_weaknesses": ["<string>", ...],
  "strengths": ["<string>", ...],
  "improvement_tasks": ["<string>", ...],
  "weakness_tags": ["<string>", ...]
}`;

  let rawText = "";
  let result;
  
  const maxRetries = 3;
  const retryDelays = [1500, 3000, 5000];
  const retryStatuses = [429, 500, 502, 503, 504];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result = await geminiModel.generateContent(prompt);
      break;
    } catch (error) {
      const status = error?.status || error?.response?.status;
      const msg = error?.message || "";
      const isRetryable = retryStatuses.includes(status) || retryStatuses.some(s => msg.includes(String(s)));

      if (attempt < maxRetries && isRetryable) {
        console.warn(`[evaluateMainsAnswer] Gemini API Error (status: ${status || 'unknown'}), retrying in ${retryDelays[attempt]}ms (Attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      } else {
        console.error("[evaluateMainsAnswer] Unrecoverable error generating content from Gemini.");
        throw error;
      }
    }
  }

  try {
    rawText = result.response.text();
    
    // Defensive parsing
    let cleanText = rawText.trim();
    if (cleanText.startsWith("\`\`\`json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith("\`\`\`")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("\`\`\`")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    return JSON.parse(cleanText);
  } catch (error) {
    console.error("[evaluateMainsAnswer] Error or Failed to parse JSON.");
    console.error("Raw Output:", rawText);
    console.error("Error Detail:", error);
    throw error;
  }
}
