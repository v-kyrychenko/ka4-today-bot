---
status: Accepted
owner: "vitalii.kyrychenko"
reviewers: []
updated_at: "2026-08-29"
feature_size: "M"
ticket: ""
---

# 0006 — App-side score confidence threshold for catalog candidates

- **Status:** Accepted (supersedes [[0002-reuse-search-dict-exercises-for-catalog-matching]]'s "app does not compute or threshold a score itself" rule)
- **Date:** 2026-08-29
- **Deciders:** User

## Context

ADR-0002 decided that `search_dict_exercises` alone is responsible for ranking, and that the app always shows every returned row (1-3) to the client as candidates for confirmation, without any app-side thresholding. `search_dict_exercises` returns a `score` column (full-text search rank) per row, which was until now discarded entirely — untyped, unmapped, unused.

In practice, a very high `score` on the top result means the match is effectively unambiguous, and asking the client to pick from a list of near-duplicates (e.g. "Bench Press", "Incline Bench Press", "Close-Grip Bench Press") adds friction without adding value.

## Decision drivers

- Reduce confirmation friction when the top catalog match is clearly correct.
- Keep the existing confirmation flow (AC-05/AC-05b) intact for anything less than clearly correct — this does not introduce auto-accept without confirmation.

## Decision outcome

The app now reads `search_dict_exercises`'s `score` column and applies a single threshold in `matchCandidates` (`src/modules/telegram/features/workoutLogging/workoutCandidateMatcher.ts`):

- If the top-ranked result's `score >= 300`, only that one candidate is shown (still as a candidate requiring client confirmation, per AC-05 — never auto-accepted).
- Otherwise, all returned rows (1-3) are shown, exactly as before.

This assumes `search_dict_exercises` returns rows already ordered by descending score, since the app does not re-sort.

`score` is threaded through as an internal-only value: it is typed on a new `RankedDictExerciseRow` (extends `DictExerciseRow`, in `src/infrastructure/persistence/postgres/models/exerciseRow.ts`) rather than on `DictExerciseRow`/`ExerciseItem`, so it never reaches the public coach REST exercise search response. `exerciseRepository.search` now returns `RankedDictExerciseRow[]`; the coach REST path (`searchExercises.ts`) maps these back to `ExerciseItem` via the existing, unchanged `exerciseMapper.toAppModel`, which simply never reads the ranking columns.

## Consequences

**Positive**
- Fewer confirmation taps for unambiguous matches.
- No change to the public coach REST exercise search contract.

**Negative**
- This reverses part of ADR-0002: ranking/scoring is no longer purely `search_dict_exercises`'s concern — the app now makes a threshold decision on top of it.
- The `300` cutoff is a magic number calibrated against the current `search_dict_exercises` scoring scale; if that scoring logic changes in the database (hand-managed, no migration tooling per ADR-0002), this threshold may need recalibration.

**Neutral**
- `RankedDictExerciseRow` also carries `coreInName`/`nameInQuery` sub-scores for future refinement of the threshold; they are typed but not yet consumed.

## Links

- Spec: [[../spec.md]]
- Related ADR: [[0002-reuse-search-dict-exercises-for-catalog-matching]]
