import { query } from './db/index.js';
async function run() {
  const userId = 'moulika';
  const notificationType = 'HIGH_RISK_INTERVENTION_3PM';
  const todayKey = '2026-06-27';

  const { rows } = await query(`
    SELECT * FROM public.notification_events 
    WHERE user_id = $1 AND notification_type = $2 AND source_id = $3
  `, [userId, notificationType, todayKey]);
  
  console.log('SELECT RESULT (Before Deletion):', rows);

  if (rows.length > 0) {
    const { rowCount } = await query(`
      DELETE FROM public.notification_events 
      WHERE user_id = $1 AND notification_type = $2 AND source_id = $3
    `, [userId, notificationType, todayKey]);
    console.log(`Deleted ${rowCount} rows.`);
  }

  process.exit(0);
}
run();
