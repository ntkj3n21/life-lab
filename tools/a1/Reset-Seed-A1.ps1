[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string]$ReferenceDate = '2026-08-27',
    [string]$EnvFile,
    [string]$SnapshotPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}
if ([string]::IsNullOrWhiteSpace($SnapshotPath)) {
    $SnapshotPath = Join-Path $PSScriptRoot 'a1-source-snapshot.json'
}

. (Join-Path $PSScriptRoot 'A1-Database.ps1')

$DeterministicSeed = 20260827
$DemoPasswordHash = '$2a$10$CtETwdyERV3JxQhKLBJPW.KvfT6IpZCSVsTvloYPUXN6QGHF4UsK2'

$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath $SnapshotPath | ConvertFrom-Json
$sources = @($snapshot.sources)
$currentSources = @($sources | Where-Object role -eq 'CURRENT_LIBRARY')
$historicalSources = @($sources | Where-Object role -eq 'HISTORICAL_H1')

if ([int]$snapshot.schemaVersion -ne 1 -or
    $sources.Count -ne 37 -or
    $currentSources.Count -ne 36 -or
    $historicalSources.Count -ne 1 -or
    $historicalSources[0].youtubeVideoId -ne '-XsRLyKV9_k' -or
    @($sources.youtubeVideoId | Group-Object | Where-Object Count -gt 1).Count -ne 0) {
    throw 'A1 snapshot must contain exactly 36 current sources and the locked H1 source.'
}

foreach ($source in $sources) {
    if ($source.availabilityStatus -ne 'AVAILABLE' -or
        [int]$source.durationSeconds -le 0 -or
        [string]::IsNullOrWhiteSpace($source.title) -or
        [string]::IsNullOrWhiteSpace($source.channelName)) {
        throw "A1 snapshot source '$($source.fixtureKey)' is incomplete or unavailable."
    }
}

$prelude = [System.Text.StringBuilder]::new()
$noteFixturesPath = Join-Path $PSScriptRoot 'a1-note-fixtures.json'
$taskFixturesPath = Join-Path $PSScriptRoot 'a1-task-fixtures.json'
$imageFixturesPath = Join-Path $PSScriptRoot 'a1-image-fixtures.json'
$imageMediaPath = Join-Path $PSScriptRoot 'media/images'
$audioFixturesPath = Join-Path $PSScriptRoot 'a1-audio-fixtures.json'
$audioMediaPath = Join-Path $PSScriptRoot 'media/audio'

if (-not (Test-Path -LiteralPath $imageFixturesPath)) {
    throw 'A1 image fixture specification is missing.'
}

if (-not (Test-Path -LiteralPath $imageMediaPath)) {
    throw 'A1 image media directory is missing.'
}

$imageFixtures = @(
    (Get-Content -Raw -Encoding UTF8 -LiteralPath $imageFixturesPath | ConvertFrom-Json) |
        ForEach-Object { $_ }
)

if ($imageFixtures.Count -ne 14) {
    throw 'A1 image fixture count must be exactly 14.'
}

foreach ($fixture in $imageFixtures) {
    $sourcePath = Join-Path $imageMediaPath $fixture.fileName

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "A1 image fixture file is missing: $($fixture.fileName)"
    }
}

if (-not (Test-Path -LiteralPath $audioFixturesPath)) {
    throw 'A1 audio fixture specification is missing.'
}

if (-not (Test-Path -LiteralPath $audioMediaPath)) {
    throw 'A1 audio media directory is missing.'
}

$audioFixtures = @(
    (Get-Content -Raw -Encoding UTF8 -LiteralPath $audioFixturesPath |
        ConvertFrom-Json) |
        ForEach-Object { $_ }
)

if ($audioFixtures.Count -ne 13) {
    throw 'A1 audio fixture count must be exactly 13.'
}

$audioTaskFixtures = @(
    $audioFixtures |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_.taskTitle)
    }
)

$audioNoteOnlyFixtures = @(
    $audioFixtures |
    Where-Object {
        [string]::IsNullOrWhiteSpace($_.taskTitle)
    }
)

if ($audioTaskFixtures.Count -ne 9 -or
    $audioNoteOnlyFixtures.Count -ne 4) {
    throw 'A1 audio fixture distribution must be 9 tasks / 4 note-only.'
}

$expectedAudioNumbers = 1..13
$actualAudioNumbers = @(
    $audioFixtures |
    ForEach-Object { [int]$_.audioNo } |
    Sort-Object
)

if (($actualAudioNumbers -join ',') -ne
    ($expectedAudioNumbers -join ',')) {
    throw 'A1 audio fixture numbers must be exactly 1 through 13.'
}

if (@(
    $audioFixtures |
    Group-Object fileName |
    Where-Object Count -ne 1
).Count -ne 0) {
    throw 'A1 audio fixture filenames must be unique.'
}

foreach ($fixture in $audioFixtures) {
    $sourcePath =
        Join-Path $audioMediaPath $fixture.fileName

    if (-not (
        Test-Path `
            -LiteralPath $sourcePath `
            -PathType Leaf
    )) {
        throw "A1 audio fixture file is missing: $($fixture.fileName)"
    }

    $extension =
        [System.IO.Path]::GetExtension(
            $fixture.fileName
        ).ToLowerInvariant()

    if ($extension -ne '.mp3') {
        throw "Unsupported A1 audio extension: $extension"
    }

    if ([int]$fixture.timestampSeconds -lt 0) {
        throw "A1 audio timestamp must not be negative: $($fixture.fileName)"
    }

    if ([string]::IsNullOrWhiteSpace($fixture.title) -or
        [string]::IsNullOrWhiteSpace($fixture.noteContent) -or
        [string]::IsNullOrWhiteSpace($fixture.category)) {
        throw "A1 audio fixture is incomplete: $($fixture.fileName)"
    }
}

if (-not (Test-Path -LiteralPath $noteFixturesPath) -or -not (Test-Path -LiteralPath $taskFixturesPath)) {
    throw 'Durable semantic fixtures are missing. Run Build-A1SemanticFixtures.ps1 first.'
}
$noteFixtureJson = Get-Content -Raw -Encoding UTF8 -LiteralPath $noteFixturesPath
$taskFixtureJson = Get-Content -Raw -Encoding UTF8 -LiteralPath $taskFixturesPath
$noteFixtures = @((ConvertFrom-Json -InputObject $noteFixtureJson) | ForEach-Object { $_ })
$taskFixtures = @((ConvertFrom-Json -InputObject $taskFixtureJson) | ForEach-Object { $_ })
Write-Verbose "Semantic fixture counts: notes=$($noteFixtures.Count), tasks=$($taskFixtures.Count)"
if ($noteFixtures.Count -ne 96 -or $taskFixtures.Count -ne 125) { throw 'A1 semantic fixture counts must be 96 notes and 125 tasks.' }
[void]$prelude.AppendLine(@'
CREATE TEMP TABLE a1_note_fixtures (
    note_key TEXT PRIMARY KEY,
    source_fixture_key TEXT NOT NULL,
    note_no INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp_seconds INTEGER,
    evidence_type TEXT NOT NULL,
    vtt_track TEXT,
    cue_start_seconds INTEGER,
    evidence_text TEXT,
    note_sequence INTEGER NOT NULL
);
CREATE TEMP TABLE a1_task_fixtures (
    task_key TEXT PRIMARY KEY,
    source_status TEXT NOT NULL,
    note_key TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    deadline_class TEXT,
    sequence_no INTEGER NOT NULL
);
'@)
for ($i = 0; $i -lt $noteFixtures.Count; $i++) {
    $f = $noteFixtures[$i]
    $values = @((ConvertTo-A1SqlLiteral $f.noteKey),(ConvertTo-A1SqlLiteral $f.sourceFixtureKey),[int]$f.noteNo,(ConvertTo-A1SqlLiteral $f.content),$(if ($null -eq $f.timestampSeconds) {'NULL'} else {[int]$f.timestampSeconds}),(ConvertTo-A1SqlLiteral $f.evidenceType),(ConvertTo-A1SqlLiteral $f.vttTrack),$(if ($null -eq $f.cueStartSeconds) {'NULL'} else {[int]$f.cueStartSeconds}),(ConvertTo-A1SqlLiteral $f.evidenceText),($i+1))
    [void]$prelude.AppendLine("INSERT INTO a1_note_fixtures VALUES ($($values -join ', '));")
}
for ($i = 0; $i -lt $taskFixtures.Count; $i++) {
    $f = $taskFixtures[$i]
    $values = @((ConvertTo-A1SqlLiteral $f.taskKey),(ConvertTo-A1SqlLiteral $f.sourceStatus),(ConvertTo-A1SqlLiteral $f.noteKey),(ConvertTo-A1SqlLiteral $f.title),(ConvertTo-A1SqlLiteral $f.description),(ConvertTo-A1SqlLiteral $f.status),(ConvertTo-A1SqlLiteral $f.deadlineClass),($i+1))
    [void]$prelude.AppendLine("INSERT INTO a1_task_fixtures VALUES ($($values -join ', '));")
}

[void]$prelude.AppendLine(@'
CREATE TEMP TABLE a1_snapshot_sources (
    fixture_key TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    library_order INTEGER,
    youtube_video_id VARCHAR NOT NULL UNIQUE,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    availability_status VARCHAR NOT NULL
);
'@)

foreach ($source in $sources) {
    $libraryOrder = if ($null -eq $source.libraryOrder) { 'NULL' } else { [int]$source.libraryOrder }
    $values = @(
        (ConvertTo-A1SqlLiteral $source.fixtureKey),
        (ConvertTo-A1SqlLiteral $source.role),
        $libraryOrder,
        (ConvertTo-A1SqlLiteral $source.youtubeVideoId),
        (ConvertTo-A1SqlLiteral $source.sourceUrl),
        (ConvertTo-A1SqlLiteral $source.title),
        (ConvertTo-A1SqlLiteral $source.channelName),
        (ConvertTo-A1SqlLiteral $source.thumbnailUrl),
        [int]$source.durationSeconds,
        (ConvertTo-A1SqlLiteral $source.publishedAt),
        (ConvertTo-A1SqlLiteral $source.availabilityStatus)
    )

    [void]$prelude.AppendLine(
        "INSERT INTO a1_snapshot_sources VALUES ($($values -join ', '));")
}

[void]$prelude.AppendLine(@'
CREATE TEMP TABLE a1_image_fixtures (
    image_no INTEGER PRIMARY KEY,
    file_name TEXT NOT NULL,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    note_content TEXT NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    tags_json TEXT NOT NULL,
    task_title VARCHAR(255),
    task_status VARCHAR,
    deadline_class TEXT,
    media_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL
);
'@)

for ($i = 0; $i -lt $imageFixtures.Count; $i++) {
    $fixture = $imageFixtures[$i]
    $imageNo = $i + 1

    $sourcePath = Join-Path $imageMediaPath $fixture.fileName

    $extension =
        [System.IO.Path]::GetExtension($fixture.fileName).ToLowerInvariant()

    $mediaType = switch ($extension) {
        '.jpg'  { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.png'  { 'image/png' }
        '.webp' { 'image/webp' }
        default {
            throw "Unsupported A1 image extension: $extension"
        }
    }

    $storageExtension =
        if ($extension -eq '.jpeg') {
            '.jpg'
        }
        else {
            $extension
        }

    $storageKey =
        "a1-image-{0:D2}{1}" -f $imageNo, $storageExtension

    $sizeBytes =
        (Get-Item -LiteralPath $sourcePath).Length

    $tagsJson =
        ConvertTo-Json `
            -InputObject @($fixture.tags) `
            -Compress

    $values = @(
        $imageNo
        (ConvertTo-A1SqlLiteral $fixture.fileName)
        (ConvertTo-A1SqlLiteral $storageKey)
        (ConvertTo-A1SqlLiteral $fixture.title)
        (ConvertTo-A1SqlLiteral $fixture.note)
        (ConvertTo-A1SqlLiteral $fixture.category)
        (ConvertTo-A1SqlLiteral $tagsJson)
        (ConvertTo-A1SqlLiteral $fixture.taskTitle)
        (ConvertTo-A1SqlLiteral $fixture.taskStatus)
        (ConvertTo-A1SqlLiteral $fixture.deadlineClass)
        (ConvertTo-A1SqlLiteral $mediaType)
        $sizeBytes
    )

    [void]$prelude.AppendLine(
        "INSERT INTO a1_image_fixtures VALUES ($($values -join ', '));"
    )
}

Write-Verbose "A1 image fixtures: $($imageFixtures.Count)"

[void]$prelude.AppendLine(@'
CREATE TEMP TABLE a1_audio_fixtures (
    audio_no INTEGER PRIMARY KEY,
    file_name TEXT NOT NULL,
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    note_content TEXT NOT NULL,
    timestamp_seconds INTEGER NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    tags_json TEXT NOT NULL,
    task_title VARCHAR(255),
    task_status VARCHAR,
    deadline_class TEXT,
    media_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL
);
'@)

foreach ($fixture in $audioFixtures) {
    $audioNo = [int]$fixture.audioNo

    $sourcePath =
        Join-Path $audioMediaPath $fixture.fileName

    $storageKey =
        "a1-audio-{0:D2}.mp3" -f $audioNo

    $sizeBytes =
        (Get-Item -LiteralPath $sourcePath).Length

    $tagsJson =
        ConvertTo-Json `
            -InputObject @($fixture.tags) `
            -Compress

    $timestampSeconds =
        [int]$fixture.timestampSeconds

    $values = @(
        $audioNo
        (ConvertTo-A1SqlLiteral $fixture.fileName)
        (ConvertTo-A1SqlLiteral $storageKey)
        (ConvertTo-A1SqlLiteral $fixture.fileName)
        (ConvertTo-A1SqlLiteral $fixture.title)
        (ConvertTo-A1SqlLiteral $fixture.sourceUrl)
        (ConvertTo-A1SqlLiteral $fixture.noteContent)
        $timestampSeconds
        (ConvertTo-A1SqlLiteral $fixture.category)
        (ConvertTo-A1SqlLiteral $tagsJson)
        (ConvertTo-A1SqlLiteral $fixture.taskTitle)
        (ConvertTo-A1SqlLiteral $fixture.taskStatus)
        (ConvertTo-A1SqlLiteral $fixture.deadlineClass)
        (ConvertTo-A1SqlLiteral 'audio/mpeg')
        $sizeBytes
    )

    [void]$prelude.AppendLine(
        "INSERT INTO a1_audio_fixtures VALUES ($($values -join ', '));"
    )
}

Write-Verbose "A1 audio fixtures: $($audioFixtures.Count)"

$seedSql = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'seed-a1.sql')
$combinedSql = $prelude.ToString() + [Environment]::NewLine + $seedSql
$temporarySql = Join-Path ([System.IO.Path]::GetTempPath()) "life-lab-a1-seed-$([guid]::NewGuid().ToString('N')).sql"
[System.IO.File]::WriteAllText(
    $temporarySql,
    $combinedSql,
    [System.Text.UTF8Encoding]::new($false))

$repositoryRoot = (
    Resolve-Path (Join-Path $PSScriptRoot '../..')
).Path

$imageStoragePath = Join-Path $repositoryRoot 'backend/data/images'

New-Item `
    -ItemType Directory `
    -Force `
    -Path $imageStoragePath |
    Out-Null

for ($i = 0; $i -lt $imageFixtures.Count; $i++) {
    $fixture = $imageFixtures[$i]

    $sourcePath = Join-Path $imageMediaPath $fixture.fileName

    $extension = [System.IO.Path]::GetExtension($fixture.fileName).ToLowerInvariant()

    if ($extension -eq '.jpeg') {
        $extension = '.jpg'
    }

    $storageKey = "a1-image-{0:D2}{1}" -f ($i + 1), $extension
    $destinationPath = Join-Path $imageStoragePath $storageKey

    Copy-Item `
        -LiteralPath $sourcePath `
        -Destination $destinationPath `
        -Force
}

$audioStoragePath =
    Join-Path $repositoryRoot 'backend/data/audio'

New-Item `
    -ItemType Directory `
    -Force `
    -Path $audioStoragePath |
    Out-Null

foreach ($fixture in $audioFixtures) {
    $audioNo = [int]$fixture.audioNo

    $sourcePath =
        Join-Path $audioMediaPath $fixture.fileName

    $storageKey =
        "a1-audio-{0:D2}.mp3" -f $audioNo

    $destinationPath =
        Join-Path $audioStoragePath $storageKey

    Copy-Item `
        -LiteralPath $sourcePath `
        -Destination $destinationPath `
        -Force
}

$databaseConfig = Get-A1DatabaseConfig -EnvFile $EnvFile

try {
    Invoke-A1Psql -DatabaseConfig $databaseConfig -Arguments @(
        '-v', "reference_date=$ReferenceDate",
        '-v', "deterministic_seed=$DeterministicSeed",
        '-v', "password_hash=$DemoPasswordHash",
        '-f', $temporarySql
    )
}
finally {
    if (Test-Path -LiteralPath $temporarySql) {
        Remove-Item -LiteralPath $temporarySql -Force
    }
}

Write-Host "A1 reset + seed completed."
Write-Host "REFERENCE_DATE: $ReferenceDate"
Write-Host "Business timezone: Asia/Ho_Chi_Minh"
Write-Host "Deterministic seed: $DeterministicSeed"
