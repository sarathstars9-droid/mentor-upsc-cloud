# PHASE 2.5 LOCK (DO NOT MODIFY)

## Status
Phase 2.5 is fully stabilized and frozen.

## Rules
- Resolver logic is immutable
- pyq_by_node.json is source of truth
- Stage classification must use pyqStage.js only
- No duplicate logic in frontend/backend

## Restrictions
- Phase 3A MUST NOT modify:
  - resolver
  - mapping
  - counts
  - index structure

## Allowed
- Phase 3A can ONLY consume data
- New logic must be created in separate modules

## Purpose
Ensure:
Block → Subject → Topic → Microtheme → Node → PYQs is stable forever