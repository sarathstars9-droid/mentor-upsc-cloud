function detectWeakness(analysis) {
    const weakNodes = [];
    const weakSubjects = [];
    const weakTypes = [];
    const trapAlerts = [];
    const recommendations = [];

    for (const nodeId in analysis.nodeStats) {
        const d = analysis.nodeStats[nodeId];
        if (d.attempted > 0 && d.accuracy < 50) {
            weakNodes.push({
                nodeId,
                accuracy: d.accuracy,
            });
            recommendations.push(`Revise topic: ${nodeId}`);
        }
    }

    for (const subject in analysis.subjectStats) {
        const d = analysis.subjectStats[subject];
        if (d.attempted > 0 && d.accuracy < 50) {
            weakSubjects.push({
                subject,
                accuracy: d.accuracy,
            });
            recommendations.push(`Strengthen subject: ${subject}`);
        }
    }

    for (const type in analysis.typeStats) {
        const d = analysis.typeStats[type];
        if (d.attempted > 0 && d.accuracy < 50) {
            weakTypes.push({
                type,
                accuracy: d.accuracy,
            });
            recommendations.push(`Practice ${type} questions`);
        }
    }

    for (const trap in analysis.trapStats) {
        const d = analysis.trapStats[trap];
        if (trap !== "none" && d.attempted > 0 && d.accuracy < 40) {
            trapAlerts.push({
                trap,
                accuracy: d.accuracy,
            });
            recommendations.push(`Improve handling of ${trap}`);
        }
    }

    if ((analysis.summary?.guessRate || 0) > 30) {
        recommendations.push("Reduce blind guessing in prelims attempts");
    }

    if ((analysis.summary?.fastWrong || 0) > 0) {
        recommendations.push("Slow down on fast wrong answers");
    }

    if ((analysis.summary?.riskyAttempts || 0) > (analysis.summary?.safeAttempts || 0)) {
        recommendations.push("Increase safe attempts and reduce risky marking");
    }

    return {
        weakNodes,
        weakSubjects,
        weakTypes,
        trapAlerts,
        recommendations: [...new Set(recommendations)],
    };
}

export { detectWeakness };