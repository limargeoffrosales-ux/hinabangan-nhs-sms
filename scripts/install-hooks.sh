#!/usr/bin/env sh
# Installs the git pre-push hook so the quality gate runs before any push.
# Safe to re-run; it will not install the hook twice.
set -e

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

hook_dir="$repo_root/.git/hooks"
hook="$hook_dir/pre-push"

if [ ! -d "$hook_dir" ]; then
  echo "error: $hook_dir not found - is this a git repository?" >&2
  exit 1
fi

# Never clobber a hook the developer already wrote.
if [ -f "$hook" ] && ! grep -q "ondrive-protect\|npm run check" "$hook" 2>/dev/null; then
  existing="$hook.pre-push-backup.$(date +%s)"
  cp "$hook" "$existing"
  echo "existing pre-push hook backed up to $existing"
fi

cp scripts/pre-push.sh "$hook"
chmod +x "$hook"

echo "installed pre-push hook -> $hook"
echo "it runs the quality gate before every push (bypass with: git push --no-verify)"
