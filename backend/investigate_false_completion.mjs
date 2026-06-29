import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();
    console.log('Connected to production DB');

    // 1. Find Moulika user ID
    console.log('\n--- 1. SEARCHING USERS ---');
    const usersRes = await client.query(`SELECT * FROM users`);
    console.log('Total users:', usersRes.rows.length);
    console.log(usersRes.rows);

    // Check all user IDs in study_blocks for today
    const blocksUserRes = await client.query(`SELECT DISTINCT user_id FROM study_blocks WHERE day_key = '2026-06-29'`);
    console.log('User IDs in study_blocks for 2026-06-29:', blocksUserRes.rows);

    // Also check all blocks on 2026-06-29 for any user
    console.log('\n--- ALL BLOCKS FOR 2026-06-29 ---');
    const allBlocksToday = await client.query(`SELECT * FROM study_blocks WHERE day_key = '2026-06-29' ORDER BY created_at DESC`);
    console.log('Total blocks today:', allBlocksToday.rows.length);
    console.log(JSON.stringify(allBlocksToday.rows, null, 2));

    // Also check all blocks across all days (just in case)
    console.log('\n--- RECENT 20 STUDY BLOCKS OVERALL ---');
    const recentBlocks = await client.query(`SELECT * FROM study_blocks ORDER BY created_at DESC LIMIT 20`);
    console.log(JSON.stringify(recentBlocks.rows, null, 2));

    // 2. Plan block events
    console.log('\n--- 2. PLAN BLOCK EVENTS (RECENT 20) ---');
    try {
      const eventsRes = await client.query(`SELECT * FROM plan_block_events ORDER BY created_at DESC LIMIT 20`);
      console.log('Plan block events count:', eventsRes.rows.length);
      console.log(JSON.stringify(eventsRes.rows, null, 2));
    } catch (e) {
      console.error('Error querying plan_block_events:', e.message);
    }

    // Block logs
    console.log('\n--- BLOCK LOGS (RECENT 20) ---');
    try {
      const logsRes = await client.query(`SELECT * FROM block_logs ORDER BY created_at DESC LIMIT 20`);
      console.log('Block logs count:', logsRes.rows.length);
      console.log(JSON.stringify(logsRes.rows, null, 2));
    } catch (e) {
      console.error('Error querying block_logs:', e.message);
    }

    // 4. Notification events
    console.log('\n--- 4. NOTIFICATION EVENTS (RECENT 20) ---');
    try {
      const notifRes = await client.query(`SELECT * FROM notification_events ORDER BY sent_at DESC LIMIT 20`);
      console.log('Notification events count:', notifRes.rows.length);
      console.log(JSON.stringify(notifRes.rows, null, 2));
    } catch (e) {
      console.error('Error querying notification_events:', e.message);
    }

  } catch (err) {
    console.error('Database connection / query error:', err);
  } finally {
    await client.end();
  }
}

main();
