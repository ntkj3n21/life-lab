# A2 canonical V3 long-term learning data

Development/evaluation tooling for `scale@lifelab.local`. It is never invoked by Spring Boot,
Flyway, or production startup. The locked design artifacts remain in `tools/a2-spec/`; normal
reset and verification are offline and consume the durable `a2-note-fixtures.tsv` in this folder.
The VTT extract remains raw evidence; `a2-curated-video.sql` layers seven reviewed
Note→Task chains and six personal Video metadata examples over it without changing
Source IDs or timestamps. A1 is the compact curated workspace; A2 retains its
longer-term and historical-source regression role. `tools/demo` is archived
scale-validation tooling, not a canonical account.

## Commands (project root, PowerShell)

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Test-A2Artifacts.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Reset-Seed-A2.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Verify-A2.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Test-A2Idempotence.ps1
```

The one-time fixture build reads only the locked source IDs from the already harvested local VTT
bundle and prefers `vi-orig`, then `vi`, then `en`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Build-A2NoteFixtures.ps1
```

The generated fixture stores exact source ID, cue track, and cue-start evidence. Reset does not
read VTT files or access the network. Database settings use `.env` / `DB_*` variables and the same
UTF-8-safe `psql` behavior as A1.
The remaining 233 Video Notes retain raw VTT-derived technical coverage rather than
claiming to be manually reviewed showcase prose. Use the seven curated chains for
semantic demonstrations; the wider corpus remains useful for long-history queries.

`a2-video-organization.tsv` selects one existing representative Note for each of
the 70 current Video Sources with captures. The ten other current Videos are
intentionally saved without a Note. The manifest assigns broad Categories and
specific Tags without organizing the entire long-history Video corpus. Seed and
verification load the same stable `(fixture_key, note_no)` mapping; verification
checks its exact Source, Note identity, Category, and full Tag set. Linked Tasks
inherit compatible organization without changing lifecycle or provenance.

The reset takes the transaction advisory lock `life-lab-a2-seed`, recreates only the locked A2
account's personal rows, never truncates tables, and never updates a pre-existing global
`youtube_videos` row. Unreferenced A2-only source rows may be recreated from the locked snapshot.
