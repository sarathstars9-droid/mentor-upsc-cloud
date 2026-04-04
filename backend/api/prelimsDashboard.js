import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPrelimsDashboard(testId, userId) {
    const filePath = path.join(
        __dirname,
        "..",
        "data",
        "user_attempt_analytics",
        `${testId}_${userId}.json`
    );

    if (!fs.existsSync(filePath)) {
        return {
            success: false,
            error: "Analytics file not found",
        };
    }

    const analytics = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    return {
        success: true,
        summary: analytics.summary || {},
        subjectStats: analytics.subjectStats || {},
        nodeStats: analytics.nodeStats || {},
        typeStats: analytics.typeStats || {},
        trapStats: analytics.trapStats || {},
        difficultyStats: analytics.difficultyStats || {},
        weakNodes: analytics.weakNodes || [],
        weakSubjects: analytics.weakSubjects || [],
        weakTypes: analytics.weakTypes || [],
        trapAlerts: analytics.trapAlerts || [],
        recommendations: analytics.recommendations || [],
    };
}

export { getPrelimsDashboard };