import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeText } from "./mappingUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "..");
const ALIAS_FILE = path.join(BACKEND_DIR, "data", "aliasDictionary.json");

let CACHE = null;

function loadAliasDictionary() {
    if (CACHE) return CACHE;
    CACHE = JSON.parse(fs.readFileSync(ALIAS_FILE, "utf-8"));
    return CACHE;
}

function escapeRegExp(str = "") {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceWholeWord(text, alias, fullForm) {
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
    return text.replace(pattern, fullForm);
}

export function expandAliases(input = "") {
    let text = normalizeText(input);
    const dict = loadAliasDictionary();

    const allGroups = Object.values(dict || {});
    for (const group of allGroups) {
        const entries = Object.entries(group || {}).sort((a, b) => b[0].length - a[0].length);

        for (const [alias, fullForm] of entries) {
            text = replaceWholeWord(text, normalizeText(alias), normalizeText(fullForm));
        }
    }

    return text;
}
