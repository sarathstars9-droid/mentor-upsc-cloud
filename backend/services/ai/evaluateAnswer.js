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
9. memoryMnemonic: Return one memorable, theme-based sentence, not an acronym list.
   - Do NOT use acronym-only hooks like SEP-R, VEST, VESTW, PEARL, etc.
   - Do NOT just list dimensions.
   - Use a story-like memory sentence connected to the question theme.
   - For transformation/change questions, use "From X to Y" pattern.
   - For comparison questions, use contrast pairs.
   - For causes/factors questions, use a cause-chain sentence.
   - For distribution questions, use a location-flow sentence.
   - Keep it under 30 words.
   - Make it easy to revise before exam.
   - If the memory hook looks like an acronym or plain list, regenerate it internally before returning JSON.
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
    
    const jsonCandidate = extractJsonObject(rawText);
    let parsed;
    try {
      parsed = JSON.parse(jsonCandidate);
    } catch (err) {
      console.warn("[evaluate-answer] Failed to parse Gemini JSON", { error: err.message });
      
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
        finalAdvice: "Review the mentor notes and rerun Quick Review if needed.",
        rawOutput: rawText
      };
    }

    // Validate memoryMnemonic
    let memoryHook = parsed.memoryMnemonic || "";
    if (memoryHook) {
      const isBadPattern = 
        /^[A-Z](-[A-Z])+/.test(memoryHook) || 
        /^[A-Z]{3,}:\s/.test(memoryHook) || 
        (memoryHook.split(",").length >= 3 && memoryHook.split(" ").length < 15) || 
        /Society,\s*Economy,\s*Polity/i.test(memoryHook);
      
      if (isBadPattern) {
        if (/Vedic/i.test(question || "")) {
          memoryHook = "From cattle to crops, clans to kingdoms, simple worship to sacrifices, and flexible varna to fixed hierarchy.";
        } else {
          memoryHook = "From old pattern to new pattern: economy, society, polity and culture changed together.";
        }
      }
    }

    // Schema normalization
    return {
      score: parsed.score || "N/A",
      level: parsed.level || "Format Issue",
      examinerImpression: parsed.examinerImpression || "Evaluation completed.",
      topFixes: Array.isArray(parsed.topFixes) ? parsed.topFixes.slice(0, 3) : [],
      missingDimensions: Array.isArray(parsed.missingDimensions) ? parsed.missingDimensions : [],
      upscStructure: Array.isArray(parsed.upscStructure) ? parsed.upscStructure : (parsed.upscStructure ? [parsed.upscStructure] : []),
      improvedIntro: parsed.improvedIntro || "",
      improvedConclusion: parsed.improvedConclusion || "",
      memoryMnemonic: memoryHook,
      finalAdvice: parsed.finalAdvice || ""
    };

  } catch (error) {
    console.warn("[evaluate-answer] Failed to read Gemini response", { error: error.message });
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
      finalAdvice: "Review the mentor notes and rerun Quick Review if needed.",
      rawOutput: rawText
    };
  }
}

function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  let text = rawText.trim();

  // Remove markdown fences
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  // Remove common prefixes if Gemini adds them
  text = text.replace(/^Raw AI Output:\s*/i, "").trim();
  text = text.replace(/^JSON:\s*/i, "").trim();

  // Extract JSON object between first { and last }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text;
}
