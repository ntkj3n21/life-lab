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
