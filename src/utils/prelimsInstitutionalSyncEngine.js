import { BACKEND_URL } from "../config";

function mistakeQid(testId, questionNumber) {
    return `INST_${testId}_${questionNumber}`;
}

export function previewSync(test, evaluationResult) {
    const eligible = (evaluationResult.questionResults || []).filter(
        (r) => r.result === "wrong" || r.result === "unattempted"
    );

    return {
        total:       evaluationResult.totalQuestions,
        wrong:       evaluationResult.wrong,
        unattempted: evaluationResult.unattempted,
        eligible:    eligible.length,
        mistakeBookNew:  eligible.length, // Preview assumes all are new for simplicity
        revisionNew: eligible.length,
    };
}

export async function syncToMistakeBook(test, evaluationResult) {
    const toAdd = [];

    for (const q of (evaluationResult.questionResults || [])) {
        if (q.result !== "wrong" && q.result !== "unattempted") continue;

        const questionId = mistakeQid(test.id, q.questionNumber);

        toAdd.push({
            sourceType:     "institutional",
            testId:         test.id,
            questionId,
            stage:          "prelims",
            subject:        q.subjectBucket || null,
            nodeId:         null,
            questionText:   q.questionText  || "",
            latestUserAnswer: q.userAnswer    || null,
            correctAnswer:  q.correctAnswer || "",
            latestResult:   q.result,
            mistakeType:    q.result === "unattempted" ? "unattempted" : "conceptual_error",
            mustRevise:     true,
        });
    }

    if (toAdd.length === 0) return { added: 0, skipped: 0 };

    try {
        const res = await fetch(`${BACKEND_URL}/api/mistakes/bulk-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: toAdd })
        });
        const data = await res.json();
        return { added: data.count || 0, skipped: 0 };
    } catch (err) {
        console.error("Failed to sync institutional test to mistakes", err);
        return { added: 0, skipped: toAdd.length };
    }
}

export async function syncToRevisionQueue(test, evaluationResult) {
    // Handled automatically by backend hook during Mistake Book bulk-sync
    return { added: 0, skipped: 0 };
}
