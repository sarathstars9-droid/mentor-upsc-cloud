import { geminiModel } from './geminiClient.js';

export async function extractQuestionAnswerFromImages(images) {
  const prompt = `You are extracting and classifying a UPSC mains answer sheet. The uploaded file may contain a question and candidate answer. Extract the actual exam question and candidate answer separately. Also classify the question into the most likely paper: GS1, GS2, GS3, GS4, Essay, or Geography Optional. Identify subject, topic, and microtheme if possible. Do not evaluate or rewrite. Return strict JSON only.

The response must be a valid JSON object matching the following structure:
{
  "success": true,
  "questionText": "The extracted question text here",
  "answerText": "The extracted candidate written answer text here",
  "detectedMetadata": {
    "paper": "GS1, GS2, GS3, GS4, Essay, or Geography Optional",
    "subject": "The detected subject (e.g. History, Polity, Economy, etc.)",
    "topic": "The detected topic",
    "microtheme": "The detected microtheme if possible",
    "sourceType": "UPSC PYQ, Institute Test, or Custom Practice",
    "questionNumber": "The question number if present",
    "year": "The year of the question if present",
    "wordLimit": 250
  },
  "confidence": {
    "questionText": 0.95,
    "answerText": 0.85,
    "paper": 0.9,
    "subject": 0.8,
    "splitAccuracy": 0.9
  },
  "warnings": []
}

Ensure confidence values are numbers between 0 and 1. Do not wrap the JSON output in markdown blocks (like \`\`\`json).`;

  try {
    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...images
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
    
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Vision Question-Answer Extraction Error:", err);
    throw err;
  }
}
