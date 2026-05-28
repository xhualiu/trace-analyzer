#!/bin/bash

# Fix GitHub Pages Deployment
# This script fixes the workflow and re-triggers deployment

set -e

echo "╔════════════════════════════════════════╗"
echo "║   Fix GitHub Pages Deployment         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository"
    echo "   Please run this from trace-tool/app directory"
    exit 1
fi

echo "📋 This script will:"
echo "   1. Commit the fixed workflow file"
echo "   2. Push to GitHub"
echo "   3. GitHub Actions will run successfully"
echo ""

echo "🔧 Step 1: Committing workflow fix..."

# Add the fixed workflow
git add .github/workflows/deploy.yml

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "⚠️  No changes to commit - workflow already fixed"
    echo "   Triggering deployment anyway..."
    
    # Make a small change to trigger deployment
    if [ -f README.md ]; then
        echo "" >> README.md
        echo "<!-- Deployment trigger: $(date) -->" >> README.md
    else
        echo "# Trace Analyzer" > README.md
        echo "" >> README.md
        echo "Deployed: $(date)" >> README.md
    fi
    
    git add README.md
    git commit -m "Trigger deployment"
else
    git commit -m "Fix GitHub Pages workflow - add enablement parameter"
fi

echo "✓ Commit created"
echo ""

echo "🚀 Step 2: Pushing to GitHub..."
git push

echo "✓ Pushed successfully"
echo ""

echo "╔════════════════════════════════════════╗"
echo "║          ✓ Done!                      ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📍 What was fixed:"
echo ""
echo "   Added 'enablement: true' to the workflow"
echo "   This tells GitHub Actions to enable Pages automatically"
echo ""
echo "📍 Next steps:"
echo ""
echo "1. Go to: https://github.com/xhualiu/trace-analyzer"
echo ""
echo "2. Click the 'Actions' tab"
echo ""
echo "3. You should see a new workflow running"
echo ""
echo "4. Wait 1-2 minutes for it to complete"
echo ""
echo "5. Your app will be live at:"
echo "   https://xhualiu.github.io/trace-analyzer"
echo ""

# Made with Bob
