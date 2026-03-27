function initBucket() {
    return { attempted: 0, correct: 0, wrong: 0 };
}

function finalizeStats(statsObj) {
    const finalStats = {};

    for (const key in statsObj) {
        const s = statsObj[key];
        finalStats[key] = {
            attempted: s.attempted,
            correct: s.correct,
            wrong: s.wrong,
            accuracy: s.attempted ? Number(((s.correct / s.attempted) * 100).toFixed(2)) : 0,
        };
    }

    return finalStats;
}

function analyzeAttempt(attempt, questionsMeta) {
    let attempted = 0;
    let correct = 0;
    let wrong = 0;
    let totalTime = 0;

    let guessCount = 0;
    let fastWrong = 0;
    let slowQuestions = 0;
    let safeAttempts = 0;
    let riskyAttempts = 0;

    const nodeStats = {};
    const trapStats = {};
    const subjectStats = {};
    const typeStats = {};
    const difficultyStats = {};

    const metaMap = new Map();
    questionsMeta.forEach((meta) => {
        metaMap.set(String(meta.questionId), meta);
    });

    attempt.answers.forEach((ans) => {
        const meta = metaMap.get(String(ans.questionId));
        if (!meta) return;

        const selected = typeof ans.selected === "string" ? ans.selected.trim() : ans.selected;
        const hasAttempted = selected !== "" && selected !== null && selected !== undefined;

        if (!hasAttempted) return;

        attempted++;
        const timeTaken = Number(ans.timeTaken || 0);
        totalTime += timeTaken;

        if (ans.isCorrect) correct++;
        else wrong++;

        if (timeTaken > 90) slowQuestions++;
        if (!ans.isCorrect && timeTaken > 0 && timeTaken < 20) fastWrong++;

        const isGuess = !ans.isCorrect && timeTaken > 0 && timeTaken < 15;
        if (isGuess) guessCount++;

        if (timeTaken >= 30) safeAttempts++;
        else riskyAttempts++;

        if (!nodeStats[meta.nodeId]) nodeStats[meta.nodeId] = initBucket();
        if (!subjectStats[meta.subject]) subjectStats[meta.subject] = initBucket();
        if (!typeStats[meta.type]) typeStats[meta.type] = initBucket();
        if (!trapStats[meta.trapType]) trapStats[meta.trapType] = initBucket();
        if (!difficultyStats[meta.difficulty]) difficultyStats[meta.difficulty] = initBucket();

        nodeStats[meta.nodeId].attempted++;
        subjectStats[meta.subject].attempted++;
        typeStats[meta.type].attempted++;
        trapStats[meta.trapType].attempted++;
        difficultyStats[meta.difficulty].attempted++;

        if (ans.isCorrect) {
            nodeStats[meta.nodeId].correct++;
            subjectStats[meta.subject].correct++;
            typeStats[meta.type].correct++;
            trapStats[meta.trapType].correct++;
            difficultyStats[meta.difficulty].correct++;
        } else {
            nodeStats[meta.nodeId].wrong++;
            subjectStats[meta.subject].wrong++;
            typeStats[meta.type].wrong++;
            trapStats[meta.trapType].wrong++;
            difficultyStats[meta.difficulty].wrong++;
        }
    });

    const accuracy = attempted ? (correct / attempted) * 100 : 0;
    const avgTime = attempted ? totalTime / attempted : 0;
    const totalQuestions = Array.isArray(attempt.answers) ? attempt.answers.length : 0;

    return {
        summary: {
            attempted,
            correct,
            wrong,
            skipped: totalQuestions - attempted,
            accuracy: Number(accuracy.toFixed(2)),
            avgTime: Number(avgTime.toFixed(2)),
            guessCount,
            guessRate: attempted ? Number(((guessCount / attempted) * 100).toFixed(2)) : 0,
            fastWrong,
            slowQuestions,
            safeAttempts,
            riskyAttempts,
        },
        nodeStats: finalizeStats(nodeStats),
        subjectStats: finalizeStats(subjectStats),
        typeStats: finalizeStats(typeStats),
        trapStats: finalizeStats(trapStats),
        difficultyStats: finalizeStats(difficultyStats),
    };
}

export { analyzeAttempt };