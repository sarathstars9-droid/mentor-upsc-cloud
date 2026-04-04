import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./prelims_gs_economy_tagged.json', 'utf-8'));
const questions = data.questions || [];

// Check all keys in a question object
if (questions.length > 0) {
  console.log('Keys in a question object:');
  console.log(Object.keys(questions[0]));
  
  console.log('\nLooking for questions with "subtopic" field:');
  const withSubtopic = questions.filter(q => q.subtopic);
  console.log(`Found ${withSubtopic.length} with subtopic`);
  if (withSubtopic.length > 0) {
    console.log(Object.keys(withSubtopic[0]));
  }
  
  console.log('\nAll unique fields across all questions:');
  const allKeys = new Set();
  questions.forEach(q => {
    Object.keys(q).forEach(k => allKeys.add(k));
  });
  console.log(Array.from(allKeys).sort());
}
