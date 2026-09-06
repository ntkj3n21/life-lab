[CmdletBinding()]
param(
    [string]$SnapshotPath,
    [string]$OutputPath,
    [string]$UrlListPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
    $SnapshotPath = Join-Path $PSScriptRoot "..\a1\a1-source-snapshot.json"
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot "a1-harvest-input.tsv"
}
if ([string]::IsNullOrWhiteSpace($UrlListPath)) {
    $UrlListPath = Join-Path $PSScriptRoot "a1-harvest-urls.txt"
}

function Write-Utf8File {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Lines
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    [System.IO.File]::WriteAllLines($Path, $Lines, $utf8NoBom)
}

if (-not (Test-Path -LiteralPath $SnapshotPath -PathType Leaf)) {
    throw "Missing locked A1 source snapshot: $SnapshotPath"
}

$snapshot = Get-Content -LiteralPath $SnapshotPath -Raw -Encoding UTF8 |
    ConvertFrom-Json
$sources = @($snapshot.sources)

if ($sources.Count -ne 37) {
    throw "Expected 37 locked A1 sources, found $($sources.Count)."
}

$duplicateFixtureKeys = @(
    $sources |
        Group-Object fixtureKey |
        Where-Object Count -gt 1
)
$duplicateVideoIds = @(
    $sources |
        Group-Object youtubeVideoId |
        Where-Object Count -gt 1
)

if ($duplicateFixtureKeys.Count -gt 0) {
    throw "Duplicate fixtureKey values: $($duplicateFixtureKeys.Name -join ', ')"
}

if ($duplicateVideoIds.Count -gt 0) {
    throw "Duplicate youtubeVideoId values: $($duplicateVideoIds.Name -join ', ')"
}

$currentSources = @($sources | Where-Object role -eq "CURRENT_LIBRARY")
$historicalSources = @($sources | Where-Object role -eq "HISTORICAL_H1")

if ($currentSources.Count -ne 36 -or $historicalSources.Count -ne 1) {
    throw "Expected 36 CURRENT_LIBRARY and 1 HISTORICAL_H1 sources; found $($currentSources.Count) and $($historicalSources.Count)."
}

$expectedOrders = 1..36
$actualOrders = @($currentSources.libraryOrder | Sort-Object)
if (($actualOrders -join ",") -ne ($expectedOrders -join ",")) {
    throw "CURRENT_LIBRARY libraryOrder must contain every integer from 1 through 36 exactly once."
}

$historicalSource = $historicalSources[0]
if (
    $historicalSource.fixtureKey -ne "H1_GIT_TEAMWORK" -or
    $historicalSource.youtubeVideoId -ne "-XsRLyKV9_k"
) {
    throw "The locked historical source must be H1_GIT_TEAMWORK / -XsRLyKV9_k."
}

foreach ($source in $sources) {
    if (
        [string]::IsNullOrWhiteSpace([string]$source.fixtureKey) -or
        [string]::IsNullOrWhiteSpace([string]$source.youtubeVideoId) -or
        [string]::IsNullOrWhiteSpace([string]$source.sourceUrl)
    ) {
        throw "Every source must provide fixtureKey, youtubeVideoId, and sourceUrl."
    }

    if ([string]$source.youtubeVideoId -notmatch '^[A-Za-z0-9_-]{11}$') {
        throw "Invalid YouTube ID for $($source.fixtureKey): $($source.youtubeVideoId)"
    }
}

$orderedSources = @(
    $currentSources | Sort-Object libraryOrder
    $historicalSources | Sort-Object fixtureKey
)

$rows = @(
    $orderedSources | ForEach-Object {
        [pscustomobject][ordered]@{
            fixture_key = [string]$_.fixtureKey
            role = [string]$_.role
            library_order = if ($null -eq $_.libraryOrder) { "" } else { [string]$_.libraryOrder }
            youtube_video_id = [string]$_.youtubeVideoId
            source_url = [string]$_.sourceUrl
            title = ([string]$_.title -replace "[\t\r\n]+", " ").Trim()
            channel_name = ([string]$_.channelName -replace "[\t\r\n]+", " ").Trim()
            duration_seconds = [string]$_.durationSeconds
        }
    }
)

$tsvLines = @($rows | ConvertTo-Csv -Delimiter "`t" -NoTypeInformation)
$urlLines = @($rows.source_url)

Write-Utf8File -Path $OutputPath -Lines $tsvLines
Write-Utf8File -Path $UrlListPath -Lines $urlLines

Write-Host "A1 harvest input built from locked snapshot."
Write-Host "TOTAL = $($rows.Count)"
Write-Host "CURRENT_LIBRARY = $($currentSources.Count)"
Write-Host "HISTORICAL_H1 = $($historicalSources.Count)"
Write-Host "Input: $OutputPath"
Write-Host "URLs:  $UrlListPath"
