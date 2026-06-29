import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to production DB');

    // 1. Delete false blocks if any exist
    const delBlocks = await client.query(`
      DELETE FROM public.study_blocks 
      WHERE (user_id = 'moulika' AND day_key = '2026-06-29' AND (subject = 'Polity' OR block_id LIKE '%test%'))
         OR is_test_data = true
      RETURNING id, block_id, subject, planned_minutes, actual_minutes;
    `);
    console.log('Deleted false study_blocks:', delBlocks.rows);

    // 2. Delete related block_logs if any exist
    try {
      const delLogs = await client.query(`
        DELETE FROM public.block_logs 
        WHERE user_id = 'moulika' AND (actual_minutes = 50 OR confidence = 'auto_stopped_on_new_start')
        RETURNING id, block_id, actual_minutes;
      `);
      console.log('Deleted related block_logs:', delLogs.rows);
    } catch (e) { console.log('block_logs cleanup note:', e.message); }

    // 3. Delete related study_events if any exist
    try {
      const delEvents = await client.query(`
        DELETE FROM public.study_events 
        WHERE user_id = 'moulika' AND created_at >= '2026-06-29' AND subject = 'Polity'
        RETURNING id, event_type, subject;
      `);
      console.log('Deleted related study_events:', delEvents.rows);
    } catch (e) { console.log('study_events cleanup note:', e.message); }

    // 4. Delete related notification_events if any exist
    try {
      const delNotifs = await client.query(`
        DELETE FROM public.notification_events 
        WHERE user_id = 'moulika' AND notification_type = 'BLOCK_COMPLETED' AND created_at >= '2026-06-29'
        RETURNING id, notification_type, sent_at;
      `);
      console.log('Deleted false notification_events:', delNotifs.rows);
    } catch (e) { console.log('notification_events cleanup note:', e.message); }

    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    await client.end();
  }
}
main();
