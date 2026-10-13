#!/usr/bin/env sh
# Pre-push guard: run the quality gate before anything reaches the remote.
#
# Why this exists: GitHub Actions is currently unable to start jobs (account
# billing / spending limit), so the "Quality gate" job never runs and a broken
# push would land on main unverified. This hook runs the same `npm run check`
# locally first and blocks the push on failure.
#
# It reuses scripts/onedrive-protect.ps1, which already knows how to build from
# a mirror outside OneDrive (node_modules does not survive being synced by
# OneDrive on this machine).
#
# Install once per clone:
#   sh scripts/install-hooks.sh
#
# Bypass deliberately with:  git push --no-verify
set -e

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ "${SKIP_PREPUSH:-0}" = "1" ]; then
  echo "pre-push: SKIP_PREPUSH=1, skipping gate"
  exit 0
fi

# On Windows-with-OneDrive the only reliable way to build is the mirror helper.
# Everywhere else, run the gate directly.
if command -v powershell.exe >/dev/null 2>&1 && [ -f scripts/onedrive-protect.ps1 ]; then
  echo "pre-push: running quality gate via onedrive-protect mirror helper..."
  powershell.exe -NoProfile -ExecutionPolicy Bypass \
    -File "scripts\\onedrive-protect.ps1" -CheckOnly
else
  echo "pre-push: running npm run check..."
  npm run check
fi

echo "pre-push: quality gate passed"
