import {
    insertPyqAttempt,
    upsertNodePerformance,
    getNodePerformance,
} from "../repositories/pyqIntelligenceRepository.js";
import { getQuestionsByNodeId } from "../brain/nodeIdTopicEngine.js";
import { loadAllPrelimsQuestions } from "../loaders/prelimsUnifiedLoader.js";
import { upsertNodeWeakness } from "../repositories/adaptiveWeaknessRepository.js";

export async function recordPyqAttempts({ userId, testId, attempts }) {
    const saved = [];
    const updatedNodes = new Set();

    for (const a of attempts || []) {
        if (!a.questionId || !a.nodeId) continue;

        const row = await insertPyqAttempt({
            userId,
            testId,
            questionId: a.questionId,
            nodeId: a.nodeId,
            subjectId: a.subjectId,
            stage: a.stage || "Prelims",
            year: a.year,
            selectedAnswer: a.selectedAnswer,
            correctAnswer: a.correctAnswer,
            isCorrect: a.isCorrect,
            timeTakenSec: a.timeTakenSec,
            sourceType: a.sourceType || "pyq_practice",
        });

        await upsertNodePerformance({
            userId,
            nodeId: a.nodeId,
            subjectId: a.subjectId,
        });

        // Track unique nodes for batch weakness update
        updatedNodes.add(a.nodeId);
        saved.push(row);
    }

    // ── Adaptive Intelligence: update node_weakness for each affected node ──
    // Non-blocking: failures are logged but never block the main attempt flow
    for (const nodeId of updatedNodes) {
        try {
            await upsertNodeWeakness({ userId, nodeId, stage: "prelims" });
        } catch (err) {
            console.warn(`[ADAPTIVE] node_weakness update failed for ${nodeId}:`, err.message);
        }
    }

    return saved;
}

export async function getWeakNodes(userId) {
    const rows = await getNodePerformance(userId);
    return rows.filter((r) => r.status === "weak" || Number(r.accuracy) < 60);
}



import { resolveSubjectAlias, resolveSubjectFromNodeId } from "../brain/subjectAliasMap.js";

export async function buildAdaptiveTest({ userId, subjectId, count = 25 }) {
    const rows = await getNodePerformance(userId);
    let nodes = rows;
    const resolvedSubject = subjectId ? resolveSubjectAlias(subjectId) : null;
    
    if (resolvedSubject) {
        nodes = nodes.filter(n => {
            if (resolveSubjectAlias(n.subject_id || "") === resolvedSubject) return true;
            if (resolveSubjectFromNodeId(n.node_id) === resolvedSubject) return true;
            return false;
        });
    }

    const weakNodes = nodes.filter(n => n.status === "weak");
    const mediumNodes = nodes.filter(n => n.status === "medium");
    const strongNodes = nodes.filter(n => n.status === "strong");

    const weakCount = Math.floor(count * 0.6);
    const mediumCount = Math.floor(count * 0.3);
    const strongCount = count - weakCount - mediumCount;

    const { questions: unifiedPool } = loadAllPrelimsQuestions();

    const finalQuestions = [];
    const usedIds = new Set();

    const pickQuestions = (nodePool, neededCount) => {
        let picked = 0;
        const shuffledNodes = [...nodePool].sort(() => Math.random() - 0.5);
        for (const node of shuffledNodes) {
            if (picked >= neededCount) break;
            const { questions: qs } = getQuestionsByNodeId({ 
                nodeId: node.node_id, 
                subjectId, 
                fallbackPool: unifiedPool 
            });
            const shuffledQs = [...qs].sort(() => Math.random() - 0.5);
            for (const q of shuffledQs) {
                if (picked >= neededCount) break;
                if (!usedIds.has(q.id)) {
                    usedIds.add(q.id);
                    finalQuestions.push(q);
                    picked++;
                }
            }
        }
        return picked;
    };

    pickQuestions(weakNodes, weakCount);
    pickQuestions(mediumNodes, mediumCount);
    pickQuestions(strongNodes, strongCount);

    let missing = count - finalQuestions.length;
    if (missing > 0) missing -= pickQuestions(weakNodes, missing);
    if (missing > 0) missing -= pickQuestions(mediumNodes, missing);
    if (missing > 0) missing -= pickQuestions(strongNodes, missing);

    let fallbackUsed = 0;
    missing = count - finalQuestions.length;

    if (missing > 0) {
        let fallbackPool = unifiedPool;
        if (resolvedSubject) {
            fallbackPool = fallbackPool.filter(q => {
                if (resolveSubjectAlias(q.subject || "") === resolvedSubject) return true;
                if (resolveSubjectFromNodeId(q.nodeId || q.syllabusNodeId) === resolvedSubject) return true;
                return false;
            });
        }

        const availableFallback = fallbackPool.filter(q => !usedIds.has(q.id));
        const shuffledFallback = availableFallback.sort(() => Math.random() - 0.5);

        for (const q of shuffledFallback) {
            if (missing <= 0) break;
            usedIds.add(q.id);
            finalQuestions.push(q);
            fallbackUsed++;
            missing--;
        }
    }

    let broaderUsed = 0;
    if (missing > 0 && resolvedSubject) {
        if (['ancient_history', 'medieval_history', 'modern_history'].includes(resolvedSubject)) {
            const broaderPool = unifiedPool.filter(q => {
                if (resolveSubjectAlias(q.subject || "") !== 'history') return false;
                if (resolvedSubject === 'ancient_history' && String(q.nodeId || q.syllabusNodeId || '').startsWith('GS1-HIS-ANC')) return true;
                if (resolvedSubject === 'medieval_history' && String(q.nodeId || q.syllabusNodeId || '').startsWith('GS1-HIS-MED')) return true;
                if (resolvedSubject === 'modern_history' && (String(q.nodeId || q.syllabusNodeId || '').startsWith('GS1-HIS-MOD') || String(q.nodeId || q.syllabusNodeId || '').startsWith('GS1-HIS-WORLD'))) return true;
                return false;
            });

            const availableBroader = broaderPool.filter(q => !usedIds.has(q.id));
            const shuffledBroader = availableBroader.sort(() => Math.random() - 0.5);

            for (const q of shuffledBroader) {
                if (missing <= 0) break;
                usedIds.add(q.id);
                finalQuestions.push(q);
                broaderUsed++;
                missing--;
            }
        }
    }

    return {
        questions: finalQuestions.sort(() => Math.random() - 0.5),
        debug: {
            requested: count,
            returned: finalQuestions.length,
            weakNodes: weakNodes.length,
            mediumNodes: mediumNodes.length,
            strongNodes: strongNodes.length,
            fallbackUsed,
            broaderUsed,
            subjectId: resolvedSubject || null
        }
    };
}