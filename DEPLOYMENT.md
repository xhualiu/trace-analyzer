# Deployment Guide - Trace Analyzer

This guide explains how to deploy your Trace Analyzer app to GitHub Pages.

## Quick Start (5 Minutes)

### Step 1: Get Your GitHub Token

#### For Public GitHub (github.com):
1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `Trace Analyzer Deployment`
4. Select scopes:
   - ✅ `repo` (all)
   - ✅ `workflow`
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)

#### For IBM GitHub Enterprise (github.ibm.com):
1. Go to https://github.ibm.com/settings/tokens
2. Follow same steps as above

### Step 2: Create Repository on GitHub

#### Option A: Via Web Interface
1. Go to https://github.com/new (or https://github.ibm.com/new for IBM)
2. Repository name: `trace-analyzer` (or your preferred name)
3. Description: `Java Trace Analyzer - SQL trace visualization tool`
4. Choose **Public** or **Private**
5. **Do NOT** initialize with README, .gitignore, or license
6. Click **"Create repository"**

#### Option B: Via GitHub CLI (if installed)
```bash
gh repo create trace-analyzer --public --description "Java Trace Analyzer"
```

### Step 3: Configure Environment

```bash
cd trace-tool/app

# Copy the example file
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

Fill in these values in `.env`:

```bash
# Your GitHub username (e.g., "johndoe")
GITHUB_USERNAME=your-username-here

# Your repository name (must match what you created)
GITHUB_REPO=trace-analyzer

# GitHub type: "public" for github.com or "ibm" for github.ibm.com
GITHUB_TYPE=public

# Paste your GitHub token here
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Your email and name for git commits
GIT_EMAIL=your.email@example.com
GIT_NAME=Your Name
```

### Step 4: Run Deployment Script

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

The script will:
1. ✅ Build your app
2. ✅ Initialize git repository
3. ✅ Commit your code
4. ✅ Push to GitHub
5. ✅ Create GitHub Actions workflow
6. ✅ Show you next steps

### Step 5: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Pages** in left sidebar
4. Under **"Source"**, select **"GitHub Actions"**
5. Wait 1-2 minutes

### Step 6: Access Your App

Your app will be live at:
- **Public GitHub**: `https://YOUR_USERNAME.github.io/trace-analyzer/`
- **IBM GitHub**: `https://pages.github.ibm.com/YOUR_USERNAME/trace-analyzer/`

## What Each File Does

### `.env.example`
Template for your configuration. Copy this to `.env` and fill in your values.

### `.env`
Your actual configuration with secrets. **Never commit this file!** It's in `.gitignore`.

### `deploy.sh`
Automated deployment script that:
- Builds your app
- Sets up git
- Pushes to GitHub
- Creates deployment workflow

### `.github/workflows/deploy.yml`
GitHub Actions workflow that automatically deploys your app when you push code.

## Troubleshooting

### Error: "GITHUB_TOKEN not set"
- Make sure you copied `.env.example` to `.env`
- Make sure you filled in all required values
- Check that there are no spaces around the `=` sign

### Error: "Failed to push to GitHub"
- Check your GitHub token is valid
- Make sure token has `repo` and `workflow` scopes
- Verify repository name matches exactly

### Error: "Repository not found"
- Make sure you created the repository on GitHub first
- Check `GITHUB_USERNAME` and `GITHUB_REPO` are correct
- For IBM GitHub, make sure `GITHUB_TYPE=ibm`

### Pages Not Working
1. Check GitHub Actions tab - deployment should be green ✅
2. Go to Settings → Pages
3. Make sure Source is set to "GitHub Actions"
4. Wait a few minutes - first deployment can take 2-3 minutes

### 404 Error on Pages URL
- Make sure deployment completed successfully
- Check the URL matches your username and repo name
- Try adding `/index.html` to the end of the URL

## Manual Deployment (Alternative)

If the script doesn't work, you can deploy manually:

```bash
# 1. Build
bun run build

# 2. Initialize git
git init
git add .
git commit -m "Initial commit"

# 3. Add remote (replace with your values)
git remote add origin https://github.com/YOUR_USERNAME/trace-analyzer.git

# 4. Push
git push -u origin main

# 5. Create workflow file
mkdir -p .github/workflows
# Copy deploy.yml content from the script

# 6. Push workflow
git add .github/
git commit -m "Add deployment workflow"
git push

# 7. Enable Pages in GitHub Settings
```

## Updating Your Deployed App

After initial deployment, updates are automatic:

```bash
# Make your changes to the code
# ...

# Commit and push
git add .
git commit -m "Update feature X"
git push

# GitHub Actions will automatically rebuild and deploy!
```

## Security Notes

### Protecting Your Token

1. **Never commit `.env` file** - it's in `.gitignore`
2. **Never share your token** - treat it like a password
3. **Rotate tokens regularly** - create new ones every few months
4. **Use minimal scopes** - only `repo` and `workflow` needed

### If Token is Compromised

1. Go to https://github.com/settings/tokens
2. Find the compromised token
3. Click **"Delete"**
4. Generate a new token
5. Update `.env` with new token
6. Run `./deploy.sh` again

## Advanced Configuration

### Custom Domain

To use your own domain (e.g., `trace-analyzer.yourcompany.com`):

1. Add `CNAME` file to `static/` directory:
   ```bash
   echo "trace-analyzer.yourcompany.com" > static/CNAME
   ```

2. Configure DNS:
   ```
   CNAME record: trace-analyzer → YOUR_USERNAME.github.io
   ```

3. In GitHub Settings → Pages, enter your custom domain

### Private Repository

If your repository is private:
- GitHub Pages is free for public repos
- For private repos, you need GitHub Pro/Team/Enterprise
- Everything else works the same

### IBM GitHub Enterprise

IBM GitHub may have different Pages URLs:
- Check with your admin for the correct format
- Usually: `https://pages.github.ibm.com/USERNAME/REPO`
- Some orgs use custom domains

## Cost

**GitHub Pages is completely FREE** for:
- ✅ Public repositories (unlimited)
- ✅ Private repositories (with GitHub Pro/Team/Enterprise)
- ✅ Unlimited bandwidth
- ✅ Unlimited builds
- ✅ Custom domains

## Support

### GitHub Documentation
- GitHub Pages: https://docs.github.com/en/pages
- GitHub Actions: https://docs.github.com/en/actions
- Personal Access Tokens: https://docs.github.com/en/authentication

### Common Issues
- Check GitHub Actions tab for build errors
- Check Settings → Pages for deployment status
- Check browser console for runtime errors

## Next Steps

After deployment:
1. ✅ Share the URL with your team
2. ✅ Add URL to your repository description
3. ✅ Update README with deployment badge
4. ✅ Set up custom domain (optional)
5. ✅ Configure branch protection (optional)

## Deployment Badge

Add this to your README to show deployment status:

```markdown
![Deploy](https://github.com/YOUR_USERNAME/trace-analyzer/actions/workflows/deploy.yml/badge.svg)
```

Replace `YOUR_USERNAME` with your actual username.