import fs from "fs";
import path from "path";

import { getQuestionMeta } from "./questionMetaEngine.js";
import { analyzeAttempt } from "./attemptAnalysisEngine.js";
import { detectWeakness } from "./weaknessEngine.js";
import { saveAnalyticsResult } from "./saveAnalyticsResult.js";

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function buildQuestionLookup(questions) {
    const map = new Map();

    questions.forEach((question) => {
        const questionId =
            question.id ||
            question.questionId ||
            question.qid ||
            question._id;

        if (!questionId) return;

        map.set(String(questionId), {
            ...question,
            id: String(questionId),
        });
    });

    return map;
}

function enrichQuestionsMeta(attempt, questionLookup) {
    const metaList = [];

    attempt.answers.forEach((answer) => {
        const rawQuestion = questionLookup.get(String(answer.questionId));
        if (!rawQuestion) return;

        const normalizedQuestion = {
            ...rawQuestion,
            id: rawQuestion.id || String(answer.questionId),
            subject: rawQuestion.subject || rawQuestion.paperSubject || "Unknown",
            nodeId:
                rawQuestion.nodeId ||
                rawQuestion.syllabusNodeId ||
                rawQuestion.node_id ||
                "UNKNOWN_NODE",
            section: rawQuestion.section || rawQuestion.topic || rawQuestion.topicName || "",
            microtheme: rawQuestion.microtheme || rawQuestion.microTheme || rawQuestion.micro_theme || "",
            questionType: rawQuestion.questionType || "",
            question:
                rawQuestion.question ||
                rawQuestion.questionText ||
                rawQuestion.title ||
                "",
            syllabusNodeId:
                rawQuestion.syllabusNodeId ||
                rawQuestion.nodeId ||
                rawQuestion.node_id ||
                "UNKNOWN_NODE",
        };

        metaList.push(getQuestionMeta(normalizedQuestion));
    });

    return metaList;
}

function buildFinalAnalytics(analysis, weakness) {
    return {
        summary: analysis.summary || {},
        nodeStats: analysis.nodeStats || {},
        subjectStats: analysis.subjectStats || {},
        typeStats: analysis.typeStats || {},
        trapStats: analysis.trapStats || {},
        difficultyStats: analysis.difficultyStats || {},
        weakNodes: weakness.weakNodes || [],
        weakSubjects: weakness.weakSubjects || [],
        weakTypes: weakness.weakTypes || [],
        trapAlerts: weakness.trapAlerts || [],
        recommendations: weakness.recommendations || [],
    };
}
function runPhase3A({ attemptFilePath, questionsFilePath }) {
    const attempt = loadJson(attemptFilePath);
    const questionsData = loadJson(questionsFilePath);

    const questions = Array.isArray(questionsData)
        ? questionsData
        : questionsData.questions;

    if (!attempt || !Array.isArray(attempt.answers)) {
        throw new Error("Invalid attempt file: answers array missing");
    }

    if (!Array.isArray(questions)) {
        throw new Error("Invalid questions file: 'questions' array missing");
    }

    const questionLookup = buildQuestionLookup(questions);
    const questionsMeta = enrichQuestionsMeta(attempt, questionLookup);
    const analysis = analyzeAttempt(attempt, questionsMeta);
    const weakness = detectWeakness(analysis);

    const finalAnalytics = buildFinalAnalytics(analysis, weakness);

    const savedPath = saveAnalyticsResult(
        attempt.testId,
        attempt.userId,
        finalAnalytics
    );

    return {
        success: true,
        testId: attempt.testId,
        userId: attempt.userId,
        metaCount: questionsMeta.length,
        savedPath,
        analytics: finalAnalytics,
    };
}

export { runPhase3A };