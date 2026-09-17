<#
.SYNOPSIS
  Installs the skill-router-mcp binary on Windows.

.DESCRIPTION
  irm https://raw.githubusercontent.com/Mane087/skill-router/main/install.ps1 | iex

  Environment:
    SKILL_ROUTER_VERSION      release tag to install, exactly as it appears on
                              the release, such as 0.1.0 (default: latest)
    SKILL_ROUTER_INSTALL_DIR  where to put the binary
                              (default: %LOCALAPPDATA%\Programs\skill-router-mcp)
#>

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = 'Mane087/skill-router'
$Binary = 'skill-router-mcp'

function Get-InstallDir {
    if ($env:SKILL_ROUTER_INSTALL_DIR) {
        return $env:SKILL_ROUTER_INSTALL_DIR
    }

    return Join-Path $env:LOCALAPPDATA "Programs\$Binary"
}

function Get-Asset {
    $architecture = $env:PROCESSOR_ARCHITECTURE

    # Only x64 is built. Windows on ARM runs it through emulation, which is
    # worth saying out loud rather than leaving to a confusing failure.
    if ($architecture -eq 'ARM64') {
        Write-Host 'Windows on ARM: installing the x64 binary, which runs under emulation.'
    }
    elseif ($architecture -ne 'AMD64') {
        throw "Unsupported architecture: $architecture."
    }

    return "$Binary-windows-x64.exe"
}

# Read from the redirect rather than the API: no token and no rate limit that
# matters in practice.
function Get-LatestVersion {
    $response = Invoke-WebRequest -Uri "https://github.com/$Repo/releases/latest" `
        -MaximumRedirection 0 -ErrorAction SilentlyContinue -SkipHttpErrorCheck

    $location = $response.Headers.Location

    if (-not $location) {
        throw 'Could not reach GitHub to resolve the latest version.'
    }

    $version = ([string]$location).Split('/')[-1]

    # Whatever the tag is called is what the download URL needs, so this only
    # rejects the shapes that mean the redirect did not land on a release.
    if (-not $version -or $version -in @('latest', 'releases')) {
        throw "Could not resolve the latest release; got `"$version`"."
    }

    return $version
}

# A published checksum is the only thing standing between a proxy and a binary
# that will run with the user's permissions.
function Test-Checksum {
    param(
        [string] $File,
        [string] $SumsFile,
        [string] $Asset
    )

    $expectedLine = Get-Content $SumsFile | Where-Object { $_ -match "\s$([regex]::Escape($Asset))$" }

    if (-not $expectedLine) {
        throw "SHA256SUMS does not list $Asset."
    }

    $expected = ($expectedLine -split '\s+')[0]
    $actual = (Get-FileHash $File -Algorithm SHA256).Hash.ToLower()

    if ($actual -ne $expected.ToLower()) {
        throw "Checksum mismatch for $Asset.`n  expected $expected`n  actual   $actual"
    }

    Write-Host 'Checksum verified'
}

function Add-ToUserPath {
    param([string] $Directory)

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')

    if ($userPath -split ';' -contains $Directory) {
        return
    }

    [Environment]::SetEnvironmentVariable('Path', "$userPath;$Directory", 'User')
    Write-Host ''
    Write-Host "Added $Directory to your PATH. Open a new terminal for it to take effect."
}

$asset = Get-Asset
$version = if ($env:SKILL_ROUTER_VERSION) { $env:SKILL_ROUTER_VERSION } else { Get-LatestVersion }
$installDir = Get-InstallDir

Write-Host "Installing $Binary $version ($asset)"

$workspace = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $workspace | Out-Null

try {
    $base = "https://github.com/$Repo/releases/download/$version"

    Invoke-WebRequest -Uri "$base/$asset" -OutFile (Join-Path $workspace $asset)
    Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile (Join-Path $workspace 'SHA256SUMS')

    Test-Checksum -File (Join-Path $workspace $asset) `
        -SumsFile (Join-Path $workspace 'SHA256SUMS') `
        -Asset $asset

    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Move-Item -Path (Join-Path $workspace $asset) `
        -Destination (Join-Path $installDir "$Binary.exe") -Force

    Write-Host "Installed to $(Join-Path $installDir "$Binary.exe")"
    Add-ToUserPath -Directory $installDir
}
finally {
    Remove-Item -Recurse -Force $workspace -ErrorAction SilentlyContinue
}
