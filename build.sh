#!/bin/bash
# Production build script for Linux/macOS
# Java Trace Analyzer - Trace Tool

set -e

echo "=========================================="
echo "Building for Production"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running installation..."
    ./install.sh
fi

# Run type checking
echo "Running type check..."
bun run check

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠ Type check warnings (continuing anyway)${NC}"
fi

# Run tests
echo ""
echo "Running tests..."
bun test

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Tests failed. Aborting build.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ All tests passed${NC}"

# Build for production
echo ""
echo "Building application..."
bun run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build completed successfully${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Display build output info
echo ""
echo "=========================================="
echo -e "${GREEN}Production Build Complete!${NC}"
echo "=========================================="
echo ""
echo "Build output location: ./build"
echo ""
echo "To preview the production build locally:"
echo "  bun run preview"
echo ""
echo "To deploy, upload the contents of the 'build' directory"
echo "to your web server or hosting service."
echo ""

# Made with Bob
