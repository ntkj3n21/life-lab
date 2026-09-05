# A1 demo pilot tooling

This directory contains explicitly invoked development/evaluation tooling for the
single `demo@lifelab.local` pilot account. Nothing here runs during normal Spring
Boot startup.

## Prerequisites

- PostgreSQL is running with the schema created by the normal Flyway migration.
- `psql` is available on `PATH` (the Windows PostgreSQL 17 default path is also detected).
- Root `.env` contains the normal local database values.
- Online snapshot refresh additionally requires `LIFELAB_YOUTUBE_API_KEY`.

The default logical date is `2026-08-27`, interpreted with the business timezone
`Asia/Ho_Chi_Minh`. Override it with `-ReferenceDate YYYY-MM-DD` for both seed and
verify. The deterministic pseudo-random seed is locked to `20260827`.

## 1. Validate/update the source snapshot (online)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File tools/a1/Validate-A1Sources.ps1
```

The validator reads `a1-source-manifest.json`, calls YouTube Data API v3, and
atomically replaces `a1-source-snapshot.json` only when all 36 current sources and
historical H1 are public, embeddable, processed, and have known durations. It does
not connect to the Life Lab database.

## 2. Reset and seed A1 (offline normal path)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File tools/a1/Reset-Seed-A1.ps1 `
  -ReferenceDate 2026-08-27
```

This command consumes the durable snapshot and does not call YouTube. Its single
transaction takes an advisory lock, deletes only rows owned by the locked A1 email,
and recreates the deterministic fixture. Global YouTube rows are deleted/recreated
only when they are unreferenced after the A1 reset; rows referenced by another
account are never deleted or overwritten.

## 3. Verify A1 (read-only)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File tools/a1/Verify-A1.ps1 `
  -ReferenceDate 2026-08-27
```

The verifier opens a `READ ONLY` PostgreSQL transaction, prints every expected and
actual value, and exits non-zero on any failed check. It never repairs data.

For the repeatability/isolation audit, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File tools/a1/Test-A1Idempotence.ps1 `
  -ReferenceDate 2026-08-27
```

This takes fingerprints before and after a second reset, requires the read-only
verifier to pass again, and fails if either unrelated-account rows or A1's logical
dataset changes.

## Demo credentials

- Email: `demo@lifelab.local`
- Display name: `Life Lab Demo`
- Password: `LifeLab@2026`

Only a BCrypt hash is stored in PostgreSQL.

## Scope

This is A1-only development tooling. Do not turn it into an HTTP endpoint, startup
initializer, Flyway data migration, or production reset mechanism.
# Semantic rebuild

`Build-A1SemanticFixtures.ps1` is the one-time offline authoring step. It reads the completed subtitle audit and downloaded preferred VTT files, validates cue timestamps against source durations, and writes the durable `a1-note-fixtures.json`, `a1-task-fixtures.json`, and `a1-semantic-review.tsv` artifacts.

Normal reset is offline and consumes those JSON fixtures:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a1/Build-A1SemanticFixtures.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a1/Reset-Seed-A1.ps1 -ReferenceDate 2026-09-05
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a1/Verify-A1.ps1 -ReferenceDate 2026-09-05
```

Reset does not parse VTT, call YouTube, or regenerate semantic text.

`a1-semantic-overrides.json` records reviewed, source-ID-checked metadata fallbacks
and linked Task wording by stable Note key. These overrides run before VTT cue
selection; they do not change the subtitle harvest's technical availability audit.
LIBRARY_09 has technically usable but semantically corrupted captions, so its two
Notes use study intentions supported only by the source title. Their timestamps,
VTT tracks and cue starts are NULL, and their evidence text is the snapshot title.
The builder changes only linked Task titles/descriptions, not links, statuses or
deadlines. Rebuild the durable artifacts after editing reviewed overrides.

Evidence totals: 92 VTT_CUE/timestamped Notes and 4 SOURCE_METADATA/NULL-timestamp
Notes (one each for LIBRARY_07 and LIBRARY_34, two for LIBRARY_09), 96 Notes total.
