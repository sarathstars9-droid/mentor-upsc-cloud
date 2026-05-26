import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Starting migration runner...');
  
  console.log('1/2 Running Telegram migration...');
  execSync('node "' + path.join(__dirname, 'run_telegram_migration.js') + '"', { stdio: 'inherit' });
  
  console.log('2/2 Running 025 migration...');
  execSync('node "' + path.join(__dirname, 'run_025_migration.js') + '"', { stdio: 'inherit' });
  
  console.log('🎉 All migrations completed successfully.');
} catch (error) {
  console.error('❌ Migration run failed:', error.message);
  process.exit(1);
}
