import { loadAllPrelimsQuestions } from "../loaders/prelimsUnifiedLoader.js";
import { getQuestionsByNodeId } from "../brain/nodeIdTopicEngine.js";
import { resolveSubjectAlias } from "../brain/subjectAliasMap.js";

function safeArray(v) {
    return Array.isArray(v) ? v : [];
}

export function getPrelimsTopicCounts({ subjectId, topics = [] }) {
    const resolvedSubject = resolveSubjectAlias(subjectId || "");
    const { questions } = loadAllPrelimsQuestions();

    const subjectPool = questions.filter(
        (q) => resolveSubjectAlias(q.subject || "") === resolvedSubject
    );

    const results = safeArray(topics).map((topic) => {
        const nodeId = topic.nodeId || topic.syllabusNodeId || "";

        if (!nodeId) {
            return {
                ...topic,
                count: 0,
                source: "missing_nodeId",
                status: "NO_NODE",
            };
        }

        const result = getQuestionsByNodeId({
            nodeId,
            subjectId,
            fallbackPool: subjectPool,
        });

        return {
            ...topic,
            count: result.questions.length,
            source: result.source,
            canonicalNodeId: result.canonicalNodeId,
            status: result.questions.length > 0 ? "MATCH" : "ZERO",
        };
    });

    return {
        subjectId,
        resolvedSubject,
        subjectTotal: subjectPool.length,
        topics: results,
    };
}