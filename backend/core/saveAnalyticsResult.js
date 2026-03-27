import fs from "fs";
import path from "path";

function saveAnalyticsResult(testId, userId, analytics) {
    const dirPath = path.join(process.cwd(), "data", "user_attempt_analytics");

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `${testId}_${userId}.json`);

    fs.writeFileSync(filePath, JSON.stringify(analytics, null, 2), "utf-8");

    return filePath;
}

export { saveAnalyticsResult };