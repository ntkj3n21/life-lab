[CmdletBinding()]
param(
 [ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$ReferenceDate='2026-08-27',
 [string]$EnvFile,[string]$ArtifactDirectory)

$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
if([string]::IsNullOrWhiteSpace($EnvFile)){$EnvFile=Join-Path $PSScriptRoot '../../.env'}
if([string]::IsNullOrWhiteSpace($ArtifactDirectory)){$ArtifactDirectory=Join-Path $PSScriptRoot '../a3-spec'}
. (Join-Path $PSScriptRoot 'A3-Database.ps1')
& (Join-Path $PSScriptRoot 'Test-A3Artifacts.ps1') -ArtifactDirectory $ArtifactDirectory -Quiet|Out-Null
$snapshot=Get-Content -Raw -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-source-snapshot.json')|ConvertFrom-Json
$a1=(Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot '../a1/a1-source-snapshot.json')|ConvertFrom-Json).sources
$a2=(Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot '../a2-spec/a2-source-snapshot.json')|ConvertFrom-Json).sources
$watch=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-watch-distribution.tsv')
$tags=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-tags-10.tsv')
$links=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-tag-links-30.tsv')
$notes=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-note-distribution.tsv')
$tasks=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-task-matrix.tsv')
$deadlines=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-deadline-matrix.tsv')
$b=[System.Text.StringBuilder]::new();[void]$b.AppendLine(@'
CREATE TEMP TABLE a3_sources(fixture_key text primary key,a3_order integer,youtube_video_id text unique,category text,source_url text,title text,channel_name text,thumbnail_url text,duration_seconds integer,published_at timestamptz,availability_status text,shared_a1 boolean);
CREATE TEMP TABLE a3_watch(fixture_key text primary key,valid_count integer,invalid_count integer);
CREATE TEMP TABLE a3_tags(ordinal integer primary key,name text);CREATE TEMP TABLE a3_links(fixture_key text,tag_name text,primary key(fixture_key,tag_name));
CREATE TEMP TABLE a3_notes(fixture_key text primary key,note_count integer);CREATE TEMP TABLE a3_tasks(source_status text primary key,completed integer,not_started integer,in_progress integer);CREATE TEMP TABLE a3_deadlines(bucket text primary key,count integer);
'@)
foreach($s in $snapshot.sources){$canonical=if($s.sharedWithA1){$a1|Where-Object youtubeVideoId -eq $s.youtubeVideoId}else{$a2|Where-Object youtubeVideoId -eq $s.youtubeVideoId};$sourceRow=Import-Csv -Delimiter "`t" -Encoding UTF8 (Join-Path $ArtifactDirectory 'a3-final-sources-15.tsv')|Where-Object video_id -eq $s.youtubeVideoId;[void]$b.AppendLine("INSERT INTO a3_sources VALUES ($(ConvertTo-A3SqlLiteral $s.fixtureKey),$([int]$s.libraryOrder),$(ConvertTo-A3SqlLiteral $s.youtubeVideoId),$(ConvertTo-A3SqlLiteral $sourceRow.category),$(ConvertTo-A3SqlLiteral $canonical.sourceUrl),$(ConvertTo-A3SqlLiteral $canonical.title),$(ConvertTo-A3SqlLiteral $canonical.channelName),$(ConvertTo-A3SqlLiteral $canonical.thumbnailUrl),$([int]$canonical.durationSeconds),$(ConvertTo-A3SqlLiteral $canonical.publishedAt),$(ConvertTo-A3SqlLiteral $canonical.availabilityStatus),$(if($s.sharedWithA1){'true'}else{'false'}));")}
foreach($x in $watch){[void]$b.AppendLine("INSERT INTO a3_watch VALUES ($(ConvertTo-A3SqlLiteral $x.fixture_key),$([int]$x.valid_sessions),$([int]$x.invalid_sessions));")}
foreach($x in $tags){[void]$b.AppendLine("INSERT INTO a3_tags VALUES ($([int]$x.ordinal),$(ConvertTo-A3SqlLiteral $x.tag));")};foreach($x in $links){[void]$b.AppendLine("INSERT INTO a3_links VALUES ($(ConvertTo-A3SqlLiteral $x.fixture_key),$(ConvertTo-A3SqlLiteral $x.tag));")}
foreach($x in $notes){[void]$b.AppendLine("INSERT INTO a3_notes VALUES ($(ConvertTo-A3SqlLiteral $x.fixture_key),$([int]$x.note_count));")};foreach($x in $tasks){[void]$b.AppendLine("INSERT INTO a3_tasks VALUES ($(ConvertTo-A3SqlLiteral $x.source_status),$([int]$x.completed),$([int]$x.not_started),$([int]$x.in_progress));")};foreach($x in $deadlines){[void]$b.AppendLine("INSERT INTO a3_deadlines VALUES ($(ConvertTo-A3SqlLiteral $x.incomplete_bucket),$([int]$x.count));")}
$temporary=Join-Path ([IO.Path]::GetTempPath()) "life-lab-a3-seed-$([guid]::NewGuid().ToString('N')).sql";[IO.File]::WriteAllText($temporary,$b.ToString()+"`n"+(Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'seed-a3.sql')),[Text.UTF8Encoding]::new($false))
$db=Get-A3DatabaseConfig $EnvFile
$idList=($snapshot.sources.youtubeVideoId|ForEach-Object{ConvertTo-A3SqlLiteral $_}) -join ','
$beforeOutput=@(Invoke-A3Psql -Capture -DatabaseConfig $db -Arguments @('-q','-At','-c',"SELECT count(*) FROM youtube_videos WHERE youtube_video_id IN ($idList);"))
$before=[int]($beforeOutput|Select-Object -First 1)
$passwordHash='$2a$10$CtETwdyERV3JxQhKLBJPW.KvfT6IpZCSVsTvloYPUXN6QGHF4UsK2'
try{Invoke-A3Psql -DatabaseConfig $db -Arguments @('-q','-v',"reference_date=$ReferenceDate",'-v',"password_hash=$passwordHash",'-f',$temporary)}finally{if(Test-Path $temporary){Remove-Item $temporary -Force}}
Write-Host 'A3 reset + seed completed.';Write-Host "Shared global rows reused: $before";Write-Host "Missing canonical rows created: $(15-$before)";Write-Host "REFERENCE_DATE: $ReferenceDate";Write-Host 'Business timezone: Asia/Ho_Chi_Minh';Write-Host 'Deterministic seed: 20260827'
