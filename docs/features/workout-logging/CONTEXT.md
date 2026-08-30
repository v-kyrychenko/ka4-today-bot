---
status: Living
updated_at: "2026-08-22"
---

# Domain Context — workout-logging

## Glossary

- exercise entry — one record of a single exercise the person actually performed during a logging session, captured from a free-text message and holding the exercise identity (matched to the catalog or kept as free text), reps, weight, and set count. NOT a "prescribed exercise" in a workout plan — an exercise entry is what happened, not what was assigned.
- logging session — an explicit, user-started period during which one or more exercise entries are recorded, begun by an explicit start action and ended by an explicit end action, by another bot interaction pre-empting it, or auto-closed after 2 hours of inactivity. NOT the existing "workout" (the prescribed plan) or "workout schedule" (which day a plan is assigned) — a logging session records what the person actually did, independent of any prescribed plan.
