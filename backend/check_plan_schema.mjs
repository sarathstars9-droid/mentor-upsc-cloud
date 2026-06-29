import { query } from './db/index.js';
async function run() {
  const { rows } = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'plan_block_events'
  `);
  console.log('plan_block_events schema:', rows);
  
  const { rows: constraints } = await query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'plan_block_events'
  `);
  console.log('plan_block_events constraints:', constraints);
  process.exit(0);
}
run();
