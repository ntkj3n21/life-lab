[CmdletBinding()]
param(
    [ValidatePattern('^\d{4}-\d{2}-\d{2}$')][string]$ReferenceDate = '2026-08-27',
    [string]$EnvFile
)

$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if([string]::IsNullOrWhiteSpace($EnvFile)){$EnvFile=Join-Path $PSScriptRoot '../../.env'}
. (Join-Path $PSScriptRoot 'A2-Database.ps1')
$database=Get-A2DatabaseConfig -EnvFile $EnvFile

function Get-A2Fingerprints {
    $lines=Invoke-A2Psql -Capture -DatabaseConfig $database -Arguments @('-q','-At','-F','|','-f',(Join-Path $PSScriptRoot 'fingerprint-a2.sql'))
    $groups=@{}
    foreach($scope in @('A2','A1','UNRELATED','GLOBAL')){
        $values=@($lines|Where-Object{$_ -like "$scope|*"}|ForEach-Object{$_.Substring($scope.Length+1)})
        $groups[$scope]=[pscustomobject]@{Count=$values.Count;Hash=Get-A2Sha256 $values}
    }
    return $groups
}

function Invoke-A2Child([string]$Script) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $Script) -ReferenceDate $ReferenceDate -EnvFile $EnvFile
    if($LASTEXITCODE -ne 0){throw "$Script failed with exit code $LASTEXITCODE."}
}

$before=Get-A2Fingerprints
$a1WasPresent=$before.A1.Count -gt 0
Invoke-A2Child 'Reset-Seed-A2.ps1'
Invoke-A2Child 'Verify-A2.ps1'
$first=Get-A2Fingerprints
Invoke-A2Child 'Reset-Seed-A2.ps1'
Invoke-A2Child 'Verify-A2.ps1'
$second=Get-A2Fingerprints

$failures=[System.Collections.Generic.List[string]]::new()
if($first.A2.Hash -ne $second.A2.Hash){$failures.Add('A2 logical fingerprint changed across resets.')}
foreach($scope in @('UNRELATED','GLOBAL')){
    if($before[$scope].Hash -ne $first[$scope].Hash -or $first[$scope].Hash -ne $second[$scope].Hash){$failures.Add("$scope fingerprint changed during A2 resets.")}
}
if($a1WasPresent -and ($before.A1.Hash -ne $first.A1.Hash -or $first.A1.Hash -ne $second.A1.Hash)){$failures.Add('A1 logical fingerprint changed during A2 resets.')}

Write-Host "A2 logical: $($second.A2.Hash) ($($second.A2.Count) rows)"
if($a1WasPresent){Write-Host "A1 logical: $($second.A1.Hash) ($($second.A1.Count) rows)"}else{Write-Warning 'A1 account was unavailable; A1 runtime isolation was not exercised.'}
Write-Host "Unrelated accounts: $($second.UNRELATED.Hash) ($($second.UNRELATED.Count) rows)"
Write-Host "Non-A2 referenced global metadata: $($second.GLOBAL.Hash) ($($second.GLOBAL.Count) rows)"
if($failures.Count -gt 0){$failures|ForEach-Object{Write-Error $_};exit 1}
Write-Host 'A2 IDEMPOTENCE / ISOLATION: PASS'
