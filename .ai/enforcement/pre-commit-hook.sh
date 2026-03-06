#!/bin/bash
#
# TSFSYSTEM Pre-Commit Hook
# Enforces module boundaries before allowing commits
#
# Installation:
#   ln -sf ../../.ai/enforcement/pre-commit-hook.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "🔍 Running TSFSYSTEM Architecture Enforcement..."

# Get the project root
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not found${NC}"
    exit 1
fi

# Check if PyYAML is installed
if ! python3 -c "import yaml" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Installing PyYAML...${NC}"
    pip3 install pyyaml > /dev/null 2>&1 || {
        echo -e "${RED}❌ Failed to install PyYAML${NC}"
        exit 1
    }
fi

# Run enforcement check on staged files
python3 .ai/enforcement/enforce.py check --staged

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Architecture violations detected${NC}"
    echo -e "${YELLOW}Fix the violations above or use 'git commit --no-verify' to bypass (not recommended)${NC}"
    exit 1
fi
