async function validateCsatIntegrity() {
  const tests = [
    { name: 'CSAT Quant', id: 'csat_quant', expected: ['CSAT-BN', 'CSAT-DI'] },
    { name: 'CSAT LR', id: 'csat_lr', expected: ['CSAT-LR', 'CSAT-DM'] },
    { name: 'CSAT Reasoning (alias for LR)', id: 'csat_reasoning', expected: ['CSAT-LR', 'CSAT-DM'] },
    { name: 'CSAT RC', id: 'csat_rc', expected: ['CSAT-COMP'] }
  ];
  
  console.log('\n========== CSAT DATA INTEGRITY VALIDATION ==========\n');
  
  for (const test of tests) {
    const payload = JSON.stringify({
      mode: 'topic_wise',
      selectedSubjectId: test.id,
      practiceQuestionCount: 15
    });
    
    try {
      const response = await fetch('http://localhost:8787/api/prelims/practice/build', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      const prefixes = new Set();
      const wrongPrefixes = [];
      
      data.questions
        .filter(q => q.syllabusNodeId && !q.isPassage)
        .forEach(q => {
          const prefix = q.syllabusNodeId.split('-').slice(0, 2).join('-');
          prefixes.add(prefix);
          
          // Check if prefix matches expected
          if (!test.expected.some(ep => prefix.startsWith(ep))) {
            wrongPrefixes.push(q.syllabusNodeId);
          }
        });
      
      console.log(`✓ ${test.name}:`);
      console.log(`  Questions: ${data.questions.filter(q => !q.isPassage).length}`);
      console.log(`  Expected prefixes: ${test.expected.join(', ')}`);
      console.log(`  Found prefixes: ${[...prefixes].sort().join(', ')}`);
      
      if (wrongPrefixes.length > 0) {
        console.log(`  ⚠ WARNING: ${wrongPrefixes.length} questions have wrong prefix`);
        console.log(`    Examples: ${wrongPrefixes.slice(0, 2).join(', ')}`);
      } else {
        console.log(`  ✅ ZERO LEAKAGE - All questions have correct prefix`);
      }
      console.log('');
    } catch (e) {
      console.error(`✗ ${test.name}: ${e.message}`);
    }
  }
}

validateCsatIntegrity().catch(console.error);
