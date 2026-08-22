---
status: Accepted
owner: "vitalii.kyrychenko"
reviewers: []
updated_at: "2026-08-22"
feature_size: "M"
ticket: ""
---

# 0002 — Reuse search_dict_exercises for catalog matching

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Architect + user (Socratic walk)

## Context

After a client message is parsed into a structured exercise name (ADR-0001), that name must be matched against the exercise catalog to produce up to 3 ranked candidates (AC-05), or to determine no confident match exists at all (AC-05b). The database already has a stored Postgres function, `search_dict_exercises(query, offset, limit)`, implemented directly in the live database (this repo has no migration tooling — schema and DB functions are hand-managed, per §2 Constraints). The current `exerciseRepository.search()` (`src/modules/coach/exercise/repository/exerciseRepository.ts`) instead runs its own inline `LIKE` + trigram-similarity SQL — that implementation does not reflect the actual production search and needs fixing to call the stored function.

## Decision drivers

- Spec AC-05 / AC-05b: up to 3 ranked candidates, or an explicit no-match outcome.
- Spec §8 open question: no plain-language similarity threshold was fixed in the spec — left to design (resolved below).
- §2 Constraints: no migration tooling exists — reusing a function the database already has avoids introducing new schema-migration risk.

## Considered options

1. **Reuse `search_dict_exercises`** — call the existing stored Postgres function with the OpenAI-normalized exercise name and take its ranked results directly.
2. **New embedding-based semantic search (pgvector)** — add a vector-embedding column + the `pgvector` extension, embed the catalog and generate an embedding per parsed message, rank by vector similarity.

## Decision outcome

**Chosen:** Option 1. It reuses an existing, already-implemented database capability with zero new infrastructure, fits the OpenAI-normalized name the parse step already produces, and avoids adding a new Postgres extension in a repo with no migration tooling to manage it safely.

**Matching rule (resolves spec §8's confidence-threshold open question):** call `search_dict_exercises(query, 0, 3)` — `3` is a pagination limit passed to the function, not a required result count; the function may legitimately return 0, 1, 2, or 3 rows. Zero rows is the no-match outcome (AC-05b). One to three rows are always shown to the client as candidates for confirmation (AC-05) — the spec never has the system auto-accept a match without confirmation, so there is no separate "confident single link" tier to define at the application layer. Ranking/scoring is entirely `search_dict_exercises`'s responsibility; the app does not compute or threshold a score itself.

## Consequences

**Positive**
- No new infrastructure — matching runs against a stored function the database already has.
- Consistent with the existing catalog-search capability rather than a second, parallel search technology.

**Negative**
- `exerciseRepository.search()`'s current inline SQL is not the correct implementation and must be fixed to call `search_dict_exercises` instead — this is corrective work, not new work, but must not be skipped.
- Matching quality across very different phrasings of the same exercise is bounded by whatever similarity logic `search_dict_exercises` implements; that logic is defined only in the database, not visible in this repo's source.

**Neutral**
- Switching to an embedding-based search later remains possible but would need a new extension, a backfill of embeddings for the existing catalog, and is a bigger lift given the no-migration-tooling gap.

## Links

- Spec: [[../spec.md]]
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-openai-structured-output-parse]]
