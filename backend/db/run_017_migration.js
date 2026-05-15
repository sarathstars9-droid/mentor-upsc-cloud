import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '017_mains_learning_loop.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 017...');
    await query(sql);
    console.log('Migration 017 completed successfully.');
    
    process.exit(0);
  } catch (err) {
    console.error('Migration 017 failed:', err);
    process.exit(1);
  }
}

runMigration();
