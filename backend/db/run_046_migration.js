import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '046_study_blocks_friction_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 046...');
    await query(sql);
    console.log('Migration 046 applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
