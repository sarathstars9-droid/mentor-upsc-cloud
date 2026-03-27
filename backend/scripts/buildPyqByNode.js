import fs from "fs";
import path from "path";

const BASE = path.resolve("data");

const PYQ_NODE_PATH = path.join(BASE, "pyq_index/pyq_by_node.json");
const DATA_DIR = path.join(BASE, "pyq_questions");

const FOLDERS = {
    prelims: "prelims",
    mains: "mains",
    essay: "essay",
    ethics: "ethics",
    optional: "optional",
    csat: "csat"
};

const pyqByNode = JSON.parse(fs.readFileSync(PYQ_NODE_PATH, "utf-8"));

function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    let results = [];

    for (const name of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, name);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            results = results.concat(getFiles(fullPath));
        } else if (stat.isFile() && fullPath.endsWith(".json")) {
            results.push(fullPath);
        }
    }

    return results;
}

Object.entries(FOLDERS).forEach(([category, folder]) => {

    const files = getFiles(path.join(DATA_DIR, folder));

    files.forEach(file => {
        const data = JSON.parse(fs.readFileSync(file, "utf-8"));

        (data.questions || []).forEach(q => {

            const node = q.syllabusNodeId;
            const qid = q.id;

            if (!node || !qid) return;
            if (!pyqByNode[node]) return;

            if (!pyqByNode[node][category].includes(qid)) {
                pyqByNode[node][category].push(qid);
            }

        });

    });

});

fs.writeFileSync(PYQ_NODE_PATH, JSON.stringify(pyqByNode, null, 2));

console.log("✅ pyq_by_node.json updated");