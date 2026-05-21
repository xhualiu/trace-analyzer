@echo off
REM Installation script for Windows
REM Java Trace Analyzer - Trace Tool

setlocal enabledelayedexpansion

echo ==========================================
echo Java Trace Analyzer - Installation Script
echo ==========================================
echo.

REM Check if Bun is installed
echo Checking for Bun runtime...
where bun >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Bun is not installed.
    echo.
    echo Please install Bun from: https://bun.sh
    echo.
    echo For Windows, run in PowerShell:
    echo   powershell -c "irm bun.sh/install.ps1 | iex"
    echo.
    echo After installation, restart this script.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('bun --version') do set BUN_VERSION=%%i
    echo [OK] Bun is already installed (!BUN_VERSION!)
)

REM Install dependencies
echo.
echo Installing dependencies...
call bun install

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed successfully

REM Run type checking
echo.
echo Running type check...
call bun run check

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Type check warnings (non-critical)
) else (
    echo [OK] Type check passed
)

REM Run tests
echo.
echo Running tests...
call bun test

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Some tests failed
    pause
    exit /b 1
)
echo [OK] All tests passed

echo.
echo ==========================================
echo [SUCCESS] Installation completed!
echo ==========================================
echo.
echo To start the development server, run:
echo   dev.bat
echo.
echo To build for production, run:
echo   build.bat
echo.
pause

@REM Made with Bob
