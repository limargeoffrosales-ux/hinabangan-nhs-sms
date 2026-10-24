<#
.SYNOPSIS
  Registers and starts a GitHub Actions self-hosted runner for this repo.

.DESCRIPTION
  Why this exists: this is a private repo on a free personal account whose
  Actions budget is currently blocked ("recent account payments have failed
  or your spending limit needs to be increased"). GitHub-hosted runners cannot
  start at all in that state.

  Self-hosted runners do NOT consume GitHub-hosted Actions minutes, so CI keeps
  working while billing is sorted. Once billing is fixed you can switch the
  workflows back to `runs-on: ubuntu-latest` and delete the runner.

  Requires: gh CLI, or a git credential-helper token with repo scope.
  The runner listens for jobs only while this script's process (or the
  service it installs) is running.

.EXAMPLE
  .\scripts\setup-runner.ps1            # register (if needed) + start
  .\scripts\setup-runner.ps1 -Stop      # stop the runner
#>
[CmdletBinding()]
param(
  [switch]$Stop,
  [string]$Repo = 'limargeoffrosales-ux/hinabangan-nhs-sms',
  [string]$RunnerName = 'local-dev-runner',
  [string]$RunnerDir = "$env:LOCALAPPDATA\gh-runner-hnsms",
  [string]$Labels = 'self-hosted,windows,x64'
)

$ErrorActionPreference = 'Stop'

function Get-GitHubToken {
  # Reuse whatever git already authenticates with.
  $filled = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
  if ($filled) {
    $pw = (($filled | Select-String -Pattern '^password=').ToString() -replace '^password=', '').Trim()
    if ($pw) { return $pw }
  }
  if ($env:GH_TOKEN) { return $env:GH_TOKEN }
  if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN }
  throw "No GitHub token found. Run 'gh auth login' or set GH_TOKEN."
}

$listener = Get-Process -Name 'Runner.Listener' -ErrorAction SilentlyContinue

if ($Stop) {
  if ($listener) {
    $listener | ForEach-Object { Write-Host "Stopping runner PID $($_.Id)"; Stop-Process -Id $_.Id -Force }
    Write-Host 'Runner stopped.' -ForegroundColor Green
  } else {
    Write-Host 'Runner was not running.'
  }
  return
}

if ($listener) {
  Write-Host 'Runner already running.' -ForegroundColor Green
  return
}

$token = Get-GitHubToken
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'setup-runner' }

# Registered already?
$runners = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/actions/runners" -Headers $headers
$existing = $runners.runners | Where-Object { $_.name -eq $RunnerName } | Select-Object -First 1

# "Registered" is not enough: the runner also needs its files on THIS machine.
# A previously registered runner whose install directory was cleaned up must be
# re-installed, otherwise run.cmd does not exist and nothing can start.
$haveFiles = Test-Path (Join-Path $RunnerDir 'run.cmd')

if ($existing -and -not $haveFiles) {
  Write-Host "Runner '$RunnerName' is registered but its files are missing - recreating." -ForegroundColor Yellow
  # config.cmd refuses to run while a registration with this name exists, so the
  # stale one has to go first. It is offline, so removing it is safe.
  try {
    Invoke-RestMethod -Method DELETE -Uri "https://api.github.com/repos/$Repo/actions/runners/$($existing.id)" -Headers $headers | Out-Null
    Write-Host "  removed stale registration (id $($existing.id))." -ForegroundColor Green
  } catch {
    Write-Host "  could not remove stale registration: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  $existing = $null
}

if (-not $existing) {
  Write-Host "Registering runner '$RunnerName'..." -ForegroundColor Cyan

  # Always use a current runner: GitHub enforces a minimum version.
  $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/actions/runner/releases/latest' -Headers @{ 'User-Agent' = 'setup-runner' }
  $asset = $release.assets | Where-Object { $_.name -match 'actions-runner-win-x64-.*\.zip$' } | Select-Object -First 1
  if (-not $asset) { throw 'Could not find a win-x64 runner asset.' }

  New-Item -ItemType Directory -Force -Path $RunnerDir | Out-Null
  $zip = Join-Path $env:TEMP $asset.name
  Write-Host "Downloading $($release.tag_name)..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $RunnerDir -Force
  Remove-Item $zip -Force

  # A fresh directory still carries no runner identity, so register even if
  # GitHub already knows this name.
  $reg = Invoke-RestMethod -Method POST -Uri "https://api.github.com/repos/$Repo/actions/runners/registration-token" -Headers $headers
  Push-Location $RunnerDir
  try {
    # Do not pipe config.cmd: it exits non-zero on warnings and the output is
    # swallowed, which previously left the runner registered but unconfigured.
    $cfg = & cmd /c "config.cmd --unattended --url `"https://github.com/$Repo`" --token $($reg.token) --name $RunnerName --labels $Labels --work _work 2>&1"
    $cfgText = ($cfg | Out-String)
  } finally { Pop-Location }
  if ($cfgText -notmatch 'Runner successfully added') {
    throw "config.cmd failed to register the runner:`n$cfgText"
  }
  Write-Host 'Runner installed and registered.' -ForegroundColor Green
} else {
  Write-Host "Runner '$RunnerName' already registered and installed ($($existing.status))." -ForegroundColor Green
}

Write-Host 'Starting runner (listening for jobs)...' -ForegroundColor Cyan
Start-Process -FilePath (Join-Path $RunnerDir 'run.cmd') -WorkingDirectory $RunnerDir -WindowStyle Hidden
Start-Sleep -Seconds 8

$check = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/actions/runners" -Headers $headers
$now = $check.runners | Where-Object { $_.name -eq $RunnerName } | Select-Object -First 1
if ($now.status -eq 'online') {
  Write-Host "Runner is ONLINE and will pick up jobs (labels: $($Labels))." -ForegroundColor Green
} else {
  Write-Host "Runner status is '$($now.status)' - it may need a moment." -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Note: CI only runs while this machine is on and the runner is listening.' -ForegroundColor Yellow
Write-Host 'To stop it:  .\scripts\setup-runner.ps1 -Stop' -ForegroundColor Yellow