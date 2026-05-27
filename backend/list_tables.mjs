import { query } from './db/index.js';
async function run() {
    const sb = await query("SELECT DISTINCT user_id FROM public.study_blocks;");
    const ri = await query("SELECT DISTINCT user_id FROM public.revision_items;");
    const m = await query("SELECT DISTINCT user_id FROM public.mistakes;");
    const ma = await query("SELECT DISTINCT user_id FROM public.mains_answers;");
    
    console.log("Distinct User IDs in study_blocks:", sb.rows.map(r => r.user_id));
    console.log("Distinct User IDs in revision_items:", ri.rows.map(r => r.user_id));
    console.log("Distinct User IDs in mistakes:", m.rows.map(r => r.user_id));
    console.log("Distinct User IDs in mains_answers:", ma.rows.map(r => r.user_id));
    process.exit(0);
}
run();
