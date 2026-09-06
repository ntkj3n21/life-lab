[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string]$ReferenceDate = '2026-08-27',
    [string]$EnvFile,
    [string]$SnapshotPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}
if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
    $SnapshotPath = Join-Path $PSScriptRoot 'a1-source-snapshot.json'
}

. (Join-Path $PSScriptRoot 'A1-Database.ps1')

$DeterministicSeed = 20260827
$DemoPasswordHash = '$2a$10$CtETwdyERV3JxQhKLBJPW.KvfT6IpZCSVsTvloYPUXN6QGHF4UsK2'

$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath $SnapshotPath | ConvertFrom-Json
$sources = @($snapshot.sources)
$currentSources = @($sources | Where-Object role -eq 'CURRENT_LIBRARY')
$historicalSources = @($sources | Where-Object role -eq 'HISTORICAL_H1')

if ([int]$snapshot.schemaVersion -ne 1 -or
    $sources.Count -ne 37 -or
    $currentSources.Count -ne 36 -or
    $historicalSources.Count -ne 1 -or
    $historicalSources[0].youtubeVideoId -ne '-XsRLyKV9_k' -or
    @($sources.youtubeVideoId | Group-Object | Where-Object Count -gt 1).Count -ne 0) {
    throw 'A1 snapshot must contain exactly 36 current sources and the locked H1 source.'
}

foreach ($source in $sources) {
    if ($source.availabilityStatus -ne 'AVAILABLE' -or
        [int]$source.durationSeconds -le 0 -or
        [string]::IsNullOrWhiteSpace($source.title) -or
        [string]::IsNullOrWhiteSpace($source.channelName)) {
        throw "A1 snapshot source '$($source.fixtureKey)' is incomplete or unavailable."
    }
}

$prelude = [System.Text.StringBuilder]::new()
$noteFixturesPath = Join-Path $PSScriptRoot 'a1-note-fixtures.json'
$taskFixturesPath = Join-Path $PSScriptRoot 'a1-task-fixtures.json'
if (-not (Test-Path -LiteralPath $noteFixturesPath) -or -not (Test-Path -LiteralPath $taskFixturesPath)) {
    throw 'Durable semantic fixtures are missing. Run Build-A1SemanticFixtures.ps1 first.'
}
$noteFixtureJson = Get-Content -Raw -Encoding UTF8 -LiteralPath $noteFixturesPath
$taskFixtureJson = Get-Content -Raw -Encoding UTF8 -LiteralPath $taskFixturesPath
$noteFixtures = @((ConvertFrom-Json -InputObject $noteFixtureJson) | ForEach-Object { $_ })
$taskFixtures = @((ConvertFrom-Json -InputObject $taskFixtureJson) | ForEach-Object { $_ })
Write-Verbose "Semantic fixture counts: notes=$($noteFixtures.Count), tasks=$($taskFixtures.Count)"
if ($noteFixtures.Count -ne 96 -or $taskFixtures.Count -ne 125) { throw 'A1 semantic fixture counts must be 96 notes and 125 tasks.' }
[void]$prelude.AppendLine(@'
CREATE TEMP TABLE a1_note_fixtures (
    note_key TEXT PRIMARY KEY,
    source_fixture_key TEXT NOT NULL,
    note_no INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp_seconds INTEGER,
    evidence_type TEXT NOT NULL,
    vtt_track TEXT,
    cue_start_seconds INTEGER,
    evidence_text TEXT,
    note_sequence INTEGER NOT NULL
);
CREATE TEMP TABLE a1_task_fixtures (
    task_key TEXT PRIMARY KEY,
    source_status TEXT NOT NULL,
    note_key TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    deadline_class TEXT,
    sequence_no INTEGER NOT NULL
);
'@)
for ($i = 0; $i -lt $noteFixtures.Count; $i++) {
    $f = $noteFixtures[$i]
    $values = @((ConvertTo-A1SqlLiteral $f.noteKey),(ConvertTo-A1SqlLiteral $f.sourceFixtureKey),[int]$f.noteNo,(ConvertTo-A1SqlLiteral $f.content),$(if ($null -eq $f.timestampSeconds) {'NULL'} else {[int]$f.timestampSeconds}),(ConvertTo-A1SqlLiteral $f.evidenceType),(ConvertTo-A1SqlLiteral $f.vttTrack),$(if ($null -eq $f.cueStartSeconds) {'NULL'} else {[int]$f.cueStartSeconds}),(ConvertTo-A1SqlLiteral $f.evidenceText),($i+1))
    [void]$prelude.AppendLine("INSERT INTO a1_note_fixtures VALUES ($($values -join ', '));")
}
for ($i = 0; $i -lt $taskFixtures.Count; $i++) {
    $f = $taskFixtures[$i]
    $values = @((ConvertTo-A1SqlLiteral $f.taskKey),(ConvertTo-A1SqlLiteral $f.sourceStatus),(ConvertTo-A1SqlLiteral $f.noteKey),(ConvertTo-A1SqlLiteral $f.title),(ConvertTo-A1SqlLiteral $f.description),(ConvertTo-A1SqlLiteral $f.status),(ConvertTo-A1SqlLiteral $f.deadlineClass),($i+1))
    [void]$prelude.AppendLine("INSERT INTO a1_task_fixtures VALUES ($($values -join ', '));")
}

[void]$prelude.AppendLine(@'
CREATE TEMP TABLE a1_snapshot_sources (
    fixture_key TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    library_order INTEGER,
    youtube_video_id VARCHAR NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    availability_status VARCHAR NOT NULL
);
'@)

foreach ($source in $sources) {
    $libraryOrder = if ($null -eq $source.libraryOrder) { 'NULL' } else { [int]$source.libraryOrder }
    $values = @(
        (ConvertTo-A1SqlLiteral $source.fixtureKey),
        (ConvertTo-A1SqlLiteral $source.role),
        $libraryOrder,
        (ConvertTo-A1SqlLiteral $source.youtubeVideoId),
        (ConvertTo-A1SqlLiteral $source.sourceUrl),
        (ConvertTo-A1SqlLiteral $source.title),
        (ConvertTo-A1SqlLiteral $source.channelName),
        (ConvertTo-A1SqlLiteral $source.thumbnailUrl),
        [int]$source.durationSeconds,
        (ConvertTo-A1SqlLiteral $source.publishedAt),
        (ConvertTo-A1SqlLiteral $source.availabilityStatus)
    )

    [void]$prelude.AppendLine(
        "INSERT INTO a1_snapshot_sources VALUES ($($values -join ', '));")
}

$seedSql = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'seed-a1.sql')
$combinedSql = $prelude.ToString() + [Environment]::NewLine + $seedSql
$temporarySql = Join-Path ([System.IO.Path]::GetTempPath()) "life-lab-a1-seed-$([guid]::NewGuid().ToString('N')).sql"
[System.IO.File]::WriteAllText(
    $temporarySql,
    $combinedSql,
    [System.Text.UTF8Encoding]::new($false))

$databaseConfig = Get-A1DatabaseConfig -EnvFile $EnvFile

try {
    Invoke-A1Psql -DatabaseConfig $databaseConfig -Arguments @(
        '-v', "reference_date=$ReferenceDate",
        '-v', "deterministic_seed=$DeterministicSeed",
        '-v', "password_hash=$DemoPasswordHash",
        '-f', $temporarySql
    )
}
finally {
    if (Test-Path -LiteralPath $temporarySql) {
        Remove-Item -LiteralPath $temporarySql -Force
    }
}

Write-Host "A1 reset + seed completed."
Write-Host "REFERENCE_DATE: $ReferenceDate"
Write-Host "Business timezone: Asia/Ho_Chi_Minh"
Write-Host "Deterministic seed: $DeterministicSeed"
