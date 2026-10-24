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

# One gate at a time. A pre-push hook that is killed (agent timeout, Ctrl+C) can
# leave its PowerShell + cmd/npm/eslint tree running in the mirror, holding file
# locks. The NEXT gate then dies with "The process cannot access the file
# because it is being used by another process" and blocks an unrelated push.
#
# Mutex: a TEMP file shared by every invocation on this machine stamps the owner
# PID. On the next run a stale owner (dead, or alive but holding the lock over
# 10 minutes) is reaped with taskkill /T before anything is built. A younger
# alive owner means a real gate is in flight, so we wait for it instead of
# racing it.
$GateLock = Join-Path $env:TEMP 'school-system.gate.lock'

function Get-GateOwner {
  if (-not (Test-Path -LiteralPath $GateLock)) { return $null }
  $text = (Get-Content -LiteralPath $GateLock -Raw).Trim()
  if ($text -notmatch '^\d+$') { return $null }
  return [int]$text
}

function Acquire-GateLock {
  $waitedSec = 0
  while ($true) {
    $owner = Get-GateOwner
    if ($null -eq $owner) { break }
    $alive = $null -ne (Get-Process -Id $owner -ErrorAction SilentlyContinue)
    $stale = -not $alive
    if ($alive) {
      $age = (Get-Date) - (Get-Item -LiteralPath $GateLock).LastWriteTime
      $stale = $age.TotalMinutes -ge 10
    }
    if ($stale) {
      Write-Host "  Reaping stale gate owner pid=$owner (left behind by a killed run)" -ForegroundColor Yellow
      taskkill /PID $owner /T /F 2>$null | Out-Null
      Remove-Item -LiteralPath $GateLock -Force -ErrorAction SilentlyContinue
      continue
    }
    if ($waitedSec -ge 1500) {
      Write-Host "  Another gate (pid=$owner) has been running for over 25 minutes; aborting rather than waiting forever." -ForegroundColor Red
      exit 3
    }
    Write-Host "  Another gate is running (pid=$owner); waiting up to 25 min for it to finish..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    $waitedSec += 5
  }
  Set-Content -LiteralPath $GateLock -Value $PID -NoNewline -Encoding ascii
}

function Release-GateLock {
  $owner = Get-GateOwner
  if ($null -ne $owner -and $owner -eq $PID) {
    Remove-Item -LiteralPath $GateLock -Force -ErrorAction SilentlyContinue
  }
}

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
    $stamp = Join-Path $env:TEMP 'school-system.mirror-head'
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

Acquire-GateLock

if ($BuildRoot -ne $RepoRoot -and -not (Test-Path (Join-Path $BuildRoot 'package.json'))) {
  Write-Step "Creating build mirror at $BuildRoot"
  Copy-Tree $RepoRoot $BuildRoot
}

# Always push repo sources into the mirror before building. The gate is only
# meaningful if it runs the code it is being asked to approve.
#
# This used to be skipped under -CheckOnly, which made the pre-push hook check
# a stale mirror: it validated the tree from whenever the mirror was last
# refreshed, then blocked the push of correct newer code. A gate that reports
# on the wrong revision is worse than no gate at all.
if ($BuildRoot -ne $RepoRoot) {
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
} finally {
  Pop-Location
  Release-GateLock
}

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