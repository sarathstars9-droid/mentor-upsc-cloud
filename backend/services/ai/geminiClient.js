import "../../config/env.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiModel(modelName = "gemini-2.5-flash") {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.MENTOR_AI_API_KEY;
  if (!apiKey) {
    console.error("[geminiClient] Gemini API key missing!");
  }
  const genAI = new GoogleGenerativeAI(apiKey || "dummy-api-key");
  return genAI.getGenerativeModel({ model: modelName });
}

export const geminiModel = new Proxy({}, {
  get(target, prop) {
    const model = getGeminiModel();
    const value = model[prop];
    return typeof value === "function" ? value.bind(model) : value;
  }
});
