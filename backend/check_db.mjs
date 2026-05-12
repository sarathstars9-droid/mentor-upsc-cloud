import { query } from './db/index.js';
async function run() {
    const r = await query("SELECT table_name FROM information_schema.tables WHERE table_name = 'node_weakness';");
    console.log(r.rows);
    process.exit(0);
}
run();
