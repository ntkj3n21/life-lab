Set-StrictMode -Version Latest

function Get-A1DotEnv {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^([^#=]+)=(.*)$') {
            $values[$matches[1].Trim()] = $matches[2].Trim()
        }
    }

    return $values
}

function Get-A1DatabaseConfig {
    param(
        [Parameter(Mandatory)]
        [string]$EnvFile
    )

    $dotenv = Get-A1DotEnv -Path $EnvFile

    function Resolve-Value {
        param(
            [Parameter(Mandatory)]
            [string]$Name,
            [Parameter(Mandatory)]
            [string]$DefaultValue
        )

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

    return [pscustomobject]@{
        Host = Resolve-Value -Name 'DB_HOST' -DefaultValue 'localhost'
        Port = Resolve-Value -Name 'DB_PORT' -DefaultValue '5433'
        Database = Resolve-Value -Name 'DB_NAME' -DefaultValue 'lifelab'
        Username = Resolve-Value -Name 'DB_USERNAME' -DefaultValue 'lifelab'
        Password = Resolve-Value -Name 'DB_PASSWORD' -DefaultValue 'lifelab'
    }
}

function Get-A1PsqlPath {
    $command = Get-Command psql -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    $knownPath = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
    if (Test-Path -LiteralPath $knownPath) {
        return $knownPath
    }

    throw 'psql was not found. Install PostgreSQL client tools or add psql to PATH.'
}

function ConvertTo-A1SqlLiteral {
    param(
        [AllowNull()]
        [object]$Value
    )

    if ($null -eq $Value) {
        return 'NULL'
    }

    return "'$(([string]$Value).Replace("'", "''"))'"
}

function Invoke-A1Psql {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$DatabaseConfig,
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $psql = Get-A1PsqlPath
    $previousPassword = $env:PGPASSWORD
    $previousClientEncoding = $env:PGCLIENTENCODING
    $env:PGPASSWORD = $DatabaseConfig.Password
    $env:PGCLIENTENCODING = 'UTF8'

    try {
        & $psql `
            -X `
            -v ON_ERROR_STOP=1 `
            -h $DatabaseConfig.Host `
            -p $DatabaseConfig.Port `
            -U $DatabaseConfig.Username `
            -d $DatabaseConfig.Database `
            @Arguments

        if ($LASTEXITCODE -ne 0) {
            throw "psql exited with code $LASTEXITCODE."
        }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $env:PGCLIENTENCODING = $previousClientEncoding
    }
}

function Invoke-A1PsqlCapture {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$DatabaseConfig,
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $psql = Get-A1PsqlPath
    $previousPassword = $env:PGPASSWORD
    $previousClientEncoding = $env:PGCLIENTENCODING
    $env:PGPASSWORD = $DatabaseConfig.Password
    $env:PGCLIENTENCODING = 'UTF8'

    try {
        $output = @(& $psql `
            -X `
            -v ON_ERROR_STOP=1 `
            -h $DatabaseConfig.Host `
            -p $DatabaseConfig.Port `
            -U $DatabaseConfig.Username `
            -d $DatabaseConfig.Database `
            @Arguments)

        if ($LASTEXITCODE -ne 0) {
            throw "psql exited with code $LASTEXITCODE."
        }

        return $output
    }
    finally {
        $env:PGPASSWORD = $previousPassword
        $env:PGCLIENTENCODING = $previousClientEncoding
    }
}
