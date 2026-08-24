---
status: Accepted
owner: "vitalii.kyrychenko"
reviewers: []
updated_at: "2026-08-24"
feature_size: "M"
ticket: ""
---

# 0005 — Generic conversation-lifecycle hooks for pre-emption and expiry

- **Status:** Accepted (supersedes [[0003-lazy-ttl-session-expiry-no-new-cron]]'s mechanism)
- **Date:** 2026-08-24
- **Deciders:** Architect + user (post-implementation review)

## Context

ADR-0003 wired AC-10 (cross-context pre-emption) and AC-11 (2h lazy auto-expiry) by having `routesProcessor.ts` import `workoutLoggingService` directly and call it unconditionally at the top of `execute()`, before any routing decision. Implementing that literally surfaced two problems:

1. **A generic HTTP/message processor gained feature-specific knowledge.** `routesProcessor.ts` is meant to stay workout-logging-agnostic — any future conversation type needing the same pre-emption/expiry behavior would have required the same direct import, duplicated per feature.
2. **A real correctness bug.** Because the call ran unconditionally before `continueConversation`, it closed the client's *own* active workout-logging session on the very next message they sent to continue it — pre-emption fired even when the incoming message was meant for the active conversation itself, not "another interaction." The original AC-10 test only covered an unrelated route pre-empting a session; it never exercised "the client continues their own session," so the bug passed review.

Separately, ADR-0003's own "Negative consequences" section had already flagged that `updateConversation` doesn't bump `expires_at`, and that the 2h AC-11 window was meant to reuse `tg_conversation_state.expires_at` (the *same* TTL mechanism every other conversation type already has), not a second, workout-specific idle calculation. The as-built T12 code never did that reuse — it computed idle time itself via a new `workoutLogRepository.findLastEntryAt`, alongside the generic TTL, so there were two independent, unsynchronized "is this expired" mechanisms for the same session.

## Decision drivers

- A generic engine primitive should require zero per-feature wiring outside the feature's own conversation definition — this is the same reuse argument ADR-0003 already made in choosing lazy TTL expiry over a new cron.
- The pre-emption bug (a session closing itself on its own continuation message) must not exist — reusing the wrong control-flow position is not an acceptable trade-off, unlike the *documented* AC-11 gap ADR-0003 already accepted (lazy discovery vs. proactive push).
- "Workout session = conversation session": `workout_log_session`'s lifecycle should be driven by the *same* `tg_conversation_state` TTL/active-row mechanism every other conversation type uses, not a parallel one.

## Considered options

1. **Keep the direct-import call site, fix only the ordering bug** — move the workout-logging-specific call to fire only when a route matches, but leave `workoutLoggingService` imported directly into `routesProcessor.ts`.
2. **Generic lifecycle hooks on `ConversationDefinition`** — add optional `onPreempt`/`onExpire` callbacks to the type's own definition; the generic engine (`engine.ts`) becomes the single place that detects pre-emption/expiry and invokes whichever hook the active conversation's type declares. `routesProcessor.ts` calls one generic `conversationEngine.preemptActiveConversation(chatId)`; it never imports a feature module.

## Decision outcome

**Chosen:** Option 2. It fixes the correctness bug as a side effect of centralizing the check in one place (`engine.ts`'s internal `resolveActiveConversation`, shared by `handleText`, `handleCallback`, and the new `preemptActiveConversation`), keeps `routesProcessor.ts` and `engine.ts` fully feature-agnostic, and makes the mechanism available to any future conversation type for free.

**Mechanism:**
- `ConversationDefinition` (`model.ts`) gains two optional hooks: `onExpire?(state)` and `onPreempt?(state)`.
- `tgConversationStateRepository` exposes `findRawActiveByChatId` (no side effect) and `isConversationExpired` (pure check) instead of the old `findActiveByChatId`, which conflated "read" with "lazily deactivate."
- `engine.ts`'s internal `resolveActiveConversation(chatId)` is the *only* place that reads the active row, and it lazily deactivates + fires `onExpire` when the TTL lapsed — used by `handleText`, `handleCallback`, and the new `preemptActiveConversation`. This means AC-11's "on the next check" applies to *any* check, not just an explicit pre-emption call.
- `engine.ts` exports a new `preemptActiveConversation(chatId)`: resolves the active conversation (lazily expiring it first, if applicable — in which case `onExpire` already fired and there is nothing left to pre-empt), then deactivates it with a new `CONVERSATION_STEP_PREEMPTED` step and fires `onPreempt`.
- `routesProcessor.execute()` calls `conversationEngine.preemptActiveConversation(chatId)` **only when the incoming text matches a registered route** (`routeRegistry.some(canHandle)`), checked before `continueConversation` — the fix for the correctness bug. A plain continuation message never matches a route, so it is never pre-empted; cron-enqueued reminders and explicit commands (e.g. `/progress`, `/measurements`) do match, which is exactly ADR-0003's "any other route... arrives" trigger.
- `workoutLoggingConversation.ts` implements `onPreempt`/`onExpire` by calling `workoutLoggingService.preemptActiveSession`/`closeExpiredSession` — both now unconditional "close whatever's open" primitives (see below), since the *decision* that the session is expired or pre-empted has already been made by the generic engine before the hook runs.
- `workoutLoggingService.closeExpiredSession` no longer recomputes an idle window (dropped `workoutLogRepository.findLastEntryAt` and the local `SESSION_TTL_MS` constant) — it trusts the engine's TTL decision and just closes the session as `auto-closed`. The 2h idle window is enforced entirely by `tg_conversation_state.expires_at`, set to 120 minutes on session start (`ConversationDefinition.ttlMinutes`) and refreshed to +120 minutes by `workoutLoggingConversation`'s confirmation-response step calling `tgConversationStateRepository.updateConversation({id, ttlMinutes: 120})` after every recorded exercise — the extension ADR-0003 flagged as still needed, now actually wired.

## Consequences

**Positive**
- Fixes a real bug: a client's own continuation message can no longer pre-empt their own session.
- `routesProcessor.ts` and `engine.ts` stay generic — no feature import, no per-type conditional.
- Any future conversation type gets pre-emption/expiry hooks for free by implementing `onPreempt`/`onExpire`, with zero changes to `routesProcessor.ts`.
- Removes a duplicate, unsynchronized idle-tracking mechanism (`findLastEntryAt`) in favor of the one TTL column every conversation type already has.

**Negative**
- One more indirection to trace (`routesProcessor` → generic `preemptActiveConversation` → registry lookup → type's hook) versus the original single direct call — judged worth it for the isolation and the bug fix.
- `updateConversation` must now be called by every step that should keep a session alive (the confirmation-response step); a future step that records progress without bumping the TTL would silently under-extend the session. No structural guard against that beyond code review — same class of risk ADR-0003 already accepted for the overall lazy-expiry approach.

**Neutral**
- AC-11's already-accepted gap (lazy discovery, not a proactive push notifying the client) is unchanged by this ADR.

## Links

- Spec: [[../spec.md]]
- SAD: [[../sad.md]] §4
- Supersedes: [[0003-lazy-ttl-session-expiry-no-new-cron]] (its "no new cron" and "same-type guard via `startConversation`" decisions still stand — only the pre-emption/expiry *call-site* mechanism changes)
- Related ADR: [[0004-session-record-plus-entries-persistence]]
