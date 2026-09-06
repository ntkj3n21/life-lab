[CmdletBinding()]
param(
    [string]$ApiKey,
    [string]$EnvFile,
    [string]$ManifestPath,
    [string]$SnapshotPath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $PSScriptRoot 'a1-source-manifest.json'
}
if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
    $SnapshotPath = Join-Path $PSScriptRoot 'a1-source-snapshot.json'
}

function Get-DotEnvValue {
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        [Parameter(Mandatory)]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^$([regex]::Escape($Name))=(.*)$") {
            return $matches[1].Trim()
        }
    }

    return $null
}

function Convert-IsoDurationToSeconds {
    param(
        [Parameter(Mandatory)]
        [string]$Duration
    )

    try {
        $value = [System.Xml.XmlConvert]::ToTimeSpan($Duration)
    }
    catch {
        throw "Invalid YouTube duration '$Duration'."
    }

    $seconds = [long][Math]::Floor($value.TotalSeconds)
    if ($seconds -lt 0 -or $seconds -gt [int]::MaxValue) {
        throw "YouTube duration '$Duration' is outside the supported range."
    }

    return [int]$seconds
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = Get-DotEnvValue -Path $EnvFile -Name "LIFELAB_YOUTUBE_API_KEY"
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    throw "LIFELAB_YOUTUBE_API_KEY is required for online source validation."
}

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $ManifestPath | ConvertFrom-Json
$currentIds = @($manifest.currentLibrarySources)
$historicalEntries = @($manifest.historicalSources)

if ($currentIds.Count -ne 36) {
    throw "A1 manifest must contain exactly 36 current Library sources."
}

if ($historicalEntries.Count -ne 1 -or
    $historicalEntries[0].fixtureKey -ne "H1_GIT_TEAMWORK" -or
    $historicalEntries[0].youtubeVideoId -ne "-XsRLyKV9_k") {
    throw "A1 manifest must contain only the locked H1 historical source."
}

$allIds = @($currentIds) + @($historicalEntries | ForEach-Object { $_.youtubeVideoId })
$duplicates = @($allIds | Group-Object | Where-Object Count -gt 1)
if ($allIds.Count -ne 37 -or $duplicates.Count -ne 0) {
    throw "A1 manifest must contain exactly 37 unique source IDs."
}

$query = [System.Web.HttpUtility]::ParseQueryString([string]::Empty)
$query["part"] = "snippet,contentDetails,status"
$query["id"] = $allIds -join ","
$query["key"] = $ApiKey
$uri = "https://www.googleapis.com/youtube/v3/videos?$($query.ToString())"

$response = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 45
$itemsById = @{}
foreach ($item in @($response.items)) {
    $itemsById[$item.id] = $item
}

$missingIds = @($allIds | Where-Object { -not $itemsById.ContainsKey($_) })
if ($missingIds.Count -gt 0) {
    throw "YouTube did not return required A1 source(s): $($missingIds -join ', '). Snapshot was not changed."
}

$h1Manifest = $historicalEntries[0]
$h1Item = $itemsById[$h1Manifest.youtubeVideoId]
if ($h1Item.snippet.title -notlike "*$($h1Manifest.expectedTitleContains)*" -or
    $h1Item.snippet.channelTitle -ne $h1Manifest.expectedChannelName) {
    throw "H1 semantic identity no longer matches the locked Git teamwork source. Snapshot was not changed."
}

$verifiedAt = [DateTimeOffset]::UtcNow.ToString("o")
$sources = [System.Collections.Generic.List[object]]::new()

for ($index = 0; $index -lt $allIds.Count; $index++) {
    $id = $allIds[$index]
    $item = $itemsById[$id]

    if ($item.status.privacyStatus -ne "public" -or
        $item.status.embeddable -ne $true -or
        $item.status.uploadStatus -ne "processed") {
        throw "A1 source '$id' is not public, embeddable, and processed. Snapshot was not changed."
    }

    $durationSeconds = Convert-IsoDurationToSeconds -Duration $item.contentDetails.duration
    $thumbnailUrl = $null
    foreach ($thumbnailName in @("maxres", "high", "default")) {
        $thumbnail = $item.snippet.thumbnails.PSObject.Properties[$thumbnailName]
        if ($null -ne $thumbnail -and
            -not [string]::IsNullOrWhiteSpace($thumbnail.Value.url)) {
            $thumbnailUrl = $thumbnail.Value.url
            break
        }
    }

    $role = if ($index -lt 36) { "CURRENT_LIBRARY" } else { "HISTORICAL_H1" }
    $fixtureKey = if ($role -eq "HISTORICAL_H1") { "H1_GIT_TEAMWORK" } else { "LIBRARY_$('{0:D2}' -f ($index + 1))" }

    $sources.Add([ordered]@{
        fixtureKey = $fixtureKey
        role = $role
        libraryOrder = if ($role -eq "CURRENT_LIBRARY") { $index + 1 } else { $null }
        youtubeVideoId = $id
        sourceUrl = "https://www.youtube.com/watch?v=$id"
        title = [string]$item.snippet.title
        channelName = [string]$item.snippet.channelTitle
        thumbnailUrl = [string]$thumbnailUrl
        durationSeconds = $durationSeconds
        publishedAt = ([DateTimeOffset]$item.snippet.publishedAt).ToUniversalTime().ToString("o")
        availabilityStatus = "AVAILABLE"
    })
}

$snapshot = [ordered]@{
    schemaVersion = 1
    manifestSchemaVersion = [int]$manifest.schemaVersion
    verifiedAt = $verifiedAt
    validationProvider = "YouTube Data API v3 videos.list"
    currentLibrarySourceCount = 36
    historicalSourceCount = 1
    sources = $sources
}

$snapshotDirectory = Split-Path -Parent $SnapshotPath
New-Item -ItemType Directory -Force -Path $snapshotDirectory | Out-Null
$temporaryPath = "$SnapshotPath.tmp"
$json = $snapshot | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
    $temporaryPath,
    $json + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false))
Move-Item -Force -LiteralPath $temporaryPath -Destination $SnapshotPath

Write-Host "A1 source validation succeeded."
Write-Host "Current Library sources: 36"
Write-Host "Historical H1 sources: 1"
Write-Host "Snapshot fixtures: 37"
Write-Host "Snapshot: $([System.IO.Path]::GetFullPath($SnapshotPath))"
