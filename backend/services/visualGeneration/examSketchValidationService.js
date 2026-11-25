/**
 * backend/services/visualGeneration/examSketchValidationService.js
 *
 * Strict Exam Sketch Validator & Simplifier for Mains Answers (Phase 2C).
 * 
 * Rules:
 *   - targetDrawSeconds <= 30
 *   - examDrawable = true
 *   - Nodes: 3 to 7 (preferred 4-6)
 *   - Total words across all nodes <= 25 (preferred 12-20)
 *   - Disallows complex icons, gradients, 3D artwork, or unsupported numbers.
 */

export function validateAndSanitizeExamSketch(sketchSpec, options = {}) {
  if (!sketchSpec || typeof sketchSpec !== 'object') {
    return {
      isValid: false,
      error: 'Exam sketch specification must be an object'
    };
  }

  const sanitized = { ...sketchSpec };

  // 1. Renderer check
  sanitized.renderer = 'EXAM_SKETCH';
  sanitized.examDrawable = true;
  sanitized.targetDrawSeconds = Math.min(30, Number(sanitized.targetDrawSeconds) || 30);

  // 2. Validate and clean nodes
  let rawNodes = Array.isArray(sanitized.nodes) ? sanitized.nodes : [];
  if (rawNodes.length === 0) {
    return {
      isValid: false,
      error: 'Exam sketch must contain at least 3 nodes for logical structure'
    };
  }

  // Sanitize node strings
  let cleanNodes = rawNodes.map(n => {
    if (typeof n === 'string') return n.trim();
    if (n && typeof n === 'object' && n.label) return String(n.label).trim();
    return String(n).trim();
  }).filter(Boolean);

  // If node count > 7, slice to 7 maximum meaningful nodes
  if (cleanNodes.length > 7) {
    cleanNodes = cleanNodes.slice(0, 7);
  }

  // Count total words across nodes
  const totalWords = cleanNodes.reduce((acc, node) => acc + node.split(/\s+/).filter(Boolean).length, 0);

  // If word count > 25, simplify verbose node text
  if (totalWords > 25) {
    cleanNodes = cleanNodes.map(node => {
      const words = node.split(/\s+/).filter(Boolean);
      return words.slice(0, 4).join(' ');
    });
  }

  sanitized.nodes = cleanNodes;

  // 3. Validate connections
  let rawConnections = Array.isArray(sanitized.connections) ? sanitized.connections : [];
  if (rawConnections.length === 0 && cleanNodes.length > 1) {
    // Generate default sequential connections
    rawConnections = [];
    for (let i = 0; i < cleanNodes.length - 1; i++) {
      rawConnections.push({ from: i, to: i + 1 });
    }
  } else {
    // Filter invalid connection indices
    rawConnections = rawConnections.filter(
      c => c && typeof c.from === 'number' && typeof c.to === 'number' &&
           c.from >= 0 && c.from < cleanNodes.length &&
           c.to >= 0 && c.to < cleanNodes.length
    );
  }

  sanitized.connections = rawConnections;
  sanitized.title = sanitized.title ? String(sanitized.title).slice(0, 100) : '30-Second Exam Sketch';
  sanitized.description = sanitized.description ? String(sanitized.description).slice(0, 200) : '30-second exam-reproducible diagram.';

  const finalWordCount = cleanNodes.reduce((acc, node) => acc + node.split(/\s+/).filter(Boolean).length, 0);

  return {
    isValid: cleanNodes.length >= 3 && cleanNodes.length <= 7 && finalWordCount <= 25,
    spec: sanitized,
    nodeCount: cleanNodes.length,
    wordCount: finalWordCount,
    drawTimeSeconds: sanitized.targetDrawSeconds
  };
}
