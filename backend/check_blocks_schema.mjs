import { query } from './db/index.js';
async function run() {
  const { rows } = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'study_blocks'
  `);
  console.log('study_blocks schema:', rows);
  process.exit(0);
}
run();
