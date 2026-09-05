import assert from 'assert';
import fetch from 'node-fetch';
import { query } from './db/index.js';
import app from './server.js';
import http from 'http';

const BASE_URL = 'http://localhost:3000/api/mains/knowledge/review';
// We simulate different users via x-user-id fallback in non-prod auth
const ADMIN_ID = 'admin'; // allowed reviewer
const USER_ID = 'teststudent'; // not allowed

let testItemIds = [];

async function makeRequest(path, method = 'GET', body = null, userId = ADMIN_ID) {
  const options = {
    method,
    headers: {
      'x-user-id': userId,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== STARTING MAINS V1.5C REVIEW TESTS ===');
  let passed = 0;
  let failed = 0;

  function runAssert(condition, message) {
    try {
      assert(condition);
      console.log(`✅ PASS: ${message}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // PREPARE TEST DATA
    const resStatic = await query(`
      INSERT INTO mains_knowledge_items 
      (paper, subject, knowledge_type, title, content, verification_status, lifecycle_status, is_active, created_at, updated_at)
      VALUES 
      ('GS2', 'Polity', 'SUBJECT_LANGUAGE', 'Test Review Static', 'Content', 'UNVERIFIED', 'PENDING_REVIEW', false, NOW(), NOW())
      RETURNING id
    `);
    const staticId = resStatic.rows[0].id;
    testItemIds.push(staticId);

    const resEvid = await query(`
      INSERT INTO mains_knowledge_items 
      (paper, subject, knowledge_type, title, content, verification_status, lifecycle_status, is_active, source_type, created_at, updated_at)
      VALUES 
      ('GS2', 'Polity', 'EVIDENCE', 'Test Review Evidence', 'Content', 'SOURCE_REQUIRED', 'PENDING_REVIEW', false, 'AI_GENERATED_SOURCE_REQUIRED', NOW(), NOW())
      RETURNING id
    `);
    const evidId = resEvid.rows[0].id;
    testItemIds.push(evidId);

    // TEST A, B, C: AUTHORIZATION
    // In dev mode, missing x-user-id falls back to DEFAULT_USER (e.g. 'moulika'). 
    // We pass an explicitly invalid user ID to simulate an authenticated but unauthorized user.
    let res = await fetch(`${BASE_URL}/`, {
      headers: { 'x-user-id': 'nobody' }
    });
    runAssert(res.status === 403, 'Unauthorized user GET review list -> rejected');

    res = await makeRequest('/', 'GET', null, USER_ID); // Authenticated non-reviewer
    runAssert(res.status === 403, 'Authenticated non-reviewer GET -> rejected');

    res = await makeRequest('/', 'GET', null, ADMIN_ID); // Authenticated reviewer
    runAssert(res.status === 200, 'Authenticated reviewer GET -> allowed');
    
    // Auth-status helper
    res = await makeRequest('/auth-status', 'GET', null, USER_ID);
    runAssert(res.status === 403, 'Non-reviewer /auth-status -> rejected');
    res = await makeRequest('/auth-status', 'GET', null, ADMIN_ID);
    runAssert(res.status === 200 && res.data.can_review_knowledge === true, 'Reviewer /auth-status -> allowed');

    // TEST D, E, F, G: MUTATION AUTHORIZATION
    res = await makeRequest('/build', 'POST', {}, USER_ID);
    runAssert(res.status === 403, 'Authenticated non-reviewer build -> rejected');

    res = await makeRequest(`/${evidId}/verify`, 'POST', {}, USER_ID);
    runAssert(res.status === 403, 'Authenticated non-reviewer verify -> rejected');

    res = await makeRequest(`/${staticId}/approve`, 'POST', {}, USER_ID);
    runAssert(res.status === 403, 'Authenticated non-reviewer approve -> rejected');

    res = await makeRequest(`/${staticId}/retire`, 'POST', {}, USER_ID);
    runAssert(res.status === 403, 'Authenticated non-reviewer retire -> rejected');

    // TEST H, I, J: GENERIC PATCH TRUST SPOOFING
    res = await makeRequest(`/${staticId}`, 'PATCH', {
      verification_status: 'HUMAN_APPROVED',
      lifecycle_status: 'ACTIVE',
      is_active: true,
      title: 'Patched Title'
    }, ADMIN_ID);
    
    let dbItem = (await query(`SELECT * FROM mains_knowledge_items WHERE id = $1`, [staticId])).rows[0];
    runAssert(dbItem.title === 'Patched Title', 'Generic PATCH allowed safe edits');
    runAssert(dbItem.verification_status === 'UNVERIFIED', 'Generic PATCH blocked verification_status change');
    runAssert(dbItem.lifecycle_status === 'PENDING_REVIEW', 'Generic PATCH blocked lifecycle_status change');
    runAssert(dbItem.is_active === false, 'Generic PATCH blocked is_active change');

    // TEST: TAXONOMY EDITING BLOCKED
    res = await makeRequest(`/${staticId}`, 'PATCH', {
      syllabus_node_id: 'MALICIOUS_NODE'
    }, ADMIN_ID);
    dbItem = (await query(`SELECT * FROM mains_knowledge_items WHERE id = $1`, [staticId])).rows[0];
    runAssert(dbItem.syllabus_node_id === null, 'Generic PATCH blocked taxonomy change');

    // TEST: NORMAL APPROVE WORKFLOW
    res = await makeRequest(`/${staticId}/approve`, 'POST', null, ADMIN_ID);
    runAssert(res.status === 200, 'Normal approve request succeeds');
    dbItem = (await query(`SELECT * FROM mains_knowledge_items WHERE id = $1`, [staticId])).rows[0];
    runAssert(dbItem.verification_status === 'HUMAN_APPROVED' && dbItem.lifecycle_status === 'ACTIVE' && dbItem.is_active === true, 'Normal static candidate approve transition PASS');

    // TEST: EVIDENCE DIRECT APPROVE BLOCKED
    res = await makeRequest(`/${evidId}/approve`, 'POST', null, ADMIN_ID);
    runAssert(res.status === 400 && res.data.error === 'EVIDENCE_SOURCE_REQUIRED', 'SOURCE_REQUIRED evidence direct approve blocked');

    // TEST: EVIDENCE VERIFY -> APPROVE
    res = await makeRequest(`/${evidId}/verify`, 'POST', {
      source_reference: 'The Hindu',
      source_year: 2026
    }, ADMIN_ID);
    runAssert(res.status === 200, 'Verify request succeeds');
    dbItem = (await query(`SELECT * FROM mains_knowledge_items WHERE id = $1`, [evidId])).rows[0];
    runAssert(dbItem.verification_status === 'VERIFIED' && dbItem.lifecycle_status === 'PENDING_REVIEW' && dbItem.source_reference === 'The Hindu', 'Verify transitions verification_status but leaves PENDING_REVIEW');

    res = await makeRequest(`/${evidId}/approve`, 'POST', null, ADMIN_ID);
    runAssert(res.status === 200, 'Verified evidence approve succeeds');
    dbItem = (await query(`SELECT * FROM mains_knowledge_items WHERE id = $1`, [evidId])).rows[0];
    runAssert(dbItem.verification_status === 'HUMAN_APPROVED' && dbItem.lifecycle_status === 'ACTIVE' && dbItem.is_active === true, 'Verified evidence approve transition PASS');

    // TEST: RETIRE
    res = await makeRequest(`/${staticId}/retire`, 'POST', null, ADMIN_ID);
    runAssert(res.status === 200, 'Retire request succeeds');
    dbItem = (await query(`SELECT * FROM mains_knowledge_items WHERE id = $1`, [staticId])).rows[0];
    runAssert(dbItem.lifecycle_status === 'RETIRED' && dbItem.is_active === false, 'Retire transition PASS');

  } catch (err) {
    console.error('Test Execution Error:', err);
  } finally {
    if (testItemIds.length > 0) {
      const ph = testItemIds.map((_, i) => `$${i + 1}`).join(',');
      await query(`DELETE FROM mains_knowledge_items WHERE id IN (${ph})`, testItemIds);
      console.log(`[CLEANUP] Deleted ${testItemIds.length} test records.`);
    }

    console.log('=== FINAL RESULTS ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

const server = http.createServer(app);
server.listen(3000, () => {
  runTests().then(() => {
    server.close();
  });
});
