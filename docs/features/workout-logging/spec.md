---
status: Draft
owner: "vitalii.kyrychenko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-08-22"
feature_size: "M"
---

# Spec — workout-logging

> **Glossary:** [CONTEXT](./CONTEXT.md) (+ repo-root [CONTEXT.md](../../../CONTEXT.md))
> **Reference module / docs / channels used:** None new in step 5 — the two repo-grounded §6 measurements (existing slow-reply notice, existing async-processing concurrency ceiling) draw on `docs/architecture-map.md` and the code already reviewed while scoping this feature (from `survey`), not a step-5 channel read.

## 1. Context

Today the bot can push a client a coach-prescribed workout and remind them about body measurements, but it has no way to capture what the client actually did in the gym — there is no record of real training, only the plan. For a client who wants to track their own progress, and for a future coach-facing view of what clients actually train, this gap means every workout is invisible the moment it's finished.

This closes a gap left open after the measurement-logging capability shipped: the bot already has a pattern for a client to report personal data conversationally (measurements) and an existing exercise catalog built for prescribed plans — the pieces exist, logging the client's actual performance is the natural next step.

The committed approach: a client records what they did entirely in free-text, one exercise per message, in their own language, inside an explicit logging session; each message is matched against the existing exercise catalog and shown back to the client (with images) for confirmation before anything is saved. The medium-depth research pass found no comparable product combining single-message free-text parsing, a candidate-match confirmation step, and a bounded session — this is a genuine differentiator, not just parity.

Traceability: decisions fixed during this interview — one rephrase attempt before falling back to an unlinked free-text save; starting another bot command or a scheduled reminder ends an open session early; the client confirms the full parsed entry (exercise **and** numbers), not just the exercise identity; a session spanning midnight is dated by its start day. The exact mechanism for turning free text into structured fields (an AI-based parse) and where exercise images are served from (existing object storage) are noted for `design` — they are not committed here.

## 2. Goals

- Give clients a low-friction way to record every workout they actually perform, in their own words, without needing a structured form.
- Preserve the exercise catalog's value as a reference by linking recorded exercises back to it whenever a confident match exists.
- Keep the logging flow forgiving of informal, native-language phrasing across the bot's supported languages.

## 3. Non-goals

- Viewing, editing, or deleting past entries — this pass is write-only; history/editing is a separate feature once the write path is proven.
- A numeric adoption target at launch — there's no baseline yet for a brand-new capability.
- Automatically reconciling unmatched free-text entries back into the exercise catalog — catalog curation is a separate, coach/admin-side concern.
- A coach-facing review or correction flow for client-submitted entries — this feature only captures client input.
- Cross-checking logged entries against the client's prescribed schedule — this is a free-standing personal log, not an adherence check.

## 4. User stories

### US-01: Start a logging session
**As a** client
**I want** to explicitly start a workout-logging session
**So that** the exercises I log next are grouped together as one workout

### US-02: Record an exercise performed
**As a** client
**I want** to describe one exercise I just performed in my own words
**So that** it gets saved as part of my current session

### US-03: Confirm a matched exercise
**As a** client
**I want** the bot to show me which catalog exercise it thinks I meant, with a picture
**So that** the wrong exercise never gets recorded silently

### US-04: Keep an unmatched exercise as free text
**As a** client
**I want** to keep my own description when none of the suggested matches are right
**So that** I can still log it instead of getting stuck

### US-05: Get help when my message isn't understood
**As a** client
**I want** the bot to tell me what's missing or unclear and let me try again
**So that** I don't lose an exercise just because I phrased it awkwardly

### US-06: End a logging session
**As a** client
**I want** to explicitly end my logging session
**So that** my workout is marked complete

### US-07: Have an inactive session close on its own
**As a** client
**I want** an abandoned session to close automatically
**So that** I don't have to remember to end it and my next workout starts clean

## 5. Acceptance criteria

### AC-01 (US-01) — happy path
**Given** a client with no open logging session
**When** the client starts a logging session
**Then** the system opens a new session for them and confirms it's ready to receive exercises

### AC-02 (US-01) — authorization
**Given** a Telegram user who is not a registered client of the bot
**When** they attempt to start a logging session
**Then** the system tells them logging isn't available until they're set up as a client, and does not open a session

### AC-03 (US-02) — happy path
**Given** a client with an open logging session
**When** the client describes an exercise they performed, including how much weight, how many times, and how many sets
**Then** the system extracts these details and asks the client to confirm the exact entry before saving it

### AC-04 (US-02) — domain invariant
**Given** a client with no open logging session
**When** the client sends a message describing an exercise
**Then** the system tells the client no workout is in progress and that they need to start one first, and records nothing

### AC-05 (US-03) — happy path
**Given** a client just described an exercise
**When** the system can suggest close matches from the exercise catalog
**Then** it shows up to three candidate exercises, each with its picture, for the client to choose from before the entry is saved

### AC-06 (US-04) — domain invariant
**Given** none of the suggested candidates match what the client meant
**When** the client chooses to keep their own description instead
**Then** the system records the exercise entry without linking it to the catalog, and confirms it was saved as described

### AC-07 (US-05) — error
**Given** a client's message doesn't include enough detail to identify the weight, reps, or sets, or is otherwise unclear
**When** the system cannot confidently interpret it
**Then** the system tells the client what's missing or unclear and gives them one more chance to restate it in the same exchange

### AC-08 (US-05) — error
**Given** a client's restated message still can't be confidently interpreted after that one retry
**When** the retry also fails
**Then** the system saves the client's original wording as the entry, without linking it to the catalog, and tells the client it was saved as written

### AC-09 (US-06) — happy path
**Given** a client has an open logging session with at least one recorded exercise
**When** the client explicitly ends the session
**Then** the system closes the session and confirms the workout is complete

### AC-10 (US-06, US-07) — cross-context
**Given** a client has an open logging session
**When** a scheduled reminder or another bot command is triggered for that client
**Then** the system ends the logging session early, as if the client had ended it themselves, before handling the other interaction

### AC-11 (US-07) — domain invariant
**Given** a client's logging session has had no new exercise for more than 2 hours
**When** that period elapses
**Then** the system closes the session on its own, and the client is treated as having no open session from then on

### AC-12 (US-01) — domain invariant
**Given** a client already has an open logging session
**When** the client tries to start another logging session
**Then** the system tells the client a session is already open and that they need to end it first, and does not open a second one

### AC-13 (US-06) — domain invariant
**Given** a client's logging session started before midnight and is still open, or was auto-closed, after midnight
**When** the session's exercises are recorded
**Then** the system attributes every exercise entry in that session to the day the session started, regardless of the exact time each entry was logged

### AC-14 (US-02) — happy path
**Given** a client with an open logging session writes their exercise message in any of the bot's supported languages
**When** the system interprets the message
**Then** it extracts the exercise details and replies to the client in that same language

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Latency p95 — exercise parse + confirmation round trip | ≤ 5000 ms | production logs (same signal used for the existing slow-reply notice) |
| Latency p95 — start/end session acknowledgement | ≤ 300 ms | production logs |
| Throughput | ≥ 2 concurrent logging exchanges per instance | matches existing async-processing concurrency ceiling |
| Session-state consistency | a client never has more than one open logging session at a time | enforced by AC-01/AC-04/AC-10/AC-11/AC-12 |

## 6.1 Security / privacy

- **Data classification:** Internal — same tier as the existing body-measurement logs (personal but not health/medical-grade).
- **Personal data touched:** new field set — exercise description/name (free text or catalog reference), reps, weight, set count — each tied to a client.
- **AuthZ/AuthN impact:** only an already-registered client (per AC-02) can start a session or add entries to it; a client only ever sees and writes their own entries, there is no cross-client access surface in this feature.
- **Abuse cases:**
  - A non-client Telegram account attempting to log: denied per AC-02, told to become a client first.
  - Spamming exercise messages to run up AI-parsing cost: bounded by the one-retry cap (AC-08) — a message either resolves or falls back to a raw save, it never loops.
  - Arbitrary free text used to smuggle unrelated content into an exercise entry: accepted as-is at Internal classification, same handling as any other free-text field the bot already stores (e.g. measurement notes) — no new exposure introduced by this feature.
- **Security review:** N/A — same data class and access pattern as the existing measurement-logging feature, no new authorization boundary.

## 7. Metrics / KPIs

- **Weekly active loggers** (clients recording ≥1 exercise entry in a 7-day window) — baseline: 0 (new capability), target: establish a real baseline within 30 days of launch; no fixed target set yet.
- **Catalog match rate** (share of saved entries linked to a catalog exercise vs. kept as free text) — baseline: 0, target: measure for 30 days to gauge catalog/matching quality; informs whether the catalog needs filling in.
- **Session completion rate** (sessions explicitly ended by the client vs. auto-closed by inactivity) — baseline: 0, target: measure for 30 days; a low completion rate signals the flow feels heavier than expected.

## 8. Open questions

- [ ] Exactly how free text is turned into structured fields (model/approach) and where candidate-match images are served from? Default now: forwarded as design-stage notes (AI-based parse, existing object storage), not committed here. — owner: Tech Lead, due: before `sdd:design`
- [ ] Whether unmatched free-text entries should ever feed back into the exercise catalog (e.g. a future coach-side review queue)? Default now: out of scope (§3). — owner: PM, due: before a future workout-history feature is specified
