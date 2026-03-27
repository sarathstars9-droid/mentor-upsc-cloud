// =============================
// PRELIMS ANALYSIS
// =============================

export function analyzePrelimsAttempt({ questions, answersMap, confidenceMap = {} }) {
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    const enriched = questions.map((q, index) => {
        const selected = answersMap[q.questionId] || "";
        let status = "unattempted";

        if (selected) {
            if (selected === q.correctAnswer) {
                status = "correct";
                correct++;
            } else {
                status = "wrong";
                wrong++;
            }
        } else {
            unattempted++;
        }

        return {
            ...q,
            questionNumber: index + 1,
            selectedOption: selected,
            correctOption: q.correctAnswer,
            status,
            confidence: confidenceMap[q.questionId] || "unknown"
        };
    });

    return {
        summary: {
            correct,
            wrong,
            unattempted,
            total: questions.length,
            accuracy: correct + wrong
                ? Math.round((correct / (correct + wrong)) * 100)
                : 0
        },
        questions: enriched
    };
}


// =============================
// REVISION ENGINE
// =============================

export function buildRevisionFromAttempts(attempts = []) {
    const weakMap = {};

    attempts.forEach((a) => {
        (a.questions || []).forEach((q) => {
            if (q.status === "wrong") {
                const key = q.microThemeLabel || "Unknown";
                weakMap[key] = (weakMap[key] || 0) + 1;
            }
        });
    });

    return Object.entries(weakMap)
        .sort((a, b) => b[1] - a[1])
        .map(([theme, count]) => ({
            theme,
            count,
            priority: count > 5 ? "high" : count > 2 ? "medium" : "low",
        }));
}