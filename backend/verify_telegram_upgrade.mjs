// backend/verify_telegram_upgrade.mjs
import { query } from './db/index.js';
import * as progressService from './services/progressService.js';
import * as reportGeneratorService from './services/reportGeneratorService.js';
import * as botCommandService from './services/botCommandService.js';
import * as consistencyService from './services/consistencyService.js';

async function verify() {
  console.log('================================================================');
  console.log('          Telegram Bot Upgrade Verification Script              ');
  console.log('================================================================\n');

  // 1. Table Verification
  console.log('--- 1. Verification of New Tables existence ---');
  const targetTables = ['subject_sub_targets', 'daily_consistency'];
  try {
    const tableRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (${targetTables.map((_, i) => `$${i + 1}`).join(', ')})
    `, targetTables);
    
    const foundTables = new Set(tableRes.rows.map(r => r.table_name));
    for (const t of targetTables) {
      console.log(`Table '${t}': ${foundTables.has(t) ? '✔ Yes' : '✘ No'}`);
    }
  } catch (err) {
    console.error('✘ Error checking table existence:', err.message);
  }

  // 2. Verification of Seeded Sub-Targets count
  console.log('\n--- 2. Granular Sub-Targets Count Check ---');
  try {
    const countRes = await query(`
      SELECT parent_subject, COUNT(*) as count, SUM(target_hours) as total_hours 
      FROM public.subject_sub_targets 
      WHERE user_id = 'moulika'
      GROUP BY parent_subject
    `);
    console.table(countRes.rows.map(r => ({
      'Parent Subject': r.parent_subject,
      'Sub-areas Seeded': r.count,
      'Total Allocated Hours': r.total_hours
    })));
  } catch (err) {
    console.error('✘ Error checking sub-targets counts:', err.message);
  }

  // 3. Test progressService.getGoodMorningReportData & generateGoodMorningReport
  console.log('\n--- 3. Testing 5 AM Good Morning Mission Message ---');
  try {
    const morningData = await progressService.getGoodMorningReportData('moulika');
    console.log('Generated Good Morning Data:');
    console.dir(morningData);
    
    const text = reportGeneratorService.generateGoodMorningReport(morningData, 'Moulika');
    console.log('\nFormatted Message:\n');
    console.log(text);
  } catch (err) {
    console.error('✘ Good Morning report test failed:', err.message, err.stack);
  }

  // 4. Test progressService.getDailyNightReportData & generateDailyNightReport
  console.log('\n--- 4. Testing 10 PM Daily Night Report ---');
  try {
    const nightData = await progressService.getDailyNightReportData('moulika', '2026-05-26');
    console.log('Generated Night Report Data:');
    console.dir(nightData);
    
    const text = reportGeneratorService.generateDailyNightReport(nightData, 'Moulika');
    console.log('\nFormatted Message:\n');
    console.log(text);
  } catch (err) {
    console.error('✘ Daily Night report test failed:', err.message, err.stack);
  }

  // 5. Test progressService.getMonthlyProgressReport & generateMonthlyReport
  console.log('\n--- 5. Testing End of Month Report ---');
  try {
    const monthlyData = await progressService.getMonthlyProgressReport('moulika', '2026-05');
    console.log('Generated Monthly Report Data:');
    console.dir(monthlyData);
    
    const text = reportGeneratorService.generateMonthlyReport(monthlyData, 'Moulika');
    console.log('\nFormatted Message:\n');
    console.log(text);
  } catch (err) {
    console.error('✘ Monthly report test failed:', err.message, err.stack);
  }

  // 6. Test progressService.getSubjectSubTargetsProgress
  console.log('\n--- 6. Testing GS1/GS2/GS3 Sub-targets Progress ---');
  try {
    for (const paper of ['GS1', 'GS2', 'GS3']) {
      const progress = await progressService.getSubjectSubTargetsProgress('moulika', paper);
      console.log(`\nProgress for ${paper} sub-targets:`);
      console.table(progress.slice(0, 5).map(p => ({
        'Sub Area': p.sub_area,
        'Target Hours': p.target_hours,
        'Completed Hours': p.completed_hours,
        'Remaining Hours': p.remaining_hours,
        'Done %': `${p.completion_percent}%`
      })));
    }
  } catch (err) {
    console.error('✘ Sub-targets progress check failed:', err.message);
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
