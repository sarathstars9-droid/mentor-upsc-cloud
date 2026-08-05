import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^DATABASE_URL=(.*)/);
      if (match) process.env.DATABASE_URL = match[1].trim();
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DANGER: DATABASE_URL is required");
  process.exit(1);
}

const dbUrl = new URL(process.env.DATABASE_URL);
const safeHosts = ['localhost', '127.0.0.1', '::1'];
if (!safeHosts.includes(dbUrl.hostname) || dbUrl.hostname.includes('railway') || dbUrl.hostname.includes('production')) {
  console.error(`DANGER: DATABASE_URL hostname '${dbUrl.hostname}' is not explicitly safe. Aborting.`);
  process.exit(1);
}

// Ensure db/index.js gets the properly set DATABASE_URL
const { pool } = await import('../db/index.js');
export { pool };
