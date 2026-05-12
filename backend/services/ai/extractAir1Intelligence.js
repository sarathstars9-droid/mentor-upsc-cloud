import { geminiModel } from "./geminiClient.js";

function stripMarkdownFence(rawText = "") {
  let cleanText = String(rawText || "").trim();

  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7);
  }
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }

  return cleanText.trim();
}

const BASE_PROMPT = `You are the MentorOS AIR-1 Intelligence Extractor.

Your job is NOT to evaluate the answer again.
The AIR-1 evaluation is already completed.

Your task is to extract structured intelligence signals from the AIR-1 review for MentorOS database tracking.

Analyze:
1. UPSC question
2. Student answer
3. AIR-1 review

Supported papers:
GS1, GS2, GS3, GS4, Essay, Geography Optional.

Return STRICT JSON ONLY.
Do not write markdown.
Do not explain.
Do not wrap JSON in triple backticks.
Do not hallucinate.
Use only evidence present in AIR-1 review.
If evidence is missing, return null or empty array.

If output is not valid JSON, regenerate silently and return corrected JSON only.

Keep all evidence snippets under 12 words.
Keep mentorSummary under 60 words.

Allowed enum values:

overallLevel:
poor, below_average, average, good, excellent, null

severity:
low, medium, high

reviewQuality:
low, medium, high

paper:
GS1, GS2, GS3, GS4, Essay, Geography Optional, Unknown

questionNature:
static, analytical, current_affairs, case_study, ethical, geographical, essay, optional, mixed, unknown

structure level:
poor, average, good, null

QUESTION:
{{question}}

STUDENT ANSWER:
{{studentAnswer}}

AIR-1 REVIEW:
{{air1Review}}

Return this JSON schema only:

{
  "answerMeta": {
    "paper": null,
    "subjectArea": null,
    "questionDemand": null,
    "questionNature": null
  },
  "overallLevel": null,
  "estimatedMarks": {
    "scored": null,
    "outOf": null,
    "marksSource": "explicit_in_review"
  },
  "oneAnswerWeaknessSignals": [
    {
      "weakness": null,
      "severity": null,
      "evidenceSnippet": null,
      "confidence": 0
    }
  ],
  "strengthSignals": [
    {
      "strength": null,
      "evidenceSnippet": null,
      "confidence": 0
    }
  ],
  "missingDimensions": [
    {
      "dimension": null,
      "normalizedKey": null,
      "customLabel": null,
      "severity": null,
      "evidenceSnippet": null
    }
  ],
  "answerStructure": {
    "intro": {
      "level": null,
      "evidenceSnippet": null
    },
    "body": {
      "level": null,
      "evidenceSnippet": null
    },
    "conclusion": {
      "level": null,
      "evidenceSnippet": null
    }
  },
  "upscSkills": {
    "analysis": {
      "score": 0,
      "evidenceSnippet": null
    },
    "multidimensionality": {
      "score": 0,
      "evidenceSnippet": null
    },
    "examples": {
      "score": 0,
      "evidenceSnippet": null
    },
    "currentAffairsUsage": {
      "score": 0,
      "evidenceSnippet": null
    },
    "structure": {
      "score": 0,
      "evidenceSnippet": null
    },
    "conceptualDepth": {
      "score": 0,
      "evidenceSnippet": null
    },
    "clarity": {
      "score": 0,
      "evidenceSnippet": null
    }
  },
  "suggestedDrills": [
    {
      "drill": null,
      "targetWeakness": null,
      "priority": null,
      "evidenceBasis": null
    }
  ],
  "mentorSummary": null,
  "confidence": {
    "patternConfidence": 0,
    "reviewQuality": null,
    "confidenceReason": null
  }
}

Rules:
1. Do not create recurring patterns from one answer.
2. Do not generate weekly plan here.
3. Do not re-score if marks are absent.
4. Scores inside upscSkills must be integers from 0 to 10.
5. confidence values must be integers from 0 to 100.
6. Evidence snippets must come only from AIR-1 review.
7. For custom dimensions, provide normalizedKey and customLabel.
8. If AIR-1 review is vague, reduce confidence.`;

export async function extractAir1Intelligence({
  question,
  studentAnswer,
  air1Review,
}) {
  const prompt = BASE_PROMPT
    .replace("{{question}}", String(question || ""))
    .replace("{{studentAnswer}}", String(studentAnswer || ""))
    .replace("{{air1Review}}", String(air1Review || ""));

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
      const isRetryable =
        retryStatuses.includes(status) ||
        retryStatuses.some((s) => msg.includes(String(s)));

      if (attempt < maxRetries && isRetryable) {
        console.warn(
          `[extractAir1Intelligence] Gemini API Error (status: ${
            status || "unknown"
          }), retrying in ${retryDelays[attempt]}ms (Attempt ${
            attempt + 1
          }/${maxRetries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      } else {
        console.error(
          "[extractAir1Intelligence] Unrecoverable error generating content from Gemini."
        );
        throw error;
      }
    }
  }

  try {
    rawText = result.response.text();
    const cleanText = stripMarkdownFence(rawText);
    return JSON.parse(cleanText);
  } catch (error) {
    console.error(
      "[extractAir1Intelligence] Failed to parse Gemini response as JSON."
    );
    console.error("Raw Output:", rawText);
    throw new Error(
      `[extractAir1Intelligence] JSON parsing failed: ${
        error?.message || String(error)
      }`
    );
  }
}
