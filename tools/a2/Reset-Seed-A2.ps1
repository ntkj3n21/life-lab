[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$ReferenceDate = '2026-08-27',
    [string]$EnvFile,
    [string]$ArtifactDirectory,
    [string]$NoteFixturePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) { $EnvFile = Join-Path $PSScriptRoot '../../.env' }
if ([string]::IsNullOrWhiteSpace($ArtifactDirectory)) { $ArtifactDirectory = Join-Path $PSScriptRoot '../a2-spec' }
if ([string]::IsNullOrWhiteSpace($NoteFixturePath)) { $NoteFixturePath = Join-Path $PSScriptRoot 'a2-note-fixtures.tsv' }

. (Join-Path $PSScriptRoot 'A2-Database.ps1')
& (Join-Path $PSScriptRoot 'Test-A2Artifacts.ps1') -ArtifactDirectory $ArtifactDirectory -Quiet | Out-Null
if (-not (Test-Path -LiteralPath $NoteFixturePath)) {
    throw 'a2-note-fixtures.tsv is missing. Run Build-A2NoteFixtures.ps1 once before reset.'
}

$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-source-snapshot.json') | ConvertFrom-Json
$a1Snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a1/a1-source-snapshot.json') | ConvertFrom-Json
$watch = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-watch-distribution.tsv'))
$tags = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-tags-25.tsv'))
$links = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-tag-links-200.tsv'))
$taskMatrix = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-task-source-status-matrix.tsv'))
$deadlines = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-incomplete-deadline-matrix.tsv'))
$notes = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath $NoteFixturePath)

if ($notes.Count -ne 240 -or @($notes | Where-Object timestamp_seconds -ne '').Count -ne 120) {
    throw 'A2 Note fixture must contain exactly 240 rows, 120 timestamped.'
}

$builder = [System.Text.StringBuilder]::new()
[void]$builder.AppendLine(@'
CREATE TEMP TABLE a2_snapshot_sources (
 fixture_key text primary key, role text not null, library_order integer,
 youtube_video_id varchar not null unique, source_url text not null, title text not null,
 channel_name text not null, thumbnail_url text, duration_seconds integer not null,
 a2_duration_seconds integer not null, published_at timestamptz not null,
 availability_status varchar not null, shared_with_a1 boolean not null
);
CREATE TEMP TABLE a2_note_fixtures (
 fixture_key text not null, note_no integer not null, youtube_video_id varchar not null,
 content text not null, timestamp_seconds integer, vtt_track text, cue_start_seconds integer,
 primary key (fixture_key, note_no)
);
CREATE TEMP TABLE a2_watch_distribution (
 fixture_key text primary key, valid_sessions integer not null, invalid_sessions integer not null
);
CREATE TEMP TABLE a2_tags (ordinal integer primary key, name text not null);
CREATE TEMP TABLE a2_tag_links (fixture_key text not null, tag_name text not null, primary key(fixture_key, tag_name));
CREATE TEMP TABLE a2_task_matrix (source_status text primary key, completed integer, not_started integer, in_progress integer);
CREATE TEMP TABLE a2_deadline_matrix (bucket text primary key, count integer not null);
'@)

foreach ($source in $snapshot.sources) {
    $canonical = $source
    if ($source.sharedWithA1) {
        $canonical = $a1Snapshot.sources | Where-Object youtubeVideoId -eq $source.youtubeVideoId
        if ($null -eq $canonical) { throw "Shared A1 snapshot source missing: $($source.youtubeVideoId)" }
    }
    $order = if ($null -eq $source.libraryOrder) { 'NULL' } else { [int]$source.libraryOrder }
    $values = @(
        (ConvertTo-A2SqlLiteral $source.fixtureKey), (ConvertTo-A2SqlLiteral $source.role), $order,
        (ConvertTo-A2SqlLiteral $source.youtubeVideoId), (ConvertTo-A2SqlLiteral $canonical.sourceUrl),
        (ConvertTo-A2SqlLiteral $canonical.title), (ConvertTo-A2SqlLiteral $canonical.channelName),
        (ConvertTo-A2SqlLiteral $canonical.thumbnailUrl), [int]$canonical.durationSeconds,
        [int]$source.durationSeconds, (ConvertTo-A2SqlLiteral $canonical.publishedAt),
        (ConvertTo-A2SqlLiteral $canonical.availabilityStatus),
        $(if ($source.sharedWithA1) { 'true' } else { 'false' })
    )
    [void]$builder.AppendLine("INSERT INTO a2_snapshot_sources VALUES ($($values -join ', '));")
}

foreach ($note in $notes) {
    $timestamp = if ($note.timestamp_seconds -eq '') { 'NULL' } else { [int]$note.timestamp_seconds }
    $track = if ($note.vtt_track -eq '') { 'NULL' } else { ConvertTo-A2SqlLiteral $note.vtt_track }
    $cue = if ($note.cue_start_seconds -eq '') { 'NULL' } else { [int]$note.cue_start_seconds }
    [void]$builder.AppendLine("INSERT INTO a2_note_fixtures VALUES ($(ConvertTo-A2SqlLiteral $note.fixture_key), $([int]$note.note_no), $(ConvertTo-A2SqlLiteral $note.youtube_video_id), $(ConvertTo-A2SqlLiteral $note.content), $timestamp, $track, $cue);")
}
foreach ($row in $watch) { [void]$builder.AppendLine("INSERT INTO a2_watch_distribution VALUES ($(ConvertTo-A2SqlLiteral $row.fixture_key), $([int]$row.valid_sessions), $([int]$row.invalid_sessions));") }
foreach ($row in $tags) { [void]$builder.AppendLine("INSERT INTO a2_tags VALUES ($([int]$row.ordinal), $(ConvertTo-A2SqlLiteral $row.tag));") }
foreach ($row in $links) { [void]$builder.AppendLine("INSERT INTO a2_tag_links VALUES ($(ConvertTo-A2SqlLiteral $row.fixture_key), $(ConvertTo-A2SqlLiteral $row.tag));") }
foreach ($row in $taskMatrix) { [void]$builder.AppendLine("INSERT INTO a2_task_matrix VALUES ($(ConvertTo-A2SqlLiteral $row.source_status), $([int]$row.completed), $([int]$row.not_started), $([int]$row.in_progress));") }
foreach ($row in $deadlines) { [void]$builder.AppendLine("INSERT INTO a2_deadline_matrix VALUES ($(ConvertTo-A2SqlLiteral $row.incomplete_bucket), $([int]$row.count));") }

$seedSql = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'seed-a2.sql')
$temporarySql = Join-Path ([System.IO.Path]::GetTempPath()) "life-lab-a2-seed-$([guid]::NewGuid().ToString('N')).sql"
[System.IO.File]::WriteAllText($temporarySql, $builder.ToString() + "`n" + $seedSql, [System.Text.UTF8Encoding]::new($false))
$database = Get-A2DatabaseConfig -EnvFile $EnvFile
$passwordHash = '$2a$10$CtETwdyERV3JxQhKLBJPW.KvfT6IpZCSVsTvloYPUXN6QGHF4UsK2'
try {
    Invoke-A2Psql -DatabaseConfig $database -Arguments @('-q','-v', "reference_date=$ReferenceDate", '-v', "password_hash=$passwordHash", '-f', $temporarySql)
}
finally {
    if (Test-Path -LiteralPath $temporarySql) { Remove-Item -LiteralPath $temporarySql -Force }
}

Write-Host 'A2 reset + seed completed.'
Write-Host "REFERENCE_DATE: $ReferenceDate"
Write-Host 'Business timezone: Asia/Ho_Chi_Minh'
Write-Host 'Deterministic seed: 20260827'
