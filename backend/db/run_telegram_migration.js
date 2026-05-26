import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '022_notification_progress_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 022...');
    await query(sql);
    console.log('Migration 022 completed successfully.');
    
    const sqlPath023 = path.join(__dirname, 'migrations', '023_subject_targets_dates.sql');
    const sql023 = fs.readFileSync(sqlPath023, 'utf8');
    
    console.log('Running Migration 023...');
    await query(sql023);
    console.log('Migration 023 completed successfully.');
    
    console.log('Seeding users and subject targets...');
    
    const users = ['moulika', 'user_1'];
    
    for (const u of users) {
      // Seed user
      await query(`
        INSERT INTO public.users (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING;
      `, [u, u === 'moulika' ? 'Moulika' : 'User 1']);

      // Seed targets with UPSC 2027 mission dates (May 25, 2026 to April 15, 2027)
      await query(`
        INSERT INTO public.subject_targets (user_id, subject, target_hours, mission_start_date, mission_end_date)
        VALUES
          ($1, 'Geography Optional', 800, '2026-05-25', '2027-04-15'),
          ($1, 'CSAT', 450, '2026-05-25', '2027-04-15'),
          ($1, 'Prelims GS MCQ + PYQ', 325, '2026-05-25', '2027-04-15'),
          ($1, 'GS1', 250, '2026-05-25', '2027-04-15'),
          ($1, 'GS2', 275, '2026-05-25', '2027-04-15'),
          ($1, 'GS3', 300, '2026-05-25', '2027-04-15'),
          ($1, 'GS4 Ethics', 325, '2026-05-25', '2027-04-15'),
          ($1, 'Essay', 175, '2026-05-25', '2027-04-15'),
          ($1, 'Mains Answer Writing', 300, '2026-05-25', '2027-04-15'),
          ($1, 'Current Affairs', 175, '2026-05-25', '2027-04-15'),
          ($1, 'Revision/Buffer', 125, '2026-05-25', '2027-04-15')
        ON CONFLICT (user_id, subject) DO UPDATE SET
          target_hours = EXCLUDED.target_hours,
          mission_start_date = EXCLUDED.mission_start_date,
          mission_end_date = EXCLUDED.mission_end_date;
      `, [u]);
      
      // Seed default Telegram preferences
      const notificationTypes = [
        'MISSED_BLOCK_ALERT',
        'REVISION_DUE_ALERT',
        'END_OF_DAY_REPORT',
        'WEEKLY_MENTOR_REPORT',
        'SYLLABUS_TRACK_REPLY',
        'BACKLOG_ALERT'
      ];
      
      for (const type of notificationTypes) {
        await query(`
          INSERT INTO public.notification_preferences (user_id, notification_type, channel_type, is_enabled)
          VALUES ($1, $2, 'TELEGRAM', TRUE)
          ON CONFLICT (user_id, notification_type, channel_type) DO NOTHING;
        `, [u, type]);
      }
    }
    
    console.log('Seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
