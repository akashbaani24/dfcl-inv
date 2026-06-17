#!/usr/bin/env bash
# ============================================================
#  Push DFCL Inventory App to GitHub — One-Command Script
# ============================================================
#
#  This script will:
#    1. (Optional) Create a NEW GitHub repository for you
#    2. Push the entire source code to it
#
#  PREREQUISITES — pick ONE of these:
#
#  OPTION A: GitHub CLI (recommended, easiest)
#    1. Install: https://cli.github.com/
#    2. Run: gh auth login
#    3. Then run this script
#
#  OPTION B: Personal Access Token (PAT)
#    1. Go to: https://github.com/settings/tokens/new
#    2. Token name: "dfcl-app-push"
#    3. Expiration: 30 days
#    4. Scope: ✓ repo  (full control of private repositories)
#    5. Click "Generate token" → copy the token
#    6. Export it before running this script:
#         export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
#    7. Then run this script
#
# ============================================================

set -e
cd "$(dirname "$0")"

# ---- Config (EDIT THESE IF YOU WANT) ----
REPO_NAME="dfcl-inv"
REPO_DESC="DFCL Inventory Management System — Next.js 16 + Prisma + SQLite"
REPO_VISIBILITY="private"   # or "public"
GITHUB_USERNAME=""          # leave empty to auto-detect from gh/credentials
# -----------------------------------------

echo "=============================================="
echo "  Push DFCL App to GitHub"
echo "=============================================="
echo ""
echo "Repo name:        $REPO_NAME"
echo "Description:      $REPO_DESC"
echo "Visibility:       $REPO_VISIBILITY"
echo ""

# ---------- Detect authentication method ----------
USE_GH_CLI=false
USE_PAT=false

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  USE_GH_CLI=true
  echo "✓ Authenticated via GitHub CLI"
  if [ -z "$GITHUB_USERNAME" ]; then
    GITHUB_USERNAME=$(gh api user --jq .login)
  fi
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  USE_PAT=true
  echo "✓ Using GITHUB_TOKEN from environment"
  if [ -z "$GITHUB_USERNAME" ]; then
    GITHUB_USERNAME=$(curl -sS -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -o '"login": *"[^"]*"' | cut -d'"' -f4)
  fi
else
  echo "❌ Not authenticated."
  echo ""
  echo "To fix this, do ONE of the following:"
  echo ""
  echo "  OPTION A — GitHub CLI (easiest):"
  echo "    1. Install:  https://cli.github.com/"
  echo "    2. Run:      gh auth login"
  echo "    3. Re-run:   ./push-to-github.sh"
  echo ""
  echo "  OPTION B — Personal Access Token:"
  echo "    1. Create:   https://github.com/settings/tokens/new"
  echo "                (tick the 'repo' scope)"
  echo "    2. Export:   export GITHUB_TOKEN=\"ghp_your_token_here\""
  echo "    3. Re-run:   ./push-to-github.sh"
  echo ""
  exit 1
fi

if [ -z "$GITHUB_USERNAME" ]; then
  echo "❌ Could not determine your GitHub username."
  echo "   Set it manually at the top of this script: GITHUB_USERNAME=\"yourname\""
  exit 1
fi

echo "GitHub username:  $GITHUB_USERNAME"
echo ""

# ---------- Create the remote repository ----------
REMOTE_URL="https://github.com/$GITHUB_USERNAME/$REPO_NAME"

if git ls-remote "$REMOTE_URL" >/dev/null 2>&1; then
  echo "⚠ Repository $REMOTE_URL already exists."
  read -p "Push to existing repo anyway? (y/N) " yn < /dev/tty
  case "$yn" in
    y|Y) echo "→ Pushing to existing repo..." ;;
    *) echo "Aborted."; exit 1 ;;
  esac
else
  echo "→ Creating new repository: $REMOTE_URL"
  if $USE_GH_CLI; then
    gh repo create "$REPO_NAME" --$REPO_VISIBILITY --description "$REPO_DESC" --source=. --remote=origin --push 2>&1 | tail -5
    # gh repo create with --source=. --push already adds the remote and pushes
    echo ""
    echo "✅ Done!"
    echo ""
    echo "📦 Your repository: $REMOTE_URL"
    exit 0
  elif $USE_PAT; then
    RESPONSE=$(curl -sS -X POST \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      https://api.github.com/user/repos \
      -d "{\"name\":\"$REPO_NAME\",\"description\":\"$REPO_DESC\",\"private\":$([ "$REPO_VISIBILITY" = "private" ] && echo true || echo false)}")
    echo "$RESPONSE" | grep -E '"full_name"|"html_url"|"message"' | head -5
    if echo "$RESPONSE" | grep -q '"message"'; then
      echo "❌ GitHub API error. Aborting."
      exit 1
    fi
  fi
fi

# ---------- Add remote and push ----------
if ! git remote get-url origin >/dev/null 2>&1; then
  if $USE_PAT; then
    # Embed token in remote URL so git can authenticate
    git remote add origin "https://$GITHUB_USERNAME:$GITHUB_TOKEN@github.com/$GITHUB_USERNAME/$REPO_NAME.git"
  else
    git remote add origin "$REMOTE_URL"
  fi
fi

echo ""
echo "→ Pushing source code to GitHub..."
git push -u origin main

echo ""
echo "=============================================="
echo "  ✅ SUCCESS!"
echo "=============================================="
echo ""
echo "📦 Your repository is now live at:"
echo "   $REMOTE_URL"
echo ""
echo "Next steps:"
echo "  1. Visit the repo URL above"
echo "  2. Clone on any machine:  git clone $REMOTE_URL"
echo "  3. Run:                   cd $REPO_NAME && ./start-dev.sh"
echo ""
