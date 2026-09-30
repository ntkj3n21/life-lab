function Get-A2VideoOrganizationSql {
    param(
        [Parameter(Mandatory)][object[]]$Sources,
        [Parameter(Mandatory)][object[]]$Notes
    )

    $noteLessKeys = @(
        'A2_LIB_005','A2_LIB_012','A2_LIB_020','A2_LIB_027','A2_LIB_035',
        'A2_LIB_042','A2_LIB_050','A2_LIB_057','A2_LIB_064','A2_LIB_071'
    )
    $manifest = @(
        Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (
            Join-Path $PSScriptRoot 'a2-video-organization.tsv'
        )
    )
    $current = @($Sources | Where-Object role -eq 'CURRENT_LIBRARY')
    $noteBearingKeys = @($current | Where-Object { $_.fixtureKey -in $Notes.fixture_key } |
        ForEach-Object { $_.fixtureKey })
    $actualNoteLess = @($current | Where-Object { $_.fixtureKey -notin $Notes.fixture_key } |
        ForEach-Object { $_.fixtureKey })
    if ($current.Count -ne 80 -or $noteBearingKeys.Count -ne 70 -or
        @(Compare-Object ($noteLessKeys | Sort-Object) ($actualNoteLess | Sort-Object)).Count -ne 0 -or
        $manifest.Count -ne 70 -or
        @($manifest.fixture_key | Sort-Object -Unique).Count -ne 70 -or
        @(Compare-Object ($noteBearingKeys | Sort-Object) ($manifest.fixture_key | Sort-Object)).Count -ne 0) {
        throw 'A2 Video organization must cover exactly the 70 note-bearing current Sources and preserve the ten fixed note-less Sources.'
    }

    $sql = [Text.StringBuilder]::new()
    [void]$sql.AppendLine(@'
CREATE TEMP TABLE a2_video_organization (
    fixture_key TEXT PRIMARY KEY,
    note_no INTEGER NOT NULL,
    category_name TEXT NOT NULL,
    tag_names JSONB NOT NULL
);
CREATE TEMP TABLE a2_no_note_sources (fixture_key TEXT PRIMARY KEY);
'@)
    foreach ($key in $noteLessKeys) {
        [void]$sql.AppendLine("INSERT INTO a2_no_note_sources VALUES ($(ConvertTo-A2SqlLiteral $key));")
    }
    foreach ($entry in $manifest) {
        $candidate = @($Notes | Where-Object {
            $_.fixture_key -eq $entry.fixture_key -and
            [int]$_.note_no -eq [int]$entry.note_no
        })
        $tagNames = @($entry.tag_names -split ';')
        if ($candidate.Count -ne 1 -or
            [string]::IsNullOrWhiteSpace($entry.category_name) -or
            $tagNames.Count -eq 0 -or
            @($tagNames | Where-Object { [string]::IsNullOrWhiteSpace($_) }).Count -gt 0 -or
            @($tagNames | Sort-Object -Unique).Count -ne $tagNames.Count) {
            throw "Invalid A2 representative organization: $($entry.fixture_key)/$($entry.note_no)"
        }
        $tagJson = ConvertTo-Json -InputObject $tagNames -Compress
        [void]$sql.AppendLine(
            "INSERT INTO a2_video_organization VALUES (" +
            "$(ConvertTo-A2SqlLiteral $entry.fixture_key)," +
            "$([int]$entry.note_no)," +
            "$(ConvertTo-A2SqlLiteral $entry.category_name)," +
            "$(ConvertTo-A2SqlLiteral $tagJson)::jsonb);"
        )
    }
    return $sql.ToString()
}
