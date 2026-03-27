export function computeBehaviour({ answersMap, confidenceMap, questions }) {
    const attempted = Object.keys(answersMap).length;
    const total = questions.length;

    let correct = 0;
    questions.forEach(q => {
        if (answersMap[q.questionId] === q.correctAnswer) correct++;
    });

    const accuracy = attempted ? (correct / attempted) : 0;

    const guessCount = Object.values(confidenceMap || {}).filter(c => c === "guess").length;

    return {
        attempted,
        accuracy,
        guessCount,
        attemptQuality: accuracy > 0.7 ? "good" : accuracy > 0.4 ? "average" : "poor"
    };
}
