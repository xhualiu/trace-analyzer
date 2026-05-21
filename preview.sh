#!/bin/bash

# Preview the production build
# This script serves the built app on http://localhost:4173

set -e

echo "🚀 Starting preview server..."
echo ""

cd "$(dirname "$0")"

# Check if build directory exists
if [ ! -d "build" ]; then
    echo "❌ Build directory not found!"
    echo "   Run ./build.sh first to create the production build"
    exit 1
fi

echo "📦 Serving build/ directory on http://localhost:4173"
echo ""
echo "✨ Open in browser: http://localhost:4173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Serve the build directory
cd build

# Try python3 first, then python
if command -v python3 &> /dev/null; then
    python3 -m http.server 4173
elif command -v python &> /dev/null; then
    python -m http.server 4173
else
    echo "❌ Python not found!"
    echo "   Install Python or use: bun run preview"
    exit 1
fi

# Made with Bob
