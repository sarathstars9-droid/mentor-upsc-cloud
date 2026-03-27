import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.join(__dirname, "..");
const PYQ_QUESTIONS_DIR = path.join(BACKEND_DIR, "data", "pyq_questions");
const INDEX_FILE = path.join(BACKEND_DIR, "data", "pyq_index", "pyq_by_node.json");

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function walkJsonFiles(dir) {
    const results = [];

    function walk(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(current, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith("_tagged.json")) {
                results.push(fullPath);
            }
        }
    }

    walk(dir);
    return results;
}

function buildLookup() {
    const files = walkJsonFiles(PYQ_QUESTIONS_DIR);
    const lookup = new Map();

    for (const file of files) {
        const data = readJSON(file);
        const questions = Array.isArray(data.questions) ? data.questions : [];

        for (const q of questions) {
            if (q.id) {
                lookup.set(q.id, q.syllabusNodeId || null);
            }
        }
    }

    return lookup;
}

function validate() {
    const index = readJSON(INDEX_FILE);
    const lookup = buildLookup();

    let issues = 0;

    for (const nodeId of Object.keys(index)) {
        const buckets = index[nodeId];

        for (const bucketName of Object.keys(buckets)) {
            const ids = Array.isArray(buckets[bucketName]) ? buckets[bucketName] : [];

            for (const id of ids) {
                const actualNodeId = lookup.get(id);

                if (!lookup.has(id)) {
                    console.log(`❌ Missing question: ${id}`);
                    issues++;
                    continue;
                }

                if (actualNodeId !== nodeId) {
                    console.log(`❌ Wrong mapping: ${id} -> index:${nodeId}, actual:${actualNodeId}`);
                    issues++;
                }
            }
        }
    }

    if (issues === 0) {
        console.log("✅ ALL MAPPINGS CORRECT");
    } else {
        console.log(`⚠️ Issues found: ${issues}`);
    }
}

validate();