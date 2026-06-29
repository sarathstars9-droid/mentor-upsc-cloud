import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('Running migration 039_completion_guard_fields.sql...');
  const sqlPath = path.join(__dirname, 'migrations', '039_completion_guard_fields.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await query(sql);
    console.log('✅ Migration 039 completed successfully.');
  } catch (err) {
    console.error('❌ Migration 039 failed:', err);
  }
  process.exit(0);
}

run();
