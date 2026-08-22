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
- Spec §8 open question: no plain-language similarity threshold was fixed in the spec — left to design.
- §2 Constraints: no migration tooling exists — reusing a function the database already has avoids introducing new schema-migration risk.

## Considered options

1. **Reuse `search_dict_exercises`** — call the existing stored Postgres function with the OpenAI-normalized exercise name, rank up to 3 results by its returned score, and bucket the score into confident-link / candidate-list / no-match bands.
2. **New embedding-based semantic search (pgvector)** — add a vector-embedding column + the `pgvector` extension, embed the catalog and generate an embedding per parsed message, rank by vector similarity.

## Decision outcome

**Chosen:** Option 1. It reuses an existing, already-implemented database capability with zero new infrastructure, fits the OpenAI-normalized name the parse step already produces, and avoids adding a new Postgres extension in a repo with no migration tooling to manage it safely.

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
