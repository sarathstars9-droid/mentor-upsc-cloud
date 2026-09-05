import { geminiModel } from './geminiClient.js';
import { parseGeminiUsage } from '../geminiCostTracker.js';

export async function extractHandwrittenAnswer(images, customPrompt) {
  const prompt = customPrompt || `You are extracting a handwritten UPSC Mains answer from uploaded answer sheet images.

Rules:
1. Extract only the student's answer text.
2. Preserve original wording as closely as possible.
3. Maintain paragraph order, headings, numbering, and bullets.
4. Combine pages in uploaded order.
5. Do not improve grammar.
6. Do not evaluate.
7. Do not summarize.
8. If a word is unreadable, write [unclear].
9. Return the response as a strict JSON object with this exact structure:
{
  "text": "Clean extracted answer text here...",
  "visualArtifacts": {
    "detected": false,
    "flowchart": false,
    "diagram": false,
    "timeline": false,
    "table": false,
    "map": false,
    "graph": false,
    "geographicalSketch": false,
    "types": []
  }
}

Important for visualArtifacts:
- Inspect the IMAGE itself, not merely OCR text.
- Detect visually drawn answer-presentation artifacts based on visible layout/shapes/spatial organization.
- Do NOT require the candidate to literally write words such as "diagram", "flowchart", "map", etc.
- Do NOT classify ordinary headings, bullet lists, underlining, or boxes around plain text as diagrams.
- Examples: Boxes connected by arrows (FLOWCHART), central concept with branches (CONCEPT_DIAGRAM), spatial outline (MAP).
- Set detected to true if ANY visual artifact is present. Populate types with appropriate strings (e.g. "CONCEPT_DIAGRAM", "FLOWCHART", "MAP").

Do not wrap the JSON output in markdown blocks (like \`\`\`json).`;

  try {
    const formattedImages = (images || []).map(img => ({
      inlineData: {
        data: img.inlineData?.data || "",
        mimeType: img.inlineData?.mimeType || "image/jpeg"
      }
    }));

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...formattedImages
          ]
        }
      ],
      generationConfig: customPrompt ? undefined : {
        responseMimeType: "application/json"
      }
    });

    const rawText = result.response.text();
    let parsedText = rawText;
    let visualArtifacts = null;

    try {
      if (!customPrompt) {
        const parsed = JSON.parse(rawText);
        parsedText = parsed.text || "";
        visualArtifacts = parsed.visualArtifacts || null;
      }
    } catch (parseErr) {
      console.warn("Failed to parse extractHandwrittenAnswer JSON, returning raw text", parseErr);
    }

    return {
      text: parsedText,
      visualArtifacts: visualArtifacts,
      usage: parseGeminiUsage(result.response.usageMetadata, "MAINS_OCR", result.response.modelVersion || "gemini-2.5-flash")
    };
  } catch (err) {
    console.error("Gemini Vision Extraction Error:", err);
    throw err;
  }
}
