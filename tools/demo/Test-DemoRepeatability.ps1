[CmdletBinding()]
param(
    [string]$ReferenceDate = '2026-09-28',
    [ValidateRange(1500, 1500)][int]$NoteCount = 1500,
    [ValidateRange(1500, 1500)][int]$TaskCount = 1500,
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}

. (Join-Path $PSScriptRoot '../a2/A2-Database.ps1')
. (Join-Path $PSScriptRoot 'Demo-Fixtures.ps1')
$database = Get-A2DatabaseConfig -EnvFile $EnvFile

function Get-Fingerprint([string]$SqlFile) {
    return (@(Invoke-DemoFixtureSql -DatabaseConfig $database `
        -SqlFile (Join-Path $PSScriptRoot $SqlFile) -Capture) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join "`n"
}

$protectedBefore = Get-Fingerprint 'fingerprint-protected.sql'
Write-Host 'Captured A1/A2, unrelated-account, and protected global-source fingerprints.'

for ($pass = 1; $pass -le 2; $pass++) {
    & (Join-Path $PSScriptRoot 'Reset-Demo.ps1') -EnvFile $EnvFile
    Invoke-DemoFixtureSql -DatabaseConfig $database `
        -SqlFile (Join-Path $PSScriptRoot 'verify-source-boundaries.sql') `
        -Variables @('-v', 'phase=reset')
    & (Join-Path $PSScriptRoot 'Seed-Demo.ps1') -ReferenceDate $ReferenceDate `
        -NoteCount $NoteCount -TaskCount $TaskCount -EnvFile $EnvFile
    Invoke-DemoFixtureSql -DatabaseConfig $database `
        -SqlFile (Join-Path $PSScriptRoot 'verify-source-boundaries.sql') `
        -Variables @('-v', 'phase=seed')
    & (Join-Path $PSScriptRoot 'Verify-Demo.ps1') -ReferenceDate $ReferenceDate `
        -NoteCount $NoteCount -TaskCount $TaskCount -EnvFile $EnvFile

    $fingerprint = Get-Fingerprint 'fingerprint-demo.sql'
    if ($pass -eq 1) {
        $firstFingerprint = $fingerprint
    }
    elseif ($fingerprint -ne $firstFingerprint) {
        throw 'Second seed differs from the first logical dataset.'
    }

    $protectedAfter = Get-Fingerprint 'fingerprint-protected.sql'
    if ($protectedAfter -ne $protectedBefore) {
        throw "A1, A2, unrelated account, or protected global Source changed on pass $pass."
    }
    Write-Host "Pass ${pass}: demo logical fingerprint $fingerprint; protected fingerprints unchanged."
}
