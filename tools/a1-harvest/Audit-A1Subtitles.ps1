[CmdletBinding()]
param(
    [string]$InputPath,
    [string]$SubtitleDirectory,
    [string]$DownloadResultPath,
    [string]$ReportPath,
    [string]$SummaryPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$trackPriority = @("vi-orig", "vi", "en")

if ([string]::IsNullOrWhiteSpace($InputPath)) {
    $InputPath = Join-Path $PSScriptRoot "a1-harvest-input.tsv"
}
if ([string]::IsNullOrWhiteSpace($SubtitleDirectory)) {
    $SubtitleDirectory = Join-Path $PSScriptRoot "A1_Subtitles"
}
if ([string]::IsNullOrWhiteSpace($DownloadResultPath)) {
    $DownloadResultPath = Join-Path $PSScriptRoot "a1-download-results.tsv"
}
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $PSScriptRoot "a1-subtitle-audit.tsv"
}
if ([string]::IsNullOrWhiteSpace($SummaryPath)) {
    $SummaryPath = Join-Path $PSScriptRoot "a1-subtitle-audit-summary.ini"
}

function Write-Utf8File {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string[]]$Lines
    )

    [System.IO.File]::WriteAllLines($Path, $Lines, $utf8NoBom)
}

function Test-UsableVtt {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }

    $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    $content = $content.TrimStart([char]0xFEFF)
    if ($content -notmatch '^WEBVTT(?:\s|$)') {
        return $false
    }

    $blocks = [regex]::Split($content, '(?:\r?\n){2,}')
    foreach ($block in $blocks) {
        $lines = @($block -split '\r?\n')
        $timingIndex = -1
        for ($index = 0; $index -lt $lines.Count; $index++) {
            if ($lines[$index] -match '^\s*(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}\.\d{3}(?:\s|$)') {
                $timingIndex = $index
                break
            }
        }

        if ($timingIndex -lt 0 -or $timingIndex + 1 -ge $lines.Count) {
            continue
        }

        $cueText = (($lines[($timingIndex + 1)..($lines.Count - 1)] -join " ") -replace '<[^>]+>', ' ' -replace '&nbsp;', ' ').Trim()
        if (-not [string]::IsNullOrWhiteSpace($cueText)) {
            return $true
        }
    }

    return $false
}

function Get-AvailableTrackNames {
    param([Parameter(Mandatory)]$Info)

    $names = New-Object System.Collections.Generic.HashSet[string]([StringComparer]::OrdinalIgnoreCase)
    foreach ($propertyName in @("subtitles", "automatic_captions")) {
        $property = $Info.PSObject.Properties[$propertyName]
        if ($null -eq $property -or $null -eq $property.Value) {
            continue
        }

        foreach ($trackProperty in $property.Value.PSObject.Properties) {
            [void]$names.Add($trackProperty.Name)
        }
    }

    return ,$names
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Missing harvest input: $InputPath. Run Build-A1HarvestInput.ps1 first."
}

if (-not (Test-Path -LiteralPath $SubtitleDirectory -PathType Container)) {
    throw "Missing subtitle directory: $SubtitleDirectory. Run Download-A1Subtitles.ps1 first."
}

$sources = @(Import-Csv -LiteralPath $InputPath -Delimiter "`t" -Encoding UTF8)
if ($sources.Count -ne 37) {
    throw "Expected 37 A1 harvest input rows, found $($sources.Count)."
}

$downloadResultsById = @{}
if (Test-Path -LiteralPath $DownloadResultPath -PathType Leaf) {
    foreach ($downloadResult in @(Import-Csv -LiteralPath $DownloadResultPath -Delimiter "`t" -Encoding UTF8)) {
        $downloadResultsById[[string]$downloadResult.youtube_video_id] = $downloadResult
    }
}

$auditRows = New-Object System.Collections.Generic.List[object]

foreach ($source in $sources) {
    $videoId = [string]$source.youtube_video_id
    $infoPath = Join-Path $SubtitleDirectory "$videoId.info.json"
    $availableTracks = New-Object System.Collections.Generic.HashSet[string]([StringComparer]::OrdinalIgnoreCase)
    $metadataReadError = $null

    if (Test-Path -LiteralPath $infoPath -PathType Leaf) {
        try {
            $info = Get-Content -LiteralPath $infoPath -Raw -Encoding UTF8 | ConvertFrom-Json
            $availableTracks = Get-AvailableTrackNames -Info $info
        }
        catch {
            $metadataReadError = $_.Exception.Message
        }
    }

    $existingTracks = New-Object System.Collections.Generic.List[string]
    $usableTracks = New-Object System.Collections.Generic.List[string]
    foreach ($track in $trackPriority) {
        $vttPath = Join-Path $SubtitleDirectory "$videoId.$track.vtt"
        if (Test-Path -LiteralPath $vttPath -PathType Leaf) {
            $existingTracks.Add($track)
            if (Test-UsableVtt -Path $vttPath) {
                $usableTracks.Add($track)
            }
        }
    }

    $selectedTrack = $trackPriority |
        Where-Object { $usableTracks.Contains($_) } |
        Select-Object -First 1

    $requestedTrackAvailable = @(
        $trackPriority | Where-Object { $availableTracks.Contains($_) }
    )

    $downloadResult = $downloadResultsById[$videoId]
    $downloadOutcome = ""
    $downloadFailureDetail = ""
    if ($null -ne $downloadResult) {
        if ($null -ne $downloadResult.PSObject.Properties["outcome"]) {
            $downloadOutcome = [string]$downloadResult.outcome
        }
        if ($null -ne $downloadResult.PSObject.Properties["failure_detail"]) {
            $downloadFailureDetail = [string]$downloadResult.failure_detail
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($selectedTrack)) {
        $sourceState = "VTT_USABLE"
        $evidenceState = "DOWNLOADED"
        $reason = "Selected the first usable track by vi-orig, vi, en priority."
    }
    elseif ($downloadOutcome -eq "RATE_LIMITED") {
        $sourceState = "UNKNOWN"
        $evidenceState = "RATE_LIMITED"
        $reason = if ([string]::IsNullOrWhiteSpace($downloadFailureDetail)) { "HTTP 429 interrupted the selected subtitle download." } else { $downloadFailureDetail }
    }
    elseif ($downloadOutcome -eq "DOWNLOAD_FAILED") {
        $sourceState = "UNKNOWN"
        $evidenceState = "DOWNLOAD_FAILED"
        $reason = if ([string]::IsNullOrWhiteSpace($downloadFailureDetail)) { "The selected subtitle download did not complete." } else { $downloadFailureDetail }
    }
    elseif ($existingTracks.Count -gt 0) {
        $sourceState = "VTT_UNUSABLE"
        $evidenceState = "DOWNLOADED"
        $reason = "Downloaded requested VTT file(s) contain no valid non-empty cue."
    }
    elseif (
        (Test-Path -LiteralPath $infoPath -PathType Leaf) -and
        $null -eq $metadataReadError -and
        $requestedTrackAvailable.Count -eq 0
    ) {
        $sourceState = "NO_VTT"
        $evidenceState = "METADATA_CONFIRMED"
        $reason = "Downloaded metadata advertises none of the requested vi-orig, vi, or en tracks."
    }
    else {
        $sourceState = "UNKNOWN"
        $evidenceState = "DOWNLOAD_FAILED"
        if ($null -ne $metadataReadError) {
            $reason = "Downloaded info JSON is unreadable: $metadataReadError"
        }
        elseif ($requestedTrackAvailable.Count -gt 0) {
            $reason = "A requested track is advertised, but no usable downloaded VTT is present."
        }
        else {
            $reason = "No usable VTT or metadata evidence is available."
        }
    }

    $auditRows.Add([pscustomobject][ordered]@{
        fixture_key = [string]$source.fixture_key
        role = [string]$source.role
        youtube_video_id = $videoId
        title = [string]$source.title
        source_state = $sourceState
        evidence_state = $evidenceState
        selected_track = if ($null -eq $selectedTrack) { "" } else { [string]$selectedTrack }
        existing_tracks = $existingTracks -join ","
        advertised_requested_tracks = $requestedTrackAvailable -join ","
        reason = $reason
    })
}

if ($auditRows.Count -ne 37) {
    throw "Expected 37 classified audit rows, found $($auditRows.Count)."
}

$usableCount = @($auditRows | Where-Object source_state -eq "VTT_USABLE").Count
$noVttCount = @($auditRows | Where-Object source_state -eq "NO_VTT").Count
$unusableCount = @($auditRows | Where-Object source_state -eq "VTT_UNUSABLE").Count
$rateLimitedCount = @($auditRows | Where-Object { $_.source_state -eq "UNKNOWN" -and $_.evidence_state -eq "RATE_LIMITED" }).Count
$downloadFailedCount = @($auditRows | Where-Object { $_.source_state -eq "UNKNOWN" -and $_.evidence_state -eq "DOWNLOAD_FAILED" }).Count
$viOrigCount = @($auditRows | Where-Object { $_.source_state -eq "VTT_USABLE" -and $_.selected_track -eq "vi-orig" }).Count
$viCount = @($auditRows | Where-Object { $_.source_state -eq "VTT_USABLE" -and $_.selected_track -eq "vi" }).Count
$enCount = @($auditRows | Where-Object { $_.source_state -eq "VTT_USABLE" -and $_.selected_track -eq "en" }).Count

if (($usableCount + $noVttCount + $unusableCount + $rateLimitedCount + $downloadFailedCount) -ne 37) {
    throw "Audit categories do not reconcile to 37 sources."
}

$reportLines = @($auditRows | ConvertTo-Csv -Delimiter "`t" -NoTypeInformation)
$summaryLines = @(
    "TOTAL_LOCKED_SOURCES = 37",
    "VTT_USABLE = $usableCount",
    "NO_VTT = $noVttCount",
    "VTT_UNUSABLE = $unusableCount",
    "UNKNOWN_RATE_LIMITED = $rateLimitedCount",
    "UNKNOWN_DOWNLOAD_FAILED = $downloadFailedCount",
    "preferred vi-orig = $viOrigCount",
    "preferred vi = $viCount",
    "preferred en = $enCount"
)

Write-Utf8File -Path $ReportPath -Lines $reportLines
Write-Utf8File -Path $SummaryPath -Lines $summaryLines

$summaryLines | ForEach-Object { Write-Host $_ }

$notUsableRows = @($auditRows | Where-Object source_state -ne "VTT_USABLE")
Write-Host "Sources not classified VTT_USABLE:"
if ($notUsableRows.Count -eq 0) {
    Write-Host "- None"
}
else {
    $notUsableRows | ForEach-Object {
        Write-Host "- $($_.youtube_video_id) | $($_.title) | $($_.source_state) / $($_.evidence_state)"
    }
}

Write-Host "Report:  $ReportPath"
Write-Host "Summary: $SummaryPath"
