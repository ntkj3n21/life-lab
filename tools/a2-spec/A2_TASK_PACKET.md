# Task Packet — A2 Long-term Learning Demo Data

## Goal

Implement deterministic development/evaluation seed tooling for **A2 — Long-term Learning**.

A2 is an **auxiliary scale/history account**, not the primary presentation account. Keep the implementation simple. Its purpose is to provide realistic volume for pagination, search, filtering, sorting, long-term history, and account-isolation checks.

Do **not** redesign product behavior and do **not** add A1-level hand-crafted demo complexity.

---

## Locked identity

- Email: `scale@lifelab.local`
- Display name: `Long-term Learning`
- Suggested local demo password: `LifeLab@2026`
- Reference date: `2026-08-27`
- Business timezone: `Asia/Ho_Chi_Minh`
- Deterministic seed: `20260827`

A2 tooling is development/evaluation tooling only. It must not run during normal Spring Boot startup.

---

## Locked source set

Consume the supplied `a2-source-manifest.json`, `a2-source-snapshot.json`, and `a2-final-sources-100.tsv`.

Exact final source counts:

- 100 unique YouTube sources ever used
- 80 `CURRENT_LIBRARY`
- 20 `HISTORICAL`
- 94/100 have at least one harvested VTT
- 6/100 intentionally have no harvested VTT
- 4/100 are also used by A1; global `youtube_videos` rows must therefore be safely shared

All 100 come from the already completed 140/140 anonymous eligibility pass. Do not substitute similar videos and do not re-pick sources.

### Global source rule

`YouTubeVideo` is global/shared factual data.

When a source already exists because A1 uses it:

- reuse the existing global row;
- do not overwrite shared metadata casually;
- verify compatible video ID/duration/availability;
- A2 reset must never delete a global source still referenced by A1 or another account.

---

## Historical-source rule

The 20 `HISTORICAL` sources represent videos that A2 previously had in Library and later removed.

Final state:

- they are **not** present in A2 `library_videos`;
- Notes linked to their exact `YouTubeVideo` remain;
- Tasks linked to surviving historical Notes remain `HAS_SOURCE`;
- never substitute another video;
- final WatchSessions are attached only to current Library rows.

A simple valid seed implementation is:

1. create/reuse all 100 `youtube_videos`;
2. create A2 Library rows needed while building history;
3. create historical Notes/Tasks against the exact global source;
4. remove the 20 historical Library rows before commit;
5. preserve Notes/Tasks that are designed to survive Library removal.

Do not invent a new `removed_at` column or change schema just for the fixture.

---

## Locked final counts

### Library / Tags

- Library videos: **80**
- Tags: **25**
- Library-video tag links: **200**
- Use exact tag/link fixtures from:
  - `a2-tags-25.tsv`
  - `a2-tag-links-200.tsv`
- Every one of the 25 tags must be used at least once.

Optional but useful light realism:

- around 16 current videos with `custom_title`
- around 24 current videos with `personal_description`
- keep values short and topic-aware; do not hand-author 80 descriptions.

### WatchSessions

Use exact per-video counts in `a2-watch-distribution.tsv`.

Locked totals:

- WatchSessions: **1000**
- VALID: **780**
- INVALID: **220**
- UNDETERMINED: **0**
- PENDING final rows: **0**
- current videos derived as watched: **64**
- current videos derived as unwatched: **16**

All selected sources have known durations and are longer than 60 seconds. Under current business rules the valid threshold is therefore 30 seconds (`min(30, ceil(80% * duration))`).

Generate realistic closed rows:

- VALID: `watch_time_seconds >= 30`
- INVALID: `watch_time_seconds < 30`
- never exceed plausible source duration/wall time
- `started_at <= last_heartbeat_at <= ended_at`
- spread sessions non-uniformly over the long account history
- preserve the supplied long-tail distribution instead of making every video equally watched.

### Notes

Use exact per-source counts in `a2-note-distribution.tsv`.

Locked totals:

- Notes: **240**
- Current-source Notes: **200**
- Historical-source Notes: **40**
- Timestamped Notes: **120**
- NULL-timestamp Notes: **120**

Important:

- `timestamp_seconds = NULL` is valid and is not the same as `0`.
- Never fabricate timestamps.
- A timestamped Note must use a real cue start from the harvested VTT for that exact video.
- Preferred track order: `vi-orig` -> `vi` -> `en`.
- Timestamp must be `>= 0` and `< duration_seconds`.
- Note text can be a short paraphrase of the nearby subtitle cue/topic; do not copy long subtitle passages.
- For the six no-VTT sources, timestamp count is locked to zero in the distribution file.
- A2 does not require A1-level hand-curation. Deterministic VTT-driven generation is preferred.

Keep content searchable and varied across Java, DSA, JavaScript, React, Node/Express, database, REST/API, Docker/deployment, etc. Avoid hundreds of identical template sentences.

### Tasks

Locked total: **400**

Source-status matrix (also supplied as TSV):

- HAS_SOURCE: **170**
- INDEPENDENT: **190**
- SOURCE_MISSING: **40**

Status totals:

- COMPLETED: **250**
- NOT_STARTED: **85**
- IN_PROGRESS: **65**

Recommended exact cross-matrix:

| Source state | Total | Completed | Not started | In progress |
|---|---:|---:|---:|---:|
| HAS_SOURCE | 170 | 95 | 40 | 35 |
| INDEPENDENT | 190 | 130 | 35 | 25 |
| SOURCE_MISSING | 40 | 25 | 10 | 5 |
| **TOTAL** | **400** | **250** | **85** | **65** |

Create `SOURCE_MISSING` using the real lifecycle shape already used by A1:

`temporary Note -> HAS_SOURCE Task -> unlink Task/set SOURCE_MISSING -> delete Note`

Do not create fake foreign keys and do not point a missing-source Task at an unrelated Note.

### Daily Plan buckets

There are 150 incomplete Tasks.

Lock:

- Overdue: **25**
- Today: **8**
- Upcoming: **47**
- No deadline: **70**
- Completed: **250**

Business precedence remains unchanged:

`COMPLETED -> No deadline -> Overdue -> Today -> Upcoming`

Use the request/client timezone behavior already implemented by the product; do not change Daily Plan business logic.

---

## Long-term timeline

A2 should look like a learner account used over roughly 24–30 months.

Suggested approach:

- account created around 29–30 months before the reference date;
- current Library additions distributed over time and never before `published_at`;
- historical Notes are older and represent content learned before Library removal;
- WatchSessions spread over roughly the most recent 24 months, clamped so a session never predates the Library addition or video publication;
- Notes/Tasks spread over history instead of clustering around the reference date;
- `created_at <= updated_at` everywhere.

Do not generate impossible dates.

---

## Search/pagination realism

A2 exists mainly to give useful volume.

Ensure the generated content naturally supports:

- Library pagination
- Library search by source/custom title
- tag filtering
- watched/unwatched filtering
- sort by recent/most watched/added date as supported by the app
- Notes pagination/search
- Tasks pagination/filtering
- Daily Plan with all deadline buckets

Do not add new product features just to make the fixture richer.

---

## Tooling shape

Follow the existing A1 development-tooling pattern under a separate `tools/a2/` directory.

Expected files may include:

- `A2-Database.ps1`
- `a2-source-manifest.json`
- `a2-source-snapshot.json`
- `Reset-Seed-A2.ps1`
- `seed-a2.sql`
- `Verify-A2.ps1`
- `verify-a2.sql`
- `Test-A2Idempotence.ps1`
- `README.md`

Reuse/refactor harmless shared PowerShell helpers only if it clearly reduces duplication without risking A1. Do not rewrite A1 tooling unnecessarily.

Normal reset/seed path must be offline and consume the durable A2 snapshot. Do not call YouTube during reset/seed.

---

## Isolation and reset safety

A2 reset must:

- delete/recreate only rows owned by `scale@lifelab.local`;
- leave `demo@lifelab.local` unchanged;
- leave every unrelated account unchanged;
- not delete shared global YouTube rows that remain referenced elsewhere;
- not overwrite shared factual metadata in a way that changes A1.

Use a distinct advisory-lock key such as `life-lab-a2-seed`.

---

## Verifier requirements

Verifier must be read-only and fail non-zero on a failed invariant.

At minimum verify:

1. exactly one A2 account;
2. exactly 80 current Library rows;
3. exact set of 80 current source IDs;
4. 20 historical source IDs have no A2 Library row;
5. all 100 source IDs exist globally;
6. 25 Tags;
7. 200 current Library tag links;
8. all 25 Tags are used;
9. 1000 WatchSessions;
10. 780 VALID / 220 INVALID / 0 UNDETERMINED / 0 PENDING;
11. 64 watched / 16 unwatched current videos from VALID-session derivation;
12. 240 surviving Notes;
13. 200 current-source / 40 historical-source Notes;
14. 120 timestamped / 120 NULL-timestamp Notes;
15. every timestamp is within source duration;
16. every timestamped fixture references a source with harvested VTT evidence;
17. 400 Tasks;
18. 170 HAS_SOURCE / 190 INDEPENDENT / 40 SOURCE_MISSING;
19. 250 COMPLETED / 85 NOT_STARTED / 65 IN_PROGRESS;
20. 25 overdue / 8 today / 47 upcoming / 70 no deadline among incomplete Tasks;
21. HAS_SOURCE Tasks point to an existing A2 Note;
22. INDEPENDENT and SOURCE_MISSING Tasks have `source_note_id IS NULL`;
23. historical Notes resolve to their exact global source;
24. no A2 Library row exists for the 20 historical source IDs;
25. no duplicate `(account_id, youtube_source_id)` Library rows;
26. no duplicate account-tag normalized names;
27. deterministic/idempotent A2 logical fingerprint;
28. A1 logical fingerprint unchanged before vs after A2 reset;
29. unrelated account rows unchanged.

More checks are fine if they remain focused on A2 invariants.

---

## Idempotence test

Run A2 seed twice and require:

- second seed passes verifier;
- A2 logical dataset fingerprint is unchanged;
- A1 data is unchanged;
- unrelated account data is unchanged.

Do not treat database sequence/physical IDs as the logical fingerprint if IDs can legitimately change after reset. Fingerprint stable business fields and relationships.

---

## Do not change

Do not modify:

- database schema solely for demo data;
- production startup behavior;
- authentication/business rules;
- Library business logic;
- WatchSession business logic;
- Note deletion semantics;
- Task source-state semantics;
- Daily Plan precedence;
- Reverse Context behavior;
- frontend behavior;
- A1 locked fixture data.

Do not add an admin role.

---

## Input artifacts

Use these as the source of truth for implementation:

- `a2-final-sources-100.tsv`
- `a2-source-manifest.json`
- `a2-source-snapshot.json`
- `a2-note-distribution.tsv`
- `a2-watch-distribution.tsv`
- `a2-tags-25.tsv`
- `a2-tag-links-200.tsv`
- `a2-task-source-status-matrix.tsv`
- `a2-incomplete-deadline-matrix.tsv`

`a2-dropped-40.tsv` is audit-only and must not be seeded.

---

## Definition of done

A2 is DONE when:

- exact locked counts pass;
- seed is deterministic and idempotent;
- A1 remains unchanged;
- anonymous-qualified exact source identities are preserved;
- no fabricated Note timestamp exists;
- historical Library removal preserves intended Notes/Tasks;
- 1000 WatchSessions and 400 Tasks provide realistic scale;
- verifier is read-only;
- tooling remains dev/eval-only;
- no schema/product behavior was changed just to support the fixture.
