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
9. memoryMnemonic: Must be an empty string. Final mnemonic is generated only in AIR-1 Review.
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

  rawText = result.response.text();
  let parsed;

  try {
    const jsonCandidate = extractJsonObject(rawText);
    parsed = JSON.parse(jsonCandidate);
  } catch (firstErr) {
    console.warn("[evaluate-answer] JSON parse failed on first attempt", {
      error: firstErr.message,
      preview: rawText?.slice(0, 500),
    });
    try {
      const repairedCandidate = repairJsonCandidate(rawText);
      parsed = JSON.parse(repairedCandidate);
    } catch (secondErr) {
      console.warn("[evaluate-answer] Failed to parse Gemini JSON after repair", {
        firstError: firstErr.message,
        secondError: secondErr.message,
        preview: rawText?.slice(0, 500),
      });
      return {
        score: "N/A",
        level: "Format Issue",
        examinerImpression: "Review completed, but structured formatting failed. Showing raw mentor notes below.",
        topFixes: [],
        missingDimensions: [],
        upscStructure: [],
        improvedIntro: "",
        improvedConclusion: "",
        memoryMnemonic: "",
        finalAdvice: "Rerun Quick Review once.",
        rawOutput: rawText
      };
    }
  }



  return {
    score: parsed.score || "N/A",
    level: parsed.level || "Format Issue",
    examinerImpression: parsed.examinerImpression || "Evaluation completed.",
    topFixes: Array.isArray(parsed.topFixes) ? parsed.topFixes.slice(0, 3) : [],
    missingDimensions: Array.isArray(parsed.missingDimensions) ? parsed.missingDimensions : [],
    upscStructure: Array.isArray(parsed.upscStructure) ? parsed.upscStructure : [],
    improvedIntro: parsed.improvedIntro || "",
    improvedConclusion: parsed.improvedConclusion || "",
    memoryMnemonic: "",
    finalAdvice: parsed.finalAdvice || ""
  };
}

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  let text = rawText.trim();

  // Strip markdown fences
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  // Strip common Gemini prefixes
  text = text.replace(/^Raw AI Output:\s*/i, "").trim();
  text = text.replace(/^JSON:\s*/i, "").trim();

  // Extract first JSON object
  const firstBrace = text.indexOf("{");
  const lastBrace  = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text;
}

function repairJsonCandidate(rawText) {
  if (!rawText || typeof rawText !== "string") return rawText;

  let repaired = rawText.trim();

  // Strip markdown fences
  repaired = repaired
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  // Extract first JSON object
  const firstBrace = repaired.indexOf("{");
  const lastBrace  = repaired.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    repaired = repaired.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  // Normalize smart/curly quotes to straight quotes
  repaired = repaired
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Fix invalid score format like "4./10"
  repaired = repaired.replace(/"score"\s*:\s*"(\d+)\.\/( \d+)"/, '"score":"$1/$2"');

  // Strip control characters that break JSON
  repaired = repaired.replace(/[\u0000-\u001F\u007F]/g, (ch) => {
    if (ch === "\n" || ch === "\r" || ch === "\t") return " ";
    return "";
  });

  return repaired;
}
