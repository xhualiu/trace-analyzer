#!/bin/bash
# Installation script for Linux/macOS
# Java Trace Analyzer - Trace Tool

set -e  # Exit on error

echo "=========================================="
echo "Java Trace Analyzer - Installation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Bun is installed
echo "Checking for Bun runtime..."
if ! command -v bun &> /dev/null; then
    echo -e "${YELLOW}Bun is not installed. Installing Bun...${NC}"
    curl -fsSL https://bun.sh/install | bash
    
    # Add Bun to PATH for current session
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    echo -e "${GREEN}✓ Bun installed successfully${NC}"
    echo ""
    echo -e "${YELLOW}Note: You may need to restart your terminal or run:${NC}"
    echo "  source ~/.bashrc  # or ~/.zshrc depending on your shell"
    echo ""
else
    echo -e "${GREEN}✓ Bun is already installed ($(bun --version))${NC}"
fi

# Verify Bun is accessible
if ! command -v bun &> /dev/null; then
    echo -e "${RED}✗ Bun installation failed or not in PATH${NC}"
    echo "Please install Bun manually from https://bun.sh"
    exit 1
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
bun install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# Run type checking
echo ""
echo "Running type check..."
bun run check

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${YELLOW}⚠ Type check warnings (non-critical)${NC}"
fi

# Run tests
echo ""
echo "Running tests..."
bun test

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Installation completed successfully!${NC}"
echo "=========================================="
echo ""
echo "To start the development server, run:"
echo "  ./dev.sh"
echo ""
echo "To build for production, run:"
echo "  ./build.sh"
echo ""

# Made with Bob
