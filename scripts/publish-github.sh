#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-github-download-now}"
VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required. Install package 'gh' first."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Authenticate first with: gh auth login"
  exit 1
fi

if ! git config user.name >/dev/null || ! git config user.email >/dev/null; then
  echo "Configure Git identity first:"
  echo '  git config --global user.name "Your Name"'
  echo '  git config --global user.email "you@example.com"'
  exit 1
fi

npm ci
npm test
npm run package

if [ ! -d .git ]; then
  git init -b main
fi

git add .
if ! git diff --cached --quiet; then
  git commit -m "Release GitHub Download Now ${TAG}"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "${REPO_NAME}" \
    --public \
    --source=. \
    --remote=origin \
    --push \
    --description "Download the right GitHub Release asset and track selected projects for updates"
else
  git push -u origin HEAD
fi

gh repo edit \
  --add-topic browser-extension \
  --add-topic github \
  --add-topic github-releases \
  --add-topic chrome-extension \
  --add-topic firefox-addon \
  --add-topic webextension \
  --add-topic linux \
  --add-topic appimage \
  --add-topic open-source

if ! git rev-parse "${TAG}" >/dev/null 2>&1; then
  git tag "${TAG}"
fi
git push origin "${TAG}"

echo "Published source and tag ${TAG}. GitHub Actions will create the release assets."
echo "Next: upload assets/social-preview.png in repository Settings and enable GitHub Pages for privacy.html."
