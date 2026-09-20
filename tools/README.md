# Life Lab development data tooling

The scripts in this directory create deterministic local development and evaluation accounts.
They are explicit tooling only: none of them run during Spring Boot or Flyway startup.

## Prerequisites

1. Copy `.env.example` to `.env` and set the local PostgreSQL values.
2. Start PostgreSQL:

   ```powershell
   docker compose up -d postgres
   ```

3. Apply the normal Flyway migrations by starting the backend once:

   ```powershell
   Set-Location backend
   .\mvnw.cmd spring-boot:run
   ```

   After the application has started successfully, stop it with `Ctrl+C` and return to the
   repository root. The seed scripts require the application schema, but the backend does not
   need to remain running.

4. Ensure `psql` is available on `PATH`. The scripts also detect the default PostgreSQL 17
   installation path on Windows.

## Recreate all deterministic test accounts

Run the account seeds in dependency order from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a1/Reset-Seed-A1.ps1 -ReferenceDate 2026-08-27
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a1/Verify-A1.ps1 -ReferenceDate 2026-08-27

powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Reset-Seed-A2.ps1 -ReferenceDate 2026-08-27
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Verify-A2.ps1 -ReferenceDate 2026-08-27
```

The order is intentional: A2 reuses four A1 sources. Each reset deletes and recreates only its locked account's personal data. It does not truncate
personal tables or overwrite shared YouTube metadata.

## Accounts

| Fixture | Email                     | Password       | Purpose                               |
| ------- | ------------------------- | -------------- | ------------------------------------- |
| A1      | `demo@lifelab.local`      | `LifeLab@2026` | Curated main demo                     |
| A2      | `scale@lifelab.local`     | `LifeLab@2026` | Long-history and pagination volume    |

## Optional consistency checks

Validate locked artifacts without changing the database:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Test-A2Artifacts.ps1
```

Run repeatability and isolation checks (these commands reset their own fixture account):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a1/Test-A1Idempotence.ps1 -ReferenceDate 2026-08-27
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Test-A2Idempotence.ps1 -ReferenceDate 2026-08-27
```

the script reports that protected dataset as not tested rather than creating it automatically.

## Rebuild the derived A2 Note fixture

Normal A2 reset is offline and reads `tools/a2/a2-note-fixtures.tsv`; it does not need the raw
YouTube metadata dumps. If the derived fixture must be rebuilt from the retained VTT evidence:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Build-A2NoteFixtures.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a2/Test-A2Artifacts.ps1
```

The builder reads `tools/a2-harvest/A2_Subtitles/*.vtt` and does not use the removed
`*.info.json` harvest files.

## Reset caveat

Reset commands intentionally replace all personal fixture data for the selected fixture email.
Do not use these emails for data that must be kept. If A1 verification sees an extra `PENDING`
WatchSession created by a running browser session, close/finalize that session or reset A1 again
before treating the frozen A1 verification result as authoritative.
