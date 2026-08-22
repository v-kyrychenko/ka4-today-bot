---
status: Accepted
owner: "vitalii.kyrychenko"
reviewers: []
updated_at: "2026-08-22"
feature_size: "M"
ticket: ""
---

# 0003 — Reuse lazy TTL-based expiry for session auto-close, no new cron

- **Status:** Accepted
- **Date:** 2026-08-22
- **Deciders:** Architect + user (Socratic walk)

## Context

The logging session must enforce: no double-start (AC-12), pre-emption by any other bot interaction — a route or a scheduled reminder (AC-10), and an active 2h-inactivity auto-close (AC-11). The conversation engine (`tgConversationStateRepository.ts`) already has `expires_at` + a lazy `isExpired()` check inside `findActiveByChatId` (deactivates on next read), and an `expireOutdated()` batch function that exists but is wired to nothing. It replaces any active conversation whenever a *new* conversation of any type starts (`deactivatePreviousActiveConversations`), but has no same-type guard and nothing hooks routes or cron into ending a session early.

Both a new dedicated scheduled Lambda and reusing the existing lazy-expiry mechanism were genuinely viable options going into this decision — the choice below was made by preference between two real alternatives, not forced by an existing constraint.

## Decision drivers

- AC-12: a repeat start of the same session type must be blocked, not silently replaced.
- AC-10: any other route or a scheduled reminder must end an open session before proceeding.
- AC-11: the session auto-closes after 2h of inactivity, measured from start or the last recorded exercise, whichever is later.

## Considered options

1. **New dedicated scheduled Lambda + type-aware guards** — a new EventBridge-scheduled function actively sweeps and closes expired sessions on its own cadence, notifying the client, in addition to same-type and pre-emption guards.
2. **Reuse the existing lazy TTL/expiry, no new cron** — extend `expires_at` handling (120-minute TTL, refreshed on every recorded exercise) and the same-type/pre-emption guards, but rely entirely on the existing lazy check (`findActiveByChatId` deactivates on read) rather than any proactive sweep.

## Decision outcome

**Chosen:** Option 2, by preference — reusing infrastructure the repo already has (the `expires_at` column + lazy check) and avoiding a new Lambda/EventBridge rule, over Option 1's cleaner-but-heavier dedicated schedule. Option 1 remains a legitimate future path (see §11 of the SAD) if the AC-11 gap noted below proves costly in practice.

**Mechanism:**
- `startConversation` for the `workout-logging` type is blocked (not replaced) when a session of that same type is already active (AC-12) — a same-type guard added ahead of `deactivatePreviousActiveConversations`.
- `routesProcessor.ts` calls the existing pre-emption path (`deactivateActiveByChatId`) to end an active workout-logging session before continuing (AC-10) — unconditional, independent of TTL. This is a **single call site**: cron-triggered reminders already reach `routesProcessor` as synthetic webhook-shaped messages (see `cronMeasurementsReminder.ts`), so no separate hook into the cron handler itself is needed.
- The session TTL is set to 120 minutes on start and refreshed to +120 minutes on every recorded exercise (so it always measures from "start or the most recent entry, whichever is later" — AC-11), stored in the existing `expires_at` column.
- Expiry is discovered lazily: the next call to `findActiveByChatId` for that chat (the client's next message, or the pre-emption check itself) sees the row past `expires_at` and deactivates it before returning `null`.

## Consequences

**Positive**
- No new Lambda, EventBridge rule, or scheduled-job monitoring to add — reuses existing conversation-engine plumbing.
- Same mechanism (lazy TTL check) already governs every other conversation type — no new session-lifecycle concept to reason about.

**Negative**
- AC-11 literally reads "the system actively closes the session on its own, without waiting for the client's next message." This mechanism does **not** proactively close or notify — an expired session is only marked closed the next time something checks it (the client's next message, or an unrelated route/cron firing for that same client). If the client never interacts again, the session stays row-present-but-expired indefinitely rather than being actively closed and confirmed to the client. This gap is carried to §11 Risks rather than silently accepted.
- `updateConversation` does not currently bump `expires_at` — it must be extended to do so on every recorded exercise, or the TTL only ever measures from session start, not "whichever is later" as AC-11 requires.

**Neutral**
- Adding a dedicated sweep later (Option 1) remains possible without a schema change — `expireOutdated()` already exists — it would only need wiring to a new scheduled Lambda.

## Links

- Spec: [[../spec.md]]
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-openai-structured-output-parse]], [[0002-reuse-search-dict-exercises-for-catalog-matching]]
