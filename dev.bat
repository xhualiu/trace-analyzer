@echo off
REM Development server script for Windows
REM Java Trace Analyzer - Trace Tool

echo ==========================================
echo Starting Development Server
echo ==========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Dependencies not installed. Running installation...
    call install.bat
    if %ERRORLEVEL% NEQ 0 exit /b 1
)

REM Start development server
echo Starting Vite development server...
echo The application will be available at: http://localhost:5173
echo.
echo Press Ctrl+C to stop the server
echo.

call bun run dev

@REM Made with Bob
