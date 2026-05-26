import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '025_subject_sub_targets.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 025 (Subject Sub-targets & Consistency)...');
    await query(sql);
    console.log('Migration 025 applied successfully.');
    
    console.log('Cleaning up obsolete GS2 sub-targets...');
    await query(`DELETE FROM public.subject_sub_targets WHERE parent_subject = 'GS2' AND sub_area = 'Revision Sheets'`);

    console.log('Seeding subject_sub_targets...');
    const users = ['moulika', 'user_1'];
    
    const subTargets = [
      // GS1
      { parent: 'GS1', sub: 'Art & Culture', hours: 35 },
      { parent: 'GS1', sub: 'Modern History', hours: 35 },
      { parent: 'GS1', sub: 'Post-Independence India', hours: 15 },
      { parent: 'GS1', sub: 'World History', hours: 15 },
      { parent: 'GS1', sub: 'Indian Society', hours: 40 },
      { parent: 'GS1', sub: 'Physical Geography GS Level', hours: 20 },
      { parent: 'GS1', sub: 'Indian & World Geography', hours: 35 },
      { parent: 'GS1', sub: 'GS1 Mains PYQ + Answer Writing', hours: 35 },
      { parent: 'GS1', sub: 'Revision Sheets + Diagrams', hours: 20 },

      // GS2
      { parent: 'GS2', sub: 'Polity & Constitution Static', hours: 65 },
      { parent: 'GS2', sub: 'Governance', hours: 35 },
      { parent: 'GS2', sub: 'Social Justice', hours: 40 },
      { parent: 'GS2', sub: 'Welfare Schemes', hours: 25 },
      { parent: 'GS2', sub: 'International Relations', hours: 40 },
      { parent: 'GS2', sub: 'Judgments/Committees/Reports', hours: 25 },
      { parent: 'GS2', sub: 'GS2 Mains PYQ + Answer Writing', hours: 45 },

      // GS3
      { parent: 'GS3', sub: 'Economy', hours: 60 },
      { parent: 'GS3', sub: 'Agriculture', hours: 35 },
      { parent: 'GS3', sub: 'Environment', hours: 45 },
      { parent: 'GS3', sub: 'Science & Technology', hours: 30 },
      { parent: 'GS3', sub: 'Internal Security', hours: 35 },
      { parent: 'GS3', sub: 'Disaster Management', hours: 20 },
      { parent: 'GS3', sub: 'Infrastructure/Industry/Energy', hours: 20 },
      { parent: 'GS3', sub: 'GS3 Mains PYQ + Answer Writing', hours: 35 },
      { parent: 'GS3', sub: 'Revision + Error Log', hours: 20 }
    ];

    for (const u of users) {
      console.log(`Seeding sub-targets for user: ${u}...`);
      for (const st of subTargets) {
        await query(`
          INSERT INTO public.subject_sub_targets (user_id, parent_subject, sub_area, target_hours)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, parent_subject, sub_area) DO UPDATE SET
            target_hours = EXCLUDED.target_hours,
            updated_at = NOW();
        `, [u, st.parent, st.sub, st.hours]);
      }

      console.log(`Seeding Telegram notification preferences for user: ${u}...`);
      const notificationTypes = [
        'GOOD_MORNING_MISSION',
        'PLAN_NOT_UPLOADED',
        'PLAN_NOT_STARTED',
        'BLOCK_PAUSED_TOO_LONG',
        'MISSED_BLOCK_ALERT',
        'REVISION_DUE_ALERT',
        'DAILY_NIGHT_REPORT',
        'WEEKLY_MENTOR_REPORT',
        'MONTHLY_MENTOR_REPORT'
      ];
      
      for (const type of notificationTypes) {
        await query(`
          INSERT INTO public.notification_preferences (user_id, notification_type, channel_type, is_enabled)
          VALUES ($1, $2, 'TELEGRAM', TRUE)
          ON CONFLICT (user_id, notification_type, channel_type) DO UPDATE SET is_enabled = TRUE;
        `, [u, type]);
      }
    }
    
    console.log('Seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 025 failed:', err);
    process.exit(1);
  }
}

runMigration();
