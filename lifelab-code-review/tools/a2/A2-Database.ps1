Set-StrictMode -Version Latest

function Get-A2DotEnv {
    param([Parameter(Mandatory)][string]$Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        if ($line -match '^([^#=]+)=(.*)$') {
            $values[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    return $values
}

function Get-A2DatabaseConfig {
    param([Parameter(Mandatory)][string]$EnvFile)

    $dotenv = Get-A2DotEnv -Path $EnvFile
    function Resolve-A2Value {
        param([string]$Name, [string]$DefaultValue)
        $environmentValue = [Environment]::GetEnvironmentVariable($Name)
        if (-not [string]::IsNullOrWhiteSpace($environmentValue)) {
            return $environmentValue
        }
        if ($dotenv.ContainsKey($Name) -and
            -not [string]::IsNullOrWhiteSpace($dotenv[$Name])) {
            return $dotenv[$Name]
        }
        return $DefaultValue
    }

    [pscustomobject]@{
        Host = Resolve-A2Value 'DB_HOST' 'localhost'
        Port = Resolve-A2Value 'DB_PORT' '5433'
        Database = Resolve-A2Value 'DB_NAME' 'lifelab'
        Username = Resolve-A2Value 'DB_USERNAME' 'lifelab'
        Password = Resolve-A2Value 'DB_PASSWORD' 'lifelab'
    }
}

function Get-A2PsqlPath {
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -ne $command) { return $command.Source }

    $knownPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
    if (Test-Path -LiteralPath $knownPath) { return $knownPath }
    throw 'psql was not found. Install PostgreSQL client tools or add psql to PATH.'
}

function ConvertTo-A2SqlLiteral {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) { return 'NULL' }
    return "'$(([string]$Value).Replace("'", "''"))'"
}

function Invoke-A2Psql {
    param(
        [Parameter(Mandatory)][pscustomobject]$DatabaseConfig,
        [Parameter(Mandatory)][string[]]$Arguments,
        [switch]$Capture
    )

    $psql = Get-A2PsqlPath
    $previousPassword = $env:PGPASSWORD
    $previousClientEncoding = $env:PGCLIENTENCODING
    $env:PGPASSWORD = $DatabaseConfig.Password
    $env:PGCLIENTENCODING = 'UTF8'
    try {
        if ($Capture) {
            $output = @(& $psql -X -v ON_ERROR_STOP=1 -h $DatabaseConfig.Host `
                -p $DatabaseConfig.Port -U $DatabaseConfig.Username `
                -d $DatabaseConfig.Database @Arguments)
            if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE." }
            return $output
        }

        & $psql -X -v ON_ERROR_STOP=1 -h $DatabaseConfig.Host `
            -p $DatabaseConfig.Port -U $DatabaseConfig.Username `
            -d $DatabaseConfig.Database @Arguments
        if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE." }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $env:PGCLIENTENCODING = $previousClientEncoding
    }
}

function Get-A2Sha256 {
    param([Parameter(Mandatory)][string[]]$Lines)
    $text = ($Lines -join "`n")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $algorithm.ComputeHash($bytes)
        return ([BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}
