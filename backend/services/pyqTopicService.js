import { getPyqsForTopic } from "../brain/pyqLinkEngine.js";
export function fetchPyqsForTopic(nodeId) {
  const result = getPyqsForTopic(nodeId);
  if (!result || !Array.isArray(result.questions)) {
    return {
      nodeId,
      matchedNodeId: nodeId,
      count: 0,
      lastAskedYear: null,
      questions: []
    };
  }

  return {
    nodeId,
    matchedNodeId: result.matchedNodeId || nodeId,
    count: result.questions.length,
    lastAskedYear: result.lastAskedYear,
    questions: result.questions.map((q) => ({
      ...q,
      requestedNodeId: nodeId,
      linkedNodeId: result.matchedNodeId || nodeId,
      originalSyllabusNodeId: q.syllabusNodeId || result.matchedNodeId || nodeId,
      syllabusNodeId: q.syllabusNodeId || result.matchedNodeId || nodeId
    }))
  };
}