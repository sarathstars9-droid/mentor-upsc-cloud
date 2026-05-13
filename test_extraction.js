import { extractHandwrittenAnswer } from "./backend/services/ai/extractHandwrittenAnswer.js";

async function test() {
  try {
    const fakeImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const images = [
      {
        inlineData: {
          data: fakeImageBase64,
          mimeType: "image/png"
        }
      }
    ];

    const result = await extractHandwrittenAnswer(images);
    console.log("Extraction Result:", result);
    process.exit(0);
  } catch (err) {
    console.error("Extraction failed:", err);
    process.exit(1);
  }
}

test();
