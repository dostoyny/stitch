@echo off
setlocal
cd /d "%~dp0"
set MSG=%~1
if "%MSG%"=="" set MSG=update
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  git init
)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/dostoyny/stitch.git
)
git add .
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
) else (
  echo No changes to commit.
)
git branch -M main
git config credential.helper manager-core >nul 2>&1
git push -u origin main
if errorlevel 1 (
  echo Push failed.
  echo Open GitHub sign-in window and complete login.
  pause
  exit /b 1
)
if not "%RENDER_DEPLOY_HOOK_URL%"=="" (
  powershell -NoProfile -Command "try { Invoke-WebRequest -Method Post -Uri '%RENDER_DEPLOY_HOOK_URL%' | Out-Null; Write-Host 'Render deploy triggered.' } catch { Write-Host 'Deploy hook failed.'; exit 1 }"
  if errorlevel 1 (
    echo Open Render dashboard and check Deploy Hook URL.
  )
)
echo Done. GitHub push completed.
pause
