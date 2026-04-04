# MAINS SYSTEM LOCK

Status: FROZEN

This lock applies to the Mains Theme Intelligence system.

## Locked components

* matcher frozen
* theme layers frozen
* mapping frozen
* routes frozen
* API contract frozen
* UI integration frozen

## Allowed changes

* bug fixes only
* data corruption fixes only
* broken route fix only
* syntax/runtime fix only

## Not allowed

* no feature changes
* no analytics expansion
* no threshold tuning
* no remapping for convenience
* no UI redesign
* no schema changes
* no restructuring

## Rule

Any future work must treat the current Mains system as stable and production-ready.
Only fix something if it is actually broken.

## Lock reason

The Mains system has reached a stable Phase 2.5 state with high-confidence deterministic matching and should now be frozen so work can move to:

* Mains institutional tests
* mistake book linkage
* weak answer / weakness tracking
* revision system
