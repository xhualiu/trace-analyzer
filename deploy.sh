#!/bin/bash

# GitHub Pages Deployment Script for Trace Analyzer
# This script builds and deploys your app to GitHub Pages

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Trace Analyzer - GitHub Deployment   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Load environment variables
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env and fill in your values${NC}"
    echo -e "${YELLOW}Run: cp .env.example .env${NC}"
    exit 1
fi

source .env

# Validate required variables
if [ -z "$GITHUB_USERNAME" ]; then
    echo -e "${RED}❌ Error: GITHUB_USERNAME not set in .env${NC}"
    exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
    echo -e "${RED}❌ Error: GITHUB_REPO not set in .env${NC}"
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}❌ Error: GITHUB_TOKEN not set in .env${NC}"
    echo -e "${YELLOW}Create a token at: https://github.com/settings/tokens${NC}"
    exit 1
fi

# Set defaults
GITHUB_TYPE=${GITHUB_TYPE:-public}
GITHUB_BRANCH=${GITHUB_BRANCH:-main}

# Determine GitHub URL
if [ "$GITHUB_TYPE" = "ibm" ]; then
    GITHUB_URL="https://github.ibm.com"
    PAGES_URL="https://pages.github.ibm.com/${GITHUB_USERNAME}/${GITHUB_REPO}"
else
    GITHUB_URL="https://github.com"
    PAGES_URL="https://${GITHUB_USERNAME}.github.io/${GITHUB_REPO}"
fi

REPO_URL="${GITHUB_URL}/${GITHUB_USERNAME}/${GITHUB_REPO}.git"

echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "  Username: ${GREEN}${GITHUB_USERNAME}${NC}"
echo -e "  Repository: ${GREEN}${GITHUB_REPO}${NC}"
echo -e "  GitHub Type: ${GREEN}${GITHUB_TYPE}${NC}"
echo -e "  Branch: ${GREEN}${GITHUB_BRANCH}${NC}"
echo -e "  Pages URL: ${GREEN}${PAGES_URL}${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: git is not installed${NC}"
    exit 1
fi

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Error: bun is not installed${NC}"
    echo -e "${YELLOW}Install from: https://bun.sh${NC}"
    exit 1
fi

# Step 1: Build the app
echo -e "${BLUE}🔨 Step 1: Building application...${NC}"
bun run build

if [ ! -d "build" ]; then
    echo -e "${RED}❌ Error: build directory not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Step 2: Initialize git if needed
if [ ! -d ".git" ]; then
    echo -e "${BLUE}📦 Step 2: Initializing git repository...${NC}"
    git init
    git branch -M ${GITHUB_BRANCH}
    
    # Set git config if provided
    if [ -n "$GIT_EMAIL" ]; then
        git config user.email "$GIT_EMAIL"
    fi
    if [ -n "$GIT_NAME" ]; then
        git config user.name "$GIT_NAME"
    fi
    
    echo -e "${GREEN}✓ Git initialized${NC}"
else
    echo -e "${BLUE}📦 Step 2: Git repository already initialized${NC}"
fi
echo ""

# Step 3: Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo -e "${BLUE}📝 Step 3: Creating .gitignore...${NC}"
    cat > .gitignore << 'EOF'
node_modules/
.svelte-kit/
build/
.DS_Store
.env
*.log
EOF
    echo -e "${GREEN}✓ .gitignore created${NC}"
else
    echo -e "${BLUE}📝 Step 3: .gitignore already exists${NC}"
fi
echo ""

# Step 4: Commit source code
echo -e "${BLUE}💾 Step 4: Committing source code...${NC}"
git add .
git commit -m "Deploy Trace Analyzer to GitHub Pages" || echo "No changes to commit"
echo -e "${GREEN}✓ Source committed${NC}"
echo ""

# Step 5: Add remote if not exists
echo -e "${BLUE}🔗 Step 5: Setting up remote repository...${NC}"
if ! git remote | grep -q origin; then
    git remote add origin "https://${GITHUB_TOKEN}@${GITHUB_URL#https://}/${GITHUB_USERNAME}/${GITHUB_REPO}.git"
    echo -e "${GREEN}✓ Remote added${NC}"
else
    git remote set-url origin "https://${GITHUB_TOKEN}@${GITHUB_URL#https://}/${GITHUB_USERNAME}/${GITHUB_REPO}.git"
    echo -e "${GREEN}✓ Remote updated${NC}"
fi
echo ""

# Step 6: Push to GitHub
echo -e "${BLUE}🚀 Step 6: Pushing to GitHub...${NC}"
git push -u origin ${GITHUB_BRANCH} --force

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code pushed successfully${NC}"
else
    echo -e "${RED}❌ Error: Failed to push to GitHub${NC}"
    echo -e "${YELLOW}Check your GITHUB_TOKEN and repository permissions${NC}"
    exit 1
fi
echo ""

# Step 7: Create GitHub Actions workflow
echo -e "${BLUE}⚙️  Step 7: Creating GitHub Actions workflow...${NC}"
mkdir -p .github/workflows

cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Build
        run: bun run build
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./build

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
EOF

git add .github/
git commit -m "Add GitHub Actions workflow for deployment" || echo "Workflow already committed"
git push origin ${GITHUB_BRANCH}

echo -e "${GREEN}✓ Workflow created${NC}"
echo ""

# Success message
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✓ Deployment Successful!          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Next Steps:${NC}"
echo ""
echo -e "1. Go to your repository:"
echo -e "   ${GREEN}${GITHUB_URL}/${GITHUB_USERNAME}/${GITHUB_REPO}${NC}"
echo ""
echo -e "2. Click ${YELLOW}Settings${NC} → ${YELLOW}Pages${NC}"
echo ""
echo -e "3. Under ${YELLOW}Source${NC}, select ${YELLOW}GitHub Actions${NC}"
echo ""
echo -e "4. Wait 1-2 minutes for deployment to complete"
echo ""
echo -e "5. Your app will be live at:"
echo -e "   ${GREEN}${PAGES_URL}${NC}"
echo ""
echo -e "${BLUE}💡 Tip:${NC} Future deployments will happen automatically when you push to ${GITHUB_BRANCH}"
echo ""

# Made with Bob
