[CmdletBinding()]
param(
    [string]$ArtifactDirectory,
    [string]$A1SnapshotPath,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($ArtifactDirectory)) {
    $ArtifactDirectory = Join-Path $PSScriptRoot '../a2-spec'
}
if ([string]::IsNullOrWhiteSpace($A1SnapshotPath)) {
    $A1SnapshotPath = Join-Path $PSScriptRoot '../a1/a1-source-snapshot.json'
}

function Import-A2Tsv([string]$Name) {
    Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory $Name)
}

$sources = @(Import-A2Tsv 'a2-final-sources-100.tsv')
$notes = @(Import-A2Tsv 'a2-note-distribution.tsv')
$watch = @(Import-A2Tsv 'a2-watch-distribution.tsv')
$tags = @(Import-A2Tsv 'a2-tags-25.tsv')
$links = @(Import-A2Tsv 'a2-tag-links-200.tsv')
$tasks = @(Import-A2Tsv 'a2-task-source-status-matrix.tsv')
$deadlines = @(Import-A2Tsv 'a2-incomplete-deadline-matrix.tsv')
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath `
    (Join-Path $ArtifactDirectory 'a2-source-manifest.json') | ConvertFrom-Json
$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath `
    (Join-Path $ArtifactDirectory 'a2-source-snapshot.json') | ConvertFrom-Json
$a1Snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath $A1SnapshotPath | ConvertFrom-Json

$errors = [System.Collections.Generic.List[string]]::new()
function Assert-A2([bool]$Condition, [string]$Message) {
    if (-not $Condition) { $errors.Add($Message) }
}
function Sum-A2($Rows, [string]$Property) {
    [int](($Rows | Measure-Object -Property $Property -Sum).Sum)
}

$currentManifestIds = @($manifest.currentLibrarySources)
$historicalManifestIds = @($manifest.historicalSources.youtubeVideoId)
$allManifestIds = @($currentManifestIds + $historicalManifestIds)
$sourceIds = @($sources.video_id)
$snapshotIds = @($snapshot.sources.youtubeVideoId)

Assert-A2 ($sources.Count -eq 100) "sources: expected 100, actual $($sources.Count)"
Assert-A2 (@($sourceIds | Sort-Object -Unique).Count -eq 100) 'sources: YouTube IDs are not unique'
Assert-A2 (@($sources | Where-Object role -eq 'CURRENT_LIBRARY').Count -eq 80) 'sources: expected 80 CURRENT_LIBRARY'
Assert-A2 (@($sources | Where-Object role -eq 'HISTORICAL').Count -eq 20) 'sources: expected 20 HISTORICAL'
Assert-A2 (@(Compare-Object ($sourceIds | Sort-Object) ($allManifestIds | Sort-Object)).Count -eq 0) 'manifest membership differs from final source TSV'
Assert-A2 (@(Compare-Object ($sourceIds | Sort-Object) ($snapshotIds | Sort-Object)).Count -eq 0) 'snapshot membership differs from final source TSV'
Assert-A2 (@($sources | Where-Object has_vtt -eq 'True').Count -eq 94) 'sources: expected 94 hasVtt'
Assert-A2 (@($sources | Where-Object has_vtt -eq 'False').Count -eq 6) 'sources: expected 6 no-VTT'
Assert-A2 (@($sources | Where-Object shared_with_a1 -eq 'True').Count -eq 4) 'sources: expected 4 sharedWithA1'

Assert-A2 ($tags.Count -eq 25) "tags: expected 25, actual $($tags.Count)"
Assert-A2 ($links.Count -eq 200) "tag links: expected 200, actual $($links.Count)"
Assert-A2 (@($links | Group-Object video_id,tag | Where-Object Count -gt 1).Count -eq 0) 'tag links are not unique'
Assert-A2 (@($links.tag | Sort-Object -Unique).Count -eq 25) 'not all 25 tags are used'
Assert-A2 (@($links | Where-Object video_id -notin @($sources | Where-Object role -eq 'CURRENT_LIBRARY').video_id).Count -eq 0) 'tag link references a non-current source'

Assert-A2 ($watch.Count -eq 80) "watch distribution: expected 80 rows, actual $($watch.Count)"
Assert-A2 (Sum-A2 $watch 'total_sessions' -eq 1000) 'watch sessions: expected 1000'
Assert-A2 (Sum-A2 $watch 'valid_sessions' -eq 780) 'watch sessions: expected 780 VALID'
Assert-A2 (Sum-A2 $watch 'invalid_sessions' -eq 220) 'watch sessions: expected 220 INVALID'
Assert-A2 (@($watch | Where-Object watched -eq 'True').Count -eq 64) 'watch distribution: expected 64 watched'
Assert-A2 (@($watch | Where-Object watched -eq 'False').Count -eq 16) 'watch distribution: expected 16 unwatched'

Assert-A2 (Sum-A2 $notes 'note_count' -eq 240) 'notes: expected 240'
Assert-A2 (Sum-A2 @($notes | Where-Object role -eq 'CURRENT_LIBRARY') 'note_count' -eq 200) 'notes: expected 200 current-source'
Assert-A2 (Sum-A2 @($notes | Where-Object role -eq 'HISTORICAL') 'note_count' -eq 40) 'notes: expected 40 historical-source'
Assert-A2 (Sum-A2 $notes 'timestamped_note_count' -eq 120) 'notes: expected 120 timestamped'
Assert-A2 (Sum-A2 $notes 'null_timestamp_note_count' -eq 120) 'notes: expected 120 NULL timestamp'
Assert-A2 (@($notes | Where-Object { [int]$_.note_count -ne [int]$_.timestamped_note_count + [int]$_.null_timestamp_note_count }).Count -eq 0) 'note per-source totals do not reconcile'
Assert-A2 (@($notes | Where-Object { $_.has_vtt -eq 'False' -and [int]$_.timestamped_note_count -ne 0 }).Count -eq 0) 'no-VTT source has timestamped Notes'

Assert-A2 (Sum-A2 $tasks 'total' -eq 400) 'tasks: expected 400'
Assert-A2 (Sum-A2 $tasks 'completed' -eq 250) 'tasks: expected 250 COMPLETED'
Assert-A2 (Sum-A2 $tasks 'not_started' -eq 85) 'tasks: expected 85 NOT_STARTED'
Assert-A2 (Sum-A2 $tasks 'in_progress' -eq 65) 'tasks: expected 65 IN_PROGRESS'
foreach ($expected in @{'HAS_SOURCE'=170;'INDEPENDENT'=190;'SOURCE_MISSING'=40}.GetEnumerator()) {
    $actual = Sum-A2 @($tasks | Where-Object source_status -eq $expected.Key) 'total'
    Assert-A2 ($actual -eq $expected.Value) "tasks: expected $($expected.Value) $($expected.Key), actual $actual"
}
foreach ($expected in @{'OVERDUE'=25;'TODAY'=8;'UPCOMING'=47;'NO_DEADLINE'=70}.GetEnumerator()) {
    $actual = Sum-A2 @($deadlines | Where-Object incomplete_bucket -eq $expected.Key) 'count'
    Assert-A2 ($actual -eq $expected.Value) "deadlines: expected $($expected.Value) $($expected.Key), actual $actual"
}

$a1Ids = @($a1Snapshot.sources.youtubeVideoId)
$actualOverlap = @($sourceIds | Where-Object { $_ -in $a1Ids } | Sort-Object)
$flaggedOverlap = @($sources | Where-Object shared_with_a1 -eq 'True' | ForEach-Object video_id | Sort-Object)
Assert-A2 ($actualOverlap.Count -eq 4) "A1 overlap: expected 4, actual $($actualOverlap.Count)"
Assert-A2 (@(Compare-Object $actualOverlap $flaggedOverlap).Count -eq 0) 'sharedWithA1 flags do not match current A1 snapshot'
foreach ($videoId in $actualOverlap) {
    $a1 = $a1Snapshot.sources | Where-Object youtubeVideoId -eq $videoId
    $a2 = $snapshot.sources | Where-Object youtubeVideoId -eq $videoId
    $delta = [Math]::Abs([int]$a1.durationSeconds - [int]$a2.durationSeconds)
    Assert-A2 ($a1.availabilityStatus -eq 'AVAILABLE' -and $a2.availabilityStatus -eq 'AVAILABLE') "shared source $videoId is not AVAILABLE"
    Assert-A2 ($delta -le 1) "shared source $videoId duration delta $delta exceeds 1 second"
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    throw "A2 artifact preflight failed with $($errors.Count) mismatch(es)."
}

$result = [pscustomobject]@{
    Sources = 100; Current = 80; Historical = 20; HasVtt = 94; NoVtt = 6
    SharedWithA1 = 4; Tags = 25; TagLinks = 200; WatchSessions = 1000
    ValidSessions = 780; InvalidSessions = 220; Notes = 240; TimestampedNotes = 120
    NullTimestampNotes = 120; Tasks = 400; Completed = 250; NotStarted = 85
    InProgress = 65; Overdue = 25; Today = 8; Upcoming = 47; NoDeadline = 70
}
if ($Quiet) { return $result }
$result | Format-List
