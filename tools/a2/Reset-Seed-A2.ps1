[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$ReferenceDate = '2026-08-27',
    [string]$EnvFile,
    [string]$ArtifactDirectory,
    [string]$NoteFixturePath,
    [string]$ImageFixturePath,
    [string]$AudioFixturePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) { $EnvFile = Join-Path $PSScriptRoot '../../.env' }
if ([string]::IsNullOrWhiteSpace($ArtifactDirectory)) { $ArtifactDirectory = Join-Path $PSScriptRoot '../a2-spec' }
if ([string]::IsNullOrWhiteSpace($NoteFixturePath)) { $NoteFixturePath = Join-Path $PSScriptRoot 'a2-note-fixtures.tsv' }
if ([string]::IsNullOrWhiteSpace($ImageFixturePath)) {
    $ImageFixturePath =
    Join-Path $PSScriptRoot 'a2-image-fixtures.json'
}
if ([string]::IsNullOrWhiteSpace($AudioFixturePath)) {
    $AudioFixturePath =
    Join-Path $PSScriptRoot 'a2-audio-fixtures.json'
}

. (Join-Path $PSScriptRoot 'A2-Database.ps1')
& (Join-Path $PSScriptRoot 'Test-A2Artifacts.ps1') -ArtifactDirectory $ArtifactDirectory -Quiet | Out-Null
if (-not (Test-Path -LiteralPath $NoteFixturePath)) {
    throw 'a2-note-fixtures.tsv is missing. Run Build-A2NoteFixtures.ps1 once before reset.'
}

if (-not (Test-Path -LiteralPath $ImageFixturePath -PathType Leaf)) {
    throw 'a2-image-fixtures.json is missing.'
}

$imageFixtures = @(
    (
        Get-Content `
            -Raw `
            -Encoding UTF8 `
            -LiteralPath $ImageFixturePath |
        ConvertFrom-Json
    ) |
    ForEach-Object { $_ }
)

$imageTaskCount = @(
    $imageFixtures |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_.taskTitle)
    }
).Count

$imageNoteOnlyCount = @(
    $imageFixtures |
    Where-Object {
        [string]::IsNullOrWhiteSpace($_.taskTitle)
    }
).Count

$imageCategories = @(
    $imageFixtures.category |
    Sort-Object -Unique
)

$imageTags = @(
    $imageFixtures |
    ForEach-Object { @($_.tags) } |
    Sort-Object -Unique
)

if (
    $imageFixtures.Count -ne 20 -or
    $imageTaskCount -ne 13 -or
    $imageNoteOnlyCount -ne 7 -or
    $imageCategories.Count -ne 6 -or
    $imageTags.Count -ne 26
) {
    throw 'A2 Image fixture inventory must be 20 images / 13 tasks / 7 note-only / 6 categories / 26 tags.'
}

if (
    @($imageFixtures.fixtureKey | Sort-Object -Unique).Count -ne 20 -or
    @($imageFixtures.title | Sort-Object -Unique).Count -ne 20 -or
    @($imageFixtures.url | Sort-Object -Unique).Count -ne 20
) {
    throw 'A2 Image fixture keys, titles and URLs must be unique.'
}

foreach ($fixture in $imageFixtures) {
    if (
        [string]::IsNullOrWhiteSpace($fixture.fixtureKey) -or
        [string]::IsNullOrWhiteSpace($fixture.title) -or
        [string]::IsNullOrWhiteSpace($fixture.url) -or
        [string]::IsNullOrWhiteSpace($fixture.sourcePage) -or
        [string]::IsNullOrWhiteSpace($fixture.note) -or
        [string]::IsNullOrWhiteSpace($fixture.category) -or
        @($fixture.tags).Count -eq 0
    ) {
        throw "Incomplete A2 Image fixture: $($fixture.fixtureKey)"
    }

    if ($fixture.url -like '*Special:Redirect*') {
        throw "A2 Image fixture must use canonical URL: $($fixture.fixtureKey)"
    }

    $hasTask =
    -not [string]::IsNullOrWhiteSpace($fixture.taskTitle)

    if ($hasTask) {
        if (
            $fixture.taskStatus -notin @(
                'NOT_STARTED',
                'IN_PROGRESS',
                'COMPLETED'
            ) -or
            $fixture.deadlineClass -notin @(
                'OVERDUE',
                'TODAY',
                'UPCOMING',
                'NO_DEADLINE'
            )
        ) {
            throw "Invalid A2 Image task fixture: $($fixture.fixtureKey)"
        }
    }
    elseif (
        $null -ne $fixture.taskStatus -or
        $null -ne $fixture.deadlineClass
    ) {
        throw "A2 Image note-only fixture has task metadata: $($fixture.fixtureKey)"
    }
}

if (-not (Test-Path -LiteralPath $AudioFixturePath -PathType Leaf)) {
    throw 'a2-audio-fixtures.json is missing.'
}

$parsedAudioFixtures =
Get-Content `
    -Raw `
    -Encoding UTF8 `
    -LiteralPath $AudioFixturePath |
ConvertFrom-Json

$audioFixtures = @(
    $parsedAudioFixtures |
    ForEach-Object { $_ }
)

$audioTaskCount = @(
    $audioFixtures |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_.taskTitle)
    }
).Count

$audioNoteOnlyCount = @(
    $audioFixtures |
    Where-Object {
        [string]::IsNullOrWhiteSpace($_.taskTitle)
    }
).Count

$audioTimestampZeroCount = @(
    $audioFixtures |
    Where-Object {
        [int]$_.timestampSeconds -eq 0
    }
).Count

$audioTimestampPositiveCount = @(
    $audioFixtures |
    Where-Object {
        [int]$_.timestampSeconds -gt 0
    }
).Count

$audioCategories = @(
    $audioFixtures.category |
    Sort-Object -Unique
)

$audioTags = @(
    $audioFixtures |
    ForEach-Object { @($_.tags) } |
    Sort-Object -Unique
)

if (
    $audioFixtures.Count -ne 8 -or
    $audioTaskCount -ne 5 -or
    $audioNoteOnlyCount -ne 3 -or
    $audioTimestampZeroCount -ne 3 -or
    $audioTimestampPositiveCount -ne 5 -or
    $audioCategories.Count -ne 4 -or
    $audioTags.Count -ne 8
) {
    throw 'A2 Audio fixture inventory must be 8 audio / 5 tasks / 3 note-only / 3 timestamp-zero / 5 timestamp-positive / 4 categories / 8 tags.'
}

if (
    @(
        $audioFixtures.fixtureKey |
        Sort-Object -Unique
    ).Count -ne 8 -or
    @(
        $audioFixtures.title |
        Sort-Object -Unique
    ).Count -ne 8 -or
    @(
        $audioFixtures.url |
        Sort-Object -Unique
    ).Count -ne 8
) {
    throw 'A2 Audio fixture keys, titles and URLs must be unique.'
}

foreach ($fixture in $audioFixtures) {
    if (
        [string]::IsNullOrWhiteSpace($fixture.fixtureKey) -or
        [string]::IsNullOrWhiteSpace($fixture.title) -or
        [string]::IsNullOrWhiteSpace($fixture.url) -or
        [string]::IsNullOrWhiteSpace($fixture.sourcePage) -or
        [string]::IsNullOrWhiteSpace($fixture.note) -or
        [string]::IsNullOrWhiteSpace($fixture.category) -or
        @($fixture.tags).Count -eq 0
    ) {
        throw "Incomplete A2 Audio fixture: $($fixture.fixtureKey)"
    }

    if (
        -not $fixture.url.StartsWith(
            'https://',
            [System.StringComparison]::OrdinalIgnoreCase
        )
    ) {
        throw "A2 Audio fixture must use HTTPS: $($fixture.fixtureKey)"
    }

    if ([int]$fixture.timestampSeconds -lt 0) {
        throw "Negative A2 Audio timestamp: $($fixture.fixtureKey)"
    }

    $hasTask =
    -not [string]::IsNullOrWhiteSpace($fixture.taskTitle)

    if ($hasTask) {
        if (
            $fixture.taskStatus -notin @(
                'NOT_STARTED',
                'IN_PROGRESS',
                'COMPLETED'
            ) -or
            $fixture.deadlineClass -notin @(
                'OVERDUE',
                'TODAY',
                'UPCOMING',
                'NO_DEADLINE'
            )
        ) {
            throw "Invalid A2 Audio task fixture: $($fixture.fixtureKey)"
        }
    }
    elseif (
        $null -ne $fixture.taskStatus -or
        $null -ne $fixture.deadlineClass
    ) {
        throw "A2 Audio note-only fixture has task metadata: $($fixture.fixtureKey)"
    }
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
CREATE TEMP TABLE a2_image_fixtures (
    fixture_key TEXT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    external_url TEXT NOT NULL UNIQUE,
    source_page TEXT NOT NULL,
    note_content TEXT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    tags_json TEXT NOT NULL,
    task_title VARCHAR(255),
    task_status VARCHAR,
    deadline_class TEXT
);
CREATE TEMP TABLE a2_audio_fixtures (
    fixture_key TEXT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    external_url TEXT NOT NULL UNIQUE,
    source_page TEXT NOT NULL,
    note_content TEXT NOT NULL,
    timestamp_seconds INTEGER NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    tags_json TEXT NOT NULL,
    task_title VARCHAR(255),
    task_status VARCHAR,
    deadline_class TEXT
);
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
foreach ($fixture in $imageFixtures) {
    $tagsJson = @($fixture.tags) |
    ConvertTo-Json -Compress

    $taskTitle =
    if ([string]::IsNullOrWhiteSpace($fixture.taskTitle)) {
        'NULL'
    }
    else {
        ConvertTo-A2SqlLiteral $fixture.taskTitle
    }

    $taskStatus =
    if ([string]::IsNullOrWhiteSpace($fixture.taskStatus)) {
        'NULL'
    }
    else {
        ConvertTo-A2SqlLiteral $fixture.taskStatus
    }

    $deadlineClass =
    if ([string]::IsNullOrWhiteSpace($fixture.deadlineClass)) {
        'NULL'
    }
    else {
        ConvertTo-A2SqlLiteral $fixture.deadlineClass
    }

    $values = @(
        (ConvertTo-A2SqlLiteral $fixture.fixtureKey),
        (ConvertTo-A2SqlLiteral $fixture.title),
        (ConvertTo-A2SqlLiteral $fixture.url),
        (ConvertTo-A2SqlLiteral $fixture.sourcePage),
        (ConvertTo-A2SqlLiteral $fixture.note),
        (ConvertTo-A2SqlLiteral $fixture.category),
        (ConvertTo-A2SqlLiteral $tagsJson),
        $taskTitle,
        $taskStatus,
        $deadlineClass
    )

    [void]$builder.AppendLine(
        "INSERT INTO a2_image_fixtures VALUES ($($values -join ', '));"
    )
}

Write-Verbose "A2 image fixtures: $($imageFixtures.Count)"

foreach ($fixture in $audioFixtures) {
    $tagsJson =
    @($fixture.tags) |
    ConvertTo-Json -Compress

    $taskTitle =
    if ([string]::IsNullOrWhiteSpace($fixture.taskTitle)) {
        'NULL'
    }
    else {
        ConvertTo-A2SqlLiteral $fixture.taskTitle
    }

    $taskStatus =
    if ([string]::IsNullOrWhiteSpace($fixture.taskStatus)) {
        'NULL'
    }
    else {
        ConvertTo-A2SqlLiteral $fixture.taskStatus
    }

    $deadlineClass =
    if ([string]::IsNullOrWhiteSpace($fixture.deadlineClass)) {
        'NULL'
    }
    else {
        ConvertTo-A2SqlLiteral $fixture.deadlineClass
    }

    $values = @(
        (ConvertTo-A2SqlLiteral $fixture.fixtureKey),
        (ConvertTo-A2SqlLiteral $fixture.title),
        (ConvertTo-A2SqlLiteral $fixture.url),
        (ConvertTo-A2SqlLiteral $fixture.sourcePage),
        (ConvertTo-A2SqlLiteral $fixture.note),
        ([int]$fixture.timestampSeconds),
        (ConvertTo-A2SqlLiteral $fixture.category),
        (ConvertTo-A2SqlLiteral $tagsJson),
        $taskTitle,
        $taskStatus,
        $deadlineClass
    )

    [void]$builder.AppendLine(
        "INSERT INTO a2_audio_fixtures VALUES ($($values -join ', '));"
    )
}

Write-Verbose "A2 audio fixtures: $($audioFixtures.Count)"

$seedSql = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'seed-a2.sql')
$temporarySql = Join-Path ([System.IO.Path]::GetTempPath()) "life-lab-a2-seed-$([guid]::NewGuid().ToString('N')).sql"
[System.IO.File]::WriteAllText($temporarySql, $builder.ToString() + "`n" + $seedSql, [System.Text.UTF8Encoding]::new($false))
$database = Get-A2DatabaseConfig -EnvFile $EnvFile
$passwordHash = '$2a$10$CtETwdyERV3JxQhKLBJPW.KvfT6IpZCSVsTvloYPUXN6QGHF4UsK2'
try {
    Invoke-A2Psql -DatabaseConfig $database -Arguments @('-q', '-v', "reference_date=$ReferenceDate", '-v', "password_hash=$passwordHash", '-f', $temporarySql)
}
finally {
    if (Test-Path -LiteralPath $temporarySql) { Remove-Item -LiteralPath $temporarySql -Force }
}

Write-Host 'A2 reset + seed completed.'
Write-Host "REFERENCE_DATE: $ReferenceDate"
Write-Host 'Business timezone: Asia/Ho_Chi_Minh'
Write-Host 'Deterministic seed: 20260827'
