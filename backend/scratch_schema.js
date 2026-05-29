import { query } from './db/index.js';

async function run() {
  const res1 = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'plan_block_events'");
  const res2 = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'study_blocks'");
  const res3 = await query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='plan_block_events';
  `);
  
  console.log('--- plan_block_events ---');
  console.table(res1.rows);
  console.log('--- study_blocks ---');
  console.table(res2.rows);
  console.log('--- Foreign Keys ---');
  console.table(res3.rows);
  process.exit();
}

run();
