/**
 * backend/services/currentAffairs/issueRevisionService.js
 *
 * User-Specific Current Affairs Revision & Vault State (Phase 3A).
 * Provides user-isolated tracking (saved state, due dates, recall confidence, weak dimensions)
 * without mutating or duplicating global canonical issue dossiers.
 */

import { query } from '../../db/index.js';

/**
 * Get or initialize a user's revision state for a specific issue.
 */
export async function getUserIssueRevisionState(userId, issueId) {
  if (!userId || !issueId) return null;

  const { rows } = await query(`
    SELECT * FROM user_issue_revision_state
    WHERE user_id = $1 AND issue_id = $2
  `, [userId, issueId]);

  if (rows.length > 0) {
    return rows[0];
  }

  return {
    user_id: userId,
    issue_id: issueId,
    is_saved: false,
    read_state: 'UNREAD',
    recall_confidence: 0,
    weak_dimension: null,
    last_reviewed_at: null,
    next_review_due: null,
    notes: null
  };
}

/**
 * Update user's revision status (e.g., mark read, save to vault, update recall score).
 */
export async function updateUserIssueRevisionState(userId, issueId, {
  isSaved,
  readState,
  recallConfidence,
  weakDimension,
  notes,
  reviewIntervalDays = 3
}) {
  if (!userId || !issueId) throw new Error('userId and issueId are required');

  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + reviewIntervalDays);

  const { rows } = await query(`
    INSERT INTO user_issue_revision_state (
      user_id, issue_id, is_saved, read_state, recall_confidence,
      weak_dimension, last_reviewed_at, next_review_due, notes, updated_at
    )
    VALUES ($1, $2, COALESCE($3, FALSE), COALESCE($4, 'READ'), COALESCE($5, 3), $6, NOW(), $7, $8, NOW())
    ON CONFLICT (user_id, issue_id)
    DO UPDATE SET
      is_saved = COALESCE($3, user_issue_revision_state.is_saved),
      read_state = COALESCE($4, user_issue_revision_state.read_state),
      recall_confidence = COALESCE($5, user_issue_revision_state.recall_confidence),
      weak_dimension = COALESCE($6, user_issue_revision_state.weak_dimension),
      last_reviewed_at = NOW(),
      next_review_due = $7,
      notes = COALESCE($8, user_issue_revision_state.notes),
      updated_at = NOW()
    RETURNING *
  `, [
    userId,
    issueId,
    isSaved,
    readState,
    recallConfidence,
    weakDimension,
    nextDue.toISOString(),
    notes
  ]);

  return rows[0];
}

/**
 * Get all saved or due revision issues for a specific user.
 */
export async function getUserRevisionQueue(userId, { filter = 'due' } = {}) {
  let whereClause = `u.user_id = $1`;
  if (filter === 'due') {
    whereClause += ` AND (u.next_review_due <= NOW() OR u.read_state = 'READ')`;
  } else if (filter === 'saved') {
    whereClause += ` AND u.is_saved = TRUE`;
  }

  const { rows } = await query(`
    SELECT i.*, 
           u.is_saved, 
           u.read_state, 
           u.recall_confidence, 
           u.weak_dimension, 
           u.last_reviewed_at, 
           u.next_review_due
    FROM user_issue_revision_state u
    JOIN current_affairs_issues i ON u.issue_id = i.id
    WHERE ${whereClause}
    ORDER BY u.next_review_due ASC NULLS FIRST
  `, [userId]);

  return rows;
}
