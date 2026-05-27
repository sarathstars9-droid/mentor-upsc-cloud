// backend/verify_tracking_foundation.mjs
import { query } from './db/index.js';

async function verify() {
  console.log('================================================================');
  console.log('          MentorOS Tracking Foundation Verification             ');
  console.log('================================================================\n');

  // 1. Table Verification
  console.log('--- 1. Table Existence Check ---');
  const targetTables = [
    'study_events',
    'block_logs',
    'syllabus_node_progress',
    'backlog_items',
    'subject_targets',
    'study_blocks',
    'revision_items'
  ];
  
  try {
    const tableRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (${targetTables.map((_, i) => `$${i + 1}`).join(', ')})
    `, targetTables);
    
    const foundTables = new Set(tableRes.rows.map(r => r.table_name));
    const tableCheckResults = targetTables.map(t => ({
      'Table Name': t,
      'Exists?': foundTables.has(t) ? '✔ Yes' : '✘ No'
    }));
    console.table(tableCheckResults);
  } catch (err) {
    console.error('✘ Error checking table existence:', err.message);
  }

  // 2 & 3. 2027 Targets & 3500-Hour Rule
  console.log('\n--- 2 & 3. 2027 Attempt Target Hours (3500-Hour Rule check) ---');
  try {
    const hoursRes = await query(`
      SELECT user_id, SUM(target_hours::NUMERIC) as total_parent_hours
      FROM public.subject_targets 
      WHERE exam_year = '2027' 
        AND sub_area IS NULL
      GROUP BY user_id
    `);
    
    if (hoursRes.rows.length === 0) {
      console.log('✘ No 2027 parent targets found.');
    } else {
      console.table(hoursRes.rows.map(r => ({
        'User ID': r.user_id,
        'Exam Year': '2027',
        'Parent Target Hours': r.total_parent_hours,
        'Passes 3500h Rule?': Number(r.total_parent_hours) === 3500 ? '✔ Yes (3500 hours)' : '✘ No'
      })));
    }
  } catch (err) {
    console.error('✘ Error checking target hours:', err.message);
  }

  // 4. GS1/GS2/GS3 Sub-area Targets check
  console.log('\n--- 4. GS1, GS2, GS3 Sub-area Allocations Check ---');
  try {
    const subRes = await query(`
      SELECT user_id, area as subject, COUNT(*) as sub_areas_count, SUM(target_hours::NUMERIC) as total_sub_hours
      FROM public.subject_targets
      WHERE exam_year = '2027'
        AND sub_area IS NOT NULL
        AND area IN ('GS1', 'GS2', 'GS3')
      GROUP BY user_id, area
      ORDER BY user_id, area
    `);
    
    if (subRes.rows.length === 0) {
      console.log('✘ No GS1/GS2/GS3 sub-area targets found.');
    } else {
      console.table(subRes.rows.map(r => ({
        'User ID': r.user_id,
        'Paper/Subject': r.subject,
        'Sub-areas Tracked': r.sub_areas_count,
        'Allocated Hours': r.total_sub_hours
      })));
    }
  } catch (err) {
    console.error('✘ Error checking sub-area targets:', err.message);
  }

  // 5. Latest 20 rows of study_events
  console.log('\n--- 5. Latest 20 Study Events Ledger Rows ---');
  try {
    const eventsRes = await query(`
      SELECT id, user_id, event_type, subject, topic, created_at 
      FROM public.study_events 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    if (eventsRes.rows.length === 0) {
      console.log('No rows recorded in study_events yet.');
    } else {
      console.table(eventsRes.rows.map(r => ({
        'ID': r.id,
        'User': r.user_id,
        'Event Type': r.event_type,
        'Subject': r.subject || '—',
        'Topic/Details': r.topic ? (r.topic.length > 50 ? r.topic.slice(0, 47) + '...' : r.topic) : '—',
        'Created At': new Date(r.created_at).toLocaleString()
      })));
    }
  } catch (err) {
    console.error('✘ Error fetching study events:', err.message);
  }

  // 6. Latest 20 rows of syllabus_node_progress
  console.log('\n--- 6. Latest 20 Syllabus Node Progress Cache Rows ---');
  try {
    const progressRes = await query(`
      SELECT id, user_id, syllabus_node_id, status, readiness_score, actual_minutes, updated_at 
      FROM public.syllabus_node_progress 
      ORDER BY updated_at DESC 
      LIMIT 20
    `);
    if (progressRes.rows.length === 0) {
      console.log('No rows recorded in syllabus_node_progress yet.');
    } else {
      console.table(progressRes.rows.map(r => ({
        'ID': r.id,
        'User': r.user_id,
        'Syllabus Node ID': r.syllabus_node_id,
        'Preparation Status': r.status,
        'Readiness Score': `${r.readiness_score}%`,
        'Actual Minutes': r.actual_minutes,
        'Updated At': new Date(r.updated_at).toLocaleString()
      })));
    }
  } catch (err) {
    console.error('✘ Error fetching syllabus node progress:', err.message);
  }

  // 7. Latest 20 rows of backlog_items
  console.log('\n--- 7. Latest 20 Backlog Rescue Items ---');
  try {
    const backlogRes = await query(`
      SELECT id, user_id, subject, topic, risk_level, status, created_at 
      FROM public.backlog_items 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    if (backlogRes.rows.length === 0) {
      console.log('No active backlog rescue items.');
    } else {
      console.table(backlogRes.rows.map(r => ({
        'ID': r.id,
        'User': r.user_id,
        'Subject': r.subject || '—',
        'Topic': r.topic ? (r.topic.length > 40 ? r.topic.slice(0, 37) + '...' : r.topic) : '—',
        'Risk Level': r.risk_level,
        'Status': r.status,
        'Created At': new Date(r.created_at).toLocaleString()
      })));
    }
  } catch (err) {
    console.error('✘ Error fetching backlog items:', err.message);
  }

  console.log('\n================================================================');
  console.log('                  Verification Completed                        ');
  console.log('================================================================');
  process.exit(0);
}

verify().catch(err => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
