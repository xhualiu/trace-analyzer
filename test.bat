@echo off
REM Test runner script for Windows
REM Java Trace Analyzer - Trace Tool

echo ==========================================
echo Running Tests
echo ==========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Dependencies not installed. Running installation...
    call install.bat
    if %ERRORLEVEL% NEQ 0 exit /b 1
)

REM Run tests
call bun test

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] All tests passed
    exit /b 0
) else (
    echo.
    echo [ERROR] Some tests failed
    exit /b 1
)

@REM Made with Bob
