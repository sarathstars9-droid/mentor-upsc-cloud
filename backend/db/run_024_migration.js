import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '024_tracking_foundation.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 024 (Tracking Foundation)...');
    await query(sql);
    console.log('Migration 024 applied successfully.');
    
    console.log('Seeding subject_targets for UPSC 2027 Attempt...');
    
    const users = ['moulika', 'user_1'];
    const totalDays = 325;
    const totalWeeks = totalDays / 7.0; // ~46.42
    
    const targets = [
      // Top level targets
      { subject: 'Geography Optional', area: 'Geography Optional', sub_area: null, target_hours: 800, priority: 'high', exam_role: 'Optional dominance tracker' },
      { subject: 'CSAT', area: 'CSAT', sub_area: null, target_hours: 450, priority: 'high', exam_role: 'Safety tracker' },
      { subject: 'Prelims GS MCQ + PYQ', area: 'Prelims GS MCQ + PYQ', sub_area: null, target_hours: 325, priority: 'high', exam_role: 'Prelims readiness tracker' },
      { subject: 'GS1', area: 'GS1', sub_area: null, target_hours: 250, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS2', area: 'GS2', sub_area: null, target_hours: 275, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS3', area: 'GS3', sub_area: null, target_hours: 300, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS4 Ethics', area: 'GS4 Ethics', sub_area: null, target_hours: 325, priority: 'high', exam_role: 'Score booster tracker' },
      { subject: 'Essay', area: 'Essay', sub_area: null, target_hours: 175, priority: 'medium', exam_role: 'Rank-jump tracker' },
      { subject: 'Mains Answer Writing', area: 'Mains Answer Writing', sub_area: null, target_hours: 300, priority: 'high', exam_role: 'Output tracker' },
      { subject: 'Current Affairs', area: 'Current Affairs', sub_area: null, target_hours: 175, priority: 'medium', exam_role: 'Value-add tracker' },
      { subject: 'Revision/Buffer', area: 'Revision/Buffer', sub_area: null, target_hours: 125, priority: 'low', exam_role: 'Mistake-repair tracker' },

      // GS1 sub-areas
      { subject: 'GS1 - Art & Culture', area: 'GS1', sub_area: 'Art & Culture', target_hours: 35, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - Modern History', area: 'GS1', sub_area: 'Modern History', target_hours: 35, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - Post-Independence India', area: 'GS1', sub_area: 'Post-Independence India', target_hours: 15, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - World History', area: 'GS1', sub_area: 'World History', target_hours: 15, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - Indian Society', area: 'GS1', sub_area: 'Indian Society', target_hours: 40, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - Physical Geography GS Level', area: 'GS1', sub_area: 'Physical Geography GS Level', target_hours: 20, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - Indian & World Geography', area: 'GS1', sub_area: 'Indian & World Geography', target_hours: 35, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - GS1 Mains PYQ + Answer Writing', area: 'GS1', sub_area: 'GS1 Mains PYQ + Answer Writing', target_hours: 35, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },
      { subject: 'GS1 - Revision Sheets + Diagrams', area: 'GS1', sub_area: 'Revision Sheets + Diagrams', target_hours: 20, priority: 'medium', exam_role: 'Mains + Prelims integrated tracker' },

      // GS2 sub-areas
      { subject: 'GS2 - Polity & Constitution Static', area: 'GS2', sub_area: 'Polity & Constitution Static', target_hours: 60, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - Governance', area: 'GS2', sub_area: 'Governance', target_hours: 35, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - Social Justice', area: 'GS2', sub_area: 'Social Justice', target_hours: 40, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - Welfare Schemes', area: 'GS2', sub_area: 'Welfare Schemes', target_hours: 20, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - International Relations', area: 'GS2', sub_area: 'International Relations', target_hours: 35, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - Judgments/Committees/Reports', area: 'GS2', sub_area: 'Judgments/Committees/Reports', target_hours: 20, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - GS2 Mains PYQ + Answer Writing', area: 'GS2', sub_area: 'GS2 Mains PYQ + Answer Writing', target_hours: 45, priority: 'medium', exam_role: 'Polity/governance/current tracker' },
      { subject: 'GS2 - Revision Sheets', area: 'GS2', sub_area: 'Revision Sheets', target_hours: 20, priority: 'medium', exam_role: 'Polity/governance/current tracker' },

      // GS3 sub-areas
      { subject: 'GS3 - Economy', area: 'GS3', sub_area: 'Economy', target_hours: 60, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Agriculture', area: 'GS3', sub_area: 'Agriculture', target_hours: 35, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Environment', area: 'GS3', sub_area: 'Environment', target_hours: 45, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Science & Technology', area: 'GS3', sub_area: 'Science & Technology', target_hours: 30, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Internal Security', area: 'GS3', sub_area: 'Internal Security', target_hours: 35, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Disaster Management', area: 'GS3', sub_area: 'Disaster Management', target_hours: 20, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Infrastructure/Industry/Energy', area: 'GS3', sub_area: 'Infrastructure/Industry/Energy', target_hours: 20, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - GS3 Mains PYQ + Answer Writing', area: 'GS3', sub_area: 'GS3 Mains PYQ + Answer Writing', target_hours: 35, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' },
      { subject: 'GS3 - Revision + Error Log', area: 'GS3', sub_area: 'Revision + Error Log', target_hours: 20, priority: 'medium', exam_role: 'Economy/environment/data-driven tracker' }
    ];

    for (const u of users) {
      console.log(`Seeding targets for user: ${u}...`);
      for (const t of targets) {
        const totalMinutes = t.target_hours * 60;
        const dailyAverageMinutes = Math.round(totalMinutes / totalDays);
        const weeklyTargetMinutes = Math.round(totalMinutes / totalWeeks);

        await query(`
          INSERT INTO public.subject_targets (
            user_id, subject, target_hours, total_weeks, remaining_weeks, 
            mission_start_date, mission_end_date, exam_year, area, sub_area, 
            weekly_target_minutes, daily_average_minutes, priority, exam_role
          )
          VALUES ($1, $2, $3, $4, $5, '2026-05-25', '2027-04-15', '2027', $6, $7, $8, $9, $10, $11)
          ON CONFLICT (user_id, subject) DO UPDATE SET
            target_hours = EXCLUDED.target_hours,
            total_weeks = EXCLUDED.total_weeks,
            remaining_weeks = EXCLUDED.remaining_weeks,
            mission_start_date = EXCLUDED.mission_start_date,
            mission_end_date = EXCLUDED.mission_end_date,
            exam_year = EXCLUDED.exam_year,
            area = EXCLUDED.area,
            sub_area = EXCLUDED.sub_area,
            weekly_target_minutes = EXCLUDED.weekly_target_minutes,
            daily_average_minutes = EXCLUDED.daily_average_minutes,
            priority = EXCLUDED.priority,
            exam_role = EXCLUDED.exam_role,
            updated_at = NOW();
        `, [
          u, t.subject, t.target_hours, Math.round(totalWeeks), Math.round(totalWeeks),
          t.area, t.sub_area, weeklyTargetMinutes, dailyAverageMinutes, t.priority, t.exam_role
        ]);
      }
    }
    
    console.log('Seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 024 failed:', err);
    process.exit(1);
  }
}

runMigration();
