import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

function searchDir(dir) {
  if (dir.includes('node_modules') || dir.includes('.git') || dir.includes('.claude')) return;
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return;
  }
  for (const file of files) {
    const filePath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch (e) {
      continue;
    }
    if (stat.isDirectory()) {
      searchDir(filePath);
    } else if (stat.isFile() && (file.endsWith('.json') || file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.log'))) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes("relief-guided") || content.includes("Western Ghats force") || content.includes("Monsoon-Sensitive")) {
          console.log("Found match in file:", filePath);
          console.log("Snippet:", content.slice(content.indexOf("relief-guided") - 100, content.indexOf("relief-guided") + 300));
        }
      } catch (e) {}
    }
  }
}

async function main() {
  console.log("Starting search in:", rootDir);
  searchDir(rootDir);
  console.log("Search finished.");
}
main();
