# Mains Intelligence Trigger - Step 1 Hardening Patch
## Audit Feedback Implementation Summary

**Date:** April 28, 2026  
**Status:** ✅ All 5 fixes implemented and code-verified

---

## Files Modified

### 1. `backend/services/mainsIntelligenceService.js`
**Changes:**
- ✅ **Fix #1**: Added `isValidEvaluation(parsed)` - strict validation of parsed JSON structure
- ✅ **Fix #2**: Added `getFallbackEvaluation()` - safe fallback object factory
- ✅ **Fix #3**: Added array field sanitization in `normalizeEvaluation()`:
  - `safeStrengths` - ensures array
  - `safeWeaknesses` - ensures array  
  - `safeMissingDimensions` - ensures array
  - `safeImprovementActions` - ensures array
- ✅ **Fix #4**: Rawvaluation ALWAYS saved (even with fallback)
- ✅ **Fix #5**: FK validation changed from blocking throw to non-blocking warning
  - `console.warn("[MAINS INTELLIGENCE] answer attempt not found", { answerAttemptId })`
  - Allows saves even if FK validation fails

**Key Logic Flow:**
```
tryParseEvaluation(rawEvaluation)
  ├─ If empty → return getFallbackEvaluation()
  ├─ If object → validate with isValidEvaluation()
  │   ├─ Valid → normalizeEvaluation(with sanitization)
  │   └─ Invalid → return getFallbackEvaluation() + log "invalid evaluation structure"
  ├─ If string → try JSON.parse()
  │   ├─ Parse succeeds, structure valid → normalizeEvaluation(with sanitization)
  │   ├─ Parse succeeds, structure invalid → return getFallbackEvaluation() + log "invalid structure"
  │   └─ Parse fails → return getFallbackEvaluation() + log "invalid JSON"
```

**Console Logs Added:**
- `[MAINS INTELLIGENCE] evaluate called`
- `[MAINS INTELLIGENCE] invalid JSON, using fallback`
- `[MAINS INTELLIGENCE] invalid evaluation structure, using fallback`
- `[MAINS INTELLIGENCE] answer attempt not found` (warning)
- `[MAINS INTELLIGENCE] evaluation saved`

---

### 2. `backend/routes/mainsIntelligenceRoutes.js`
**Changes:**
- ✅ **Fix #5 (Route Layer)**: Added FK constraint error handling
  - Catches PostgreSQL error code `23503` (FK violation)
  - Returns clean JSON error response (not ugly stack trace):
    ```json
    {
      "success": false,
      "error": "Answer attempt not found. Create/save the answer attempt before evaluation.",
      "code": "ANSWER_ATTEMPT_NOT_FOUND"
    }
    ```
  - Catches other DB errors with error code 2xxx
  - Generic error fallback

**Error Response Pattern:**
```javascript
if (error.code === "23503" || error.detail?.includes("mains_answer_attempts")) {
  // Clean FK error
  return res.status(400).json({
    success: false,
    error: "Answer attempt not found...",
    code: "ANSWER_ATTEMPT_NOT_FOUND"
  });
}
```

---

### 3. `backend/repositories/mainsIntelligenceRepository.js`
**Status:** ✅ No changes needed (already production-safe)

---

### 4. `backend/server.js`
**Status:** ✅ Already wired correctly
- Import: `import mainsIntelligenceRoutes from "./routes/mainsIntelligenceRoutes.js";`
- Mount: `app.use("/api/mains", mainsIntelligenceRoutes);`

---

## Test Cases

### Test Case 1: Valid JSON
**Input:**
```json
{
  "userId": "user_1",
  "answerAttemptId": "<valid-uuid>",
  "rawEvaluation": "{\"totalScore\":6,\"maxScore\":10,\"componentScores\":{\"intro\":6,\"structure\":6,...},\"strengths\":[\"Clear structure\"],\"weaknesses\":[\"Weak examples\"],...}"
}
```

**Expected:**
- ✅ Parsed successfully
- ✅ `total_score` = 6, `intro_score` = 6, etc.
- ✅ `strengths` JSONB array saved correctly
- ✅ Response: `{"success": true, "evaluation": {...with parsed values...}}`

---

### Test Case 2: Invalid JSON (Plain Text)
**Input:**
```json
{
  "userId": "user_1",
  "answerAttemptId": "<valid-uuid>",
  "rawEvaluation": "Score is 6/10. Good structure but weak examples."
}
```

**Expected:**
- ✅ JSON parse fails
- ✅ Falls back to zero scores
- ✅ `raw_evaluation` column stores original text
- ✅ `total_score` = 0, `intro_score` = 0, etc.
- ✅ `strengths` = `[]` (empty array)
- ✅ Console: `[MAINS INTELLIGENCE] invalid JSON, using fallback`
- ✅ Response: `{"success": true, "evaluation": {...with zero scores...}}`

---

### Test Case 3: JSON with Wrong Shape
**Input:**
```json
{
  "userId": "user_1",
  "answerAttemptId": "<valid-uuid>",
  "rawEvaluation": "{\"score\":6}"
}
```

**Expected:**
- ✅ JSON parses but fails structure validation (missing totalScore, maxScore, componentScores)
- ✅ Falls back to zero scores
- ✅ `raw_evaluation` column stores original JSON
- ✅ Console: `[MAINS INTELLIGENCE] invalid evaluation structure, using fallback`
- ✅ Response: `{"success": true, "evaluation": {...with zero scores...}}`

---

## Testing Instructions

### Prerequisites
1. Restart backend server to load new code:
```bash
cd backend
npm install  # if needed
npm start    # or your normal start command
```

2. Ensure test answer attempt exists in DB, or prepare a valid `answerAttemptId`

### Run Tests

**Test 1: Valid JSON**
```bash
curl -X POST http://localhost:8787/api/mains/evaluate \
  -H "Content-Type: application/json" \
  -d @test1_valid_json.json
```

Expected: HTTP 200, `success: true`, `total_score: 6`

---

**Test 2: Invalid JSON (Plain Text)**
```bash
curl -X POST http://localhost:8787/api/mains/evaluate \
  -H "Content-Type: application/json" \
  -d @test2_invalid_json.json
```

Expected: HTTP 200, `success: true`, `total_score: 0`, `raw_evaluation` contains original text

---

**Test 3: Wrong Shape**
```bash
curl -X POST http://localhost:8787/api/mains/evaluate \
  -H "Content-Type: application/json" \
  -d @test3_wrong_shape.json
```

Expected: HTTP 200, `success: true`, `total_score: 0`, `raw_evaluation` contains `{"score":6}`

---

## Verification Checklist

- ✅ All 5 audit fixes implemented
- ✅ No UI changes
- ✅ No DB schema changes
- ✅ Surgical backend addition only
- ✅ Preserves existing routes
- ✅ Production-safe error handling
- ✅ Console logs added with [MAINS INTELLIGENCE] prefix
- ✅ FK validation is non-blocking warning
- ✅ rawEvaluation always saved for debugging
- ✅ Array fields always arrays
- ✅ JSON validation strict (requires totalScore, maxScore, componentScores)

---

## No Changes Committed Yet (As Requested)

- ❌ No weakness signals integration
- ❌ No next actions integration
- ❌ No revision integration

**Status:** Ready for Step 2 implementation

---

## Files Ready for Deployment

1. ✅ `backend/services/mainsIntelligenceService.js` - HARDENED
2. ✅ `backend/routes/mainsIntelligenceRoutes.js` - HARDENED
3. ✅ `backend/repositories/mainsIntelligenceRepository.js` - VERIFIED
4. ✅ `backend/server.js` - VERIFIED
