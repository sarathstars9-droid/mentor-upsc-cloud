import fs from "fs";
import path from "path";
import { PRELIMS_SUBJECT_TOPIC_MAP } from "../utils/prelimsStructureMap.js";

const PYQ_ROOT = path.resolve("backend/data/pyq_questions");

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalize(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function collectTaggedFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let files = [];

    for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(collectTaggedFiles(full));
        } else if (entry.isFile() && entry.name.endsWith("_tagged.json")) {
            files.push(full);
        }
    }

    return files;
}

function loadQuestionsFromFiles(files) {
    const questions = [];

    for (const file of files) {
        try {
            const raw = fs.readFileSync(file, "utf-8");
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
                questions.push(...parsed);
            } else if (Array.isArray(parsed.questions)) {
                questions.push(...parsed.questions);
            }
        } catch (err) {
            console.error("Failed reading file:", file, err.message);
        }
    }

    return questions;
}

function getQuestionText(q) {
    return normalize(q.question || q.questionText || q.title || "");
}

function getQuestionTopicText(q) {
    return normalize(
        q.topic ||
        q.topicName ||
        q.subTopic ||
        q.microTheme ||
        q.section ||
        q.chapter ||
        ""
    );
}

function getQuestionSubjectText(q) {
    return normalize(
        q.subject ||
        q.subjectName ||
        q.paperSubject ||
        q.module ||
        ""
    );
}

function getNodeText(q) {
    return safeArray(q.syllabusNodeIds).map(normalize).join(" ");
}

function matchesAny(text, aliases = []) {
    const n = normalize(text);
    return aliases.some((alias) => n.includes(normalize(alias)));
}

function matchesSubject(question, subjectId) {
    const map = PRELIMS_SUBJECT_TOPIC_MAP[subjectId];
    if (!map) return false;

    const subjectText = getQuestionSubjectText(question);
    const topicText = getQuestionTopicText(question);
    const qText = getQuestionText(question);
    const nodeText = getNodeText(question);

    return (
        matchesAny(subjectText, map.subjectAliases) ||
        matchesAny(topicText, map.subjectAliases) ||
        matchesAny(qText, map.subjectAliases) ||
        matchesAny(nodeText, map.subjectAliases)
    );
}

function matchesTopic(question, subjectId, topicId) {
    const map = PRELIMS_SUBJECT_TOPIC_MAP[subjectId];
    if (!map || !map.topicAliases?.[topicId]) return false;

    const aliases = map.topicAliases[topicId];
    const topicText = getQuestionTopicText(question);
    const qText = getQuestionText(question);
    const nodeText = getNodeText(question);

    return (
        matchesAny(topicText, aliases) ||
        matchesAny(qText, aliases) ||
        matchesAny(nodeText, aliases)
    );
}

function matchesYear(question, year) {
    return String(question.year || "") === String(year);
}

function matchesPaper(question, paper) {
    const p = normalize(question.paper || question.paperType || question.stagePaper || "");
    if (paper === "gs1") return p.includes("gs") || p.includes("gs1");
    if (paper === "csat") return p.includes("csat");
    return false;
}

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function shapeQuestion(q, fallbackIndex = 0) {
    return {
        ...q,
        id: q.id || q.questionId || `PYQ_${fallbackIndex + 1}`,
        questionId: q.questionId || q.id || `PYQ_${fallbackIndex + 1}`,
        questionText: q.questionText || q.question || "",
        options: q.options || {
            A: q.optionA || q.A || "",
            B: q.optionB || q.B || "",
            C: q.optionC || q.C || "",
            D: q.optionD || q.D || "",
        },
    };
}

export async function buildPrelimsPracticeTest(payload) {
    const { mode, paper, scope, subjectId, topicId, count = 10, year } = payload || {};

    const allFiles = collectTaggedFiles(PYQ_ROOT);
    const allQuestions = loadQuestionsFromFiles(allFiles);

    let matched = [];

    if (mode === "full_length") {
        matched = allQuestions.filter(
            (q) => matchesYear(q, year) && matchesPaper(q, paper)
        );
    } else if (mode === "sectional") {
        if (scope === "subject") {
            matched = allQuestions.filter((q) => matchesSubject(q, subjectId));
        } else if (scope === "topic") {
            matched = allQuestions.filter(
                (q) => matchesSubject(q, subjectId) && matchesTopic(q, subjectId, topicId)
            );
        }
    }

    const finalQuestions = shuffle(matched)
        .slice(0, Number(count))
        .map((q, idx) => shapeQuestion(q, idx));

    return {
        ok: true,
        totalMatched: matched.length,
        returnedCount: finalQuestions.length,
        questions: finalQuestions,
    };
}