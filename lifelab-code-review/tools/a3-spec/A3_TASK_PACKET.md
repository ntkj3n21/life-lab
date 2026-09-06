# Task Packet — A3 Isolation Demo

## Goal
Implement the final small development/evaluation account **A3 — Isolation Demo**.

A3 is not another scale account. Its only purpose is to prove:
1. account-scoped Library/Tags/Notes/Tasks/WatchSessions are isolated;
2. global `youtube_videos` rows can be safely shared by multiple accounts;
3. resetting A3 does not change A1, A2, unrelated accounts, or shared global source metadata.

Keep this implementation deliberately small.

## Identity
- Email: `isolation@lifelab.local`
- Display name: `Isolation Demo`
- Suggested local password: `LifeLab@2026`
- Reference date: `2026-08-27`
- Business timezone: `Asia/Ho_Chi_Minh`
- Deterministic seed: `20260827`

Dev/eval tooling only. Never run from production/Spring startup.

## Sources
Consume `a3-final-sources-15.tsv` and `a3-source-snapshot.json`.

Locked:
- 15 current Library videos
- all 15 already exist in the A2 locked source set
- 4 are also in A1
- no A3 historical sources
- no new harvesting is needed

Prefer reusing the existing global `youtube_videos` row by `youtube_video_id`.
Do not overwrite shared metadata.
A3 reset must not delete any of these global source rows.

## Tags
Use exact artifacts:
- `a3-tags-10.tsv`
- `a3-tag-links-30.tsv`

Locked:
- 10 tags
- 30 links
- every tag used

## WatchSessions
Use `a3-watch-distribution.tsv`.

Locked:
- 45 total
- 30 VALID
- 15 INVALID
- 0 PENDING final
- 0 UNDETERMINED final
- 10 watched / 5 unwatched current Library videos

All are known-duration sources. Use the existing business rule:
VALID requires >= 30 seconds; INVALID < 30 seconds.
Generate only closed sessions with ordered timestamps and plausible watch time.

## Notes
Use `a3-note-distribution.tsv`.

Locked:
- 20 Notes
- all 20 linked to exact current sources
- all 20 have `timestamp_seconds = NULL`

Do not build or read VTT. A3 is not testing timestamp provenance.
Use short topic-aware text; simple deterministic templates are fine.

## Tasks
Use `a3-task-matrix.tsv`.

Locked:
- 30 total
- 12 HAS_SOURCE
- 18 INDEPENDENT
- 0 SOURCE_MISSING
- 10 COMPLETED
- 10 NOT_STARTED
- 10 IN_PROGRESS

HAS_SOURCE Tasks must link to existing A3 Notes.
INDEPENDENT Tasks must have `source_note_id IS NULL`.

No temporary Note deletion fixture is needed.

## Daily Plan
Use `a3-deadline-matrix.tsv`.

Among the 20 incomplete Tasks:
- 4 overdue
- 3 today
- 6 upcoming
- 7 no deadline

Do not change production Daily Plan precedence.

## Tooling
Follow the A1/A2 dev-tooling pattern but keep A3 smaller.

Suggested files:
- `tools/a3/A3-Database.ps1`
- `tools/a3/Reset-Seed-A3.ps1`
- `tools/a3/seed-a3.sql`
- `tools/a3/Verify-A3.ps1`
- `tools/a3/verify-a3.sql`
- `tools/a3/Test-A3Idempotence.ps1`
- `tools/a3/fingerprint-a3.sql`
- `tools/a3/README.md`

Do not create a VTT fixture builder.

## Reset safety
A3 reset may delete/recreate only rows owned by `isolation@lifelab.local`.

It must not:
- change A1 personal rows;
- change A2 personal rows;
- change unrelated accounts;
- update/delete shared global `youtube_videos`;
- alter schema or production code.

Use its own advisory lock, e.g. `life-lab-a3-seed`.

## Minimum verifier
Keep it focused. Verify at least:
- exactly one A3 account;
- 15 Library videos with exact source IDs;
- 10 Tags / 30 tag links / all tags used;
- 45 WatchSessions = 30 VALID + 15 INVALID;
- 10 watched / 5 unwatched;
- WatchSession timestamp/threshold invariants;
- 20 Notes, all source-linked and timestamp NULL;
- 30 Tasks;
- 12 HAS_SOURCE / 18 INDEPENDENT;
- 10 COMPLETED / 10 NOT_STARTED / 10 IN_PROGRESS;
- HAS_SOURCE links same-account Notes;
- INDEPENDENT has NULL source;
- Daily Plan 10 completed / 4 overdue / 3 today / 6 upcoming / 7 no deadline;
- temporal ordering;
- no duplicate account/source Library row;
- no duplicate normalized tag name.

## Idempotence/isolation
Run reset+verify twice.

Fingerprint and require stable:
- A3 logical data across reset 1 vs reset 2;
- A1 logical data before/after;
- A2 logical data before/after;
- unrelated accounts before/after;
- shared global source metadata before/after.

## Do not change
Do not modify A1/A2 locked fixtures, frontend, backend, schema, migrations, APIs, Watch/Note/Task/Daily Plan business rules, or production startup.

## Definition of done
A3 is complete when verifier passes, idempotence passes, A1/A2/global fingerprints remain stable, and the account can be used for a simple manual isolation spot-check.
