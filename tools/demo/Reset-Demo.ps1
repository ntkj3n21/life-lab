[CmdletBinding()]
param([string]$EnvFile)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    $EnvFile = Join-Path $PSScriptRoot '../../.env'
}

. (Join-Path $PSScriptRoot '../a2/A2-Database.ps1')
. (Join-Path $PSScriptRoot 'Demo-Fixtures.ps1')
$database = Get-A2DatabaseConfig -EnvFile $EnvFile
Invoke-DemoFixtureSql -DatabaseConfig $database -SqlFile (Join-Path $PSScriptRoot 'reset-demo.sql')
Write-Host 'Demo account data reset; unreferenced deterministic Demo-only Sources removed.'
