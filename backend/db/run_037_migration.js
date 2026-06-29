import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '037_guardian_phase3.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 037 (Guardian Phase 3A Tables)...');
    await query(sql);
    console.log('Migration 037 applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 037 failed:', err);
    process.exit(1);
  }
}

runMigration();
