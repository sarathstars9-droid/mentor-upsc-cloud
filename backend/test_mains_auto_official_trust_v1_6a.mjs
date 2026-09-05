import assert from 'assert';
import { classifySourceAuthority } from './services/sourceDiscoveryService.js';
import { verifyClaim } from './services/sourceVerificationService.js';
import { getMainsRagContext } from './services/mainsRagContextService.js';
import { query } from './db/index.js';
import { setMockGenerateAIContent } from './services/aiAdapterService.js';
import { setMockFetchAndExtractSource, fetchAndExtractSource } from './services/safeSourceFetcher.js';
import { discoverSource, setMockDiscoverCandidates } from './services/sourceDiscoveryService.js';

process.env.OFFLINE_TEST = 'true';

let testFailures = 0;
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message}. Expected '${expected}', got '${actual}'`);
    testFailures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log("=== BATCH A.2: NEW TRUST & SECURITY POLICY TESTS ===");

  console.log("\\n--- 1. NEGATIVE AUTHORITY MATRIX ---");
  assertEqual(classifySourceAuthority({domain: 'rbi.org.in'}, 'STATISTIC'), 'PRIMARY_OFFICIAL', 'RBI statistic from RBI');
  assertEqual(classifySourceAuthority({domain: 'finmin.nic.in'}, 'STATISTIC'), 'AUTHORITATIVE_SECONDARY', 'RBI statistic from Finance Ministry');
  assertEqual(classifySourceAuthority({domain: 'mospi.gov.in'}, 'STATISTIC'), 'PRIMARY_OFFICIAL', 'MOSPI statistic from MOSPI');
  assertEqual(classifySourceAuthority({domain: 'sci.gov.in'}, 'JUDGMENT'), 'PRIMARY_OFFICIAL', 'SC judgment from sci.gov.in');
  assertEqual(classifySourceAuthority({domain: 'pib.gov.in'}, 'JUDGMENT'), 'AUTHORITATIVE_SECONDARY', 'SC judgment from PIB');
  assertEqual(classifySourceAuthority({domain: 'pmjay.gov.in'}, 'SCHEME'), 'PRIMARY_OFFICIAL', 'Scheme from official portal');
  assertEqual(classifySourceAuthority({domain: 'niti.gov.in'}, 'REPORT'), 'PRIMARY_OFFICIAL', 'NITI report from NITI');
  assertEqual(classifySourceAuthority({domain: 'finance.gov.in'}, 'REPORT'), 'AUTHORITATIVE_SECONDARY', 'NITI report from another ministry');
  assertEqual(classifySourceAuthority({domain: 'visionias.in'}, 'REPORT'), 'SECONDARY', 'Coaching summary');

  console.log("\\n--- 2. STATISTIC DETERMINISTIC MATRIX ---");
  
  // Clean up
  await query("DELETE FROM mains_knowledge_items WHERE title LIKE 'TEST_STAT_%'");

  // Helper to test verifyClaim mock
  const runStatTest = async (claimContent, sourceContent, year, expectBlock) => {
    const res = await query(`
      INSERT INTO mains_knowledge_items (paper, subject, title, content, knowledge_type, knowledge_subtype, source_year, is_active)
      VALUES ('GS1', 'Geography', 'TEST_STAT_X', $1, 'EVIDENCE', 'STATISTIC', $2, false)
      RETURNING id
    `, [claimContent, year]);
    const id = res.rows[0].id;
    
    setMockFetchAndExtractSource(() => sourceContent);
    const verifyRes = await verifyClaim(id, 'https://mock.com', 'user', 'PRIMARY_OFFICIAL');
    
    if (expectBlock) {
      if (verifyRes.claim_supported === false && verifyRes.support_type === 'NOT_SUPPORTED') {
         console.log(`✅ PASS: Blocked -> Claim: "${claimContent}" | Source: "${sourceContent}"`);
      } else {
         console.error(`❌ FAIL: Expected BLOCK but got supported -> Claim: "${claimContent}"`);
         testFailures++;
      }
    } else {
      if (verifyRes.claim_supported === true || verifyRes.support_type === 'PARTIAL') {
         console.log(`✅ PASS: Eligible for DIRECT -> Claim: "${claimContent}"`);
      } else {
         console.error(`❌ FAIL: Expected ELIGIBLE but got blocked -> Claim: "${claimContent}"`);
         console.error(verifyRes.verification_notes);
         testFailures++;
      }
    }
  };

  setMockGenerateAIContent(() => JSON.stringify({ claim_supported: true, support_type: 'DIRECT' }));

  await runStatTest("India's population reached 1.4 billion", "India has 1.4 billion people", null, false);
  await runStatTest("Growth is 35%", "Growth was 40%", null, true);
  await runStatTest("35 million people", "35% of people", null, true);
  await runStatTest("India's population", "Andhra Pradesh's population", null, true);
  await runStatTest("FY2024-25 revenue", "FY2022-23 revenue", null, true);
  await runStatTest("GDP 8%", "GDP is 8%", 2025, true); // missing source year 2025 in text

  console.log("\\n--- 3. SAFE FETCHER SECURITY MATRIX ---");
  
  // We need to bypass the mock intercept to test the actual safe fetcher security
  setMockFetchAndExtractSource(null); 
  
  const testSecurity = async (url, expectMsg) => {
    try {
      await fetchAndExtractSource(url, "claim", {});
      console.error(`❌ FAIL: Expected error for ${url}`);
      testFailures++;
    } catch(e) {
      console.log(`✅ PASS: Blocked ${url} (${e.message})`);
    }
  };

  await testSecurity('http://127.0.0.1', 'UNSAFE_IP_REJECTED'); // Loopback
  await testSecurity('http://localhost', 'UNSAFE_IP_REJECTED'); 
  await testSecurity('http://169.254.169.254', 'UNSAFE_IP_REJECTED'); // Link-local
  await testSecurity('http://192.168.1.1', 'UNSAFE_IP_REJECTED'); // RFC1918
  await testSecurity('http://[::1]', 'UNSAFE_IP_REJECTED'); // IPv6 loopback
  await testSecurity('http://[fd00::1]', 'UNSAFE_IP_REJECTED'); // IPv6 ULA
  await testSecurity('ftp://example.com', 'UNSAFE_SCHEME_REJECTED'); // unsafe scheme
  await testSecurity('http://admin:password@example.com', 'URL_CREDENTIALS_REJECTED'); // userinfo
  await testSecurity('http://example.com:22', 'UNSAFE_PORT_REJECTED'); // unsafe port

  console.log("\\n--- 4. NEW BATCH-A RAG TRUST POLICY ---");
  
  // Clean up
  await query("DELETE FROM mains_knowledge_items WHERE title LIKE 'TEST_TRUST_%'");
  
  const insertItem = async (status, active, structuredContent) => {
    const res = await query(`
      INSERT INTO mains_knowledge_items (paper, subject, title, content, knowledge_type, knowledge_subtype, verification_status, is_active, structured_content)
      VALUES ('GS1', 'Geography', 'TEST_TRUST_ITEM', 'Test content.', 'EVIDENCE', 'STATISTIC', $1, $2, $3)
      RETURNING id
    `, [status, active, JSON.stringify(structuredContent)]);
    return res.rows[0].id;
  };

  // 1. HUMAN_APPROVED + ACTIVE -> YES
  const hId = await insertItem('HUMAN_APPROVED', true, {});
  // 2. VERIFIED + ACTIVE -> NO
  const vId = await insertItem('VERIFIED', true, {});
  // 3. VERIFIED + PENDING_REVIEW -> NO (not active)
  const pId = await insertItem('VERIFIED', false, {});
  // 4. AUTO_OFFICIAL_VERIFIED + VERIFIED + ACTIVE + PRIMARY_OFFICIAL -> YES
  const autoYesId = await insertItem('VERIFIED', true, { source_verification: { trust_origin: 'AUTO_OFFICIAL_VERIFIED', authority_level: 'PRIMARY_OFFICIAL' } });
  // 5. AUTO_OFFICIAL_VERIFIED + VERIFIED + ACTIVE + AUTHORITATIVE_SECONDARY -> NO
  const autoNoId = await insertItem('VERIFIED', true, { source_verification: { trust_origin: 'AUTO_OFFICIAL_VERIFIED', authority_level: 'AUTHORITATIVE_SECONDARY' } });
  // 6. SOURCE_REQUIRED -> NO
  const sId = await insertItem('SOURCE_REQUIRED', true, {});

  // For testing RAG, we will use the logic in isTrustedItem directly or by trying to get context
  // But wait, it's easier to run a query or check mainsRagContextService since getMainsRagContext fetches by node.
  // We can just fetch the row and run the javascript logic directly from the repository/service, or query it.
  
  // Actually, getMainsRagContext requires a syllabus_node_id. 
  const nodeId = 'GS1-TEST-TRUST';
  await query("DELETE FROM mains_knowledge_items WHERE syllabus_node_id = $1", [nodeId]);
  
  const insertItemNode = async (status, active, structuredContent) => {
    const res = await query(`
      INSERT INTO mains_knowledge_items (paper, subject, title, content, knowledge_type, knowledge_subtype, verification_status, lifecycle_status, is_active, structured_content, syllabus_node_id)
      VALUES ('GS1', 'Geography', 'TEST_TRUST_ITEM', 'Test content.', 'EVIDENCE', 'STATISTIC', $1, 'ACTIVE', $2, $3, $4)
      RETURNING id
    `, [status, active, JSON.stringify(structuredContent || {}), nodeId]);
    return res.rows[0].id;
  };

  const id1 = await insertItemNode('HUMAN_APPROVED', true, {});
  const id2 = await insertItemNode('VERIFIED', true, {});
  const id3 = await insertItemNode('VERIFIED', false, {});
  const id4 = await insertItemNode('VERIFIED', true, { source_verification: { trust_origin: 'AUTO_OFFICIAL_VERIFIED', authority_level: 'PRIMARY_OFFICIAL' } });
  const id5 = await insertItemNode('VERIFIED', true, { source_verification: { trust_origin: 'AUTO_OFFICIAL_VERIFIED', authority_level: 'AUTHORITATIVE_SECONDARY' } });
  const id6 = await insertItemNode('SOURCE_REQUIRED', true, {});

  const rag = await getMainsRagContext({ syllabusNodeId: nodeId });
  const evIds = (rag.evidence || []).map(e => e.id);
  
  assertEqual(evIds.includes(id1), true, 'HUMAN_APPROVED + ACTIVE -> RAG YES');
  assertEqual(evIds.includes(id2), false, 'VERIFIED + ACTIVE -> RAG NO');
  assertEqual(evIds.includes(id3), false, 'VERIFIED + PENDING_REVIEW -> RAG NO');
  assertEqual(evIds.includes(id4), true, 'AUTO_OFFICIAL_VERIFIED + PRIMARY_OFFICIAL -> RAG YES');
  assertEqual(evIds.includes(id5), false, 'AUTO_OFFICIAL_VERIFIED + AUTHORITATIVE_SECONDARY -> RAG NO');
  assertEqual(evIds.includes(id6), false, 'SOURCE_REQUIRED -> RAG NO');

  await query("DELETE FROM mains_knowledge_items WHERE title LIKE 'TEST_STAT_%' OR title LIKE 'TEST_TRUST_%'");
  process.exit(testFailures > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
