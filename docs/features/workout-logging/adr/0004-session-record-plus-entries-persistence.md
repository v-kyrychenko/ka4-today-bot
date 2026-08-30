---
status: Accepted
owner: "vitalii.kyrychenko"
reviewers: []
updated_at: "2026-08-22"
feature_size: "M"
ticket: ""
---

# 0004 — Persist a first-class workout-log session record plus entries

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Architect + user (Socratic walk)

## Context

Each confirmed exercise entry is saved immediately (AC-03), not batched to session end. Spec §7 defines a "session completion rate" KPI that distinguishes sessions explicitly ended by the client from ones auto-closed by inactivity, and AC-09b requires empty sessions (no recorded exercises) to be excluded from that metric regardless of how they ended. `tg_conversation_state` (the conversation engine's state row, per ADR-0003) is a live-conversation mechanism, not a durable audit log of how a session concluded.

## Decision drivers

- Spec §7 KPI: session completion rate needs an `end_reason` (explicit vs. auto-closed) to compute.
- AC-09b: an empty session must be excluded from that metric, however it ended.
- AC-13: every exercise entry in a session is attributed to the session's start day, even across midnight.
- Spec §8 open question: a future workout-history/coach-review feature may read this data — a durable session boundary makes that additive, not a redesign.

## Considered options

1. **Session record + entries** — `workout_log_session` (client, day, started_at, ended_at, end_reason) and `workout_log_entry` (session FK, catalog exercise FK or null, raw description, reps, sets, weight, created_at).
2. **Entries only** — a single `workout_log_entry` table with the session's start-day snapshotted onto each row; "is a session open" answered only by the transient conversation-state row.

## Decision outcome

**Chosen:** Option 1. It is the only option that gives the §7 completion-rate KPI a durable `end_reason` to read, and it gives AC-09b's "don't count an empty session" rule a row to attach to even when zero entries were ever recorded.

## Consequences

**Positive**
- §7's completion-rate KPI (explicit vs. auto-closed) is a direct query against `end_reason`, not a derived guess.
- AC-09b's empty-session exclusion has a concrete session row to mark, independent of whether any entry exists.
- A future workout-history feature (spec §8) reads existing session boundaries instead of reconstructing them from entry timestamps.

**Negative**
- Two new tables instead of one, both hand-added to Drizzle schema files with no migration tooling (§2 Constraints) — more surface for a hand-edited schema to drift.

**Neutral**
- The session row is written at session start (AC-01) and updated at end (AC-09/AC-09b/AC-11); this makes the session row, not the conversation-state row, the system of record for "did this workout happen" once the conversation ends.

## Links

- Spec: [[../spec.md]]
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-openai-structured-output-parse]], [[0002-reuse-search-dict-exercises-for-catalog-matching]], [[0003-lazy-ttl-session-expiry-no-new-cron]]
