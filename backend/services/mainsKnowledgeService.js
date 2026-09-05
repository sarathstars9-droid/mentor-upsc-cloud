// backend/services/mainsKnowledgeService.js
// Service layer for Mains Knowledge management (V1.5A).
// Handles data validation, normalization, and trust transitions.

import * as repo from '../repositories/mainsKnowledgeRepository.js';

const VALID_KNOWLEDGE_TYPES = new Set(['SUBJECT_LANGUAGE', 'DIMENSION', 'EVIDENCE', 'VALUE_ADDITION', 'GEOGRAPHY_OPTIONAL']);
const VALID_VERIFICATION_STATUSES = new Set(['UNVERIFIED', 'SOURCE_REQUIRED', 'VERIFIED', 'HUMAN_APPROVED']);
const VALID_LIFECYCLE_STATUSES = new Set(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'EXPIRED', 'RETIRED']);

function validateItem(item) {
  if (!item.paper) throw new Error('paper is required');
  if (!item.subject) throw new Error('subject is required');
  if (!item.title) throw new Error('title is required');
  if (!item.content) throw new Error('content is required');

  if (!VALID_KNOWLEDGE_TYPES.has(item.knowledge_type)) {
    throw new Error(`invalid knowledge_type: ${item.knowledge_type}`);
  }

  if (item.verification_status && !VALID_VERIFICATION_STATUSES.has(item.verification_status)) {
    throw new Error(`invalid verification_status: ${item.verification_status}`);
  }

  if (item.lifecycle_status && !VALID_LIFECYCLE_STATUSES.has(item.lifecycle_status)) {
    throw new Error(`invalid lifecycle_status: ${item.lifecycle_status}`);
  }
}

export async function createKnowledgeItem(item) {
  validateItem(item);
  
  // Normalization of JSON fields
  const normalized = { ...item };
  if (typeof normalized.structured_content === 'object') {
    normalized.structured_content = JSON.stringify(normalized.structured_content);
  }

  return repo.createKnowledgeItem(normalized);
}

export async function updateKnowledgeItem(id, patch) {
  if (patch.knowledge_type && !VALID_KNOWLEDGE_TYPES.has(patch.knowledge_type)) {
    throw new Error(`invalid knowledge_type: ${patch.knowledge_type}`);
  }
  if (patch.verification_status && !VALID_VERIFICATION_STATUSES.has(patch.verification_status)) {
    throw new Error(`invalid verification_status: ${patch.verification_status}`);
  }
  if (patch.lifecycle_status && !VALID_LIFECYCLE_STATUSES.has(patch.lifecycle_status)) {
    throw new Error(`invalid lifecycle_status: ${patch.lifecycle_status}`);
  }

  const normalized = { ...patch };
  if (typeof normalized.structured_content === 'object') {
    normalized.structured_content = JSON.stringify(normalized.structured_content);
  }

  return repo.updateKnowledgeItem(id, normalized);
}

export async function getKnowledgeItem(id) {
  return repo.getKnowledgeItem(id);
}

export async function searchKnowledgeItems(filters) {
  return repo.searchKnowledgeItems(filters);
}

export async function approveKnowledgeItem(id, metadata) {
  return repo.approveKnowledgeItem(id, metadata);
}

export async function verifyKnowledgeItem(id, metadata) {
  return repo.verifyKnowledgeItem(id, metadata);
}

export async function retireKnowledgeItem(id, metadata) {
  return repo.retireKnowledgeItem(id, metadata);
}

export async function markSourceRequired(id, metadata) {
  return repo.markSourceRequired(id, metadata);
}

export async function activateKnowledgeItem(id, metadata) {
  return repo.activateKnowledgeItem(id, metadata);
}

export async function checkDuplicateKnowledgeItem(syllabusNodeId, knowledgeType, knowledgeSubtype, title) {
  return repo.checkDuplicateKnowledgeItem(syllabusNodeId, knowledgeType, knowledgeSubtype, title);
}
