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
