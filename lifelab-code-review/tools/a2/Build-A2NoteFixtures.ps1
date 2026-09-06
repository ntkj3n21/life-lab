[CmdletBinding()]
param(
    [string]$ArtifactDirectory,
    [string]$VttDirectory,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($ArtifactDirectory)) {
    $ArtifactDirectory = Join-Path $PSScriptRoot '../a2-spec'
}
if ([string]::IsNullOrWhiteSpace($VttDirectory)) {
    $VttDirectory = Join-Path $PSScriptRoot '../a2-harvest/A2_Subtitles'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot 'a2-note-fixtures.tsv'
}

& (Join-Path $PSScriptRoot 'Test-A2Artifacts.ps1') `
    -ArtifactDirectory $ArtifactDirectory -Quiet | Out-Null

$distribution = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath `
    (Join-Path $ArtifactDirectory 'a2-note-distribution.tsv'))
$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath `
    (Join-Path $ArtifactDirectory 'a2-source-snapshot.json') | ConvertFrom-Json
$vttFiles = @(Get-ChildItem -LiteralPath $VttDirectory -Filter '*.vtt')

function ConvertFrom-A2VttTime([string]$Value) {
    $parts = $Value.Split(':')
    if ($parts.Count -eq 3) {
        return [int][Math]::Floor(([double]$parts[0] * 3600) + ([double]$parts[1] * 60) + [double]$parts[2])
    }
    return [int][Math]::Floor(([double]$parts[0] * 60) + [double]$parts[1])
}

function Get-A2CleanCueText([string[]]$Lines) {
    $text = ($Lines -join ' ') -replace '<[^>]+>', '' -replace '&nbsp;', ' '
    $text = $text -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>'
    $text = ($text -replace '\s+', ' ').Trim()
    if ($text.Length -gt 180) { $text = $text.Substring(0, 177).TrimEnd() + '...' }
    return $text
}

function Read-A2VttCues([string]$Path) {
    $lines = @(Get-Content -Encoding UTF8 -LiteralPath $Path)
    $cues = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -notmatch '^(\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->') { continue }
        $startText = ($lines[$index] -split '\s+-->')[0]
        $content = [System.Collections.Generic.List[string]]::new()
        $index++
        while ($index -lt $lines.Count -and -not [string]::IsNullOrWhiteSpace($lines[$index])) {
            if ($lines[$index] -notmatch '^NOTE') { $content.Add($lines[$index]) }
            $index++
        }
        $clean = Get-A2CleanCueText $content.ToArray()
        if ($clean.Length -ge 12) {
            $cues.Add([pscustomobject]@{ Start = ConvertFrom-A2VttTime $startText; Text = $clean })
        }
    }
    return @($cues | Group-Object Start | ForEach-Object { $_.Group[0] })
}

function Find-A2Track([string]$VideoId) {
    foreach ($track in @('vi-orig', 'vi', 'en')) {
        $match = @($vttFiles | Where-Object { $_.Name.StartsWith("$VideoId - ") -and $_.Name.EndsWith(".$track.vtt") })
        if ($match.Count -eq 1) { return [pscustomobject]@{ Track = $track; Path = $match[0].FullName } }
        if ($match.Count -gt 1) { throw "Multiple $track VTT files found for $VideoId." }
    }
    return $null
}

$rows = [System.Collections.Generic.List[object]]::new()
foreach ($item in $distribution) {
    $source = $snapshot.sources | Where-Object youtubeVideoId -eq $item.video_id
    if ($null -eq $source) { throw "Snapshot source missing for $($item.video_id)." }
    $timestampCount = [int]$item.timestamped_note_count
    $nullCount = [int]$item.null_timestamp_note_count
    $track = Find-A2Track $item.video_id
    $cues = @()
    if ($null -ne $track) {
        $durationSeconds = [int]$source.durationSeconds
        $cues = @(Read-A2VttCues $track.Path | Where-Object { $_.Start -lt $durationSeconds })
    }
    if ($timestampCount -gt 0 -and $cues.Count -lt $timestampCount) {
        throw "Insufficient real VTT cues for $($item.fixture_key): need $timestampCount, found $($cues.Count)."
    }
    if ($timestampCount -gt 0 -and $null -eq $track) {
        throw "Required timestamped Notes have no VTT for $($item.fixture_key)."
    }

    $selectedIndexes = [System.Collections.Generic.HashSet[int]]::new()
    for ($noteNo = 1; $noteNo -le [int]$item.note_count; $noteNo++) {
        $isTimestamped = $noteNo -le $timestampCount
        $cue = $null
        if ($cues.Count -gt 0) {
            $position = [Math]::Floor(($noteNo * ($cues.Count + 1.0)) / ([int]$item.note_count + 1.0))
            $position = [Math]::Min($cues.Count - 1, [Math]::Max(0, $position))
            while ($selectedIndexes.Contains([int]$position) -and $position -lt $cues.Count - 1) { $position++ }
            [void]$selectedIndexes.Add([int]$position)
            $cue = $cues[$position]
        }

        $content = if ($null -ne $cue) {
            "$($item.category): $($cue.Text)"
        } else {
            "$($item.category): Review the key ideas from $($source.title)."
        }
        $rows.Add([pscustomobject]@{
            fixture_key = $item.fixture_key
            note_no = $noteNo
            youtube_video_id = $item.video_id
            content = $content
            timestamp_seconds = if ($isTimestamped) { $cue.Start } else { $null }
            vtt_track = if ($isTimestamped) { $track.Track } else { $null }
            cue_start_seconds = if ($isTimestamped) { $cue.Start } else { $null }
        })
    }
}

if ($rows.Count -ne 240 -or @($rows | Where-Object timestamp_seconds -ne $null).Count -ne 120) {
    throw 'Generated Note fixtures do not match 240 total / 120 timestamped.'
}

$temporary = "$OutputPath.tmp"
$rows | Export-Csv -Delimiter "`t" -NoTypeInformation -Encoding UTF8 -LiteralPath $temporary
$utf8 = [System.Text.UTF8Encoding]::new($false)
$content = Get-Content -Raw -Encoding UTF8 -LiteralPath $temporary
[System.IO.File]::WriteAllText($OutputPath, $content, $utf8)
Remove-Item -LiteralPath $temporary -Force

Write-Host "Built $($rows.Count) durable A2 Note fixtures."
Write-Host "Timestamped with real VTT cue evidence: 120"
Write-Host "NULL timestamp: 120"
Write-Host "Output: $OutputPath"
