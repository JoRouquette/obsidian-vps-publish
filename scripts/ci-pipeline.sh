#!/usr/bin/env bash
#
# CI/CD Pipeline - Local execution
# Mirrors the GitHub Actions workflow for local testing
#
# Usage:
#   ./scripts/ci-pipeline.sh           # Full pipeline without Lighthouse
#   ./scripts/ci-pipeline.sh --full    # Full pipeline with Lighthouse
#   ./scripts/ci-pipeline.sh --quick   # Quick CI (lint + build + test only)
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
FULL_MODE=false
QUICK_MODE=false

for arg in "$@"; do
  case $arg in
    --full)
      FULL_MODE=true
      ;;
    --quick)
      QUICK_MODE=true
      ;;
  esac
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
if [ "$FULL_MODE" = true ]; then
  echo -e "${BLUE}  CI/CD Pipeline - Full (with Lighthouse)${NC}"
elif [ "$QUICK_MODE" = true ]; then
  echo -e "${BLUE}  CI/CD Pipeline - Quick (lint + build + test)${NC}"
else
  echo -e "${BLUE}  CI/CD Pipeline - Standard${NC}"
fi
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Documentation validation
echo -e "${YELLOW}Step 1: Documentation validation...${NC}"
npm run docs:check
echo -e "${GREEN}✓ docs:check passed${NC}"
echo ""

# Step 2: Linting
echo -e "${YELLOW}Step 2: Linting...${NC}"
npm run lint
echo -e "${GREEN}✓ lint passed${NC}"
echo ""

# Step 3: Build
echo -e "${YELLOW}Step 3: Building...${NC}"
npm run build
echo -e "${GREEN}✓ build passed${NC}"
echo ""

# Step 4: Unit tests
echo -e "${YELLOW}Step 4: Unit tests...${NC}"
npm run test
echo -e "${GREEN}✓ test passed${NC}"
echo ""

# Exit early if quick mode
if [ "$QUICK_MODE" = true ]; then
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✓ Quick CI Pipeline PASSED${NC}"
  echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
  exit 0
fi

# Step 5: CSR fallback
echo -e "${YELLOW}Step 5: Preparing CSR fallback...${NC}"
if [ -f "dist/apps/site/browser/index.csr.html" ] && [ ! -f "dist/apps/site/browser/index.html" ]; then
  cp dist/apps/site/browser/index.csr.html dist/apps/site/browser/index.html
  echo -e "${GREEN}✓ Created index.html from index.csr.html${NC}"
else
  echo -e "${GREEN}✓ index.html already exists or not needed${NC}"
fi
echo ""

# Step 6: E2E tests
echo -e "${YELLOW}Step 6: E2E tests...${NC}"
npx playwright install chromium --with-deps
npm run test:e2e:ci
echo -e "${GREEN}✓ E2E tests passed${NC}"
echo ""

# Step 7: Lighthouse (only in full mode)
if [ "$FULL_MODE" = true ]; then
  echo -e "${YELLOW}Step 7: Lighthouse CI...${NC}"
  
  # Install LHCI if not available
  if ! command -v lhci &> /dev/null; then
    echo "Installing @lhci/cli..."
    npm install -g @lhci/cli@0.14.x
  fi
  
  npm run lighthouse:ci
  echo -e "${GREEN}✓ Lighthouse CI passed${NC}"
  echo ""
fi

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
if [ "$FULL_MODE" = true ]; then
  echo -e "${GREEN}  ✓ Full CI/CD Pipeline PASSED${NC}"
else
  echo -e "${GREEN}  ✓ CI/CD Pipeline PASSED${NC}"
fi
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
