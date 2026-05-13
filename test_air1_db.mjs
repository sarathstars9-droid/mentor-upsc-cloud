import { saveAir1ReviewIntelligence } from "./backend/repositories/air1ReviewRepository.js";

async function test() {
  try {
    const res = await saveAir1ReviewIntelligence({
      userId: 'test_user',
      question: 'Discuss the impact of climate change.',
      studentAnswer: 'Climate change has a huge impact.',
      air1ReviewText: 'This is a test AIR-1 review text.',
      paper: 'GS3',
      extractedJson: { level: 'Advanced', score: 6.5 },
      overallLevel: 'Advanced',
      estimatedScore: 6.5,
      coreWeaknesses: ['lack of examples'],
      focusAreas: ['add more data']
    });
    console.log("Insert successful:", res);
    process.exit(0);
  } catch (err) {
    console.error("Insert failed:", err);
    process.exit(1);
  }
}

test();
