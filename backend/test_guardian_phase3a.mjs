// backend/test_guardian_phase3a.mjs
import 'dotenv/config';
import { query } from './db/index.js';

const TEST_URL = process.env.TEST_URL || 'http://localhost:8787';
const MOCK_USER = 'test_guardian_user';
const API_KEY = process.env.GUARDIAN_API_KEY || 'test_guardian_key_123';

async function runTests() {
  console.log('🚀 Starting Guardian Phase 3A Backend Tests...\n');

  try {
    // 1. Clean up old test data
    console.log('[Setup] Cleaning up old test data for user:', MOCK_USER);
    await query(`DELETE FROM public.guardian_daily_phone_usage WHERE user_id = $1`, [MOCK_USER]);
    await query(`DELETE FROM public.guardian_alert_ledger WHERE user_id = $1`, [MOCK_USER]);

    const headers = {
      'Content-Type': 'application/json',
      'x-guardian-api-key': API_KEY
    };

    const dateKey = '2026-06-26';

    // 2. Test below 45-minute threshold (30 minutes = 1800 seconds)
    console.log('\n[Scenario 1] Uploading 30 minutes of distraction usage (no alert expected)...');
    const res1 = await fetch(`${TEST_URL}/api/guardian/daily-phone-usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: MOCK_USER,
        date: dateKey,
        apps: [
          { appPackage: 'com.instagram.android', appName: 'Instagram', durationSeconds: 1200 },
          { appPackage: 'com.google.android.youtube', appName: 'YouTube', durationSeconds: 600 }
        ],
        totalDistractionSeconds: 1800
      })
    });

    if (!res1.ok) {
      throw new Error(`Scenario 1 failed with status: ${res1.status}`);
    }
    const json1 = await res1.json();
    console.log('Response:', json1);
    if (json1.alertTriggered !== false) {
      throw new Error('Expected no alert to trigger at 30 minutes.');
    }
    console.log('✅ Scenario 1 Passed.');

    // Verify DB upsert
    const dbCheck1 = await query(
      `SELECT app_name, duration_seconds FROM public.guardian_daily_phone_usage 
       WHERE user_id = $1 AND date = $2 ORDER BY duration_seconds DESC`,
      [MOCK_USER, dateKey]
    );
    if (dbCheck1.rows.length !== 2) {
      throw new Error(`Expected 2 apps in DB, found ${dbCheck1.rows.length}`);
    }
    console.log('✅ DB records verified successfully.');

    // 3. Test crossing 45-minute threshold (50 minutes = 3000 seconds)
    console.log('\n[Scenario 2] Uploading 50 minutes of distraction usage (45m alert expected)...');
    const res2 = await fetch(`${TEST_URL}/api/guardian/daily-phone-usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: MOCK_USER,
        date: dateKey,
        apps: [
          { appPackage: 'com.instagram.android', appName: 'Instagram', durationSeconds: 2000 },
          { appPackage: 'com.google.android.youtube', appName: 'YouTube', durationSeconds: 1000 }
        ],
        totalDistractionSeconds: 3000
      })
    });

    if (!res2.ok) {
      throw new Error(`Scenario 2 failed with status: ${res2.status}`);
    }
    const json2 = await res2.json();
    console.log('Response:', json2);
    if (json2.alertTriggered !== true || json2.triggeredThreshold !== 45) {
      throw new Error('Expected 45m alert to trigger.');
    }
    console.log('✅ Scenario 2 Passed.');

    // Check alert ledger
    const ledgerCheck = await query(
      `SELECT alert_type FROM public.guardian_alert_ledger WHERE user_id = $1 AND date = $2`,
      [MOCK_USER, dateKey]
    );
    if (ledgerCheck.rows.length !== 1 || ledgerCheck.rows[0].alert_type !== 'distraction_45') {
      throw new Error('Expected distraction_45 in ledger.');
    }
    console.log('✅ Alert ledger verified successfully.');

    // 4. Test duplicate alert prevention (resending same 50 minutes)
    console.log('\n[Scenario 3] Uploading 50 minutes again (no duplicate alert expected)...');
    const res3 = await fetch(`${TEST_URL}/api/guardian/daily-phone-usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: MOCK_USER,
        date: dateKey,
        apps: [
          { appPackage: 'com.instagram.android', appName: 'Instagram', durationSeconds: 2000 },
          { appPackage: 'com.google.android.youtube', appName: 'YouTube', durationSeconds: 1000 }
        ],
        totalDistractionSeconds: 3000
      })
    });

    if (!res3.ok) {
      throw new Error(`Scenario 3 failed with status: ${res3.status}`);
    }
    const json3 = await res3.json();
    console.log('Response:', json3);
    if (json3.alertTriggered !== false) {
      throw new Error('Duplicate alert was triggered!');
    }
    console.log('✅ Scenario 3 Passed.');

    // 5. Test crossing next threshold: 60-minute threshold (65 minutes = 3900 seconds)
    console.log('\n[Scenario 4] Uploading 65 minutes of distraction usage (60m alert expected)...');
    const res4 = await fetch(`${TEST_URL}/api/guardian/daily-phone-usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: MOCK_USER,
        date: dateKey,
        apps: [
          { appPackage: 'com.instagram.android', appName: 'Instagram', durationSeconds: 2500 },
          { appPackage: 'com.google.android.youtube', appName: 'YouTube', durationSeconds: 1400 }
        ],
        totalDistractionSeconds: 3900
      })
    });

    if (!res4.ok) {
      throw new Error(`Scenario 4 failed with status: ${res4.status}`);
    }
    const json4 = await res4.json();
    console.log('Response:', json4);
    if (json4.alertTriggered !== true || json4.triggeredThreshold !== 60) {
      throw new Error('Expected 60m alert to trigger.');
    }
    console.log('✅ Scenario 4 Passed.');

    // 6. Test bad api key auth fail
    console.log('\n[Scenario 5] Testing request with invalid API key (unauthorized expected)...');
    const res5 = await fetch(`${TEST_URL}/api/guardian/daily-phone-usage`, {
      method: 'POST',
      headers: { ...headers, 'x-guardian-api-key': 'wrong_key' },
      body: JSON.stringify({ userId: MOCK_USER, date: dateKey, apps: [], totalDistractionSeconds: 0 })
    });
    if (res5.status !== 401) {
      throw new Error(`Expected 401 status for invalid key, got ${res5.status}`);
    }
    console.log('✅ Scenario 5 Passed.');

    console.log('\n🎉 ALL MOCK TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

runTests();
