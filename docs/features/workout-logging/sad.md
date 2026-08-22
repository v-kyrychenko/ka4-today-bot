---
status: Draft
owner: "vitalii.kyrychenko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-08-22"
feature_size: "M"
target_surfaces: []  # filled in §4 — subset of: backend-service | web-frontend | mobile-app | desktop-app | cli | worker | library-sdk. Read (never re-derived) by api/sequences/tasks/plan-tests/review → _shared/surfaces.md
---

# Software Architecture Document — workout-logging

<!-- 12 Arc42 sections. Empty section → <!-- N/A: <one-line reason> -->. -->
<!-- C4 Context (L1) lives inline in §3. C4 Container (L2) lives inline in §5. -->
<!-- Numbers in §10 come VERBATIM from spec.md §6 NFR — no inventing, no rounding. -->

## 1. Introduction and goals

**Intent.** Give clients a low-friction way to record what they actually did in the gym, in free text and their own language, linking back to the exercise catalog whenever a confident match exists — closing the gap where every workout is invisible once it's finished.

**Top-3 quality goals (1-liners; full scenarios in §10):**

1. **Trustworthy capture** — nothing is ever silently misrecorded; every exercise+numbers pair is shown back and confirmed before it's saved (AC-03/05/06/07/08 — the feature's actual differentiator).
2. **Responsiveness** — parse+confirm round trip ≤5000ms p95; start/end acknowledgement ≤300ms p95 (spec §6 NFR).
3. **Session-state consistency** — a client never has more than one open logging session at a time (AC-01/04/10/11/12).

**Stakeholders.**

| Role | Interest | Sign-off owner? |
|---|---|---|
| Client | records their own workouts in free text | No |
| Tech Lead | SAD approval | Yes |
| Security Lead | reviews personal-data handling (reps/weight/free text) | No |

<!-- Decision overrides (¶4) — populated by the critic resolution loop, empty otherwise. -->

## 2. Constraints

_pending Socratic walk_

## 3. Context and scope

_pending Socratic walk_

## 4. Solution strategy

_pending Socratic walk_

## 5. Building block view

_pending Socratic walk_

## 6. Runtime view

_pending Socratic walk_

## 7. Deployment view

_pending Socratic walk_

## 8. Crosscutting concepts

_pending Socratic walk_

## 9. Architecture decisions

_pending Socratic walk_

## 10. Quality requirements

_pending Socratic walk_

## 11. Risks and technical debt

_pending Socratic walk_

## 12. Glossary

_pending Socratic walk_
