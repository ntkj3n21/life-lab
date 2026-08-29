# A2 long-term learning demo data

Development/evaluation tooling for `scale@lifelab.local`. It is never invoked by Spring Boot,
Flyway, or production startup. The locked design artifacts remain in `tools/a2-spec/`; normal
reset and verification are offline and consume the durable `a2-note-fixtures.tsv` in this folder.

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

The reset takes the transaction advisory lock `life-lab-a2-seed`, recreates only the locked A2
account's personal rows, never truncates tables, and never updates a pre-existing global
`youtube_videos` row. Unreferenced A2-only source rows may be recreated from the locked snapshot.
