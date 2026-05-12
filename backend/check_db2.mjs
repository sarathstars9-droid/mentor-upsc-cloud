import { query } from './db/index.js';
async function run() {
    const r = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'node_weakness';");
    console.log(r.rows);
    process.exit(0);
}
run();
