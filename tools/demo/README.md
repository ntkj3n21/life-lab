# Archived V3 scale-validation account

This offline, deterministic fixture uses `scale-demo@lifelab.local` only. It is
re-runnable scale/repeatability tooling, not the canonical V3 dataset; use A1/A2
for canonical demonstration and regression data. It needs
the existing A1/A2 fixtures and normal Flyway migrations. It never runs during
application startup, modifies production code, or changes A1/A2 fixture meaning.
Do not use this dedicated account for personal data.

From the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/demo/Reset-Demo.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/demo/Seed-Demo.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/demo/Verify-Demo.ps1
```

`Seed-Demo.ps1` creates the account if absent with the existing fixture password
`LifeLab@2026`; an existing account keeps its password. It refuses a nonempty
Demo account, so reset first. Database settings come from `.env` / `DB_*` via
the existing A2 PostgreSQL helper. The fixed defaults are reference date
`2026-09-28`, 1,500 Notes, and 1,500 Tasks. `-ReferenceDate` moves fixture
deadlines; it does not alter how the application derives Daily Plan from today's
date. Generated IDs may change after reset, but logical content does not.

To prove two reset/seed cycles, logical repeatability, and isolation:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/demo/Test-DemoRepeatability.ps1
```

The resulting account has 100 Videos, 50 Images, 30 Audio items, 10 Categories,
56 reusable Tags, 1,500 Notes, 1,500 Tasks, and 1,000 closed Video Watch
Sessions. Existing A1/A2 Sources are reused; the additional 16 external Images
and 9 external Audio recordings are listed with exact provenance in
`demo-image-fixtures.json` and `demo-audio-fixtures.json`. The 12 presenter
chains are defined by stable keys in `demo-showcase-stories.json`. Reset removes
only Demo-owned relationships and unreferenced Demo-only external Sources. It
preserves a Source if another account or surviving Note still references it.

## Presenter path

Use stable titles/source keys, not generated database IDs:

1. In Library, switch among Videos, Images, and Audio. Search `Spring` or
   `English`; open a result and show the original Source plus personal metadata.
2. For an Image personal-metadata example, find the A1 ERD item with custom
   title `Đồ án Life Lab — Database ERD`. Search `doi chieu` to show
   Vietnamese-accent-insensitive description search.
3. Follow `VIDEO-JAVA-SCANNER` or `IMAGE-ERD`: Source → Note → Task → exact
   Reverse Context. Use `AUDIO-DATABASE-CHOICE` for Audio timestamp restoration.
4. In Notes/Tasks, filter by Category and multiple Tags, then edit assignment.
   The stories span Programming, English, Software Design, Data Systems, and
   Computer Science. Library Tags use the same personal catalog, but media
   Library items have no Category.
5. For Daily Plan, use the story Tasks: `VIDEO-JAVA-SCANNER` is Overdue,
   `IMAGE-TENSES` is Today, `IMAGE-ERD` is Upcoming,
   `IMAGE-CLIENT-SERVER` has no deadline, and `VIDEO-TESTING` is Completed
   relative to fixture date `2026-09-28`. On another calendar day, the
   application correctly derives different groups.
6. A SOURCE_MISSING Task survives after its original Note is removed. Reverse
   Context must stop at that broken exact chain; it must not substitute a
   different Source.

Search samples include `do an`, `doi chieu`, `spring`, `database`, `english`,
`listening`, and `architecture`. `xyznomatch` has no intended match. Search is
server-side; the fixture does not add a search shortcut or product flag.

The 48 curated Notes use known A1/A2 source evidence and the new source
manifests. The remaining Notes and Tasks use deterministic, source-anchored
study-log templates for scale. Image Note timestamps are always absent. Audio
Notes cover absent, zero, and positive timestamps. `SOURCE_MISSING` is produced
through the existing Task-from-Note relationship followed by original Note
removal. Watch Sessions remain Video-only and use elapsed playing time, not
media `currentTime`.

The SQL verifier covers counts, source provenance, organization, search
examples, 12 exact story chains, Daily Plan groups, source status, ownership,
and Watch Session invariants. It does not replace a live browser demonstration:
external URL availability and browser playback can vary with provider/network
conditions. Inspect source pages and confirm playback before presenting.
