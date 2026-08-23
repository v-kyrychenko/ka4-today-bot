---
id: T5
title: "Fix exerciseRepository.search to call search_dict_exercises"
layer: "infra"
deps: []
acs: ["AC-05", "AC-05b"]
files_hint: ["src/modules/coach/exercise/repository/exerciseRepository.ts"]
owner: "<TBD lead>"
estimate: "S"
status: "todo"
---

# T5 — Fix exerciseRepository.search to call search_dict_exercises

## Why

`sad.md` §11 flags that `exerciseRepository.search()`'s current inline SQL does not call the real production `search_dict_exercises` function and must be corrected as part of this feature (ADR-0002); catalog matching (AC-05/AC-05b) depends on it.

## What

Change `search()` in `exerciseRepository.ts` to call `search_dict_exercises(query, 0, 3)` instead of its current inline SQL, keeping the existing `ExerciseSearchRequest` input/output shape so the (currently disabled) coach exercise-search API caller is unaffected beyond the corrected ranking (sad.md §11 risk row).

## Definition of Done

- [ ] integration test confirms `search()` invokes `search_dict_exercises` and returns 0-3 ranked rows
- [ ] existing callers of `search()` still compile and pass unchanged
- [ ] lint + vet clean

## Notes

No schema change — `search_dict_exercises` already exists live (untracked by migration, per sad §11 risk).
