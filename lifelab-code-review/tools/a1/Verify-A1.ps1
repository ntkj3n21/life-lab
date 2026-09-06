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

$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath $SnapshotPath | ConvertFrom-Json
$sources = @($snapshot.sources)
$currentSources = @($sources | Where-Object role -eq 'CURRENT_LIBRARY')
$historicalSources = @($sources | Where-Object role -eq 'HISTORICAL_H1')
$duplicateIds = @($sources.youtubeVideoId | Group-Object | Where-Object Count -gt 1)

if ([int]$snapshot.schemaVersion -ne 1 -or
    $sources.Count -ne 37 -or
    $currentSources.Count -ne 36 -or
    $historicalSources.Count -ne 1 -or
    $historicalSources[0].youtubeVideoId -ne '-XsRLyKV9_k' -or
    $duplicateIds.Count -ne 0) {
    throw 'FAIL snapshot_integrity: expected 36 current sources plus H1 (37 unique fixtures).'
}

$snapshotIds = $sources.youtubeVideoId -join ','
$databaseConfig = Get-A1DatabaseConfig -EnvFile $EnvFile
$noteFixturePath = Join-Path $PSScriptRoot 'a1-note-fixtures.json'
$taskFixturePath = Join-Path $PSScriptRoot 'a1-task-fixtures.json'
if (-not (Test-Path -LiteralPath $noteFixturePath) -or -not (Test-Path -LiteralPath $taskFixturePath)) { throw 'Durable semantic fixtures are missing.' }
$noteFixtures = @((ConvertFrom-Json -InputObject (Get-Content -Raw -Encoding UTF8 -LiteralPath $noteFixturePath)) | ForEach-Object { $_ })
$taskFixtures = @((ConvertFrom-Json -InputObject (Get-Content -Raw -Encoding UTF8 -LiteralPath $taskFixturePath)) | ForEach-Object { $_ })
if ($noteFixtures.Count -ne 96 -or $taskFixtures.Count -ne 125) { throw 'Durable semantic fixture counts are not 96 notes / 125 tasks.' }
$expectedMetadataKeys = @('LIBRARY_07', 'LIBRARY_09', 'LIBRARY_11', 'LIBRARY_34')
$expectedMetadataNoteKeys = @('a1-note-LIBRARY_07-1', 'a1-note-LIBRARY_09-1', 'a1-note-LIBRARY_09-2', 'a1-note-LIBRARY_11-1', 'a1-note-LIBRARY_34-1')
$metadataFixtures = @($noteFixtures | Where-Object evidenceType -eq 'SOURCE_METADATA')
if ($metadataFixtures.Count -ne 5 -or (@($metadataFixtures.noteKey | Sort-Object) -join ',') -ne (($expectedMetadataNoteKeys | Sort-Object) -join ',')) {
    throw 'Metadata fallback fixtures must contain one LIBRARY_07, two LIBRARY_09, one LIBRARY_11 and one LIBRARY_34 Note.'
}
$timestampedFixtures = @($noteFixtures | Where-Object { $null -ne $_.timestampSeconds })
if ($timestampedFixtures.Count -ne 91) { throw "Expected 91 timestamped fixtures, found $($timestampedFixtures.Count)." }
$invalidEvidence = @($noteFixtures | Where-Object {
    $source = $sources | Where-Object fixtureKey -eq $_.sourceFixtureKey
    if ($_.evidenceType -eq 'VTT_CUE') {
        $null -eq $_.timestampSeconds -or
        $null -eq $_.vttTrack -or
        $null -eq $_.cueStartSeconds -or
        [int]$_.timestampSeconds -lt 0 -or
        [int]$_.timestampSeconds -ge [int]$source.durationSeconds
    } elseif ($_.evidenceType -eq 'SOURCE_METADATA') {
        $expectedMetadataKeys -notcontains $_.sourceFixtureKey -or
        $null -ne $_.timestampSeconds -or
        $null -ne $_.vttTrack -or
        $null -ne $_.cueStartSeconds -or
        $_.evidenceText -cne $source.title
    } else {
        $true
    }
})
if ($invalidEvidence.Count -gt 0) { throw "Fixture evidence validation failed for $($invalidEvidence.Count) notes." }
$currentFixtureKeys = @($sources | Where-Object role -eq 'CURRENT_LIBRARY' | Select-Object -ExpandProperty fixtureKey)
$coveredCurrentKeys = @($noteFixtures | Where-Object { $currentFixtureKeys -contains $_.sourceFixtureKey } | Select-Object -ExpandProperty sourceFixtureKey -Unique)
if ($coveredCurrentKeys.Count -ne 36) { throw "Expected Notes for all 36 current sources, found $($coveredCurrentKeys.Count)." }
Write-Host "Semantic fixtures: notes=$($noteFixtures.Count), tasks=$($taskFixtures.Count), timestamped=$($timestampedFixtures.Count), metadata=$($metadataFixtures.Count)"
$verificationSql = Join-Path $PSScriptRoot 'verify-a1.sql'
$lines = Invoke-A1PsqlCapture -DatabaseConfig $databaseConfig -Arguments @(
    '-q',
    '-At',
    '-F', '|',
    '-v', "reference_date=$ReferenceDate",
    '-v', "snapshot_ids=$snapshotIds",
    '-f', $verificationSql
)

$results = [System.Collections.Generic.List[object]]::new()
foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $parts = $line -split '\|', 5
    if ($parts.Count -ne 5) {
        throw "Unexpected verifier output: $line"
    }

    $results.Add([pscustomobject]@{
        Check = $parts[0]
        Expected = $parts[1]
        Actual = $parts[2]
        Passed = $parts[3] -eq 't'
        Details = $parts[4]
    })
}

if ($results.Count -eq 0) {
    throw 'A1 verifier produced no checks.'
}

$results | Format-Table Check, Expected, Actual, Passed -AutoSize
$failures = @($results | Where-Object { -not $_.Passed })

if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host 'A1 VERIFIER: FAIL'
    $failures | Format-List Check, Expected, Actual, Details
    exit 1
}

Write-Host ''
Write-Host "A1 VERIFIER: PASS ($($results.Count) checks)"
Write-Host "REFERENCE_DATE: $ReferenceDate"
Write-Host 'Business timezone: Asia/Ho_Chi_Minh'
Write-Host 'Snapshot fixtures: 37 (36 current + H1)'
