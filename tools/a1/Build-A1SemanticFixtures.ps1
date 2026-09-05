[CmdletBinding()]
param(
    [string]$SnapshotPath,
    [string]$AuditPath,
    [string]$SubtitleDirectory,
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($SnapshotPath)) { $SnapshotPath = Join-Path $PSScriptRoot 'a1-source-snapshot.json' }
if ([string]::IsNullOrWhiteSpace($AuditPath)) { $AuditPath = Join-Path $PSScriptRoot '../a1-harvest/a1-subtitle-audit.tsv' }
if ([string]::IsNullOrWhiteSpace($SubtitleDirectory)) { $SubtitleDirectory = Join-Path $PSScriptRoot '../a1-harvest/A1_Subtitles' }
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $OutputDirectory = $PSScriptRoot }

function Read-Tsv([string]$Path) {
    return @(Import-Csv -LiteralPath $Path -Delimiter "`t")
}

function Convert-Time([string]$Value) {
    $Value = ($Value.Trim() -replace ',', '.')
    $parts = $Value -split ':'
    if ($parts.Count -eq 3) { return ([double]$parts[0] * 3600) + ([double]$parts[1] * 60) + [double]$parts[2] }
    if ($parts.Count -eq 2) { return ([double]$parts[0] * 60) + [double]$parts[1] }
    throw "Unrecognized VTT timestamp: $Value"
}

function Read-Cues([string]$Path) {
    $lines = Get-Content -LiteralPath $Path -Encoding UTF8
    $cues = [System.Collections.Generic.List[object]]::new()
    $i = 0
    while ($i -lt $lines.Count) {
        if ($lines[$i] -match '(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})\s+-->\s+(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{3})') {
            $start = Convert-Time ($matches[1] -replace ',', '.')
            $i++
            $text = [System.Collections.Generic.List[string]]::new()
            while ($i -lt $lines.Count -and -not [string]::IsNullOrWhiteSpace($lines[$i])) { [void]$text.Add($lines[$i]); $i++ }
            $clean = ($text -join ' ') -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '&amp;', '&' -replace '\s+', ' '
            $clean = $clean.Trim()
            if ($clean.Length -ge 12) { [void]$cues.Add([pscustomobject]@{ Start = [math]::Floor($start); Text = $clean }) }
        }
        $i++
    }
    return @($cues | Sort-Object Start, Text -Unique)
}

function SqlSafe([string]$Text) { return ($Text -replace '\s+', ' ').Trim() }

$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath $SnapshotPath | ConvertFrom-Json
$sources = @($snapshot.sources | Sort-Object @{Expression={ if ($null -eq $_.libraryOrder) { 999 } else { [int]$_.libraryOrder } }})
$audit = Read-Tsv $AuditPath
$auditByKey = @{}
foreach ($row in $audit) { $auditByKey[$row.fixture_key] = $row }

$overrides = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'a1-semantic-overrides.json') | ConvertFrom-Json
if ($overrides.schemaVersion -ne 1) { throw 'Unsupported semantic override schema.' }
$fallbackBySource = @{}
$taskOverridesByNote = @{}
$noteOverridesBySource = @{}
$noteOverridesByKey = @{}
foreach ($fallback in $overrides.metadataFallbackSources) {
    $matchedSources = @($sources | Where-Object fixtureKey -eq $fallback.sourceFixtureKey)
    if ($matchedSources.Count -ne 1 -or $matchedSources[0].youtubeVideoId -ne $fallback.youtubeVideoId -or
        $fallbackBySource.ContainsKey($fallback.sourceFixtureKey) -or
        [string]::IsNullOrWhiteSpace($fallback.reason) -or @($fallback.notes).Count -eq 0) {
        throw "Invalid semantic fallback source: $($fallback.sourceFixtureKey)"
    }
    foreach ($entry in $fallback.notes) {
        if ($entry.noteKey -ne "a1-note-$($fallback.sourceFixtureKey)-$($entry.noteNo)" -or
            [int]$entry.noteNo -lt 1 -or $taskOverridesByNote.ContainsKey($entry.noteKey) -or
            [string]::IsNullOrWhiteSpace($entry.content) -or
            [string]::IsNullOrWhiteSpace($entry.linkedTask.title) -or
            [string]::IsNullOrWhiteSpace($entry.linkedTask.description)) {
            throw "Invalid semantic fallback Note: $($entry.noteKey)"
        }
        $taskOverridesByNote[$entry.noteKey] = $entry.linkedTask
    }
    $fallbackBySource[$fallback.sourceFixtureKey] = $fallback
}

foreach ($override in @($overrides.noteOverrides)) {
    $matchedSources = @($sources | Where-Object fixtureKey -eq $override.sourceFixtureKey)
    if ($matchedSources.Count -ne 1 -or
        $override.sourceRole -ne $matchedSources[0].role -or
        [string]::IsNullOrWhiteSpace($override.noteKey) -or
        $override.noteKey -ne "a1-note-$($override.sourceFixtureKey)-$($override.noteNo)" -or
        [int]$override.noteNo -lt 1 -or
        [string]::IsNullOrWhiteSpace($override.content) -or
        [string]::IsNullOrWhiteSpace($override.vttTrack) -or
        $null -eq $override.timestampSeconds -or
        $null -eq $override.cueStartSeconds -or
        [int]$override.timestampSeconds -ne [int]$override.cueStartSeconds -or
        [string]::IsNullOrWhiteSpace($override.evidenceText)) {
        throw "Invalid semantic Note override: $($override.noteKey)"
    }
    if ($noteOverridesByKey.ContainsKey($override.noteKey) -or
        ($fallbackBySource.ContainsKey($override.sourceFixtureKey) -and
         @($fallbackBySource[$override.sourceFixtureKey].notes | Where-Object { [int]$_.noteNo -eq [int]$override.noteNo }).Count -gt 0)) {
        throw "Semantic Note override conflicts with another override: $($override.noteKey)"
    }
    if (-not $noteOverridesBySource.ContainsKey($override.sourceFixtureKey)) {
        $noteOverridesBySource[$override.sourceFixtureKey] = [System.Collections.Generic.List[object]]::new()
    }
    [void]$noteOverridesBySource[$override.sourceFixtureKey].Add($override)
    $noteOverridesByKey[$override.noteKey] = $override
    if ($null -ne $override.linkedTask) {
        if ([string]::IsNullOrWhiteSpace($override.linkedTask.title) -or
            [string]::IsNullOrWhiteSpace($override.linkedTask.description)) {
            throw "Invalid semantic Task override: $($override.noteKey)"
        }
        $taskOverridesByNote[$override.noteKey] = $override.linkedTask
    }
}

$notes = [System.Collections.Generic.List[object]]::new()
$vttNoteCount = 0
$sourceOrdinal = 0
foreach ($source in $sources) {
    Write-Verbose "Processing $($source.fixtureKey)"
    $sourceOrdinal++
    $auditRow = $auditByKey[$source.fixtureKey]
    $duration = [int]$source.durationSeconds
    $count = if ($duration -lt 600) { 1 } elseif ($duration -lt 1800) { 2 } elseif ($duration -lt 3600) { 3 } elseif ($duration -lt 7200) { 4 } else { 5 }
    # Technical subtitle availability is not proof of semantic trustworthiness.
    # Reviewed metadata fallbacks bypass cue selection without altering the harvest audit.
    if ($fallbackBySource.ContainsKey($source.fixtureKey)) {
        foreach ($entry in @($fallbackBySource[$source.fixtureKey].notes | Sort-Object noteNo)) {
            [void]$notes.Add([pscustomobject]@{
                noteKey = $entry.noteKey; sourceFixtureKey = $source.fixtureKey; noteNo = [int]$entry.noteNo
                content = $entry.content; timestampSeconds = $null; evidenceType = 'SOURCE_METADATA'
                vttTrack = $null; cueStartSeconds = $null; evidenceText = $source.title
                sourceRole = $source.role; libraryOrder = $source.libraryOrder; sourceTitle = $source.title
            })
        }
        if (@($fallbackBySource[$source.fixtureKey].notes).Count -ge $count) { continue }
    }
    if ($auditRow.source_state -eq 'NO_VTT') { throw "NO_VTT source requires an explicit metadata fallback: $($source.fixtureKey)" }
    if ($auditRow.source_state -ne 'VTT_USABLE') { throw "Unsupported subtitle state for $($source.fixtureKey): $($auditRow.source_state)" }
    $track = $auditRow.selected_track
    $vttPath = Join-Path $SubtitleDirectory ("{0}.{1}.vtt" -f $source.youtubeVideoId, $track)
    if (-not (Test-Path -LiteralPath $vttPath)) { throw "Missing VTT for $($source.fixtureKey): $vttPath" }
    $cues = @(Read-Cues $vttPath)
    Write-Verbose "Cues=$($cues.Count)"
    if ($cues.Count -eq 0) { throw "No usable cues for $($source.fixtureKey)" }
    $topic = (($source.title -replace '^\[[^\]]+\]\s*', '') -replace '\|.*$', '').Trim()
    for ($n = 1; $n -le $count; $n++) {
        if ($fallbackBySource.ContainsKey($source.fixtureKey) -and
            @($fallbackBySource[$source.fixtureKey].notes | Where-Object { [int]$_.noteNo -eq $n }).Count -gt 0) { continue }
        $overrideKey = "a1-note-$($source.fixtureKey)-$n"
        $override = if ($noteOverridesByKey.ContainsKey($overrideKey)) { $noteOverridesByKey[$overrideKey] } else { $null }
        if ($null -ne $override) {
            $matchingCues = @($cues | Where-Object { [int]$_.Start -eq [int]$override.cueStartSeconds })
            if ($matchingCues.Count -eq 0) { throw "Semantic override cue was not found in VTT: $overrideKey at $($override.cueStartSeconds)" }
            $cue = @($matchingCues | Where-Object { $_.Text -ceq $override.evidenceText } | Select-Object -First 1)
            if ($cue.Count -eq 0) { $cue = @($matchingCues | Sort-Object @{Expression={$_.Text.Length}; Descending=$true} | Select-Object -First 1) }
            $cue = $cue[0]
            if ([int]$override.timestampSeconds -ge $duration) { throw "Override timestamp exceeds duration: $overrideKey" }
            [void]$notes.Add([pscustomobject]@{
                noteKey = $override.noteKey; sourceFixtureKey = $source.fixtureKey; noteNo = [int]$override.noteNo
                content = $override.content; timestampSeconds = [int]$override.timestampSeconds; evidenceType = 'VTT_CUE'
                vttTrack = $override.vttTrack; cueStartSeconds = [int]$override.cueStartSeconds; evidenceText = $cue.Text
                sourceRole = $source.role; libraryOrder = $source.libraryOrder; sourceTitle = $source.title
            })
            $vttNoteCount++
            continue
        }
        $index = [math]::Min($cues.Count - 1, [math]::Floor(($n - 0.5) * $cues.Count / $count))
        $cue = $cues[$index]
        if ([int]$cue.Start -ge $duration) { throw "Cue timestamp exceeds duration for $($source.fixtureKey): $($cue.Start) >= $duration" }
        $text = SqlSafe $cue.Text
        if ($text.Length -gt 180) { $text = $text.Substring(0,177).TrimEnd() + '...' }
        $content = "Study note $n for ${topic}: $text"
        [void]$notes.Add([pscustomobject]@{
            noteKey = "a1-note-$($source.fixtureKey)-$n"; sourceFixtureKey = $source.fixtureKey; noteNo = $n
            content = $content; timestampSeconds = [int]$cue.Start; evidenceType = 'VTT_CUE'
            vttTrack = $track; cueStartSeconds = [int]$cue.Start; evidenceText = $cue.Text
            sourceRole = $source.role; libraryOrder = $source.libraryOrder; sourceTitle = $source.title
        })
        $vttNoteCount++
    }
}
$notes = @($notes)
Write-Verbose "Built notes=$($notes.Count), VTT=$vttNoteCount, metadata=$(@($notes | Where-Object evidenceType -eq 'SOURCE_METADATA').Count)"
if ($vttNoteCount -ne 91 -or $notes.Count -ne 96) { throw "Expected 91 VTT notes plus 5 metadata notes, built $($vttNoteCount) VTT / $($notes.Count) total." }
if (@($notes | Where-Object { $_.evidenceType -eq 'SOURCE_METADATA' -and $null -eq $_.timestampSeconds -and $null -eq $_.vttTrack -and $null -eq $_.cueStartSeconds }).Count -ne 5) { throw 'Metadata fallback Notes must have NULL timestamps and no cue/track attribution.' }

# Select 60 linked tasks in round-robin noteNo order. This gives every current
# source (and H1) its first Note before any source receives a second linked Task.
$linked = [System.Collections.Generic.List[object]]::new()
$sourceOrder = @($sources | Sort-Object @{Expression={ if ($null -eq $_.libraryOrder) { 999 } else { [int]$_.libraryOrder } }})
$maxNoteNo = [int](($notes | Measure-Object -Property noteNo -Maximum).Maximum)
for ($noteNo = 1; $noteNo -le $maxNoteNo -and $linked.Count -lt 60; $noteNo++) {
    foreach ($source in $sourceOrder) {
        $note = $notes | Where-Object { $_.sourceFixtureKey -eq $source.fixtureKey -and $_.noteNo -eq $noteNo } | Select-Object -First 1
        if ($null -ne $note) { [void]$linked.Add($note) }
        if ($linked.Count -ge 60) { break }
    }
}
if ($linked.Count -ne 60) { throw "Expected 60 linked Notes, selected $($linked.Count)." }
$linkedSourceKeys = @($linked | Select-Object -ExpandProperty sourceFixtureKey -Unique)
foreach ($source in @($sources | Where-Object role -eq 'CURRENT_LIBRARY')) {
    if ($linkedSourceKeys -notcontains $source.fixtureKey) { throw "Current source has no linked HAS_SOURCE Task: $($source.fixtureKey)" }
}
if ($linkedSourceKeys -notcontains 'H1_GIT_TEAMWORK') { throw 'H1 must have at least one linked HAS_SOURCE Task.' }
Write-Verbose "Linked=$($linked.Count), sources=$($linkedSourceKeys.Count)"

function Get-InterleavedTaskStatus([int]$Sequence) {
    # A coprime stride permutes all 125 positions while preserving exact quotas.
    $rank = (($Sequence - 1) * 37) % 125
    if ($rank -lt 45) { return 'NOT_STARTED' }
    if ($rank -lt 80) { return 'IN_PROGRESS' }
    return 'COMPLETED'
}

$tasks = [System.Collections.Generic.List[object]]::new()
$seq = 0
foreach ($note in $linked) {
    $seq++
    $verb = @('Practice','Rewrite','Apply','Check','Summarize')[(($seq-1) % 5)]
    $taskTitle = if ($note.sourceFixtureKey -eq 'H1_GIT_TEAMWORK') { 'Xem lai cach lam viec nhom voi Git' } else { "$verb material from $($note.sourceTitle)" }
    [void]$tasks.Add([pscustomobject]@{ taskKey = "a1-task-has-$seq"; sourceStatus='HAS_SOURCE'; noteKey=$note.noteKey
        title = $taskTitle; description='Create a small verifiable result and record what was learned.'
        status = Get-InterleavedTaskStatus $seq
        deadlineClass = '' })
}
foreach ($noteKey in $taskOverridesByNote.Keys) {
    $matches = @($tasks | Where-Object { $_.sourceStatus -eq 'HAS_SOURCE' -and $_.noteKey -eq $noteKey })
    if ($matches.Count -ne 1) { throw "Semantic Task override requires exactly one linked Task: $noteKey" }
    $matches[0].title = $taskOverridesByNote[$noteKey].title
    $matches[0].description = $taskOverridesByNote[$noteKey].description
}
$independentTitles = @('Prepare Life Lab demo','Plan backend study week','Practice aggregate SQL queries','Update technical portfolio','Prepare interview questions','Write concise API notes','Review technical vocabulary','Review monthly goals','Practice project presentation','Tidy study backlog')
for ($i=1; $i -le 50; $i++) {
    $seq++
    $title = $independentTitles[($i-1) % $independentTitles.Count]
    if ($i -gt $independentTitles.Count) { $title += " ($i)" }
    [void]$tasks.Add([pscustomobject]@{ taskKey="a1-task-independent-$i"; sourceStatus='INDEPENDENT'; noteKey=$null; title=$title
        description=if ($i % 3 -eq 0) {$null} else {'Independent work in the personal study and project plan.'}
        status=Get-InterleavedTaskStatus $seq; deadlineClass='' })
}
for ($i=1; $i -le 15; $i++) {
    $seq++
    [void]$tasks.Add([pscustomobject]@{ taskKey="a1-task-missing-$i"; sourceStatus='SOURCE_MISSING'; noteKey=$null
        title="Complete work after losing the source Note ($i)"; description='The Task remains independently actionable after its original Note is gone.'
        status=Get-InterleavedTaskStatus $seq; deadlineClass='' })
}
Write-Verbose "Tasks before deadlines=$($tasks.Count)"
# Deadline classes are relative to the verifier reference date and only affect incomplete tasks.
# Interleave source-status groups before applying the locked class totals.
$incomplete = [System.Collections.Generic.List[object]]::new()
$incompleteGroups = @{}
foreach ($group in @('HAS_SOURCE', 'INDEPENDENT', 'SOURCE_MISSING')) {
    $incompleteGroups[$group] = @($tasks | Where-Object { $_.sourceStatus -eq $group -and $_.status -ne 'COMPLETED' })
}
$groupIndex = @{'HAS_SOURCE' = 0; 'INDEPENDENT' = 0; 'SOURCE_MISSING' = 0}
do {
    $added = $false
    foreach ($group in @('HAS_SOURCE', 'INDEPENDENT', 'SOURCE_MISSING')) {
        if ($groupIndex[$group] -lt $incompleteGroups[$group].Count) {
            [void]$incomplete.Add($incompleteGroups[$group][$groupIndex[$group]])
            $groupIndex[$group]++
            $added = $true
        }
    }
} while ($added)
for ($i=0; $i -lt $incomplete.Count; $i++) { $incomplete[$i].deadlineClass = if ($i -lt 8) {'OVERDUE'} elseif ($i -lt 24) {'TODAY'} elseif ($i -lt 60) {'UPCOMING'} else {'NONE'} }
Write-Verbose "Deadlines assigned"

$jsonOptions = @{ Depth = 8 }
$notes | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath (Join-Path $OutputDirectory 'a1-note-fixtures.json') -Encoding UTF8
Write-Verbose "Notes written"
$tasks | ConvertTo-Json @jsonOptions | Set-Content -LiteralPath (Join-Path $OutputDirectory 'a1-task-fixtures.json') -Encoding UTF8
Write-Verbose "Tasks written"

$review = [System.Collections.Generic.List[object]]::new()
foreach ($note in $notes) {
    $taskMatches = @($tasks | Where-Object noteKey -eq $note.noteKey)
    $task = if ($taskMatches.Count -gt 0) { $taskMatches[0] } else { $null }
    [void]$review.Add([pscustomobject]@{ source_role=$note.sourceRole; library_order=$note.libraryOrder; youtube_video_id=($sources | Where-Object fixtureKey -eq $note.sourceFixtureKey).youtubeVideoId; video_title=$note.sourceTitle; note_fixture_key=$note.noteKey; note_timestamp_seconds=$note.timestampSeconds; note_text=$note.content; evidence_type=$note.evidenceType; vtt_track=$note.vttTrack; cue_start_seconds=$note.cueStartSeconds; linked_task_fixture_key=if ($null -eq $task) {''} else {$task.taskKey}; linked_task_title=if ($null -eq $task) {''} else {$task.title}; linked_task_deadline_class=if ($null -eq $task) {''} else {$task.deadlineClass} })
}
$review | ConvertTo-Csv -NoTypeInformation -Delimiter "`t" | Set-Content -LiteralPath (Join-Path $OutputDirectory 'a1-semantic-review.tsv') -Encoding UTF8
Write-Host "Built $($notes.Count) notes and $($tasks.Count) tasks."
