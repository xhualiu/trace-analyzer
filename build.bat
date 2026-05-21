@echo off
REM Production build script for Windows
REM Java Trace Analyzer - Trace Tool

setlocal enabledelayedexpansion

echo ==========================================
echo Building for Production
echo ==========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Dependencies not installed. Running installation...
    call install.bat
    if %ERRORLEVEL% NEQ 0 exit /b 1
)

REM Run type checking
echo Running type check...
call bun run check

if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Type check warnings ^(continuing anyway^)
)

REM Run tests
echo.
echo Running tests...
call bun test

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Tests failed. Aborting build.
    pause
    exit /b 1
)
echo [OK] All tests passed

REM Build for production
echo.
echo Building application...
call bun run build

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Build completed successfully

REM Display build output info
echo.
echo ==========================================
echo [SUCCESS] Production Build Complete!
echo ==========================================
echo.
echo Build output location: .\build
echo.
echo To preview the production build locally:
echo   bun run preview
echo.
echo To deploy, upload the contents of the 'build' directory
echo to your web server or hosting service.
echo.
pause

@REM Made with Bob
