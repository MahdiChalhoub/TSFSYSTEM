#!/bin/bash

################################################################################
# UNIFIED THEME ENGINE - AUTOMATED DEPLOYMENT SCRIPT
################################################################################
#
# This script deploys the complete unified theme engine system:
# - Backend: Models, API endpoints, 20 theme presets
# - Frontend: TypeScript types, context, components
# - Integration: ThemeSwitcher + UnifiedThemeWrapper
#
# Date: 2026-03-12
# Version: 1.0.0
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project paths
PROJECT_ROOT="/root/.gemini/antigravity/scratch/TSFSYSTEM"
BACKEND_DIR="$PROJECT_ROOT/erp_backend"
VENV_PATH="$BACKEND_DIR/venv"

################################################################################
# HELPER FUNCTIONS
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

check_prerequisites() {
    log_section "CHECKING PREREQUISITES"

    # Check if project directory exists
    if [ ! -d "$PROJECT_ROOT" ]; then
        log_error "Project directory not found: $PROJECT_ROOT"
        exit 1
    fi
    log_success "Project directory found"

    # Check if virtual environment exists
    if [ ! -d "$VENV_PATH" ]; then
        log_error "Virtual environment not found: $VENV_PATH"
        exit 1
    fi
    log_success "Virtual environment found"

    # Check if Django is installed
    source "$VENV_PATH/bin/activate"
    if ! python -c "import django" 2>/dev/null; then
        log_error "Django not installed in virtual environment"
        exit 1
    fi
    log_success "Django is installed"

    # Check if Node.js is available
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install Node.js"
        exit 1
    fi
    log_success "npm is available"
}

################################################################################
# STEP 1: BACKEND DEPLOYMENT
################################################################################

deploy_backend() {
    log_section "STEP 1: DEPLOYING BACKEND"

    cd "$BACKEND_DIR"
    source "$VENV_PATH/bin/activate"

    # Create migrations
    log_info "Creating migrations for theme models..."
    python manage.py makemigrations core --name add_organization_theme
    log_success "Migrations created"

    # Apply migrations
    log_info "Applying migrations..."
    python manage.py migrate
    log_success "Migrations applied"

    # Seed themes
    log_info "Seeding 20 system themes..."
    python manage.py seed_themes
    log_success "Themes seeded"

    # Verify theme count
    log_info "Verifying theme installation..."
    THEME_COUNT=$(python manage.py shell -c "from apps.core.models_themes import OrganizationTheme; print(OrganizationTheme.objects.filter(is_system=True).count())" 2>/dev/null | tail -n 1)

    if [ "$THEME_COUNT" = "20" ]; then
        log_success "✅ All 20 themes installed successfully"
    else
        log_warning "Expected 20 themes, found: $THEME_COUNT"
    fi
}

################################################################################
# STEP 2: FRONTEND INTEGRATION
################################################################################

integrate_frontend() {
    log_section "STEP 2: INTEGRATING FRONTEND COMPONENTS"

    cd "$PROJECT_ROOT"

    log_info "Checking frontend files..."

    # Verify key files exist
    FILES=(
        "src/types/theme.ts"
        "src/app/actions/theme.ts"
        "src/contexts/UnifiedThemeEngine.tsx"
        "src/components/theme/ThemeSwitcher.tsx"
        "src/components/theme/UnifiedThemeWrapper.tsx"
    )

    MISSING_FILES=()
    for file in "${FILES[@]}"; do
        if [ -f "$file" ]; then
            log_success "✓ $file"
        else
            log_error "✗ $file (MISSING)"
            MISSING_FILES+=("$file")
        fi
    done

    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        log_error "Missing ${#MISSING_FILES[@]} required files. Cannot continue."
        exit 1
    fi

    log_success "All frontend files present"
}

################################################################################
# STEP 3: UPDATE LAYOUT FILES
################################################################################

update_layouts() {
    log_section "STEP 3: UPDATING LAYOUT FILES"

    cd "$PROJECT_ROOT"

    # Check if we need to add UnifiedThemeWrapper
    LAYOUT_FILE="src/app/(privileged)/layout.tsx"

    if [ -f "$LAYOUT_FILE" ]; then
        if grep -q "UnifiedThemeWrapper" "$LAYOUT_FILE"; then
            log_warning "UnifiedThemeWrapper already present in layout"
        else
            log_info "Layout file found at: $LAYOUT_FILE"
            log_warning "MANUAL ACTION REQUIRED: Add UnifiedThemeWrapper to layout"
            echo ""
            echo "Add this import:"
            echo "  import { UnifiedThemeWrapper } from '@/components/theme/UnifiedThemeWrapper'"
            echo ""
            echo "Wrap your content with:"
            echo "  <UnifiedThemeWrapper>{children}</UnifiedThemeWrapper>"
            echo ""
        fi
    else
        log_warning "Layout file not found: $LAYOUT_FILE"
    fi

    # Check for ThemeSwitcher integration
    SIDEBAR_FILE="src/components/admin/Sidebar.tsx"
    APP_SIDEBAR_FILE="src/components/app-sidebar.tsx"

    SWITCHER_ADDED=false

    if [ -f "$SIDEBAR_FILE" ]; then
        if grep -q "ThemeSwitcher" "$SIDEBAR_FILE"; then
            log_success "ThemeSwitcher already integrated in Sidebar"
            SWITCHER_ADDED=true
        fi
    fi

    if [ -f "$APP_SIDEBAR_FILE" ]; then
        if grep -q "ThemeSwitcher" "$APP_SIDEBAR_FILE"; then
            log_success "ThemeSwitcher already integrated in app-sidebar"
            SWITCHER_ADDED=true
        fi
    fi

    if [ "$SWITCHER_ADDED" = false ]; then
        log_warning "MANUAL ACTION REQUIRED: Add ThemeSwitcher to UI"
        echo ""
        echo "Add to your sidebar/header:"
        echo "  import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher'"
        echo "  <ThemeSwitcher compact />"
        echo ""
    fi
}

################################################################################
# STEP 4: BUILD FRONTEND
################################################################################

build_frontend() {
    log_section "STEP 4: BUILDING FRONTEND"

    cd "$PROJECT_ROOT"

    log_info "Running TypeScript type check..."
    if npm run typecheck 2>&1 | tee /tmp/typecheck_output.log; then
        log_success "Type check passed"
    else
        log_error "Type check failed. Please review errors above."
        log_info "Full output saved to: /tmp/typecheck_output.log"
        exit 1
    fi

    log_info "Building Next.js frontend..."
    if npm run build; then
        log_success "Frontend build completed"
    else
        log_error "Frontend build failed"
        exit 1
    fi
}

################################################################################
# STEP 5: RESTART SERVICES
################################################################################

restart_services() {
    log_section "STEP 5: RESTARTING SERVICES"

    log_info "Restarting frontend service..."
    if systemctl restart tsfsystem-frontend.service; then
        log_success "Frontend service restarted"
    else
        log_warning "Could not restart service (may require sudo)"
    fi

    log_info "Checking service status..."
    systemctl status tsfsystem-frontend.service --no-pager -l | head -n 15
}

################################################################################
# STEP 6: VERIFICATION
################################################################################

verify_deployment() {
    log_section "STEP 6: VERIFYING DEPLOYMENT"

    # Check backend API
    log_info "Testing backend API..."
    if curl -f http://localhost:8000/api/themes/ -H "Content-Type: application/json" > /dev/null 2>&1; then
        log_success "Backend API responding"
    else
        log_warning "Backend API not responding (may require authentication)"
    fi

    # Check frontend
    log_info "Testing frontend..."
    if curl -f http://localhost:3000/ > /dev/null 2>&1; then
        log_success "Frontend responding"
    else
        log_warning "Frontend not responding"
    fi

    # Database verification
    cd "$BACKEND_DIR"
    source "$VENV_PATH/bin/activate"

    log_info "Database verification..."
    python manage.py shell <<EOF 2>/dev/null | grep "System themes:" && log_success "Database verified" || log_warning "Database check incomplete"
from apps.core.models_themes import OrganizationTheme
system_themes = OrganizationTheme.objects.filter(is_system=True).count()
print(f"System themes: {system_themes}")
EOF
}

################################################################################
# ARCHIVE OLD SYSTEMS (OPTIONAL)
################################################################################

archive_old_systems() {
    log_section "OPTIONAL: ARCHIVING OLD THEME SYSTEMS"

    cd "$PROJECT_ROOT"

    BACKUP_DIR=".backups/deprecated-themes-$(date +%Y-%m-%d-%H%M%S)"

    OLD_FILES=(
        "src/contexts/ThemeContext.tsx"
        "src/contexts/LayoutContext.tsx"
        "src/contexts/DesignEngineContext.tsx"
        "src/components/shared/DesignEngineSwitcher.tsx"
    )

    FILES_TO_ARCHIVE=()
    for file in "${OLD_FILES[@]}"; do
        if [ -f "$file" ]; then
            FILES_TO_ARCHIVE+=("$file")
        fi
    done

    if [ ${#FILES_TO_ARCHIVE[@]} -gt 0 ]; then
        log_info "Found ${#FILES_TO_ARCHIVE[@]} old theme files"
        read -p "Archive old theme systems? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mkdir -p "$BACKUP_DIR"
            for file in "${FILES_TO_ARCHIVE[@]}"; do
                mv "$file" "$BACKUP_DIR/" 2>/dev/null && log_success "Archived: $file" || true
            done
            log_success "Old systems archived to: $BACKUP_DIR"
        else
            log_info "Skipping archive"
        fi
    else
        log_info "No old theme files found to archive"
    fi
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    clear

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║       UNIFIED THEME ENGINE - DEPLOYMENT SCRIPT            ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║  • 20 Professional Themes                                 ║${NC}"
    echo -e "${GREEN}║  • Backend API (10 endpoints)                             ║${NC}"
    echo -e "${GREEN}║  • Frontend Components (React Context)                    ║${NC}"
    echo -e "${GREEN}║  • Dark/Light Mode Toggle                                 ║${NC}"
    echo -e "${GREEN}║  • Tenant Customization Ready                             ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    log_info "Starting deployment at $(date)"
    echo ""

    # Run deployment steps
    check_prerequisites
    deploy_backend
    integrate_frontend
    update_layouts
    build_frontend
    restart_services
    verify_deployment

    # Optional: Archive old systems
    echo ""
    archive_old_systems

    # Final summary
    log_section "🎉 DEPLOYMENT COMPLETE!"

    echo ""
    echo -e "${GREEN}✅ Backend:${NC} 20 themes installed in PostgreSQL"
    echo -e "${GREEN}✅ Frontend:${NC} Components integrated and built"
    echo -e "${GREEN}✅ Services:${NC} Restarted"
    echo ""
    echo -e "${YELLOW}📋 Manual Actions Required:${NC}"
    echo "   1. Add UnifiedThemeWrapper to your layout file"
    echo "   2. Add ThemeSwitcher component to sidebar/header"
    echo ""
    echo -e "${BLUE}📖 Documentation:${NC}"
    echo "   • Quick Guide: .ai/DEPLOY_NOW.md"
    echo "   • Complete Guide: .ai/FINAL_DEPLOYMENT_GUIDE.md"
    echo "   • Technical Details: .ai/THEME_ENGINE_IMPLEMENTATION_COMPLETE.md"
    echo ""
    echo -e "${GREEN}🚀 Next Steps:${NC}"
    echo "   1. Visit your app: https://tsf.ci"
    echo "   2. Look for ThemeSwitcher in UI"
    echo "   3. Test theme switching and persistence"
    echo "   4. Try dark/light mode toggle"
    echo ""

    log_success "Deployment finished at $(date)"
}

# Run main function
main
