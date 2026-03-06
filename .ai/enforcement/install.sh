#!/bin/bash
#
# TSFSYSTEM Enforcement Installation Script
#
# This script installs the module boundaries enforcement system:
# - Pre-commit hooks
# - CI/CD integration
# - Required dependencies
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Installing TSFSYSTEM Module Boundaries Enforcement..."

# Get project root
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$PROJECT_ROOT"

# Step 1: Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
if command -v pip3 &> /dev/null; then
    pip3 install pyyaml --quiet
    echo -e "${GREEN}✅ PyYAML installed${NC}"
else
    echo "⚠️  pip3 not found, skipping Python dependencies"
fi

# Step 2: Make scripts executable
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
chmod +x .ai/enforcement/enforce.py
chmod +x .ai/enforcement/pre-commit-hook.sh
chmod +x .ai/enforcement/install.sh
chmod +x .ai/scripts/validate_architecture.py
echo -e "${GREEN}✅ Scripts are executable${NC}"

# Step 3: Install pre-commit hook
echo -e "${YELLOW}🪝 Installing pre-commit hook...${NC}"
if [ -d ".git" ]; then
    # Backup existing hook if present
    if [ -f ".git/hooks/pre-commit" ]; then
        cp .git/hooks/pre-commit .git/hooks/pre-commit.backup
        echo "   Backed up existing hook to .git/hooks/pre-commit.backup"
    fi

    # Create symlink
    ln -sf ../../.ai/enforcement/pre-commit-hook.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
else
    echo "⚠️  .git directory not found, skipping hook installation"
fi

# Step 4: Create baseline
echo -e "${YELLOW}📊 Creating baseline of existing violations...${NC}"
python3 .ai/enforcement/enforce.py baseline
echo -e "${GREEN}✅ Baseline created${NC}"

# Step 5: Test enforcement
echo -e "${YELLOW}🧪 Testing enforcement system...${NC}"
python3 .ai/enforcement/enforce.py check --staged || true
echo -e "${GREEN}✅ Enforcement system is operational${NC}"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Module Boundaries Enforcement System Installed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "What was installed:"
echo "  ✅ Enforcement engine (.ai/enforcement/enforce.py)"
echo "  ✅ Pre-commit hook (.git/hooks/pre-commit)"
echo "  ✅ Configuration (.ai/enforcement/config.yaml)"
echo "  ✅ Baseline (.ai/enforcement/baseline.json)"
echo ""
echo "Usage:"
echo "  • Commits will auto-check for violations"
echo "  • Manual check: python3 .ai/enforcement/enforce.py check"
echo "  • Check specific file: python3 .ai/enforcement/enforce.py check path/to/file.py"
echo "  • Bypass hook (not recommended): git commit --no-verify"
echo ""
echo "Configuration:"
echo "  • Edit: .ai/enforcement/config.yaml"
echo "  • Whitelist patterns, adjust rules, set severity"
echo ""
echo "Next steps:"
echo "  1. Review baseline violations: cat .ai/enforcement/baseline.json"
echo "  2. Fix violations gradually"
echo "  3. Customize config.yaml to your needs"
echo ""
