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

$snapshot = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-source-snapshot.json') | ConvertFrom-Json
$watch = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-watch-distribution.tsv'))
$notes = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath $NoteFixturePath)
$links = @(Import-Csv -Delimiter "`t" -Encoding UTF8 -LiteralPath (Join-Path $ArtifactDirectory 'a2-tag-links-200.tsv'))

$builder = [System.Text.StringBuilder]::new()
[void]$builder.AppendLine(@'
CREATE TEMP TABLE a2_expected_sources(fixture_key text primary key,role text,youtube_video_id text unique,duration_seconds integer,shared boolean,has_vtt boolean);
CREATE TEMP TABLE a2_expected_watch(fixture_key text primary key,valid_count integer,invalid_count integer);
CREATE TEMP TABLE a2_expected_notes(fixture_key text,note_no integer,youtube_video_id text,timestamp_seconds integer,vtt_track text,cue_start_seconds integer,primary key(fixture_key,note_no));
CREATE TEMP TABLE a2_expected_links(fixture_key text,tag_name text,primary key(fixture_key,tag_name));
'@)
foreach ($s in $snapshot.sources) {
    [void]$builder.AppendLine("INSERT INTO a2_expected_sources VALUES ($(ConvertTo-A2SqlLiteral $s.fixtureKey),$(ConvertTo-A2SqlLiteral $s.role),$(ConvertTo-A2SqlLiteral $s.youtubeVideoId),$([int]$s.durationSeconds),$(if($s.sharedWithA1){'true'}else{'false'}),$(if($s.hasVtt){'true'}else{'false'}));")
}
foreach ($w in $watch) { [void]$builder.AppendLine("INSERT INTO a2_expected_watch VALUES ($(ConvertTo-A2SqlLiteral $w.fixture_key),$([int]$w.valid_sessions),$([int]$w.invalid_sessions));") }
foreach ($n in $notes) {
    $timestamp=if($n.timestamp_seconds -eq ''){'NULL'}else{[int]$n.timestamp_seconds}; $track=if($n.vtt_track -eq ''){'NULL'}else{ConvertTo-A2SqlLiteral $n.vtt_track}; $cue=if($n.cue_start_seconds -eq ''){'NULL'}else{[int]$n.cue_start_seconds}
    [void]$builder.AppendLine("INSERT INTO a2_expected_notes VALUES ($(ConvertTo-A2SqlLiteral $n.fixture_key),$([int]$n.note_no),$(ConvertTo-A2SqlLiteral $n.youtube_video_id),$timestamp,$track,$cue);")
}
foreach($l in $links){[void]$builder.AppendLine("INSERT INTO a2_expected_links VALUES ($(ConvertTo-A2SqlLiteral $l.fixture_key),$(ConvertTo-A2SqlLiteral $l.tag));")}

$sql = $builder.ToString()+"`n"+(Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'verify-a2.sql'))
$temporarySql=Join-Path ([System.IO.Path]::GetTempPath()) "life-lab-a2-verify-$([guid]::NewGuid().ToString('N')).sql"
[System.IO.File]::WriteAllText($temporarySql,$sql,[System.Text.UTF8Encoding]::new($false))
$database=Get-A2DatabaseConfig -EnvFile $EnvFile
try {
    $lines=Invoke-A2Psql -Capture -DatabaseConfig $database -Arguments @('-q','-At','-F','|','-v',"reference_date=$ReferenceDate",'-f',$temporarySql)
}
finally { if(Test-Path -LiteralPath $temporarySql){Remove-Item -LiteralPath $temporarySql -Force} }

$results=[System.Collections.Generic.List[object]]::new()
foreach($line in $lines){
    if([string]::IsNullOrWhiteSpace($line)){continue}
    $parts=$line -split '\|',5
    if($parts.Count -ne 5){throw "Unexpected verifier output: $line"}
    $results.Add([pscustomobject]@{Check=$parts[0];Expected=$parts[1];Actual=$parts[2];Passed=$parts[3]-eq 't';Details=$parts[4]})
}
if($results.Count -eq 0){throw 'A2 verifier produced no checks.'}
$results|Format-Table Check,Expected,Actual,Passed -AutoSize
$failures=@($results|Where-Object{-not $_.Passed})
if($failures.Count -gt 0){Write-Host '';Write-Host 'A2 VERIFIER: FAIL';$failures|Format-List;exit 1}
Write-Host '';Write-Host "A2 VERIFIER: PASS ($($results.Count) checks)";Write-Host "REFERENCE_DATE: $ReferenceDate";Write-Host 'Business timezone: Asia/Ho_Chi_Minh'
