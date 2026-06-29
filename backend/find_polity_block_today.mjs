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

    console.log('\n--- ALL ROWS CREATED OR UPDATED TODAY (2026-06-29) IN ALL TABLES ---');

    // 1. study_blocks created or updated today
    const sb = await client.query(`SELECT * FROM study_blocks WHERE created_at >= '2026-06-29' OR updated_at >= '2026-06-29' ORDER BY updated_at DESC`);
    console.log('study_blocks updated today count:', sb.rows.length);
    console.log(JSON.stringify(sb.rows, null, 2));

    // 2. block_logs created today
    try {
      const bl = await client.query(`SELECT * FROM block_logs WHERE created_at >= '2026-06-29' ORDER BY created_at DESC`);
      console.log('block_logs today count:', bl.rows.length);
      console.log(JSON.stringify(bl.rows, null, 2));
    } catch (e) { console.error('block_logs err:', e.message); }

    // 3. study_events created today
    try {
      const se = await client.query(`SELECT * FROM study_events WHERE created_at >= '2026-06-29' ORDER BY created_at DESC`);
      console.log('study_events today count:', se.rows.length);
      console.log(JSON.stringify(se.rows, null, 2));
    } catch (e) { console.error('study_events err:', e.message); }

    // 4. notification_events created or sent today
    try {
      const ne = await client.query(`SELECT * FROM notification_events WHERE created_at >= '2026-06-29' ORDER BY created_at DESC`);
      console.log('notification_events today count:', ne.rows.length);
      console.log(JSON.stringify(ne.rows, null, 2));
    } catch (e) { console.error('notification_events err:', e.message); }

    // 5. Check plan_block_events created today
    try {
      const pbe = await client.query(`SELECT * FROM plan_block_events WHERE created_at >= '2026-06-29' ORDER BY created_at DESC`);
      console.log('plan_block_events today count:', pbe.rows.length);
      console.log(JSON.stringify(pbe.rows, null, 2));
    } catch (e) { console.error('plan_block_events err:', e.message); }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

main();
