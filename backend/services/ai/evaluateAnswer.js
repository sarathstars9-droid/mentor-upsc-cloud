import { geminiModel } from "./geminiClient.js";

export async function evaluateMainsAnswer({ question, answer, paper, marks, wordLimit }) {
  const prompt = `Return STRICT JSON only. No markdown. No explanation outside JSON.
Evaluate the UPSC Mains answer as a strict but helpful UPSC mentor.
The output must be easy for an aspirant to understand within 30 seconds.

Paper: ${paper}
Marks: ${marks}
Word Limit: ${wordLimit}

Question:
${question}

Student Answer:
${answer}

Return this JSON shape exactly:
{
  "score": "",
  "level": "",
  "examinerImpression": "",
  "topFixes": [],
  "missingDimensions": [],
  "upscStructure": [],
  "improvedIntro": "",
  "improvedConclusion": "",
  "memoryMnemonic": "",
  "finalAdvice": ""
}

Field rules:
1. score: Use realistic UPSC marks (e.g. "4.5/10" or "6/15"). Do not inflate.
2. level: Use one of "Poor", "Below Average", "Average", "Good", "Excellent".
3. examinerImpression: Under 60 words. 30-second impression on relevance, structure, factual accuracy.
4. topFixes: Exactly 3 points. Specific and actionable (e.g., "Convert the answer into a direct comparison...").
5. missingDimensions: 3 to 6 points. Exact missing UPSC dimensions (e.g., "Political transformation: tribal polity to territorial kingdoms").
6. upscStructure: Array of the ideal answer structure.
7. improvedIntro: One UPSC-ready introduction (max 45 words).
8. improvedConclusion: One UPSC-ready conclusion (max 45 words).
9. memoryMnemonic: One simple mnemonic (e.g., "SEPR: Society, Economy, Polity, Religion").
10. finalAdvice: One practical next action before rewriting.

Strict quality rules:
- Do not produce generic feedback.
- Do not give long essay-like review.
- Do not invent fake facts or scholars.
- If the answer has factual errors, mention them clearly.
- Language must be simple and mentor-like.
- The output must be parseable JSON. No markdown outside JSON. No trailing commas.`;

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
    
    // Return safe fallback instead of crashing
    return {
      score: "N/A",
      level: "Error",
      examinerImpression: "Evaluation completed but AI failed to format the response properly.",
      topFixes: [],
      missingDimensions: [],
      upscStructure: [],
      improvedIntro: "",
      improvedConclusion: "",
      memoryMnemonic: "",
      finalAdvice: "Raw AI Output:\n" + rawText
    };
  }
}
