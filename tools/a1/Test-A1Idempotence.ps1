[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
    [string]$ReferenceDate = '2026-08-27',
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}

. (Join-Path $PSScriptRoot 'A1-Database.ps1')
$databaseConfig = Get-A1DatabaseConfig -EnvFile $EnvFile

function Get-UnrelatedFingerprint {
    $sql = @'
WITH demo AS (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local'),
rows AS (
    SELECT 'accounts:' || to_jsonb(account)::text AS payload
    FROM accounts account
    WHERE account.id NOT IN (SELECT id FROM demo)
    UNION ALL
    SELECT 'youtube:' || to_jsonb(youtube)::text
    FROM youtube_videos youtube
    WHERE EXISTS (
        SELECT 1 FROM library_videos library
        WHERE library.youtube_source_id = youtube.id
          AND library.account_id NOT IN (SELECT id FROM demo))
       OR EXISTS (
        SELECT 1 FROM notes note
        WHERE note.youtube_source_id = youtube.id
          AND note.account_id NOT IN (SELECT id FROM demo))
    UNION ALL
    SELECT 'library:' || to_jsonb(library)::text
    FROM library_videos library
    WHERE library.account_id NOT IN (SELECT id FROM demo)
    UNION ALL
    SELECT 'tags:' || to_jsonb(tag)::text
    FROM tags tag
    WHERE tag.account_id NOT IN (SELECT id FROM demo)
    UNION ALL
    SELECT 'links:' || to_jsonb(relation)::text
    FROM library_video_tags relation
    JOIN library_videos library ON library.id = relation.library_video_id
    WHERE library.account_id NOT IN (SELECT id FROM demo)
    UNION ALL
    SELECT 'watch:' || to_jsonb(session)::text
    FROM watch_sessions session
    JOIN library_videos library ON library.id = session.library_video_id
    WHERE library.account_id NOT IN (SELECT id FROM demo)
    UNION ALL
    SELECT 'notes:' || to_jsonb(note)::text
    FROM notes note
    WHERE note.account_id NOT IN (SELECT id FROM demo)
    UNION ALL
    SELECT 'tasks:' || to_jsonb(task)::text
    FROM tasks task
    WHERE task.account_id NOT IN (SELECT id FROM demo))
SELECT md5(coalesce(string_agg(payload, E'\n' ORDER BY payload), '')) FROM rows;
'@

    return (Invoke-A1PsqlCapture `
        -DatabaseConfig $databaseConfig `
        -Arguments @('-q', '-At', '-c', $sql) |
        Select-Object -Last 1).Trim()
}

function Get-A1LogicalFingerprint {
    $sql = @'
WITH demo AS (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local'),
rows AS (
    SELECT 'account:' || account.email || ':' || account.display_name || ':'
        || account.created_at || ':' || account.updated_at AS payload
    FROM accounts account JOIN demo ON demo.id = account.id
    UNION ALL
    SELECT 'library:' || youtube.youtube_video_id || ':'
        || coalesce(library.custom_title, '') || ':'
        || coalesce(library.personal_description, '') || ':'
        || library.added_at || ':' || library.updated_at
    FROM library_videos library
    JOIN demo ON demo.id = library.account_id
    JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
    UNION ALL
    SELECT 'tag:' || tag.name || ':' || tag.normalized_name || ':'
        || tag.created_at || ':' || tag.updated_at
    FROM tags tag JOIN demo ON demo.id = tag.account_id
    UNION ALL
    SELECT 'link:' || youtube.youtube_video_id || ':' || tag.normalized_name
    FROM library_video_tags relation
    JOIN library_videos library ON library.id = relation.library_video_id
    JOIN demo ON demo.id = library.account_id
    JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
    JOIN tags tag ON tag.id = relation.tag_id
    UNION ALL
    SELECT 'watch:' || youtube.youtube_video_id || ':' || session.started_at || ':'
        || session.last_heartbeat_at || ':' || session.ended_at || ':'
        || session.watch_time_seconds || ':' || session.validity_status
    FROM watch_sessions session
    JOIN library_videos library ON library.id = session.library_video_id
    JOIN demo ON demo.id = library.account_id
    JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
    UNION ALL
    SELECT 'note:' || youtube.youtube_video_id || ':' || note.content || ':'
        || coalesce(note.timestamp_seconds::text, '') || ':'
        || note.created_at || ':' || note.updated_at
    FROM notes note
    JOIN demo ON demo.id = note.account_id
    JOIN youtube_videos youtube ON youtube.id = note.youtube_source_id
    UNION ALL
    SELECT 'task:' || task.source_status || ':' || task.title || ':'
        || coalesce(task.description, '') || ':' || task.status || ':'
        || coalesce(task.deadline::text, '') || ':' || task.created_at || ':'
        || task.updated_at || ':' || coalesce(source_youtube.youtube_video_id, '') || ':'
        || coalesce(source_note.content, '') || ':' || coalesce(source_note.created_at::text, '')
    FROM tasks task
    JOIN demo ON demo.id = task.account_id
    LEFT JOIN notes source_note ON source_note.id = task.source_note_id
    LEFT JOIN youtube_videos source_youtube ON source_youtube.id = source_note.youtube_source_id)
SELECT md5(coalesce(string_agg(payload, E'\n' ORDER BY payload), '')) FROM rows;
'@

    return (Invoke-A1PsqlCapture `
        -DatabaseConfig $databaseConfig `
        -Arguments @('-q', '-At', '-c', $sql) |
        Select-Object -Last 1).Trim()
}

$unrelatedBefore = Get-UnrelatedFingerprint
$a1Before = Get-A1LogicalFingerprint

& (Join-Path $PSScriptRoot 'Reset-Seed-A1.ps1') `
    -ReferenceDate $ReferenceDate `
    -EnvFile $EnvFile
if ($LASTEXITCODE -ne 0) {
    throw 'Second A1 reset + seed failed.'
}

& (Join-Path $PSScriptRoot 'Verify-A1.ps1') `
    -ReferenceDate $ReferenceDate `
    -EnvFile $EnvFile
if ($LASTEXITCODE -ne 0) {
    throw 'Second A1 verification failed.'
}

$unrelatedAfter = Get-UnrelatedFingerprint
$a1After = Get-A1LogicalFingerprint

if ($unrelatedBefore -ne $unrelatedAfter) {
    throw 'Unrelated-account fingerprint changed during A1 reset.'
}
if ($a1Before -ne $a1After) {
    throw 'A1 logical fingerprint changed across deterministic reset.'
}

Write-Host ''
Write-Host 'A1 IDEMPOTENCE: PASS'
Write-Host "Unrelated-account fingerprint: $unrelatedAfter"
Write-Host "A1 logical fingerprint: $a1After"
