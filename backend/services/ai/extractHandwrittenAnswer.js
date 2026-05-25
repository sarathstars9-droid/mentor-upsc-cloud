import { geminiModel } from './geminiClient.js';

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
9. Return only clean extracted answer text.`;

  try {
    const result = await geminiModel.generateContent([prompt, ...images]);
    return result.response.text();
  } catch (err) {
    console.error("Gemini Vision Extraction Error:", err);
    throw err;
  }
}
