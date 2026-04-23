import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./prelims_gs_economy_tagged.json', 'utf-8'));

const questions = data.questions || [];
const moneyBasicsQuestions = questions.filter(q => q.syllabusNodeId === 'GS3-ECO-PRE-MONEY-BASICS');

console.log(`Total MONEY-BASICS questions: ${moneyBasicsQuestions.length}`);
console.log('\nBreakdown by microtheme:');

const microthemeMap = {};
moneyBasicsQuestions.forEach(q => {
  const mt = q.microtheme || 'NO_MICROTHEME';
  microthemeMap[mt] = (microthemeMap[mt] || 0) + 1;
});

Object.entries(microthemeMap).sort((a, b) => b[1] - a[1]).forEach(([mt, count]) => {
  console.log(`  ${mt}: ${count}`);
});

console.log('\nDetailed list:');
moneyBasicsQuestions.forEach(q => {
  console.log(`${q.id} | ${q.year} | ${q.microtheme}`);
});
