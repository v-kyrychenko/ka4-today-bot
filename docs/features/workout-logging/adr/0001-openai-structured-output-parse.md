---
status: Accepted
owner: "vitalii.kyrychenko"
reviewers: []
updated_at: "2026-08-22"
feature_size: "M"
ticket: ""
---

# 0001 — Use OpenAI structured-output parse for exercise messages

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Architect + user (Socratic walk)

## Context

Each client message inside an open logging session must become structured exercise fields (exercise name/description, reps, sets, weight) before it can be matched against the catalog and shown back for confirmation. The spec commits to "an AI-based parse" as a default but leaves the mechanism to design (spec §8 open question). The repo already integrates with the OpenAI API (`src/infrastructure/integrations/openai/openAiClient.ts`) and its request type already supports a JSON-mode structured output (`textFormat` field, `src/shared/types/openai.ts:16-28`), currently unused — the only existing AI-parsing precedent (body measurements) prompts for free-form text, not structured output.

## Decision drivers

- Spec §2 Goals: capture free text "in whatever language the client writes" — AC-14 requires language-agnostic extraction.
- Spec §6 NFR: parse+confirmation round trip ≤5000ms p95 — the mechanism must fit inside one request/response cycle already budgeted for an AI call.
- Spec §6.1: no new authorization boundary or data-exposure surface — reusing the existing OpenAI integration avoids introducing a new third-party dependency.

## Considered options

1. **OpenAI structured-output parse** — one OpenAI call per message, using the existing client's JSON-mode support with a fixed schema (exercise name, reps, sets, weight, a confidence signal).
2. **Deterministic parser (regex/keyword rules against the catalog)** — no AI call, keyword-match catalog names and regex-extract numbers.

## Decision outcome

**Chosen:** Option 1 (OpenAI structured-output parse). It is the only option that satisfies AC-14's any-language requirement without hand-written per-language rules, and it reuses infrastructure (the OpenAI client) the repo already has rather than adding a new dependency.

## Consequences

**Positive**
- Handles any language/phrasing the client uses without new language-specific code.
- The JSON schema constrains the reply, so the app layer doesn't parse free-form AI prose.
- Reuses the existing `openAiClient` integration — no new third-party dependency.

**Negative**
- Adds one external API call (latency + cost) per exercise message, inside the ≤5000ms p95 budget.
- Parse quality depends on OpenAI's reliability and on how tightly the prompt/schema is written — a vague prompt reintroduces the ambiguity AC-07's retry exists to catch.

**Neutral**
- Switching to a deterministic parser later is possible but would need per-language rule-writing and would reopen the AC-14 gap — not a drop-in swap.

## Links

- Spec: [[../spec.md]]
- SAD: [[../sad.md]] §4
- Related ADR: none yet
