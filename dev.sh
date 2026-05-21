#!/bin/bash
# Development server script for Linux/macOS
# Java Trace Analyzer - Trace Tool

set -e

echo "=========================================="
echo "Starting Development Server"
echo "=========================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running installation..."
    ./install.sh
fi

# Start development server
echo "Starting Vite development server..."
echo "The application will be available at: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

bun run dev

# Made with Bob
