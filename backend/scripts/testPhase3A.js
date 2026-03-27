import path from "path";
import { fileURLToPath } from "url";

import { runPhase3A } from "../core/runPhase3A.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const result = runPhase3A({
        attemptFilePath: path.join(
            __dirname,
            "../data/user_attempts/prelims_2020_gs1_user_1.json"
        ),
        questionsFilePath: path.join(
            __dirname,
            "../data/pyq_questions/prelims/gs/prelims_gs_history_ancient_tagged.json"
        ),
    });

    console.log("Phase 3A completed successfully");
    console.log(JSON.stringify(result, null, 2));
} catch (error) {
    console.error("Phase 3A failed");
    console.error(error.message);
}