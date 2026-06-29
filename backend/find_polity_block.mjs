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

    console.log('\n--- SEARCHING FOR TEST_PROOF_DIRECT_1 OR POLITY 50M IN ALL TABLES ---');
    
    // 1. Check study_blocks
    const sb = await client.query(`SELECT * FROM study_blocks WHERE block_id LIKE '%test%' OR title ILIKE '%polity%' OR subject ILIKE '%polity%' OR actual_minutes = 50 OR planned_minutes = 60 ORDER BY created_at DESC LIMIT 20`);
    console.log('study_blocks matches:', sb.rows.length);
    console.log(JSON.stringify(sb.rows, null, 2));

    // 2. Check block_logs
    try {
      const bl = await client.query(`SELECT * FROM block_logs WHERE block_id LIKE '%test%' OR actual_minutes = 50 ORDER BY created_at DESC LIMIT 20`);
      console.log('block_logs matches:', bl.rows.length);
      console.log(JSON.stringify(bl.rows, null, 2));
    } catch (e) { console.error('block_logs query err:', e.message); }

    // 3. Check study_events
    try {
      const se = await client.query(`SELECT * FROM study_events WHERE subject ILIKE '%polity%' OR metadata::text ILIKE '%50%' OR metadata::text ILIKE '%test%' ORDER BY created_at DESC LIMIT 20`);
      console.log('study_events matches:', se.rows.length);
      console.log(JSON.stringify(se.rows, null, 2));
    } catch (e) { console.error('study_events query err:', e.message); }

    // 4. Check notification_events
    try {
      const ne = await client.query(`SELECT * FROM notification_events WHERE payload::text ILIKE '%Polity%' OR payload_json::text ILIKE '%Polity%' OR payload::text ILIKE '%50m%' ORDER BY created_at DESC LIMIT 20`);
      console.log('notification_events matches:', ne.rows.length);
      console.log(JSON.stringify(ne.rows, null, 2));
    } catch (e) { console.error('notification_events query err:', e.message); }

  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await client.end();
  }
}

main();
