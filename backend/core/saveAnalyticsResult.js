import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function saveAnalyticsResult(testId, userId, analytics) {
    const dirPath = path.join(__dirname, "..", "data", "user_attempt_analytics");

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `${testId}_${userId}.json`);

    fs.writeFileSync(filePath, JSON.stringify(analytics, null, 2), "utf-8");

    return filePath;
}

export { saveAnalyticsResult };