import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./prelims_gs_economy_tagged.json', 'utf-8'));
const questions = data.questions || [];

// Get all MONEY-BASICS questions
const moneyBasicsQuestions = questions.filter(q => q.syllabusNodeId === 'GS3-ECO-PRE-MONEY-BASICS');

console.log('='.repeat(80));
console.log('GS3-ECO-PRE-MONEY-BASICS NODE ANALYSIS');
console.log('='.repeat(80));

console.log(`\n1. TOTAL COUNT: ${moneyBasicsQuestions.length} questions`);

console.log('\n2. DISTINCT MICROTHEME/SUBTOPIC VALUES AND THEIR FREQUENCY:\n');

const microthemeFreq = {};
moneyBasicsQuestions.forEach(q => {
  const mt = q.microtheme || 'NO_VALUE';
  microthemeFreq[mt] = (microthemeFreq[mt] || 0) + 1;
});

// Sort by count descending
const sorted = Object.entries(microthemeFreq).sort((a, b) => b[1] - a[1]);

sorted.forEach(([mt, count], idx) => {
  console.log(`   ${idx + 1}. "${mt}": ${count}`);
});

console.log('\n3. FULL QUESTION LISTING WITH ALL DETAILS:\n');

console.log('ID | Year | Microtheme | Section');
console.log('-'.repeat(100));

moneyBasicsQuestions.sort((a, b) => b.year - a.year).forEach(q => {
  console.log(`${q.id} | ${q.year} | ${q.microtheme} | ${q.section}`);
});

console.log('\n4. BREAKDOWN BY YEAR:\n');

const byYear = {};
moneyBasicsQuestions.forEach(q => {
  byYear[q.year] = (byYear[q.year] || 0) + 1;
});

Object.keys(byYear).sort((a, b) => b - a).forEach(year => {
  console.log(`   ${year}: ${byYear[year]} questions`);
});

console.log('\n5. SUMMARY:\n');
console.log(`Total questions in GS3-ECO-PRE-MONEY-BASICS: ${moneyBasicsQuestions.length}`);
console.log(`Total distinct microtheme values: ${sorted.length}`);
console.log('\nMicrotheme breakdown:');
sorted.forEach(([mt, count]) => {
  console.log(`   - ${mt}: ${count}`);
});
