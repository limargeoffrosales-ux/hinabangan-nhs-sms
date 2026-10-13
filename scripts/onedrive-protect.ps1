<#
.SYNOPSIS
  Makes this repo buildable on a OneDrive-synced machine.

.DESCRIPTION
  This repo lives under OneDrive (...\OneDrive\Documents\...). OneDrive's Files
  On-Demand evicts files it considers cold, and on this account it does so even
  for files marked "Always keep on this device" (attrib +P). Symptoms:

    * `npm ci` reports "added 821 packages", then node_modules is gutted
      (588 dirs -> 35) within minutes
    * `Test-Path` says a file is missing while `Get-ChildItem` still lists it
    * builds fail with "Could not resolve" / "Cannot find module 'pino'"
    * `npm ci` fails with ENOTEMPTY / rmdir errors (errno -4051)

  Two fixes that do NOT work here:
    - NTFS junctions: npm replaces the junction and writes into the repo anyway
    - attrib +P -U: eviction happens regardless of the pin

  The only durable arrangement is to keep node_modules physically off OneDrive.
  This script builds and checks in a mirror directory outside OneDrive.

  Note: this script copies with /E, never /MIR. Mirror mode propagates
  deletions, so a stale build copy can silently delete tracked files in the
  OneDrive repo.

.EXAMPLE
  .\scripts\onedrive-protect.ps1                 # sync out, then build + check
  .\scripts\onedrive-protect.ps1 -CheckOnly      # just re-run the quality gate
  .\scripts\onedrive-protect.ps1 -SyncBack       # copy source edits back (no deletes)
  .\scripts\onedrive-protect.ps1 -Repair         # npm ci in the build mirror first
#>
[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$SyncBack,
  [switch]$Repair,
  [string]$BuildRoot = 'C:\Users\lgros\school-system'
)

$ErrorActionPreference = 'Stop'

# Resolve the repo root lazily: $PSScriptRoot is not populated in a param default
# under every invocation style.
$RepoRoot = ''
if ($PSScriptRoot) { $RepoRoot = Split-Path -Parent $PSScriptRoot }
if (-not $RepoRoot) { $RepoRoot = (Get-Location).Path }
if (-not (Test-Path (Join-Path $RepoRoot 'package.json'))) {
  throw "Not a repo root: $RepoRoot"
}

$inOneDrive = $RepoRoot -match '(?i)\\OneDrive\\'
$ExcludeDirs = @('.git', 'node_modules', 'dist', 'data')
$ExcludeFiles = @('audit.json')

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

if ($inOneDrive) {
  Write-Host "Repo is inside OneDrive: $RepoRoot" -ForegroundColor Yellow
  Write-Host "Builds must run outside OneDrive. Build root: $BuildRoot" -ForegroundColor Yellow
} else {
  Write-Host "Repo is outside OneDrive - building in place." -ForegroundColor Green
  $BuildRoot = $RepoRoot
}

function Copy-Tree($from, $to) {
  # /E is copy-only. /MIR would propagate deletions and can delete tracked files.
  & robocopy $from $to /E `
    /XD $ExcludeDirs /XF $ExcludeFiles `
    /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy $from -> $to failed with $LASTEXITCODE" }
}

if ($SyncBack -and $BuildRoot -ne $RepoRoot) {
  Write-Step "Syncing source changes back into OneDrive (copy-only)"
  # Guard against a stale mirror silently reverting newer work in the repo.
  # The mirror has no .git, so we compare the repo HEAD against the HEAD that was
  # recorded the last time this script refreshed the mirror.
  if (Test-Path (Join-Path $RepoRoot '.git')) {
    $repoHead = (& git -C $RepoRoot rev-parse --short HEAD 2>$null)
    $stamp = Join-Path $BuildRoot '.mirror-head'
    $lastHead = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { '' }

    if ($repoHead -and $lastHead -and ($repoHead -ne $lastHead)) {
      Write-Host "  REFUSING to sync back." -ForegroundColor Red
      Write-Host "    repo HEAD now        : $repoHead" -ForegroundColor Red
      Write-Host "    mirror built from    : $lastHead" -ForegroundColor Red
      Write-Host "    The build mirror predates these commits and would revert them." -ForegroundColor Red
      Write-Host "    Re-run without -SyncBack to refresh the mirror first." -ForegroundColor Red
      throw "Stale build mirror - sync refused."
    }

    Copy-Tree $BuildRoot $RepoRoot
    if ($repoHead) { Set-Content -LiteralPath $stamp -Value $repoHead -NoNewline }
    Write-Host "  synced; nothing deleted" -ForegroundColor Green
  } else {
    Copy-Tree $BuildRoot $RepoRoot
    Write-Host "  synced; nothing deleted" -ForegroundColor Green
  }
}

if ($BuildRoot -ne $RepoRoot -and -not (Test-Path (Join-Path $BuildRoot 'package.json'))) {
  Write-Step "Creating build mirror at $BuildRoot"
  Copy-Tree $RepoRoot $BuildRoot
}

# Push repo sources into the mirror before building, so edits in either place
# are reflected in the gate.
if ($BuildRoot -ne $RepoRoot -and -not $CheckOnly) {
  Write-Step "Refreshing build mirror from repo"
  Copy-Tree $RepoRoot $BuildRoot
}

if ($Repair) {
  Write-Step "Reinstalling dependencies in the build mirror (off OneDrive)"
  Push-Location $BuildRoot
  try { cmd /c "npm ci --no-audit --no-fund" 2>&1 | Select-Object -Last 2 | Write-Host }
  finally { Pop-Location }
}

Write-Step "Verifying dependency tree is complete"
$probe = Join-Path $BuildRoot 'node_modules'
$dirs = @(Get-ChildItem $probe -Directory -ErrorAction SilentlyContinue)
$ghost = @($dirs | Where-Object { -not (Test-Path $_.FullName) })
Write-Host ("  packages on disk: {0}" -f $dirs.Count)
if ($dirs.Count -lt 200) {
  Write-Host "  WARNING: far fewer than expected - the install is incomplete." -ForegroundColor Red
}
if ($ghost.Count -gt 0) {
  Write-Host "  WARNING: $($ghost.Count) cloud placeholders detected. Re-run with -Repair" -ForegroundColor Red
}
foreach ($critical in @('eslint\package.json', 'pino\package.json', '.bin\eslint.cmd')) {
  $p = Join-Path $probe $critical
  if (-not (Test-Path $p)) { Write-Host "  MISSING: $critical" -ForegroundColor Red }
}

Write-Step "Running quality gate (audit + lint + typecheck + build + i18n + tests)"
$log = Join-Path $env:TEMP 'school-system-check.log'
Push-Location $BuildRoot
$code = 0
try {
  cmd /c "npm run check > `"$log`" 2>&1"
  $code = $LASTEXITCODE
} finally { Pop-Location }

if (Test-Path $log) { Get-Content $log -Tail 14 | Write-Host }

if ($code -eq 0) {
  Write-Host "`nPASS - build and tests are green." -ForegroundColor Green
  if ($inOneDrive) {
    Write-Host "Do NOT run npm inside the OneDrive copy; it will corrupt again." -ForegroundColor Yellow
    Write-Host "Run this script instead, or work in $BuildRoot." -ForegroundColor Yellow
  }
} else {
  Write-Host "`nFAIL (exit $code) - full log: $log" -ForegroundColor Red
  exit $code
}