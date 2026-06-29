import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to production DB');

    console.log('\n--- 1. VERIFY STUDY BLOCKS FOR MOULIKA TODAY (2026-06-29) ---');
    const sb = await client.query(`
      SELECT id, user_id, subject, topic, title, status, planned_minutes, actual_minutes, day_key, created_at, completed_at, is_test_data, completion_source
      FROM public.study_blocks
      WHERE user_id = 'moulika'
      AND day_key = '2026-06-29'
      ORDER BY created_at DESC;
    `);
    console.log('Total rows found:', sb.rows.length);
    console.log(JSON.stringify(sb.rows, null, 2));

    console.log('\n--- 2. VERIFY BLOCK_COMPLETED NOTIFICATIONS FOR MOULIKA TODAY ---');
    const ne = await client.query(`
      SELECT id, user_id, notification_type, source_type, source_id, channel_type, status, sent_at, created_at
      FROM public.notification_events
      WHERE user_id = 'moulika'
      AND source_id = '2026-06-29'
      AND notification_type = 'BLOCK_COMPLETED'
      ORDER BY sent_at DESC;
    `);
    console.log('Total notification events found:', ne.rows.length);
    console.log(JSON.stringify(ne.rows, null, 2));

    console.log('\n--- 3. VERIFY NIGHT REPORT SAFETY (ACTUAL PROGRESS TODAY) ---');
    const agg = await client.query(`
      SELECT COALESCE(SUM(actual_minutes), 0) AS total_actual_minutes,
             COUNT(*) FILTER (WHERE status = 'completed') AS completed_blocks_count
      FROM public.study_blocks
      WHERE user_id = 'moulika' AND day_key = '2026-06-29';
    `);
    console.log('Today Aggregates:', agg.rows[0]);

    const userState = await client.query(`
      SELECT id, name, mission_health_state, consecutive_zero_study_days, consecutive_missed_plan_days
      FROM public.users WHERE id = 'moulika';
    `);
    console.log('User State:', userState.rows[0]);

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await client.end();
  }
}

main();
