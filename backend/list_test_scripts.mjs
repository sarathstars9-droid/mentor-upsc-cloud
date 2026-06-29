import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = fs.readdirSync(__dirname);
const testFiles = files.filter(f => 
  (f.startsWith('test_') || f.startsWith('verify_') || f.startsWith('seed_') || f.startsWith('cleanup_')) &&
  (f.endsWith('.mjs') || f.endsWith('.js'))
);

console.log('Found test/verify scripts:', testFiles);
