[CmdletBinding()]
param(
    [string]$ArtifactDirectory,
    [string]$A1SnapshotPath,
    [string]$A2SnapshotPath,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([string]::IsNullOrWhiteSpace($ArtifactDirectory)) { $ArtifactDirectory = Join-Path $PSScriptRoot '../a3-spec' }
if ([string]::IsNullOrWhiteSpace($A1SnapshotPath)) { $A1SnapshotPath = Join-Path $PSScriptRoot '../a1/a1-source-snapshot.json' }
if ([string]::IsNullOrWhiteSpace($A2SnapshotPath)) { $A2SnapshotPath = Join-Path $PSScriptRoot '../a2-spec/a2-source-snapshot.json' }

function Import-A3Tsv([string]$Name) { @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory $Name)) }
function Sum-A3($Rows,[string]$Property) { [int](($Rows|Measure-Object -Property $Property -Sum).Sum) }
$sources=Import-A3Tsv 'a3-final-sources-15.tsv'; $tags=Import-A3Tsv 'a3-tags-10.tsv'; $links=Import-A3Tsv 'a3-tag-links-30.tsv'
$watch=Import-A3Tsv 'a3-watch-distribution.tsv'; $notes=Import-A3Tsv 'a3-note-distribution.tsv'; $tasks=Import-A3Tsv 'a3-task-matrix.tsv'; $deadlines=Import-A3Tsv 'a3-deadline-matrix.tsv'
$snapshot=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a3-source-snapshot.json')|ConvertFrom-Json
$a1=(Get-Content -Raw -Encoding UTF8 -LiteralPath $A1SnapshotPath|ConvertFrom-Json).sources
$a2=(Get-Content -Raw -Encoding UTF8 -LiteralPath $A2SnapshotPath|ConvertFrom-Json).sources
$errors=[System.Collections.Generic.List[string]]::new()
function Assert-A3([bool]$Condition,[string]$Message){if(-not $Condition){$errors.Add($Message)}}

$ids=@($sources.video_id); $snapshotIds=@($snapshot.sources.youtubeVideoId); $a1Ids=@($a1.youtubeVideoId); $a2Ids=@($a2.youtubeVideoId)
Assert-A3 ($sources.Count -eq 15) "sources expected 15, actual $($sources.Count)"
Assert-A3 (@($ids|Sort-Object -Unique).Count -eq 15) 'source IDs are not unique'
Assert-A3 (@(Compare-Object ($ids|Sort-Object) ($snapshotIds|Sort-Object)).Count -eq 0) 'source TSV and snapshot membership differ'
Assert-A3 (@($ids|Where-Object{$_ -in $a2Ids}).Count -eq 15) 'expected all 15 sources in locked A2 snapshot'
Assert-A3 (@($ids|Where-Object{$_ -in $a1Ids}).Count -eq 4) 'expected four sources in locked A1 snapshot'
Assert-A3 (@($sources|Where-Object shared_with_a2 -ne 'True').Count -eq 0) 'shared_with_a2 flags are incorrect'
Assert-A3 (@($sources|Where-Object shared_with_a1 -eq 'True').Count -eq 4) 'shared_with_a1 flags are incorrect'
foreach($source in $snapshot.sources){
    $canonical=if($source.sharedWithA1){$a1|Where-Object youtubeVideoId -eq $source.youtubeVideoId}else{$a2|Where-Object youtubeVideoId -eq $source.youtubeVideoId}
    Assert-A3 ($null -ne $canonical) "canonical source missing: $($source.youtubeVideoId)"
    if($null -ne $canonical){Assert-A3 ($canonical.availabilityStatus -eq 'AVAILABLE') "canonical source unavailable: $($source.youtubeVideoId)"; Assert-A3 ([Math]::Abs([int]$canonical.durationSeconds-[int]$source.durationSeconds)-le 1) "duration incompatibility: $($source.youtubeVideoId)"}
}
Assert-A3 ($tags.Count -eq 10) 'expected 10 tags'; Assert-A3 ($links.Count -eq 30) 'expected 30 tag links'
Assert-A3 (@($links|Group-Object video_id,tag|Where-Object Count -gt 1).Count -eq 0) 'duplicate tag links'
Assert-A3 (@($links.tag|Sort-Object -Unique).Count -eq 10) 'not all tags are used'
Assert-A3 ((Sum-A3 $watch 'total_sessions') -eq 45) 'expected 45 sessions'; Assert-A3 ((Sum-A3 $watch 'valid_sessions') -eq 30) 'expected 30 VALID'; Assert-A3 ((Sum-A3 $watch 'invalid_sessions') -eq 15) 'expected 15 INVALID'
Assert-A3 (@($watch|Where-Object watched -eq 'True').Count -eq 10) 'expected 10 watched'; Assert-A3 (@($watch|Where-Object watched -eq 'False').Count -eq 5) 'expected 5 unwatched'
Assert-A3 ((Sum-A3 $notes 'note_count') -eq 20) 'expected 20 Notes'; Assert-A3 ((Sum-A3 $notes 'timestamped_note_count') -eq 0) 'expected zero timestamped Notes'; Assert-A3 ((Sum-A3 $notes 'null_timestamp_note_count') -eq 20) 'expected 20 NULL timestamp Notes'
Assert-A3 ((Sum-A3 $tasks 'total') -eq 30) 'expected 30 Tasks'; Assert-A3 ((Sum-A3 $tasks 'completed') -eq 10) 'expected 10 COMPLETED'; Assert-A3 ((Sum-A3 $tasks 'not_started') -eq 10) 'expected 10 NOT_STARTED'; Assert-A3 ((Sum-A3 $tasks 'in_progress') -eq 10) 'expected 10 IN_PROGRESS'
Assert-A3 ((Sum-A3 @($tasks|Where-Object source_status -eq 'HAS_SOURCE') total)-eq 12) 'expected 12 HAS_SOURCE'; Assert-A3 ((Sum-A3 @($tasks|Where-Object source_status -eq 'INDEPENDENT') total)-eq 18) 'expected 18 INDEPENDENT'; Assert-A3 (@($tasks|Where-Object source_status -eq 'SOURCE_MISSING').Count -eq 0) 'SOURCE_MISSING is forbidden'
foreach($expected in @{'OVERDUE'=4;'TODAY'=3;'UPCOMING'=6;'NO_DEADLINE'=7}.GetEnumerator()){Assert-A3 ((Sum-A3 @($deadlines|Where-Object incomplete_bucket -eq $expected.Key) 'count')-eq $expected.Value) "deadline $($expected.Key) mismatch"}
if($errors.Count){$errors|ForEach-Object{Write-Error $_};throw "A3 artifact preflight failed with $($errors.Count) mismatch(es)."}
$result=[pscustomobject]@{Sources=15;A2Overlaps=15;A1Overlaps=4;Tags=10;TagLinks=30;WatchSessions=45;Valid=30;Invalid=15;Notes=20;NullTimestamps=20;Tasks=30;Completed=10;NotStarted=10;InProgress=10;Overdue=4;Today=3;Upcoming=6;NoDeadline=7}
if($Quiet){return $result};$result|Format-List
