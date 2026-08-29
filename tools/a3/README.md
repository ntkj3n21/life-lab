# A3 isolation demo

Explicit development/evaluation tooling for `isolation@lifelab.local`. It is not connected to
Spring Boot startup, Flyway, or production code. Locked inputs remain in `tools/a3-spec/`.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a3/Test-A3Artifacts.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a3/Reset-Seed-A3.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a3/Verify-A3.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/a3/Test-A3Idempotence.ps1
```

Reset is account-scoped, UTF-8-safe, guarded by `life-lab-a3-seed`, and never updates or deletes
the 15 shared global YouTube rows. Missing rows use A1 canonical metadata for the four A1 overlaps
and A2 canonical metadata otherwise. Verification runs its database checks in a read-only
transaction. Fingerprints use ordered logical business fields rather than physical IDs.
