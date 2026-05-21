#!/bin/bash
# Test runner script for Linux/macOS
# Java Trace Analyzer - Trace Tool

set -e

echo "=========================================="
echo "Running Tests"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running installation..."
    ./install.sh
fi

# Run tests
bun test

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All tests passed${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

# Made with Bob
