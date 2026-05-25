import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.log("Gemini API key missing");
}
console.log("Gemini key loaded:", apiKey ? apiKey.slice(0, 8) : "MISSING");

const genAI = new GoogleGenerativeAI(apiKey || "dummy-api-key");

const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

export { geminiModel };
