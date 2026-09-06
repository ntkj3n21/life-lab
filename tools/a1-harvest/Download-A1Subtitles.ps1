[CmdletBinding()]
param(
    [string]$InputPath,
    [string]$OutputDirectory,
    [string]$ResultPath,
    [switch]$Refresh
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

if ([string]::IsNullOrWhiteSpace($InputPath)) {
    $InputPath = Join-Path $PSScriptRoot "a1-harvest-input.tsv"
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot "A1_Subtitles"
}
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path $PSScriptRoot "a1-download-results.tsv"
}

function Resolve-Executable {
    param(
        [Parameter(Mandatory)][string]$CommandName,
        [Parameter(Mandatory)][string]$WinGetLinkName
    )

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
        $candidate = $command.Source
        $item = Get-Item -LiteralPath $candidate -ErrorAction SilentlyContinue
        if ($null -ne $item -and $item.LinkType -eq "SymbolicLink") {
            $target = @($item.Target)[0]
            if (-not [string]::IsNullOrWhiteSpace($target) -and (Test-Path -LiteralPath $target -PathType Leaf)) {
                return $target
            }
        }

        return $candidate
    }

    $winGetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet"
    $link = Join-Path $winGetRoot "Links\$WinGetLinkName"
    if (Test-Path -LiteralPath $link -PathType Leaf) {
        $item = Get-Item -LiteralPath $link
        $target = @($item.Target)[0]
        if (-not [string]::IsNullOrWhiteSpace($target) -and (Test-Path -LiteralPath $target -PathType Leaf)) {
            return $target
        }

        return $link
    }

    return Get-ChildItem -LiteralPath $winGetRoot -Recurse -Filter $WinGetLinkName -ErrorAction SilentlyContinue |
        Where-Object Length -gt 0 |
        Select-Object -First 1 -ExpandProperty FullName
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

function Invoke-YtDlp {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [Parameter(Mandatory)][object[]]$Arguments
    )

    $outputLines = New-Object System.Collections.Generic.List[string]
    & $Executable @Arguments 2>&1 | ForEach-Object {
        $line = [string]$_
        $outputLines.Add($line)
        Write-Host $line
    }
    $exitCode = $LASTEXITCODE
    $outputText = $outputLines -join "`n"

    $failureKind = ""
    $failureDetail = ""
    if ($exitCode -ne 0) {
        if ($outputText -match '(?i)HTTP Error 429|Too Many Requests') {
            $failureKind = "RATE_LIMITED"
            $failureDetail = "HTTP 429 Too Many Requests"
        }
        else {
            $failureKind = "DOWNLOAD_FAILED"
            if ($outputText -match '(?i)timed out|timeout') {
                $failureDetail = "Network timeout"
            }
            else {
                $failureDetail = "yt-dlp exited with code $exitCode"
            }
        }
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        FailureKind = $failureKind
        FailureDetail = $failureDetail
    }
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

$sources = @(Import-Csv -LiteralPath $InputPath -Delimiter "`t" -Encoding UTF8)
if ($sources.Count -ne 37) {
    throw "Expected 37 A1 harvest input rows, found $($sources.Count)."
}

$ytDlp = Resolve-Executable -CommandName "yt-dlp" -WinGetLinkName "yt-dlp.exe"
if ([string]::IsNullOrWhiteSpace($ytDlp) -or -not (Test-Path -LiteralPath $ytDlp -PathType Leaf)) {
    throw "yt-dlp was not found. Install it before running the A1 subtitle harvest."
}

$deno = Resolve-Executable -CommandName "deno" -WinGetLinkName "deno.exe"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$results = New-Object System.Collections.Generic.List[object]
$previousErrorActionPreference = $ErrorActionPreference
$hadNativePreference = Test-Path Variable:PSNativeCommandUseErrorActionPreference
if ($hadNativePreference) {
    $previousNativePreference = $PSNativeCommandUseErrorActionPreference
}

try {
    $ErrorActionPreference = "Continue"
    if ($hadNativePreference) {
        $PSNativeCommandUseErrorActionPreference = $false
    }

    for ($index = 0; $index -lt $sources.Count; $index++) {
        $source = $sources[$index]
        $videoId = [string]$source.youtube_video_id
        $outputTemplate = Join-Path $OutputDirectory "%(id)s.%(ext)s"
        $commonArguments = @(
            "--encoding", "utf-8",
            "--no-playlist",
            "--skip-download",
            "--force-overwrites",
            "--socket-timeout", "20",
            "--retries", "2",
            "--fragment-retries", "2",
            "--sleep-interval", "1",
            "--max-sleep-interval", "3",
            "-o", $outputTemplate
        )

        if (-not [string]::IsNullOrWhiteSpace($deno)) {
            $commonArguments += @("--js-runtimes", "deno:$deno")
        }

        Write-Host "[$($index + 1)/$($sources.Count)] $($source.fixture_key) / $videoId"
        $infoPath = Join-Path $OutputDirectory "$videoId.info.json"
        $metadataExitCode = 0
        $selectedTrack = $null
        $subtitleExitCode = $null
        $outcome = ""
        $failureDetail = ""

        if ($Refresh -or -not (Test-Path -LiteralPath $infoPath -PathType Leaf)) {
            $metadataArguments = @($commonArguments) + @(
                "--write-info-json",
                "--no-write-subs",
                "--no-write-auto-subs",
                [string]$source.source_url
            )
            $metadataResult = Invoke-YtDlp -Executable $ytDlp -Arguments $metadataArguments
            $metadataExitCode = $metadataResult.ExitCode
            if ($metadataExitCode -ne 0) {
                $outcome = $metadataResult.FailureKind
                $failureDetail = $metadataResult.FailureDetail
            }
        }
        else {
            Write-Host "  Reusing downloaded metadata."
        }

        if ($metadataExitCode -eq 0 -and (Test-Path -LiteralPath $infoPath -PathType Leaf)) {
            try {
                $info = Get-Content -LiteralPath $infoPath -Raw -Encoding UTF8 | ConvertFrom-Json
                $availableTracks = Get-AvailableTrackNames -Info $info
                $selectedTrack = @("vi-orig", "vi", "en") |
                    Where-Object { $availableTracks.Contains($_) } |
                    Select-Object -First 1

                if (-not [string]::IsNullOrWhiteSpace($selectedTrack)) {
                    $vttPath = Join-Path $OutputDirectory "$videoId.$selectedTrack.vtt"
                    if (
                        -not $Refresh -and
                        (Test-UsableVtt -Path $vttPath)
                    ) {
                        Write-Host "  Reusing downloaded $selectedTrack VTT."
                        $subtitleExitCode = 0
                        $outcome = "DOWNLOADED"
                    }
                    else {
                        Write-Host "  Selected track: $selectedTrack"
                        $subtitleArguments = @($commonArguments) + @(
                            "--load-info-json", $infoPath,
                            "--write-subs",
                            "--write-auto-subs",
                            "--sub-langs", $selectedTrack,
                            "--sub-format", "vtt"
                        )
                        $subtitleResult = Invoke-YtDlp -Executable $ytDlp -Arguments $subtitleArguments
                        $subtitleExitCode = $subtitleResult.ExitCode
                        if ($subtitleExitCode -eq 0 -and (Test-UsableVtt -Path $vttPath)) {
                            $outcome = "DOWNLOADED"
                        }
                        elseif ($subtitleExitCode -ne 0) {
                            $outcome = $subtitleResult.FailureKind
                            $failureDetail = $subtitleResult.FailureDetail
                        }
                        else {
                            $outcome = "DOWNLOAD_FAILED"
                            $failureDetail = "Downloaded VTT did not pass the usable-cue check"
                        }
                    }
                }
                else {
                    Write-Host "  No vi-orig, vi, or en track advertised."
                    $subtitleExitCode = 0
                    $outcome = "METADATA_CONFIRMED"
                }
            }
            catch {
                Write-Warning "Could not read metadata for ${videoId}: $($_.Exception.Message)"
                $subtitleExitCode = 1
                $outcome = "DOWNLOAD_FAILED"
                $failureDetail = "Downloaded metadata could not be parsed"
            }
        }

        if ([string]::IsNullOrWhiteSpace($outcome)) {
            $outcome = "DOWNLOAD_FAILED"
            if ([string]::IsNullOrWhiteSpace($failureDetail)) {
                $failureDetail = "Metadata download did not complete"
            }
        }

        $results.Add([pscustomobject][ordered]@{
            fixture_key = [string]$source.fixture_key
            role = [string]$source.role
            youtube_video_id = $videoId
            selected_track = if ($null -eq $selectedTrack) { "" } else { [string]$selectedTrack }
            metadata_exit_code = $metadataExitCode
            subtitle_exit_code = if ($null -eq $subtitleExitCode) { "" } else { [string]$subtitleExitCode }
            outcome = $outcome
            failure_detail = $failureDetail
            info_json_present = Test-Path -LiteralPath (Join-Path $OutputDirectory "$videoId.info.json") -PathType Leaf
            attempted_at_utc = [DateTimeOffset]::UtcNow.ToString("o")
        })
    }
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
    if ($hadNativePreference) {
        $PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
}

$resultLines = @($results | ConvertTo-Csv -Delimiter "`t" -NoTypeInformation)
Write-Utf8File -Path $ResultPath -Lines $resultLines

$failedCount = @(
    $results | Where-Object {
        [int]$_.metadata_exit_code -ne 0 -or
        [string]::IsNullOrWhiteSpace([string]$_.subtitle_exit_code) -or
        [int]$_.subtitle_exit_code -ne 0
    }
).Count
Write-Host ""
Write-Host "A1 subtitle download pass finished."
Write-Host "TOTAL = $($results.Count)"
Write-Host "NONZERO_EXIT = $failedCount"
Write-Host "Output:  $OutputDirectory"
Write-Host "Results: $ResultPath"
Write-Host "No video or audio media was requested."

if ($failedCount -gt 0) {
    Write-Warning "$failedCount source(s) returned a non-zero yt-dlp exit code. Re-run this command to retry only missing artifacts; use -Refresh to force a complete refresh."
}
