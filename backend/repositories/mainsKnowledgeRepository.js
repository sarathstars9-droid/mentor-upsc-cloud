// backend/repositories/mainsKnowledgeRepository.js
// Data access layer for Mains Knowledge items (V1.5A).
// Uses the shared connection pool from db/index.js.

import { pool } from '../db/index.js';

export async function createKnowledgeItem(item) {
  const sql = `
    INSERT INTO mains_knowledge_items (
      paper, subject, topic, micro_topic, syllabus_node_id,
      knowledge_type, knowledge_subtype, title, content, structured_content, tags,
      source_type, source_reference, source_title, source_year,
      verification_status, lifecycle_status, effective_from, expires_at,
      generated_by_model, prompt_version, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    RETURNING *;
  `;
  const values = [
    item.paper,
    item.subject,
    item.topic || null,
    item.micro_topic || null,
    item.syllabus_node_id || null,
    item.knowledge_type,
    item.knowledge_subtype || null,
    item.title,
    item.content,
    item.structured_content || '{}',
    item.tags || '{}',
    item.source_type || null,
    item.source_reference || null,
    item.source_title || null,
    item.source_year || null,
    item.verification_status || 'UNVERIFIED',
    item.lifecycle_status || 'DRAFT',
    item.effective_from || null,
    item.expires_at || null,
    item.generated_by_model || null,
    item.prompt_version || null,
    item.is_active ?? true
  ];

  const { rows } = await pool.query(sql, values);
  return rows[0];
}

export async function updateKnowledgeItem(id, patch) {
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    return getKnowledgeItem(id);
  }

  const setClause = [];
  const values = [id];
  let paramIdx = 2;

  for (const key of keys) {
    setClause.push(`${key} = $${paramIdx}`);
    values.push(patch[key]);
    paramIdx++;
  }

  const sql = `
    UPDATE mains_knowledge_items
    SET ${setClause.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, values);
  return rows[0];
}

export async function getKnowledgeItem(id) {
  const sql = `SELECT * FROM mains_knowledge_items WHERE id = $1;`;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
}

export async function searchKnowledgeItems(filters = {}) {
  const conditions = [];
  const values = [];
  let paramIdx = 1;

  if (filters.paper) {
    conditions.push(`paper = $${paramIdx}`);
    values.push(filters.paper);
    paramIdx++;
  }

  if (filters.subject) {
    conditions.push(`subject = $${paramIdx}`);
    values.push(filters.subject);
    paramIdx++;
  }

  if (filters.knowledge_type) {
    conditions.push(`knowledge_type = $${paramIdx}`);
    values.push(filters.knowledge_type);
    paramIdx++;
  }

  if (filters.lifecycle_status) {
    conditions.push(`lifecycle_status = $${paramIdx}`);
    values.push(filters.lifecycle_status);
    paramIdx++;
  }

  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${paramIdx}`);
    values.push(filters.is_active);
    paramIdx++;
  }

  if (filters.verification_status) {
    conditions.push(`verification_status = $${paramIdx}`);
    values.push(filters.verification_status);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  let pagination = '';
  if (filters.limit) {
    pagination += ` LIMIT $${paramIdx}`;
    values.push(filters.limit);
    paramIdx++;
  }
  if (filters.offset) {
    pagination += ` OFFSET $${paramIdx}`;
    values.push(filters.offset);
    paramIdx++;
  }

  const sql = `SELECT * FROM mains_knowledge_items ${whereClause} ORDER BY created_at DESC${pagination};`;
  
  const { rows } = await pool.query(sql, values);
  return rows;
}

export async function approveKnowledgeItem(id, metadata = {}) {
  const item = await getKnowledgeItem(id);
  if (item && item.verification_status === 'SOURCE_REQUIRED') {
    throw new Error('EVIDENCE_SOURCE_REQUIRED: Cannot approve item without source verification.');
  }

  return updateKnowledgeItem(id, {
    lifecycle_status: 'ACTIVE',
    verification_status: 'HUMAN_APPROVED',
    is_active: true,
    verified_at: new Date(),
    verified_by: metadata.userId || 'admin',
    last_verified_at: new Date()
  });
}

export async function verifyKnowledgeItem(id, metadata = {}) {
  return updateKnowledgeItem(id, {
    verification_status: 'VERIFIED',
    verified_at: new Date(),
    verified_by: metadata.userId || 'verifier',
    last_verified_at: new Date()
  });
}

export async function retireKnowledgeItem(id, metadata = {}) {
  return updateKnowledgeItem(id, {
    lifecycle_status: 'RETIRED',
    is_active: false
  });
}

export async function markSourceRequired(id, metadata = {}) {
  return updateKnowledgeItem(id, {
    verification_status: 'SOURCE_REQUIRED'
  });
}

export async function activateKnowledgeItem(id, metadata = {}) {
  return updateKnowledgeItem(id, {
    lifecycle_status: 'ACTIVE',
    is_active: true
  });
}

/**
 * Checks for a deterministic duplicate candidate before saving.
 */
export async function checkDuplicateKnowledgeItem(syllabusNodeId, knowledgeType, knowledgeSubtype, title) {
  if (!title) return null;
  const sql = `
    SELECT id, title, verification_status, lifecycle_status 
    FROM mains_knowledge_items 
    WHERE syllabus_node_id = $1 
      AND knowledge_type = $2 
      AND (knowledge_subtype = $3 OR ($3 IS NULL AND knowledge_subtype IS NULL))
  `;
  const { rows } = await pool.query(sql, [syllabusNodeId || null, knowledgeType, knowledgeSubtype || null]);
  
  const normalizedTarget = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  for (const row of rows) {
    if (!row.title) continue;
    const normalizedExisting = row.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (normalizedExisting === normalizedTarget) {
      return row; // Duplicate found
    }
  }
  return null;
}

/**
 * Retrieves all active knowledge items matching a query criteria for a syllabus hierarchy.
 */
export async function retrieveKnowledgeForNode({
  syllabusNodeId,
  paper,
  subject,
  topic,
  microTopic,
  knowledgeTypes = []
}) {
  const conditions = ['is_active = TRUE', '(expires_at IS NULL OR expires_at > NOW())'];
  const values = [];
  let paramIdx = 1;

  // Build OR list matching syllabus hierarchy elements
  const hierarchyConditions = [];

  if (syllabusNodeId) {
    hierarchyConditions.push(`syllabus_node_id = $${paramIdx}`);
    values.push(syllabusNodeId);
    paramIdx++;
  }

  if (microTopic) {
    hierarchyConditions.push(`micro_topic = $${paramIdx}`);
    values.push(microTopic);
    paramIdx++;
  }

  if (topic) {
    hierarchyConditions.push(`topic = $${paramIdx}`);
    values.push(topic);
    paramIdx++;
  }

  if (paper && subject) {
    hierarchyConditions.push(`(paper = $${paramIdx} AND subject = $${paramIdx + 1})`);
    values.push(paper, subject);
    paramIdx += 2;
  }

  if (hierarchyConditions.length > 0) {
    conditions.push(`(${hierarchyConditions.join(' OR ')})`);
  }

  if (knowledgeTypes.length > 0) {
    const placeholders = knowledgeTypes.map((_, i) => `$${paramIdx + i}`).join(', ');
    conditions.push(`knowledge_type IN (${placeholders})`);
    values.push(...knowledgeTypes);
    paramIdx += knowledgeTypes.length;
  }

  const sql = `
    SELECT * 
    FROM mains_knowledge_items
    WHERE ${conditions.join(' AND ')}
    ORDER BY 
      CASE 
        WHEN syllabus_node_id IS NOT NULL THEN 1
        WHEN micro_topic IS NOT NULL THEN 2
        WHEN topic IS NOT NULL THEN 3
        ELSE 4
      END ASC,
      last_verified_at DESC NULLS LAST,
      created_at DESC;
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}
