// src/utils/mainsReviewApi.js
// Helper functions for mains review pipeline API calls

import { BACKEND_URL } from "../config.js";

/**
 * Save mains answer attempt
 * POST /api/mains/attempt/save
 */
export async function saveMainsAttempt(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/mains/attempt/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("saveMainsAttempt error:", error);
        throw error;
    }
}

/**
 * Save pasted external review
 * POST /api/mains/review/save
 */
export async function saveMainsReview(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/mains/review/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("saveMainsReview error:", error);
        throw error;
    }
}

/**
 * Process mains review (parse + audit + build intelligence)
 * POST /api/mains/review/process
 */
export async function processMainsReview(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/mains/review/process`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("processMainsReview error:", error);
        throw error;
    }
}

/**
 * Get full processed review result
 * GET /api/mains/review/result?attemptId=...&reviewId=...
 */
export async function getMainsReviewResult(attemptId, reviewId) {
    try {
        const url = new URL(`${BACKEND_URL}/api/mains/review/result`);
        url.searchParams.append("attemptId", attemptId);
        url.searchParams.append("reviewId", reviewId);
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("getMainsReviewResult error:", error);
        throw error;
    }
}

/**
 * Build AIR-1 review prompt dynamically
 * ARGS: questionText, marks, wordLimit, answerText
 * RETURNS: formatted prompt string
 */
export function buildAir1ReviewPrompt({
    questionText,
    marks,
    wordLimit,
    answerText,
}) {
    return `You are a brutally honest UPSC CSE Mains evaluator trained to identify what prevents an answer from reaching top-rank quality.

Evaluate the following UPSC Mains answer exactly like a strict examiner plus a top mentor for AIR-1 preparation.

Question:
${questionText}

Marks:
${marks}

Word Limit:
${wordLimit}

Candidate Answer:
${answerText}

Instructions:

1. Evaluate strictly for UPSC Mains, not for school/college writing.
2. Do not give motivational praise or generic comments.
3. Judge the answer on relevance, structure, depth, dimensional coverage, factual strength, balance, examples, subheadings, and conclusion quality.
4. Identify whether the answer actually addresses the directive word in the question.
5. Be severe where needed. Do not inflate marks.

Return output in exactly this format:

A. Marks Awarded
- Give marks out of ${marks}
- Give a one-line justification for the marks

B. Directive Word Handling
- What was the directive word?
- Was it handled correctly: Yes / Partly / No
- Explain briefly

C. Structure Review
- Intro quality: Strong / Average / Weak
- Body organization: Strong / Average / Weak
- Conclusion quality: Strong / Average / Weak
- Explain briefly

D. Content Strength
- List 3 strengths only if they are real
- List all major missing dimensions
- List factual / conceptual weaknesses
- List whether examples, committees, constitutional articles, case studies, data, reports, thinkers, or diagrams were missing where relevant

E. Examiner Concerns
- Write the top 5 reasons why this answer would lose marks in the UPSC exam hall

F. AIR-1 Upgrade Advice
- Give 5 specific actions that would improve this exact answer
- These must be concrete, not generic

G. Rewrite Blueprint
- Give an ideal structure only, not full model answer
- Intro
- Body point 1
- Body point 2
- Body point 3
- Body point 4
- Conclusion

H. Mistake Classification
Classify the answer under these labels wherever applicable:
- poor directive handling
- weak intro
- weak conclusion
- shallow content
- poor structure
- low dimensionality
- no examples
- factual weakness
- poor prioritization
- time-pressure compression
- weak presentation
- poor balance
- weak analysis
- Missed core demand

I. Final Verdict
Choose one:
- Dangerous answer
- Below UPSC standard
- Average but recoverable
- Good but not ranker level
- Strong answer
- Ranker-grade answer`;
}

/**
 * Build Deep AIR-1 review prompt dynamically via Backend
 * POST /api/mains/air1-prompt
 */
export async function buildAir1Prompt(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/mains/air1-prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("buildAir1Prompt error:", error);
        throw error;
    }
}
export async function evaluateMainsAnswerApi(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/evaluate-answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error) errMsg = errData.error;
            } catch (_) {}
            throw new Error(errMsg);
        }
        return await response.json();
    } catch (error) {
        console.error("evaluateMainsAnswerApi error:", error);
        throw error;
    }
}

/**
 * Extract handwritten answer or printed question from uploaded images/PDFs using Gemini Vision
 * POST /api/mains/extract-answer
 */
export async function extractAnswerFromImagesApi(files, type = "answer") {
    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append("pages", file);
        });

        const response = await fetch(`${BACKEND_URL}/api/mains/extract-answer?type=${encodeURIComponent(type)}`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("extractAnswerFromImagesApi error:", error);
        throw error;
    }
}

/**
 * Extract question and answer from same uploaded image/PDF sheet using Gemini Vision OCR
 * POST /api/mains/extract-question-answer
 */
export async function extractQuestionAnswerFromImagesApi(files) {
    try {
        const formData = new FormData();
        files.forEach(file => {
            formData.append("pages", file);
        });

        const response = await fetch(`${BACKEND_URL}/api/mains/extract-question-answer`, {
            method: "POST",
            body: formData,
        });
        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error) {
                    errMsg = errData.error;
                }
            } catch (e) {}
            throw new Error(errMsg);
        }
        return await response.json();
    } catch (error) {
        console.error("extractQuestionAnswerFromImagesApi error:", error);
        throw error;
    }
}

/**
 * Save/upsert mains attempt to PostgreSQL (durable, survives refresh)
 * POST /api/mains/attempts/save
 */
export async function saveMainsAttemptToDB(payload) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/mains/attempts/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("saveMainsAttemptToDB error:", error);
        throw error;
    }
}

/**
 * Fetch a saved mains attempt from PostgreSQL by attemptId
 * GET /api/mains/attempts/:attemptId
 */
export async function fetchMainsAttempt(attemptId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/mains/attempts/${encodeURIComponent(attemptId)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("fetchMainsAttempt error:", error);
        throw error;
    }
}

/**
 * Fetch the latest saved mains attempt for one exact question key.
 * GET /api/mains/attempts/latest-for-question?userId=...&questionKey=...
 */
export async function fetchLatestMainsAttemptForQuestion(userId, questionKey) {
    try {
        const url = new URL(`${BACKEND_URL}/api/mains/attempts/latest-for-question`);
        url.searchParams.append("userId", userId || "user_1");
        url.searchParams.append("questionKey", questionKey || "");
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("fetchLatestMainsAttemptForQuestion error:", error);
        throw error;
    }
}
