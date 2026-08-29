Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$OutputEncoding = [Console]::OutputEncoding

$Root = $PSScriptRoot
$InputFile = Join-Path $Root "a2-eligible-urls.txt"
$OutputDir = Join-Path $Root "A2_Subtitles"

function Resolve-A2Binary {
    param(
        [Parameter(Mandatory)][string]$CommandName,
        [Parameter(Mandatory)][string]$WinGetLinkName
    )

    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($null -ne $cmd -and -not [string]::IsNullOrWhiteSpace($cmd.Source)) {
        return $cmd.Source
    }

    $link = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\$WinGetLinkName"
    if (Test-Path -LiteralPath $link) {
        return $link
    }

    return Get-ChildItem (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet") `
        -Recurse `
        -Filter $WinGetLinkName `
        -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path -LiteralPath $InputFile)) {
    throw "Missing input file: $InputFile. Run Check-A2SelectedCandidates.ps1 first."
}

$YTDLP = Resolve-A2Binary -CommandName "yt-dlp" -WinGetLinkName "yt-dlp.exe"
if ([string]::IsNullOrWhiteSpace($YTDLP) -or -not (Test-Path -LiteralPath $YTDLP)) {
    throw "yt-dlp.exe not found."
}

$DENO = Resolve-A2Binary -CommandName "deno" -WinGetLinkName "deno.exe"
if ([string]::IsNullOrWhiteSpace($DENO) -or -not (Test-Path -LiteralPath $DENO)) {
    throw "Deno was not found. Install it first with: winget install DenoLand.Deno"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $YTDLP `
        --encoding utf-8 `
        --js-runtimes "deno:$DENO" `
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

    $exitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
}

Write-Host ""
Write-Host "Subtitle download pass finished with yt-dlp exit code: $exitCode"
Write-Host "Output directory: $OutputDir"
Write-Host "No video/audio media was requested."
