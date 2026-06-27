#!/usr/bin/env bash
# install.sh — One-command setup for vlt
# Usage: bash install.sh
# Works on: macOS, Linux, Windows (via Git Bash or WSL)

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${CYAN}  vlt — Secret Vault Installer${RESET}"
echo -e "${DIM}  Because you only get to see that key once.${RESET}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}  ⚠  Node.js not found.${RESET}"
  echo "  Please install Node.js 16+ from: https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo -e "${YELLOW}  ⚠  Node.js 16+ required. Found: $(node -v)${RESET}"
  echo "  Please upgrade: https://nodejs.org"
  exit 1
fi

echo -e "  ${GREEN}✓${RESET} Node.js $(node -v) found"

# Install dependencies
echo ""
echo "  Installing dependencies..."
npm install --silent

# Link globally
echo "  Linking vlt globally..."
npm link --silent 2>/dev/null || sudo npm link --silent

# Verify
if command -v vlt &> /dev/null; then
  echo ""
  echo -e "  ${GREEN}✓ vlt installed successfully!${RESET}"
  echo ""
  echo -e "  ${CYAN}Get started:${RESET}"
  echo -e "  ${DIM}  vlt init${RESET}                    Initialize your vault"
  echo -e "  ${DIM}  vlt add myapp API_KEY abc123${RESET} Add a secret"
  echo -e "  ${DIM}  vlt list${RESET}                    List projects"
  echo -e "  ${DIM}  vlt copy myapp API_KEY${RESET}      Copy to clipboard"
  echo -e "  ${DIM}  vlt ui${RESET}                      Open web dashboard"
  echo ""
else
  echo ""
  echo -e "${YELLOW}  ⚠  Could not link vlt globally.${RESET}"
  echo "  Try: sudo npm link"
  echo "  Or add ./bin/vlt.js to your PATH manually."
fi
