// src/api/pyqIngestionApi.js
// Frontend API helper for PYQ Ingestion pipeline.
// Step 1: uploadPyqPdf    — upload PDF, receive metadata
// Step 2: extractPyqPdf   — trigger extraction, receive question preview
// Step 3: loadPyqReview   — load review records (reviewed if saved, else extracted)
//         savePyqReview   — write reviewed records to server
//
// Add future steps (mergePyq, tagPyq) here when ready.

import { BACKEND_URL } from "../config";

/* ── Step 1: Upload ──────────────────────────────────────────── */

export async function uploadPyqPdf(file) {
  const formData = new FormData();
  formData.append("pdf", file);

  const response = await fetch(`${BACKEND_URL}/api/pyq-ingestion/upload`, {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse(response, "Upload");
}

/* ── Step 2: Extract ─────────────────────────────────────────── */

export async function extractPyqPdf({ fileId, storedFileName }) {
  const response = await fetch(`${BACKEND_URL}/api/pyq-ingestion/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, storedFileName }),
  });

  return parseJsonResponse(response, "Extract");
}

/* ── Step 3a: Load review ────────────────────────────────────── */

/**
 * Load review records for a given fileId.
 * Backend returns previously saved reviewed records if they exist,
 * otherwise falls back to the extracted JSON (all pending).
 *
 * @param {string} fileId
 * @returns {Promise<{ source, questionCount, savedAt, questions }>}
 */
export async function loadPyqReview(fileId) {
  const url = `${BACKEND_URL}/api/pyq-ingestion/review/load?fileId=${encodeURIComponent(fileId)}`;
  const response = await fetch(url, { method: "GET" });
  return parseJsonResponse(response, "Load Review");
}

/* ── Step 3b: Save review ────────────────────────────────────── */

/**
 * Persist the current review state to the server.
 * Overwrites any previously saved reviewed file for this fileId.
 *
 * @param {string}         fileId
 * @param {ReviewRecord[]} questions
 * @returns {Promise<{ savedAt, questionCount, counts, reviewedFilePath }>}
 */
export async function savePyqReview(fileId, questions) {
  const response = await fetch(`${BACKEND_URL}/api/pyq-ingestion/review/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, questions }),
  });

  return parseJsonResponse(response, "Save Review");
}

/* ── Shared helper ───────────────────────────────────────────── */

async function parseJsonResponse(response, label) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`${label}: server returned non-JSON (status ${response.status})`);
  }

  if (!response.ok || !data.success) {
    throw new Error(data.error || `${label} failed with status ${response.status}`);
  }

  return data;
}
