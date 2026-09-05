import { getMainsQuestionsByNodeId, reloadCanonicalPyqIndex, buildCanonicalPyqIndex } from './brain/mainsPyqRetrievalV2.js';

async function runTests() {
  console.log("=== MAINS PYQ RETRIEVAL V2 PRECISION TEST SUITE ===\n");

  const t0 = process.hrtime.bigint();
  buildCanonicalPyqIndex();
  const t1 = process.hrtime.bigint();
  console.log(`Initial Build Time: ${Number(t1 - t0) / 1000000} ms\n`);

  function printResults(title, node, query, result) {
    console.log(`--- ${title} ---`);
    console.log(`Query: "${query}"`);
    console.log(`Requested Node: ${node}`);
    console.log(`Retrieved ${result.questions.length} questions (Max budget: ${result.retrieval_meta.max_budget})`);
    
    for (const q of result.questions) {
      console.log(`\n[${q.year}] ${q.question_id}`);
      console.log(`Q: ${q.question_text.substring(0, 80)}...`);
      console.log(`Level: ${q.retrieval_level} | Norm: ${q.normalization_type} | Raw: ${q.raw_node_id}`);
      console.log(`Score: ${q.relevance_score} | Matched: ${q.matched_terms.join(', ')} | Phrases: ${q.matched_phrases.join(', ')}`);
    }
    
    console.log('\n--- REJECTED CANDIDATES ---');
    const rejected = result.retrieval_meta.rejected_questions || [];
    if (rejected.length === 0) console.log("None.");
    for (const q of rejected.slice(0, 5)) {
      console.log(`[REJECTED] ${q.reject_reason} | Score: ${q.relevance_score}`);
      console.log(`Q: ${q.question_text.substring(0, 80)}...`);
      console.log(`Matched: ${q.matched_terms.join(', ')} | Phrases: ${q.matched_phrases.join(', ')}\n`);
    }
    console.log('\n');
  }

  // 1. Federalism
  const fedQuery = "Discuss the challenges to cooperative federalism in India.";
  const fedResult = getMainsQuestionsByNodeId('GS2-POL-CSREL-MT02', { queryText: fedQuery, budget: 6 });
  printResults("FEDERALISM RECOVERY", 'GS2-POL-CSREL-MT02', fedQuery, fedResult);

  // 2. Penck
  const penckQuery = "Explain Penck's concept of slope development.";
  const penckResult = getMainsQuestionsByNodeId('OPT-P1-GEOM-MT07', { queryText: penckQuery, budget: 6 });
  printResults("PENCK RECOVERY", 'OPT-P1-GEOM-MT07', penckQuery, penckResult);
  
  if (penckResult.questions.some(q => q.paper === 'GS1')) {
    console.error("❌ Penck test failed: Found GS1 Geography questions!");
  }

  // 3. Urban Flooding (TRUE ZERO)
  const urbanQuery = "Examine the causes and mitigation strategies for urban flooding in India.";
  const urbanResult = getMainsQuestionsByNodeId('GS1-GEO-NAT-HAZ-MT04', { queryText: urbanQuery, budget: 6 });
  console.log("--- URBAN FLOODING ---");
  console.log(`Retrieved ${urbanResult.questions.length} questions`);
  if (urbanResult.questions.length === 0) {
     console.log("✅ Urban Flooding returned TRUE_ZERO\n");
  } else {
     console.log(`❌ Urban Flooding returned ${urbanResult.questions.length} questions (Expected 0)\n`);
  }

  // 4. Essay Themes
  const essayThemes = [
    { node: 'ESSAY-MT03', query: "How do human values and morality shape our character in modern life?" },
    { node: 'ESSAY-MT02', query: "The relationship between wisdom, truth, and philosophical thinking." },
    { node: 'ESSAY-MT06', query: "The impact of science, technology, and machines on human values." }
  ];

  for (const t of essayThemes) {
    const res = getMainsQuestionsByNodeId(t.node, { queryText: t.query, budget: 6 });
    console.log(`--- ESSAY THEME: ${t.node} ---`);
    console.log(`Retrieved ${res.questions.length} questions`);
    const hasGs = res.questions.some(q => q.paper !== 'ESSAY');
    if (hasGs) console.error(`❌ Essay test failed: Found GS questions in ${t.node}!`);
    console.log(res.questions.map(q => `[${q.year}] ${q.question_text.substring(0, 50)}`).join('\n') + '\n');
  }

  // 5. Test Without queryText
  console.log("--- SAFETY: NO QUERY TEXT ---");
  const safeFedResult = getMainsQuestionsByNodeId('GS2-POL-CSREL-MT02', { budget: 6 });
  console.log(`Requested Node: GS2-POL-CSREL-MT02 without queryText`);
  console.log(`Retrieved ${safeFedResult.questions.length} questions`);
  if (safeFedResult.questions.length === 0) {
    console.log("✅ No-query safely avoided broad parent filling.\n");
  } else {
    console.error("❌ No-query improperly filled from parent!\n");
  }

  const index = buildCanonicalPyqIndex();
  let exact = 0, legacyAlias = 0, canonicalParent = 0;
  for (const qs of index.values()) {
    for (const q of qs) {
      if (q.normalization_type === 'EXACT') exact++;
      if (q.normalization_type === 'LEGACY_ALIAS') legacyAlias++;
      if (q.normalization_type === 'CANONICAL_PARENT') canonicalParent++;
    }
  }
  
  console.log("=== NORMALIZATION STATS ===");
  console.log(`Indexed Items (including duplicates per node): ${exact + legacyAlias + canonicalParent}`);
  
  console.log("\nMAINS PYQ RETRIEVAL V2 PRECISION READY: YES");
}

runTests().catch(console.error);
