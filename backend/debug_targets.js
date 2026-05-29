import { query } from './db/index.js';

async function run() {
  // Check all subject_targets for moulika (top-level only, no sub_area)
  const r1 = await query(`SELECT subject, target_hours, sub_area, mission_start_date, mission_end_date FROM public.subject_targets WHERE user_id='moulika' AND sub_area IS NULL ORDER BY subject`);
  console.log("== Top-level subject targets ==");
  console.log(JSON.stringify(r1.rows, null, 2));
  
  const totalHours = r1.rows.reduce((acc, r) => acc + Number(r.target_hours), 0);
  console.log("Total target hours:", totalHours);
  
  // Count weeks
  if (r1.rows.length > 0) {
    const start = new Date(r1.rows[0].mission_start_date);
    const end = new Date(r1.rows[0].mission_end_date);
    const totalWeeks = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7);
    console.log("Total weeks:", totalWeeks.toFixed(2));
    console.log("Weekly target (3500 / weeks):", (totalHours / totalWeeks).toFixed(2), "hours/week");
  }
  
  // Also check if sub_area rows exist separately
  const r2 = await query(`SELECT COUNT(*) as cnt FROM public.subject_targets WHERE user_id='moulika' AND sub_area IS NOT NULL`);
  console.log("\nSub-area rows:", r2.rows[0].cnt);
  
  // getAllSubjectProgress calls getAreaProgress for each subject including sub_areas
  const r3 = await query(`SELECT DISTINCT subject, sub_area FROM public.subject_targets WHERE user_id='moulika' ORDER BY subject`);
  console.log("\nAll distinct subject + sub_area combos:", r3.rows.length, "rows");
  console.log(JSON.stringify(r3.rows.slice(0, 10), null, 2));

  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
