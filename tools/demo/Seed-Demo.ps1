[CmdletBinding()]
param(
    [string]$ReferenceDate = '2026-09-28',
    [ValidateRange(1500, 1500)][int]$NoteCount = 1500,
    [ValidateRange(1500, 1500)][int]$TaskCount = 1500,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$parsedDate = [datetime]::MinValue
if (-not [datetime]::TryParseExact(
    $ReferenceDate, 'yyyy-MM-dd',
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::None,
    [ref]$parsedDate
)) {
    throw 'ReferenceDate must be a valid yyyy-MM-dd date.'
}

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}

. (Join-Path $PSScriptRoot '../a2/A2-Database.ps1')
. (Join-Path $PSScriptRoot 'Demo-Fixtures.ps1')
$database = Get-A2DatabaseConfig -EnvFile $EnvFile
$passwordHash = '$2a$10$CtETwdyERV3JxQhKLBJPW.KvfT6IpZCSVsTvloYPUXN6QGHF4UsK2'
Invoke-DemoFixtureSql -DatabaseConfig $database -SqlFile (Join-Path $PSScriptRoot 'seed-v3-demo.sql') -Variables @(
    '-v', "reference_date=$ReferenceDate",
    '-v', "note_count=$NoteCount",
    '-v', "task_count=$TaskCount",
    '-v', "password_hash=$passwordHash"
)
Write-Host "Demo seeded for $ReferenceDate with $NoteCount Notes and $TaskCount Tasks."
