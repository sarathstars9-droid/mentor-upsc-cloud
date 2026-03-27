import { fetchPyqsForTopic } from "../services/pyqTopicService.js";
import { getSectionalPyqTest } from "../services/pyqTestService.js";

export async function getPyqsByTopic(req, res) {
  try {
    const { nodeId } = req.params;
    const data = await fetchPyqsForTopic(nodeId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch PYQs" });
  }
}
export async function getPrelimsSectionalTest(req, res) {
  try {
    const { nodeId, limit } = req.query;

    if (!nodeId) {
      return res.status(400).json({
        ok: false,
        message: "nodeId is required",
      });
    }

    const questions = getSectionalPyqTest({
      nodeId,
      limit: Number(limit) || 10,
    });

    return res.json({
      ok: true,
      nodeId,
      count: questions.length,
      questions,
    });
  } catch (err) {
    console.error("getPrelimsSectionalTest error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to load sectional PYQ test",
    });
  }
}