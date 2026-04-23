import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./prelims_gs_economy_tagged.json', 'utf-8'));
const questions = data.questions || [];

// Look for specific monetary policy terms
const terms = {
  'Repo': 0,
  'Reverse Repo': 0,
  'MPC': 0,
  'Monetary Policy Committee': 0,
  'Liquidity': 0,
  'Bank rate': 0,
  'Open market': 0,
  'RBI': 0
};

questions.forEach(q => {
  const text = (q.question || '').toLowerCase();
  Object.keys(terms).forEach(term => {
    if (text.includes(term.toLowerCase())) {
      terms[term]++;
    }
  });
});

console.log('Question counts by keyword:');
Object.entries(terms).forEach(([term, count]) => {
  console.log(`  ${term}: ${count}`);
});

// Search more specifically
console.log('\n\nDetailed search for Repo/MPC/Liquidity:');

const repoQuestions = questions.filter(q => /repo/i.test(q.question));
const mpcQuestions = questions.filter(q => /\bMPC\b|Monetary Policy Committee/i.test(q.question));
const liquidityQuestions = questions.filter(q => /liquidity/i.test(q.question) && !/monetary/i.test(q.question));

console.log(`\nRepo/Reverse Repo: ${repoQuestions.length}`);
repoQuestions.slice(0, 5).forEach(q => {
  console.log(`  ${q.id} | ${q.syllabusNodeId} | ${q.microtheme}`);
});

console.log(`\nMPC: ${mpcQuestions.length}`);
mpcQuestions.slice(0, 5).forEach(q => {
  console.log(`  ${q.id} | ${q.syllabusNodeId} | ${q.microtheme}`);
});

console.log(`\nLiquidity: ${liquidityQuestions.length}`);
liquidityQuestions.slice(0, 5).forEach(q => {
  console.log(`  ${q.id} | ${q.syllabusNodeId} | ${q.microtheme}`);
});
