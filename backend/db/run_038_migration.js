import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'migrations', '038_proof_upload_and_backlog.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running Migration 038 (Proof Upload & Backlog Schema)...');
    await query(sql);
    console.log('Migration 038 applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration 038 failed:', err);
    process.exit(1);
  }
}

runMigration();
