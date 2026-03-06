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
git push -u origin main
if errorlevel 1 (
  echo Push failed.
  pause
  exit /b 1
)
echo Done.
pause
