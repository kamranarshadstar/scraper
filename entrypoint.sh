#!/bin/bash
set -e

# GitHub public repo URL (replace with yours)
REPO="https://github.com/kamranarshadstar/scraper.git"

# Directory inside container to clone repo
TARGET_DIR="/app/code"

# Remove old repo if exists
rm -rf $TARGET_DIR

# Clone the latest version of the repo
echo "Cloning GitHub repo..."
git clone $REPO $TARGET_DIR

# Change to the repo directory
cd $TARGET_DIR

# Install dependencies if package.json exists
if [ -f package.json ]; then
  echo "Installing dependencies..."
  npm install
fi

# Start scraper (assumes main entry is server.js)
echo "Starting scraper..."
node server.js