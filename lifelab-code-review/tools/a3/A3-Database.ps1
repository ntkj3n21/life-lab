Set-StrictMode -Version Latest

function Get-A3DotEnv {
    param([Parameter(Mandatory)][string]$Path)
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $values }
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        if ($line -match '^([^#=]+)=(.*)$') { $values[$matches[1].Trim()] = $matches[2].Trim() }
    }
    return $values
}

function Get-A3DatabaseConfig {
    param([Parameter(Mandatory)][string]$EnvFile)
    $dotenv = Get-A3DotEnv -Path $EnvFile
    function Resolve-A3Value([string]$Name, [string]$DefaultValue) {
        $environmentValue = [Environment]::GetEnvironmentVariable($Name)
        if (-not [string]::IsNullOrWhiteSpace($environmentValue)) { return $environmentValue }
        if ($dotenv.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($dotenv[$Name])) { return $dotenv[$Name] }
        return $DefaultValue
    }
    [pscustomobject]@{
        Host = Resolve-A3Value 'DB_HOST' 'localhost'
        Port = Resolve-A3Value 'DB_PORT' '5433'
        Database = Resolve-A3Value 'DB_NAME' 'lifelab'
        Username = Resolve-A3Value 'DB_USERNAME' 'lifelab'
        Password = Resolve-A3Value 'DB_PASSWORD' 'lifelab'
    }
}

function Get-A3PsqlPath {
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -ne $command) { return $command.Source }
    $knownPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
    if (Test-Path -LiteralPath $knownPath) { return $knownPath }
    throw 'psql was not found. Install PostgreSQL client tools or add psql to PATH.'
}

function ConvertTo-A3SqlLiteral {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return 'NULL' }
    return "'$(([string]$Value).Replace("'", "''"))'"
}

function Invoke-A3Psql {
    param(
        [Parameter(Mandatory)][pscustomobject]$DatabaseConfig,
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$Capture
    )
    $psql = Get-A3PsqlPath
    $previousPassword = $env:PGPASSWORD
    $previousClientEncoding = $env:PGCLIENTENCODING
    $env:PGPASSWORD = $DatabaseConfig.Password
    $env:PGCLIENTENCODING = 'UTF8'
    try {
        if ($Capture) {
            $output = @(& $psql -X -v ON_ERROR_STOP=1 -h $DatabaseConfig.Host -p $DatabaseConfig.Port `
                -U $DatabaseConfig.Username -d $DatabaseConfig.Database @Arguments)
            if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE." }
            return $output
        }
        & $psql -X -v ON_ERROR_STOP=1 -h $DatabaseConfig.Host -p $DatabaseConfig.Port `
            -U $DatabaseConfig.Username -d $DatabaseConfig.Database @Arguments
        if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE." }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $env:PGCLIENTENCODING = $previousClientEncoding
    }
}

function Get-A3Sha256 {
    param([Parameter(Mandatory)][string[]]$Lines)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $algorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes(($Lines -join "`n")))
        return ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
    }
    finally { $algorithm.Dispose() }
}
