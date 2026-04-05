/**
 * backend/brain/validNodeSet.js
 *
 * CANONICAL VALID NODE ID SET
 * ─────────────────────────────────────────────────────────────────────────────
 * Source of truth: syllabus_node_ids_only.txt (364 nodes)
 *
 * Exports:
 *   VALID_NODE_IDS          - Set<string> of all canonical node IDs
 *   isValidNodeId(id)       - true only if id exists in canonical list
 *   findNearestValidParent  - progressively trims suffix, returns nearest valid
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load canonical list
const rawTxt = readFileSync(
  join(__dirname, "../data/syllabus_node_ids_only.txt"),
  "utf8"
);

/**
 * All canonical node IDs as a Set.
 * Dots in the txt file use "." not "-" for 1C nodes,
 * BUT in the actual JSON files they are written as "1C-VA-ARCH" with hyphens.
 * The txt file also uses dots: "1C.VA.ARCH" — we normalise both.
 */
export const VALID_NODE_IDS = new Set(
  rawTxt
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(id => [
      id,                          // original (e.g. "1C.VA.ARCH")
      id.replace(/\./g, "-"),      // hyphenated (e.g. "1C-VA-ARCH")
    ])
);

/**
 * Returns true only if the given nodeId is in the canonical list.
 * Case-sensitive (all IDs are uppercase).
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isValidNodeId(nodeId) {
  if (!nodeId || typeof nodeId !== "string") return false;
  return VALID_NODE_IDS.has(nodeId) || VALID_NODE_IDS.has(nodeId.replace(/\./g, "-"));
}

/**
 * Progressively trims the last "-SEGMENT" from a nodeId until
 * either a valid parent is found or no more segments remain.
 *
 * Example:
 *   "GS2-POL-MAINS-EXEC-LEG-JUD-FED" → tries:
 *     "GS2-POL-MAINS-EXEC-LEG-JUD"
 *     "GS2-POL-MAINS-EXEC-LEG"
 *     "GS2-POL-MAINS-EXEC"
 *     "GS2-POL-MAINS"
 *     "GS2-POL"
 *     → null (GS2-POL itself is not a leaf node in the canonical list,
 *              but GS2-POL-EXEC is — so we return the first valid hit)
 *
 * @param {string} nodeId
 * @returns {string|null} nearest valid parent or null
 */
export function findNearestValidParent(nodeId) {
  if (!nodeId || typeof nodeId !== "string") return null;

  // Normalise dots to hyphens for consistent processing
  let id = nodeId.replace(/\./g, "-");

  // Try progressively shorter prefixes
  const parts = id.split("-");
  for (let len = parts.length - 1; len >= 2; len--) {
    const candidate = parts.slice(0, len).join("-");
    if (VALID_NODE_IDS.has(candidate)) return candidate;
  }
  return null;
}
