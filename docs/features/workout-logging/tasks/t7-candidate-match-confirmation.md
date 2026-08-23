---
id: T7
title: "Build candidate-match confirmation payload"
layer: "app"
deps: ["T5"]
acs: ["AC-05", "AC-05b"]
files_hint: ["src/modules/telegram/features/workoutLogging/workoutCandidateMatcher.ts"]
owner: "<TBD lead>"
estimate: "M"
status: "todo"
---

# T7 — Build candidate-match confirmation payload

## Why

ADR-0002: the parsed exercise name is matched via the corrected `search_dict_exercises` (T5); 0 rows is a no-match outcome (AC-05b), 1-3 rows are always shown for confirmation, never auto-accepted (AC-05).

## What

Add `workoutCandidateMatcher.ts` that calls `exerciseRepository.search()` with the parsed exercise name, and builds a confirmation payload: each candidate paired with the parsed numbers and a signed S3 URL (existing image-signing pattern) when the catalog exercise has one, text-only otherwise. Zero candidates returns a distinct "no match" result the caller (T8) treats per AC-05b.

## Definition of Done

- [ ] unit test (mocked repository) confirms up to 3 candidates map through with numbers + image URL or text-only
- [ ] unit test confirms 0 candidates surfaces as the AC-05b no-match case, not an error
- [ ] lint + vet clean

## Notes

Depends on T5's corrected search; does not touch persistence (T4) or the OpenAI call (T6).
