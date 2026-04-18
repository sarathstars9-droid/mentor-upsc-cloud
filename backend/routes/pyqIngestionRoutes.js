// backend/routes/pyqIngestionRoutes.js
// PYQ Ingestion Pipeline
//
// Step 1: POST   /upload          — receive PDF, save to disk, return metadata
// Step 2: POST   /extract         — parse PDF, split into rough blocks, save temp JSON
// Step 3: GET    /review/load     — load extracted or existing reviewed records
//         POST   /review/save     — write user-reviewed records to reviewed/ dir
//
// Future: /merge, /tag  (do NOT add those yet)

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  extractTextFromPdf,
  splitIntoQuestionBlocks,
} from "../ingestion/pyqPdfExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/* ── Directory constants ─────────────────────────────────────── */

const UPLOAD_DIR   = path.join(__dirname, "..", "uploads", "pyq");
const EXTRACT_DIR  = path.join(__dirname, "..", "data", "ingestion", "extracted");
const REVIEWED_DIR = path.join(__dirname, "..", "data", "ingestion", "reviewed");

for (const dir of [UPLOAD_DIR, EXTRACT_DIR, REVIEWED_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("[pyqIngestion] Created dir:", dir);
  }
}

/* ── File ID generator ───────────────────────────────────────── */

function generateFileId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = String(now.getTime()).slice(-6);
  return `pyq_${datePart}_${timePart}`;
}

/* ── Multer configuration (Step 1) ──────────────────────────── */

const storage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, UPLOAD_DIR); },
  filename(_req, file, cb) {
    const fileId   = generateFileId();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stored   = `${fileId}_${safeName}`;
    file._pyqFileId     = fileId;
    file._pyqStoredName = stored;
    cb(null, stored);
  },
});

function fileFilter(_req, file, cb) {
  file.mimetype === "application/pdf"
    ? cb(null, true)
    : cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only PDF files are accepted."));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

/* ═══════════════════════════════════════════════════════════════
   STEP 1 — POST /api/pyq-ingestion/upload
   ═══════════════════════════════════════════════════════════════ */

router.post("/upload", upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file received. Send a PDF under the field name 'pdf'.",
      });
    }

    const file           = req.file;
    const fileId         = file._pyqFileId     || `pyq_${Date.now()}`;
    const storedFileName = file._pyqStoredName || file.filename;

    const metadata = {
      success: true,
      fileId,
      fileName: file.originalname,
      storedFileName,
      relativePath: `uploads/pyq/${storedFileName}`,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    console.log("[pyqIngestion] Uploaded:", metadata);
    return res.status(200).json(metadata);
  } catch (err) {
    console.error("[pyqIngestion] Upload error:", err);
    return res.status(500).json({ success: false, error: "Upload failed.", details: String(err?.message || err) });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STEP 2 — POST /api/pyq-ingestion/extract
   ═══════════════════════════════════════════════════════════════ */

router.post("/extract", express.json(), async (req, res) => {
  try {
    const { fileId, storedFileName } = req.body || {};

    if (!fileId && !storedFileName) {
      return res.status(400).json({
        success: false,
        error: "Provide either 'fileId' or 'storedFileName' in the request body.",
      });
    }

    // Resolve PDF path
    let resolvedPdfPath = null;

    if (storedFileName) {
      const candidate = path.join(UPLOAD_DIR, storedFileName);
      if (fs.existsSync(candidate)) resolvedPdfPath = candidate;
    }

    if (!resolvedPdfPath && fileId) {
      const entries = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
      const match   = entries.find((f) => f.startsWith(fileId) && f.endsWith(".pdf"));
      if (match) resolvedPdfPath = path.join(UPLOAD_DIR, match);
    }

    if (!resolvedPdfPath) {
      return res.status(404).json({ success: false, error: "Could not locate the uploaded PDF." });
    }

    const resolvedStoredFileName = path.basename(resolvedPdfPath);
    const resolvedFileId = fileId || resolvedStoredFileName.split("_").slice(0, 3).join("_");

    console.log("[pyqIngestion] Extracting:", resolvedPdfPath);

    let rawText;
    try {
      rawText = await extractTextFromPdf(resolvedPdfPath);
    } catch (parseErr) {
      console.error("[pyqIngestion] pdf-parse failed:", parseErr);
      return res.status(422).json({
        success: false,
        error: "Failed to parse PDF. The file may be corrupt, password-protected, or image-only.",
        details: String(parseErr?.message || parseErr),
      });
    }

    if (!rawText || rawText.trim().length < 50) {
      return res.status(422).json({
        success: false,
        error: "PDF appears to contain no extractable text (may be a scanned image PDF).",
      });
    }

    const blocks      = splitIntoQuestionBlocks(rawText);
    const extractedAt = new Date().toISOString();

    const preview = {
      fileId: resolvedFileId,
      storedFileName: resolvedStoredFileName,
      extractedAt,
      rawTextLength: rawText.length,
      questionCount: blocks.length,
      questions: blocks,
    };

    const outputFileName = `${resolvedFileId}_extracted.json`;
    const outputPath     = path.join(EXTRACT_DIR, outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(preview, null, 2), "utf8");
    console.log(`[pyqIngestion] Extracted ${blocks.length} blocks → ${outputPath}`);

    return res.status(200).json({
      success: true,
      ...preview,
      extractedFilePath: `data/ingestion/extracted/${outputFileName}`,
    });
  } catch (err) {
    console.error("[pyqIngestion] Extract error:", err);
    return res.status(500).json({ success: false, error: "Extraction failed.", details: String(err?.message || err) });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STEP 3a — GET /api/pyq-ingestion/review/load?fileId=xxx
   ═══════════════════════════════════════════════════════════════

   Priority:
     1. If a reviewed file exists for this fileId → return it (preserves edits)
     2. Else if an extracted file exists → convert to review records (all pending)
     3. Else 404
*/

router.get("/review/load", (req, res) => {
  try {
    const { fileId } = req.query;

    if (!fileId || !fileId.trim()) {
      return res.status(400).json({ success: false, error: "fileId query parameter is required." });
    }

    // 1. Check reviewed dir first
    const reviewedPath = path.join(REVIEWED_DIR, `${fileId}_reviewed.json`);
    if (fs.existsSync(reviewedPath)) {
      const reviewed = JSON.parse(fs.readFileSync(reviewedPath, "utf8"));
      console.log(`[pyqIngestion] Loaded reviewed: ${reviewedPath}`);
      return res.status(200).json({
        success: true,
        source: "reviewed",
        fileId,
        questionCount: reviewed.questions?.length || 0,
        savedAt: reviewed.savedAt || null,
        questions: reviewed.questions || [],
      });
    }

    // 2. Fall back to extracted file
    const extractedPath = path.join(EXTRACT_DIR, `${fileId}_extracted.json`);
    if (!fs.existsSync(extractedPath)) {
      return res.status(404).json({
        success: false,
        error: `No extracted file found for fileId: ${fileId}. Run extraction first.`,
      });
    }

    const extracted       = JSON.parse(fs.readFileSync(extractedPath, "utf8"));
    const rawQuestions    = Array.isArray(extracted.questions) ? extracted.questions : [];
    const reviewQuestions = rawQuestions.map(toReviewRecord);

    console.log(`[pyqIngestion] Loaded extracted for review: ${extractedPath}`);
    return res.status(200).json({
      success: true,
      source: "extracted",
      fileId,
      questionCount: reviewQuestions.length,
      savedAt: null,
      questions: reviewQuestions,
    });
  } catch (err) {
    console.error("[pyqIngestion] Review load error:", err);
    return res.status(500).json({ success: false, error: "Failed to load review data.", details: String(err?.message || err) });
  }
});

/* ═══════════════════════════════════════════════════════════════
   STEP 3b — POST /api/pyq-ingestion/review/save
   ═══════════════════════════════════════════════════════════════

   Body: { fileId: string, questions: ReviewRecord[] }
   Writes to data/ingestion/reviewed/<fileId>_reviewed.json
*/

router.post("/review/save", express.json(), (req, res) => {
  try {
    const { fileId, questions } = req.body || {};

    if (!fileId || !fileId.trim()) {
      return res.status(400).json({ success: false, error: "fileId is required." });
    }

    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: "questions must be an array." });
    }

    // Sanitise and stamp each record before writing
    const savedAt    = new Date().toISOString();
    const sanitised  = questions.map(sanitiseReviewRecord);

    const payload = {
      fileId,
      savedAt,
      questionCount: sanitised.length,
      questions: sanitised,
    };

    const outputPath = path.join(REVIEWED_DIR, `${fileId}_reviewed.json`);
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

    const counts = summariseCounts(sanitised);
    console.log(`[pyqIngestion] Saved reviewed (${sanitised.length} records) → ${outputPath}`, counts);

    return res.status(200).json({
      success: true,
      fileId,
      savedAt,
      questionCount: sanitised.length,
      counts,
      reviewedFilePath: `data/ingestion/reviewed/${fileId}_reviewed.json`,
    });
  } catch (err) {
    console.error("[pyqIngestion] Review save error:", err);
    return res.status(500).json({ success: false, error: "Failed to save review.", details: String(err?.message || err) });
  }
});

/* ── Helpers for Step 3 ──────────────────────────────────────── */

/**
 * Convert an extracted question block into a review record.
 * All fields default to empty strings; status starts as "pending".
 */
function toReviewRecord(q) {
  return {
    questionNumber:     q.questionNumber ?? null,
    rawQuestionText:    String(q.rawText || ""),
    editedQuestionText: String(q.rawText || ""),   // editable copy starts same as raw
    optionA:            String(q.optionA || ""),
    optionB:            String(q.optionB || ""),
    optionC:            String(q.optionC || ""),
    optionD:            String(q.optionD || ""),
    correctAnswer:      "",
    reviewStatus:       "pending",                 // pending | approved | rejected
    notes:              "",
  };
}

/**
 * Sanitise a review record coming from the frontend before writing to disk.
 * Ensures all expected fields are present and correctly typed.
 */
function sanitiseReviewRecord(r) {
  return {
    questionNumber:     Number(r.questionNumber)  || 0,
    rawQuestionText:    String(r.rawQuestionText   || ""),
    editedQuestionText: String(r.editedQuestionText|| ""),
    optionA:            String(r.optionA           || ""),
    optionB:            String(r.optionB           || ""),
    optionC:            String(r.optionC           || ""),
    optionD:            String(r.optionD           || ""),
    correctAnswer:      String(r.correctAnswer     || ""),
    reviewStatus:       ["pending", "approved", "rejected"].includes(r.reviewStatus)
                          ? r.reviewStatus
                          : "pending",
    notes:              String(r.notes             || ""),
  };
}

/** Count pending/approved/rejected in a records array. */
function summariseCounts(records) {
  return records.reduce(
    (acc, r) => {
      acc[r.reviewStatus] = (acc[r.reviewStatus] || 0) + 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );
}

/* ── Multer error handler ────────────────────────────────────── */

router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, error: "File too large. Maximum allowed size is 25 MB." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(415).json({ success: false, error: "Unsupported file type. Only PDF files are accepted." });
    }
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  console.error("[pyqIngestion] Unhandled route error:", err);
  return res.status(500).json({ success: false, error: "An unexpected server error occurred." });
});

export default router;
