@echo off
setlocal
cd /d "%~dp0"
echo === Hinabangan NHS - deploy to Render (push to main) ===
echo.
echo Usage: %~nx0 push    - stage the known files, commit, then push
echo        %~nx0 force   - stage/tracked-push everything (git add -A)
echo.

if /I "%1"=="push" goto push
if /I "%1"=="force" goto force
echo Unknown argument. Use "push" or "force".
exit /b 1

:push
git status --short
echo.
echo Staging: security fixes, abort-error cleanup, quarterly report...
git add server/src/index.js ^
        server/src/routes/deped-forms.routes.js ^
        server/src/routes/auth.routes.js ^
        server/src/routes/users.routes.js ^
        server/src/seed.js ^
        server/src/routes/dashboard.routes.js ^
        web/src/main.jsx ^
        web/src/lib/constants.js ^
        web/src/lib/api.js ^
        web/src/components/DashboardSections.jsx ^
        web/src/pages/Aral.jsx ^
        web/src/pages/Compliance.jsx ^
        web/src/pages/Analytics.jsx ^
        web/src/pages/GradingScales.jsx ^
        web/src/pages/Submissions.jsx
if errorlevel 1 goto fail
git commit -m "Quarterly subject report, abort-error cleanup, and security hardening"
if errorlevel 1 echo [commit produced no changes or failed - continuing to push]
git push origin main
if errorlevel 1 goto fail
goto done

:force
git add -A
git commit -m "Deploy: current working tree" || echo [nothing staged / commit failed]
git push origin main
if errorlevel 1 goto fail
goto done

:done
echo.
echo === Deploy triggered. Render will rebuild within ~2-4 minutes. ===
echo After deploy, hard-refresh (Ctrl+F5) the dashboard.
exit /b 0

:fail
echo.
echo [!] Something failed above. Check the git output and fix before pushing.
echo     If a file path is wrong, edit this script or run the git commands manually.
exit /b 1