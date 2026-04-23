import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./prelims_gs_economy_tagged.json', 'utf-8'));
const questions = data.questions || [];

// Look for questions with keywords related to monetary policy
const keywords = ['Repo', 'Reverse Repo', 'MPC', 'Monetary Policy Committee', 'Liquidity', 'Bank rate', 'Open market'];
const monetaryPolicyQuestions = questions.filter(q => {
  const question = (q.question || '').toLowerCase();
  return keywords.some(kw => question.includes(kw.toLowerCase()));
});

console.log(`Questions with Monetary Policy keywords: ${monetaryPolicyQuestions.length}`);
console.log('\nBreakdown by syllabusNodeId:');

const nodeMap = {};
monetaryPolicyQuestions.forEach(q => {
  const node = q.syllabusNodeId || 'UNKNOWN';
  if (!nodeMap[node]) nodeMap[node] = [];
  nodeMap[node].push({id: q.id, year: q.year, microtheme: q.microtheme});
});

Object.entries(nodeMap).forEach(([node, qs]) => {
  console.log(`\n${node}: ${qs.length} questions`);
  qs.forEach(q => {
    console.log(`  ${q.id} | ${q.year} | ${q.microtheme}`);
  });
});
