Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$OutputEncoding = [Console]::OutputEncoding

$Root = $PSScriptRoot
$InputFile = Join-Path $Root "a2-selected-urls-140.txt"
$EligibleFile = Join-Path $Root "a2-eligible-urls.txt"
$RejectedFile = Join-Path $Root "a2-rejected.tsv"
$MetadataFile = Join-Path $Root "a2-eligible-metadata.jsonl"
$AuditFile = Join-Path $Root "a2-access-audit.tsv"

if (-not (Test-Path -LiteralPath $InputFile)) {
    throw "Missing input file: $InputFile"
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

Remove-Item $EligibleFile,$RejectedFile,$MetadataFile,$AuditFile -ErrorAction SilentlyContinue

"video_id`turl`tresult`tavailability`tembeddable`tage_limit`tduration_seconds`ttitle" |
    Set-Content -LiteralPath $AuditFile -Encoding utf8
"url`treason`tdetails" |
    Set-Content -LiteralPath $RejectedFile -Encoding utf8

$urls = @(
    Get-Content -LiteralPath $InputFile -Encoding utf8 |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique
)

$restrictedAvailability = @(
    "private",
    "premium_only",
    "subscriber_only",
    "needs_auth"
)

$eligibleCount = 0
$rejectedCount = 0
$index = 0

foreach ($url in $urls) {
    $index++
    Write-Host "[$index/$($urls.Count)] $url"

    $errorFile = [System.IO.Path]::GetTempFileName()

    try {
        $jsonLines = @(
            & $YTDLP `
                --no-playlist `
                --skip-download `
                --dump-single-json `
                $url `
                2> $errorFile
        )
        $exitCode = $LASTEXITCODE
        $jsonText = ($jsonLines -join "`n").Trim()
        $stderr = (Get-Content -LiteralPath $errorFile -Raw -ErrorAction SilentlyContinue).Trim()

        if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($jsonText)) {
            $reason = "EXTRACTION_FAILED"
            $lower = $stderr.ToLowerInvariant()

            if ($lower -match "members.only|members only|join this channel|subscriber.only") {
                $reason = "MEMBERS_ONLY"
            }
            elseif ($lower -match "private video|video is private") {
                $reason = "PRIVATE"
            }
            elseif ($lower -match "premium") {
                $reason = "PREMIUM_ONLY"
            }
            elseif ($lower -match "sign in|login|required to log|authentication") {
                $reason = "AUTH_REQUIRED"
            }
            elseif ($lower -match "not available|unavailable|removed|deleted") {
                $reason = "UNAVAILABLE"
            }

            "$url`t$reason`t$($stderr -replace "`r?`n",' ')" |
                Add-Content -LiteralPath $RejectedFile -Encoding utf8

            "`t$url`tREJECT:$reason`t`t`t`t`t" |
                Add-Content -LiteralPath $AuditFile -Encoding utf8

            $rejectedCount++
            continue
        }

        try {
            $info = $jsonText | ConvertFrom-Json
        }
        catch {
            "$url`tJSON_PARSE_FAILED`t$($_.Exception.Message)" |
                Add-Content -LiteralPath $RejectedFile -Encoding utf8
            "`t$url`tREJECT:JSON_PARSE_FAILED`t`t`t`t`t" |
                Add-Content -LiteralPath $AuditFile -Encoding utf8
            $rejectedCount++
            continue
        }

        $videoId = [string]$info.id
        $title = ([string]$info.title) -replace "`t|`r|`n",' '
        $availability = [string]$info.availability
        $embeddable = $info.playable_in_embed
        $ageLimit = $info.age_limit
        $duration = $info.duration

        if ($restrictedAvailability -contains $availability) {
            "$url`tRESTRICTED_AVAILABILITY`t$availability" |
                Add-Content -LiteralPath $RejectedFile -Encoding utf8
            "$videoId`t$url`tREJECT:RESTRICTED_AVAILABILITY`t$availability`t$embeddable`t$ageLimit`t$duration`t$title" |
                Add-Content -LiteralPath $AuditFile -Encoding utf8
            $rejectedCount++
            continue
        }

        if ($embeddable -eq $false) {
            "$url`tNOT_EMBEDDABLE`tplayable_in_embed=false" |
                Add-Content -LiteralPath $RejectedFile -Encoding utf8
            "$videoId`t$url`tREJECT:NOT_EMBEDDABLE`t$availability`t$embeddable`t$ageLimit`t$duration`t$title" |
                Add-Content -LiteralPath $AuditFile -Encoding utf8
            $rejectedCount++
            continue
        }

        if ($null -ne $ageLimit -and [double]$ageLimit -gt 0) {
            "$url`tAGE_RESTRICTED`tage_limit=$ageLimit" |
                Add-Content -LiteralPath $RejectedFile -Encoding utf8
            "$videoId`t$url`tREJECT:AGE_RESTRICTED`t$availability`t$embeddable`t$ageLimit`t$duration`t$title" |
                Add-Content -LiteralPath $AuditFile -Encoding utf8
            $rejectedCount++
            continue
        }

        if ($null -ne $duration -and [double]$duration -lt 60) {
            "$url`tTOO_SHORT`tduration=$duration" |
                Add-Content -LiteralPath $RejectedFile -Encoding utf8
            "$videoId`t$url`tREJECT:TOO_SHORT`t$availability`t$embeddable`t$ageLimit`t$duration`t$title" |
                Add-Content -LiteralPath $AuditFile -Encoding utf8
            $rejectedCount++
            continue
        }

        $url | Add-Content -LiteralPath $EligibleFile -Encoding utf8
        $jsonText | Add-Content -LiteralPath $MetadataFile -Encoding utf8
        "$videoId`t$url`tELIGIBLE`t$availability`t$embeddable`t$ageLimit`t$duration`t$title" |
            Add-Content -LiteralPath $AuditFile -Encoding utf8
        $eligibleCount++
    }
    finally {
        Remove-Item -LiteralPath $errorFile -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 1200
}

Write-Host ""
Write-Host "DONE"
Write-Host "Eligible: $eligibleCount"
Write-Host "Rejected: $rejectedCount"
Write-Host "Total checked: $($urls.Count)"
Write-Host ""
Write-Host "Outputs:"
Write-Host "  $EligibleFile"
Write-Host "  $RejectedFile"
Write-Host "  $MetadataFile"
Write-Host "  $AuditFile"
