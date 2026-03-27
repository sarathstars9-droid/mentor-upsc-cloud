import fs from "fs";
import path from "path";
import { UNIFIED_SYLLABUS_INDEX } from "../brain/unifiedSyllabusIndex.js";

const outputDir = path.resolve("backend/data");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. node id list
const nodeIds = UNIFIED_SYLLABUS_INDEX.map(n => n.syllabusNodeId).sort();

fs.writeFileSync(
  path.join(outputDir, "syllabus_node_ids_only.txt"),
  nodeIds.join("\n"),
  "utf-8"
);

// 2. registry
fs.writeFileSync(
  path.join(outputDir, "syllabus_registry_master.json"),
  JSON.stringify(UNIFIED_SYLLABUS_INDEX, null, 2),
  "utf-8"
);

// 3. group by subject
const bySubject = {};

for (const node of UNIFIED_SYLLABUS_INDEX) {
  const key = node.subjectGroup || "UNKNOWN";
  if (!bySubject[key]) bySubject[key] = [];
  bySubject[key].push(node.syllabusNodeId);
}

fs.writeFileSync(
  path.join(outputDir, "syllabus_nodes_by_subject.json"),
  JSON.stringify(bySubject, null, 2),
  "utf-8"
);

console.log("✅ Syllabus files generated successfully");