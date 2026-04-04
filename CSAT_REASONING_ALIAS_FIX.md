# CSAT Builder - csat_reasoning Alias Fix
**Date**: April 2, 2026  
**Status**: ✅ FIXED & VERIFIED

---

## Problem
Frontend was sending `selectedSubjectId: "csat_reasoning"` but backend builder only recognized:
- `csat_quant`
- `csat_lr` 
- `csat_rc`

**Result**: Error logs showing `[CSAT LOADER] Unknown CSAT subject: csat_reasoning`

---

## Root Cause
The frontend uses multiple naming conventions for the same subject:
- **Logical Reasoning** can be sent as either:
  - `csat_lr` (direct identifier)
  - `csat_reasoning` (alias/alternative name)

Both should load from the same `prelims_csat_lr_tagged.json` file with same nodeIds (`CSAT-LR`, `CSAT-DM`).

The builder's mapping functions didn't have this alias.

---

## Solution

**File**: `backend/api/buildPrelimsPracticeTest.js`

### Change 1: `mapCsatSubjectToNodeIdPrefixes()`
```javascript
const mapping = {
    csat_quant: ["CSAT-BN", "CSAT-DI"],
    csat_lr: ["CSAT-LR", "CSAT-DM"],
    csat_reasoning: ["CSAT-LR", "CSAT-DM"],  // ← NEW: Alias for csat_lr
    csat_rc: ["CSAT-COMP"],
};
```

### Change 2: `loadCsatQuestionsBySubject()`
```javascript
const fileMapping = {
    csat_quant: "prelims_csat_quant_tagged.json",
    csat_lr: "prelims_csat_lr_tagged.json",
    csat_reasoning: "prelims_csat_lr_tagged.json",  // ← NEW: Alias for csat_lr
    csat_rc: "prelims_csat_rc_tagged.json",
};
```

---

## Verification

### Test Results - ALL PASSING ✅

```
✓ CSAT Quant:
  Questions: 15
  NodeIds: CSAT-BN, CSAT-DI
  ✅ ZERO LEAKAGE

✓ CSAT LR:
  Questions: 15
  NodeIds: CSAT-LR, CSAT-DM
  ✅ ZERO LEAKAGE

✓ CSAT Reasoning (alias):
  Questions: 15
  NodeIds: CSAT-LR, CSAT-DM
  ✅ ZERO LEAKAGE

✓ CSAT RC:
  Questions: 15
  NodeIds: CSAT-COMP
  ✅ ZERO LEAKAGE
```

### Server Logs Confirm ✅
```
[CSAT LOADER] Loading from: prelims_csat_lr_tagged.json
[CSAT LOADER SUMMARY] {
  rawLoaded: 280,
  expectedNodePrefixes: ['CSAT-LR', 'CSAT-DM'],
  afterNodeValidation: 280,
  rejected: { wrongNode: 0, missingData: 0 }
}
[BUILDER VALIDATION - CSAT] {
  requestedNode: 'csat_reasoning',  ← Now recognized!
  totalFetched: 280,
  afterDedup: 280,
}
```

---

## Impact

**Before Fix** ❌
- Frontend sends: `selectedSubjectId: "csat_reasoning"`
- Backend logs: `[CSAT LOADER] Unknown CSAT subject: csat_reasoning`
- Result: 0 questions loaded, frontend shows empty test

**After Fix** ✅
- Frontend sends: `selectedSubjectId: "csat_reasoning"`
- Backend recognizes it as alias for LR
- Loads 280 LR questions with strict nodeId validation
- Frontend gets properly filtered questions

---

## All CSAT Subject Mappings

| Frontend Name | Subject ID | File | NodeIds | Questions |
|---|---|---|---|---|
| Quantitative Aptitude | `csat_quant` | prelims_csat_quant_tagged.json | CSAT-BN, CSAT-DI | 384 |
| Logical Reasoning | `csat_lr` | prelims_csat_lr_tagged.json | CSAT-LR, CSAT-DM | 280 |
| Reasoning (alias) | `csat_reasoning` | prelims_csat_lr_tagged.json | CSAT-LR, CSAT-DM | 280 |
| Reading Comprehension | `csat_rc` | prelims_csat_rc_tagged.json | CSAT-COMP | 441 |

---

## Testing
Run: `node test-csat-integrity.js`

All 4 subject variants now pass with ZERO leakage.

---

**Status**: Ready for deployment ✅
