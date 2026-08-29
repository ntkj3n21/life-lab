Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$OutputEncoding = [Console]::OutputEncoding

$Root = $PSScriptRoot
$InputFile = Join-Path $Root "a2-eligible-urls.txt"
$OutputDir = Join-Path $Root "A2_Subtitles"

if (-not (Test-Path -LiteralPath $InputFile)) {
    throw "Missing input file: $InputFile. Run Check-A2SelectedCandidates.ps1 first."
}

$YTDLP = $null
$cmd = Get-Command yt-dlp -ErrorAction SilentlyContinue
if ($null -ne $cmd) {
    $YTDLP = $cmd.Source
}
if ([string]::IsNullOrWhiteSpace($YTDLP)) {
    $wingetLink = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\yt-dlp.exe"
    if (Test-Path -LiteralPath $wingetLink) {
        $YTDLP = $wingetLink
    }
}
if ([string]::IsNullOrWhiteSpace($YTDLP) -or -not (Test-Path -LiteralPath $YTDLP)) {
    throw "yt-dlp.exe not found."
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

& $YTDLP `
    --encoding utf-8 `
    --no-playlist `
    --skip-download `
    --write-subs `
    --write-auto-subs `
    --sub-langs "vi.*,en.*" `
    --sub-format "vtt" `
    --write-info-json `
    --ignore-errors `
    --sleep-interval 1 `
    --max-sleep-interval 3 `
    -o "$OutputDir/%(id)s - %(title)s.%(ext)s" `
    -a $InputFile

Write-Host ""
Write-Host "Subtitle download pass finished."
Write-Host "Output directory: $OutputDir"
Write-Host ""
Write-Host "No video/audio media was requested."

