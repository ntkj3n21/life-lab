Set-StrictMode -Version Latest

function Get-DemoJson([string]$Name) {
    @(Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot $Name) |
        ConvertFrom-Json)
}

function Get-DemoSourceManifests {
    $images = Get-DemoJson 'demo-image-fixtures.json'
    $audio = Get-DemoJson 'demo-audio-fixtures.json'
    if ($images.Count -ne 16 -or $audio.Count -ne 9) {
        throw 'Demo external media manifests must contain 16 Images and 9 Audio items.'
    }
    $all = @($images) + @($audio)
    if (@($all | Group-Object fixtureKey | Where-Object Count -gt 1).Count -gt 0 -or
        @($all | Group-Object url | Where-Object Count -gt 1).Count -gt 0) {
        throw 'Demo external media fixture keys and URLs must be unique.'
    }
    foreach ($item in $all) {
        if ($item.url -notmatch '^https://' -or $item.sourcePage -notmatch '^https://' -or
            [string]::IsNullOrWhiteSpace($item.title) -or
            [string]::IsNullOrWhiteSpace($item.note) -or
            [string]::IsNullOrWhiteSpace($item.category) -or
            @($item.tags).Count -lt 1) {
            throw "Incomplete Demo external fixture: $($item.fixtureKey)"
        }
    }
    [pscustomobject]@{ Images = $images; Audio = $audio }
}

function Get-DemoStories([pscustomobject]$Media) {
    $stories = Get-DemoJson 'demo-showcase-stories.json'
    if ($stories.Count -lt 12 -or
        @($stories | Group-Object storyKey | Where-Object Count -gt 1).Count -gt 0) {
        throw 'Demo needs at least 12 unique showcase story keys.'
    }

    $a1Snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a1/a1-source-snapshot.json') | ConvertFrom-Json
    $a1Videos = @($a1Snapshot.sources)
    $a1VideoNotes = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a1/a1-note-fixtures.json') | ConvertFrom-Json
    $a1VideoTasks = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a1/a1-task-fixtures.json') | ConvertFrom-Json
    $a1Images = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a1/a1-image-fixtures.json') | ConvertFrom-Json
    $a1Audio = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a1/a1-audio-fixtures.json') | ConvertFrom-Json
    $a2Images = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a2/a2-image-fixtures.json') | ConvertFrom-Json
    $a2Audio = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot '../a2/a2-audio-fixtures.json') | ConvertFrom-Json

    $resolved = foreach ($story in $stories) {
        $fixtureKey = [string]$story.sourceFixtureKey
        $identity = $null
        $content = $null
        $timestamp = $null
        $taskTitle = $null
        if ($story.sourceType -eq 'YOUTUBE') {
            $source = @($a1Videos | Where-Object fixtureKey -eq $fixtureKey)
            $note = @($a1VideoNotes | Where-Object {
                $_.sourceFixtureKey -eq $fixtureKey -and $_.noteNo -eq 1
            })
            if ($source.Count -ne 1 -or $note.Count -ne 1) {
                throw "Missing A1 Video story evidence: $fixtureKey"
            }
            $identity = $source[0].youtubeVideoId
            $content = $note[0].content
            $timestamp = $note[0].timestampSeconds
            $noteKey = $note[0].noteKey
            $task = @($a1VideoTasks | Where-Object {
                $_.PSObject.Properties['noteKey'] -and $_.noteKey -eq $noteKey
            } | Select-Object -First 1)
            if ($task.Count -eq 1) { $taskTitle = $task[0].title }
        }
        elseif ($fixtureKey -match '^A1-IMG-(\d{3})$') {
            $number = [int]$Matches[1]
            $fixture = $a1Images[$number - 1]
            $extension = [IO.Path]::GetExtension($fixture.fileName).ToLowerInvariant()
            if ($extension -eq '.jpeg') { $extension = '.jpg' }
            $identity = 'a1-image-{0:D2}{1}' -f $number, $extension
            $content = $fixture.note
            $taskTitle = $fixture.taskTitle
        }
        elseif ($fixtureKey -match '^A1-AUD-(\d{3})$') {
            $number = [int]$Matches[1]
            $fixture = $a1Audio[$number - 1]
            $identity = 'a1-audio-{0:D2}.mp3' -f $number
            $content = $fixture.noteContent
            $timestamp = $fixture.timestampSeconds
            $taskTitle = $fixture.taskTitle
        }
        elseif ($fixtureKey -like 'A2-IMG-*') {
            $fixture = @($a2Images | Where-Object fixtureKey -eq $fixtureKey)
            if ($fixture.Count -ne 1) { throw "Missing A2 Image: $fixtureKey" }
            $identity = $fixture[0].url
            $content = $fixture[0].note
            $taskTitle = $fixture[0].taskTitle
        }
        elseif ($fixtureKey -like 'A2-AUD-*') {
            $fixture = @($a2Audio | Where-Object fixtureKey -eq $fixtureKey)
            if ($fixture.Count -ne 1) { throw "Missing A2 Audio: $fixtureKey" }
            $identity = $fixture[0].url
            $content = $fixture[0].note
            $timestamp = $fixture[0].timestampSeconds
            $taskTitle = $fixture[0].taskTitle
        }
        elseif ($fixtureKey -like 'DEMO-IMG-*') {
            $fixture = @($Media.Images | Where-Object fixtureKey -eq $fixtureKey)
            if ($fixture.Count -ne 1) { throw "Missing Demo Image: $fixtureKey" }
            $identity = $fixture[0].url
            $content = $fixture[0].note
            $taskTitle = $fixture[0].taskTitle
        }
        elseif ($fixtureKey -like 'DEMO-AUD-*') {
            $fixture = @($Media.Audio | Where-Object fixtureKey -eq $fixtureKey)
            if ($fixture.Count -ne 1) { throw "Missing Demo Audio: $fixtureKey" }
            $identity = $fixture[0].url
            $content = $fixture[0].note
            $taskTitle = $fixture[0].taskTitle
        }
        else { throw "Unsupported story source: $fixtureKey" }

        if ($story.PSObject.Properties['taskTitle'] -and
            -not [string]::IsNullOrWhiteSpace($story.taskTitle)) {
            $taskTitle = $story.taskTitle
        }
        if ([string]::IsNullOrWhiteSpace($identity) -or
            [string]::IsNullOrWhiteSpace($content) -or
            [string]::IsNullOrWhiteSpace($taskTitle)) {
            throw "Incomplete showcase story: $($story.storyKey)"
        }
        [pscustomobject]@{
            storyKey = $story.storyKey
            sourceType = $story.sourceType
            sourceIdentity = $identity
            sourceFixtureKey = $fixtureKey
            note = $content
            timestampSeconds = $timestamp
            taskTitle = $taskTitle
            taskStatus = $story.taskStatus
            deadlineClass = $story.deadlineClass
            category = $story.category
            tags = @($story.tags)
        }
    }
    return @($resolved)
}

function Get-DemoPrelude([pscustomobject]$Media, [object[]]$Stories) {
    $imageJson = ConvertTo-Json -InputObject @($Media.Images) -Depth 10 -Compress
    $audioJson = ConvertTo-Json -InputObject @($Media.Audio) -Depth 10 -Compress
    $storyJson = if ($null -eq $Stories -or @($Stories).Count -eq 0) { '[]' }
        else { ConvertTo-Json -InputObject @($Stories) -Depth 10 -Compress }
    $imageJson = $imageJson.Replace("'", "''")
    $audioJson = $audioJson.Replace("'", "''")
    $storyJson = $storyJson.Replace("'", "''")
    @"
CREATE TEMP TABLE demo_image_fixtures ON COMMIT DROP AS
SELECT ordinal::integer, item->>'fixtureKey' AS fixture_key,
       item->>'url' AS url, item->>'sourcePage' AS source_page,
       item->>'provider' AS provider, item->>'title' AS title,
       item->>'description' AS description, item->>'category' AS category_name,
       ARRAY(SELECT jsonb_array_elements_text(item->'tags')) AS tag_names,
       item->>'note' AS note, item->>'taskTitle' AS task_title
FROM jsonb_array_elements('$imageJson'::jsonb) WITH ORDINALITY AS fixture(item, ordinal);
CREATE TEMP TABLE demo_audio_fixtures ON COMMIT DROP AS
SELECT ordinal::integer, item->>'fixtureKey' AS fixture_key,
       item->>'url' AS url, item->>'sourcePage' AS source_page,
       item->>'provider' AS provider, item->>'title' AS title,
       item->>'description' AS description, item->>'category' AS category_name,
       ARRAY(SELECT jsonb_array_elements_text(item->'tags')) AS tag_names,
       item->>'note' AS note, item->>'taskTitle' AS task_title
FROM jsonb_array_elements('$audioJson'::jsonb) WITH ORDINALITY AS fixture(item, ordinal);
CREATE TEMP TABLE demo_story_fixtures ON COMMIT DROP AS
SELECT ordinal::integer, item->>'storyKey' AS story_key,
       item->>'sourceType' AS source_type,
       item->>'sourceIdentity' AS source_identity,
       item->>'sourceFixtureKey' AS source_fixture_key,
       item->>'note' AS note,
       (item->>'timestampSeconds')::integer AS timestamp_seconds,
       item->>'taskTitle' AS task_title,
       item->>'taskStatus' AS task_status,
       item->>'deadlineClass' AS deadline_class,
       item->>'category' AS category_name,
       ARRAY(SELECT jsonb_array_elements_text(item->'tags')) AS tag_names
FROM jsonb_array_elements('$storyJson'::jsonb) WITH ORDINALITY AS fixture(item, ordinal);
"@
}

function Invoke-DemoFixtureSql {
    param(
        [Parameter(Mandatory)][pscustomobject]$DatabaseConfig,
        [Parameter(Mandatory)][string]$SqlFile,
        [string[]]$Variables = @(),
        [switch]$Capture
    )
    $media = Get-DemoSourceManifests
    $stories = if ($SqlFile -match '(seed-v3-demo|verify-demo)\.sql$') {
        Get-DemoStories -Media $media
    } else { @() }
    $prelude = Get-DemoPrelude -Media $media -Stories $stories
    $sql = Get-Content -Raw -Encoding UTF8 -LiteralPath $SqlFile
    if ($sql.StartsWith('BEGIN;')) {
        $sql = $sql.Insert(6, "`n$prelude")
    }
    else {
        $sql = "BEGIN;`n$prelude`n$sql`nROLLBACK;"
    }
    $temporarySql = Join-Path ([IO.Path]::GetTempPath()) "life-lab-demo-$([guid]::NewGuid().ToString('N')).sql"
    [IO.File]::WriteAllText($temporarySql, $sql, [Text.UTF8Encoding]::new($false))
    try {
        $args = if ($Capture) { @('-q', '-t', '-A') + $Variables + @('-f', $temporarySql) }
            else { @('-q') + $Variables + @('-f', $temporarySql) }
        if ($Capture) { return Invoke-A2Psql -DatabaseConfig $DatabaseConfig -Arguments $args -Capture }
        Invoke-A2Psql -DatabaseConfig $DatabaseConfig -Arguments $args
    }
    finally {
        if (Test-Path -LiteralPath $temporarySql) {
            Remove-Item -LiteralPath $temporarySql -Force
        }
    }
}
