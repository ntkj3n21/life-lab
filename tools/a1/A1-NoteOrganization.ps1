function Get-A1NoteOrganizationSql {
    param(
        [Parameter(Mandatory)][object[]]$VideoNotes,
        [Parameter(Mandatory)][object[]]$VideoSources,
        [Parameter(Mandatory)][object[]]$Images,
        [Parameter(Mandatory)][object[]]$Audio
    )

    $manifest = @(
        Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (
            Join-Path $PSScriptRoot 'a1-note-organization.tsv'
        )
    )
    if ($manifest.Count -ne 123 -or
        @($manifest.note_key | Sort-Object -Unique).Count -ne 123) {
        throw 'A1 organization manifest must contain 123 unique Note keys.'
    }

    $videoByKey = @{}; foreach ($note in $VideoNotes) { $videoByKey[$note.noteKey] = $note }
    $sourceByKey = @{}; foreach ($source in $VideoSources) { $sourceByKey[$source.fixtureKey] = $source }
    $rows = [System.Text.StringBuilder]::new()
    [void]$rows.AppendLine(@'
CREATE TEMP TABLE a1_expected_organization (
    note_key TEXT PRIMARY KEY,
    source_kind TEXT NOT NULL,
    source_identity TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp_seconds INTEGER,
    category_name TEXT NOT NULL,
    tag_names JSONB NOT NULL
);
'@)

    foreach ($entry in $manifest) {
        $kind = $null; $identity = $null; $content = $null; $timestamp = 'NULL'
        if ($videoByKey.ContainsKey($entry.note_key)) {
            $note = $videoByKey[$entry.note_key]
            $kind = 'VIDEO'
            $identity = $sourceByKey[$note.sourceFixtureKey].youtubeVideoId
            $content = $note.content
            if ($null -ne $note.timestampSeconds) { $timestamp = [int]$note.timestampSeconds }
        }
        elseif ($entry.note_key -match '^a1-image-(\d{2})$') {
            $index = [int]$Matches[1]
            if ($index -lt 1 -or $index -gt $Images.Count) { throw "Unknown A1 Image Note: $($entry.note_key)" }
            $image = $Images[$index - 1]
            $extension = [IO.Path]::GetExtension($image.fileName).ToLowerInvariant()
            if ($extension -eq '.jpeg') { $extension = '.jpg' }
            $kind = 'IMAGE'; $identity = 'a1-image-{0:D2}{1}' -f $index,$extension
            $content = $image.note
            if ($entry.category_name -cne $image.category -or
                @(Compare-Object @($entry.tag_names -split ';' | Sort-Object) @($image.tags | Sort-Object)).Count -gt 0) {
                throw "A1 Image organization disagrees with existing fixture: $($entry.note_key)"
            }
        }
        elseif ($entry.note_key -match '^a1-audio-(\d{2})$') {
            $index = [int]$Matches[1]
            $audioFixture = @($Audio | Where-Object { [int]$_.audioNo -eq $index })
            if ($audioFixture.Count -ne 1) { throw "Unknown A1 Audio Note: $($entry.note_key)" }
            $kind = 'AUDIO'; $identity = 'a1-audio-{0:D2}.mp3' -f $index
            $content = $audioFixture[0].noteContent
            if ($entry.category_name -cne $audioFixture[0].category -or
                @(Compare-Object @($entry.tag_names -split ';' | Sort-Object) @($audioFixture[0].tags | Sort-Object)).Count -gt 0) {
                throw "A1 Audio organization disagrees with existing fixture: $($entry.note_key)"
            }
            if ($null -ne $audioFixture[0].timestampSeconds) { $timestamp = [int]$audioFixture[0].timestampSeconds }
        }
        else { throw "Unknown A1 organization Note: $($entry.note_key)" }

        $tagNames = @($entry.tag_names -split ';')
        if ([string]::IsNullOrWhiteSpace($entry.category_name) -or
            $tagNames.Count -eq 0 -or
            @($tagNames | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -gt 0 -or
            @($tagNames | Sort-Object -Unique).Count -ne $tagNames.Count) {
            throw "Invalid A1 organization: $($entry.note_key)"
        }
        $tagJson = ConvertTo-Json -InputObject $tagNames -Compress
        [void]$rows.AppendLine(
            "INSERT INTO a1_expected_organization VALUES (" +
            "$(ConvertTo-A1SqlLiteral $entry.note_key)," +
            "$(ConvertTo-A1SqlLiteral $kind)," +
            "$(ConvertTo-A1SqlLiteral $identity)," +
            "$(ConvertTo-A1SqlLiteral $content)," +
            "$timestamp," +
            "$(ConvertTo-A1SqlLiteral $entry.category_name)," +
            "$(ConvertTo-A1SqlLiteral $tagJson)::jsonb);"
        )
    }
    if (@($manifest | Where-Object note_key -like 'a1-note-*').Count -ne 96 -or
        @($manifest | Where-Object note_key -like 'a1-image-*').Count -ne 14 -or
        @($manifest | Where-Object note_key -like 'a1-audio-*').Count -ne 13) {
        throw 'A1 organization must cover exactly 96 Video, 14 Image and 13 Audio Notes.'
    }
    return $rows.ToString()
}
