import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const DATA_DIR = path.resolve(__dirname, "../data");
const PYQ_QUESTIONS_DIR = path.join(DATA_DIR, "pyq_questions");
const OUTPUT_DIR = path.join(DATA_DIR, "pyq_index");

// Make sure output dir exists
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    // Ignore if exists
  }
}

// Recursively find all json files
async function findJsonFiles(dir, fileList = []) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      await findJsonFiles(fullPath, fileList);
    } else if (item.isFile() && item.name.endsWith(".json")) {
      fileList.push({ path: fullPath, name: item.name });
    }
  }
  return fileList;
}

// Generate stage/bucket logically
function determineStage(filename, q) {
  const fName = filename.toLowerCase();
  const qStage = String(q.stage || "").toLowerCase();
  const qPaper = String(q.paper || "").toLowerCase();
  const qSubject = String(q.subject || "").toLowerCase();

  // Explicit csat checks
  if (fName.includes("csat") || qPaper === "csat" || qSubject === "csat") {
    return "csat";
  }
  // Mains checks
  if (fName.includes("mains") || qStage === "mains") {
    return "mains";
  }
  // Optional subjects
  if (fName.includes("optional") || qPaper.includes("optional")) {
    return "optional";
  }
  if (fName.includes("essay") || qPaper.includes("essay")) {
    return "essay";
  }
  // Prelims checks
  if (fName.includes("prelims") || qStage === "prelims") {
    return "prelims";
  }

  return "unknown";
}

async function buildMasterIndex() {
  await ensureDir(OUTPUT_DIR);

  console.log("🔍 Scanning for PYQ JSONs in:", PYQ_QUESTIONS_DIR);
  const files = await findJsonFiles(PYQ_QUESTIONS_DIR);
  
  const masterIndex = {};

  let totalQuestions = 0;
  let csatQuestions = 0;
  let missingIds = 0;

  for (const fileObj of files) {
    const raw = await fs.readFile(fileObj.path, "utf-8");
    try {
      const parsed = JSON.parse(raw);
      // Data might be array or { questions: [] }
      const qs = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : []);

      for (const q of qs) {
        if (!q.id) {
          missingIds++;
          continue; // skip if absolutely no ID available
        }

        const stage = determineStage(fileObj.name, q);
        
        // Build normalized item
        const normalized = {
          id: q.id,
          questionText: q.question || "",
          subject: q.subject || q.module || "",
          stage: stage,
          year: q.year || null,
          nodeId: q.syllabusNodeId || null,
          section: q.section || "",
          microtheme: q.microtheme || "",
          options: q.options || {},
          answer: q.answer || "",
          sourceFile: fileObj.name,
          // Retain everything else implicitly if needed, but safe payload below:
          ...q
        };
        
        masterIndex[q.id] = normalized;
        totalQuestions++;

        if (stage === "csat") {
          csatQuestions++;
        }
      }
    } catch (e) {
      console.error(`❌ Error parsing ${fileObj.name}:`, e.message);
    }
  }

  const outputPath = path.join(OUTPUT_DIR, "pyq_master_index.json");
  await fs.writeFile(outputPath, JSON.stringify(masterIndex, null, 2), "utf-8");

  console.log("✅ Master Index Built!");
  console.log(`[PYQ BUILD] Total Questions: ${totalQuestions} (Unique IDs: ${Object.keys(masterIndex).length})`);
  console.log(`[PYQ BUILD] Total CSAT: ${csatQuestions}`);
  if (missingIds > 0) {
    console.warn(`[PYQ BUILD] Ignored ${missingIds} questions due to missing "id"`);
  }
}

buildMasterIndex().catch(e => {
  console.error("Fatal error starting builder:", e);
  process.exit(1);
});