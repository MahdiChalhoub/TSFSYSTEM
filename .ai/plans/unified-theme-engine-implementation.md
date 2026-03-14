# 🎨 Unified Theme Engine v3.0 - Implementation Plan

**Created**: 2026-03-12
**Status**: ✅ Ready for Implementation
**Approach**: Option A - Enhanced DesignEngine with Backend Integration

---

## 📋 OVERVIEW

### Goals
1. ✅ **One unified theme system** (replace 3 separate systems)
2. ✅ **20 default presets** (curated for all use cases)
3. ✅ **Per-tenant customization** (organizations can create custom themes)
4. ✅ **Dark/light mode toggle** (system-wide, adapts any theme)
5. ✅ **Theme builder UI** (visual editor for creating themes)
6. ✅ **Backend storage** (database-driven, not hardcoded)
7. ✅ **Auto-migration** (convert old theme+layout selections)

### Architecture Decision
- **Keep**: DesignEngine concept (unified presets)
- **Delete**: ThemeContext (colors only - redundant)
- **Delete**: LayoutContext (layout only - redundant)
- **Enhance**: Add backend integration + theme builder

---

## 🏗️ IMPLEMENTATION PHASES

### **Phase 1: Backend Foundation** ✅ (Partially Complete)
**Time**: ~4 hours

#### 1.1 Models (✅ DONE)
- [x] `OrganizationTheme` model
- [x] `UserThemePreference` model
- [x] Validation logic
- [x] Default theme selection

**Files Created**:
- ✅ `erp_backend/apps/core/models_themes.py`

#### 1.2 Default Presets (✅ STARTED)
- [x] Create `default_theme_presets.py`
- [ ] Add remaining 15 themes (currently 5/20)
- [ ] Create management command `seed_themes`

**Files to Create**:
- ✅ `erp_backend/apps/core/default_theme_presets.py` (partial)
- ⏳ `erp_backend/apps/core/management/commands/seed_themes.py`

#### 1.3 API Endpoints (⏳ TODO)
- [ ] `GET /api/themes/` - List all themes (system + custom)
- [ ] `POST /api/themes/` - Create custom theme
- [ ] `PATCH /api/themes/{id}/` - Update custom theme
- [ ] `DELETE /api/themes/{id}/` - Delete custom theme
- [ ] `GET /api/themes/current/` - Get user's active theme
- [ ] `POST /api/themes/{id}/activate/` - Set active theme
- [ ] `POST /api/themes/toggle-mode/` - Toggle dark/light

**Files to Create**:
- ⏳ `erp_backend/apps/core/serializers_themes.py`
- ⏳ `erp_backend/apps/core/views_themes.py`
- ⏳ `erp_backend/erp/urls.py` (add theme routes)

#### 1.4 Migrations (⏳ TODO)
- [ ] Create migration for `OrganizationTheme`
- [ ] Create migration for `UserThemePreference`
- [ ] Run migrations

**Commands**:
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py seed_themes  # Seed 20 default presets
```

---

### **Phase 2: Frontend Unified Engine** (⏳ TODO)
**Time**: ~6 hours

#### 2.1 Unified Theme Context (⏳ TODO)
Replace 3 contexts with ONE:

**Delete** (archive first):
- ❌ `src/contexts/DesignEngineContext.tsx` (will enhance & rename)
- ❌ `src/contexts/ThemeContext.tsx` (redundant)
- ❌ `src/contexts/LayoutContext.tsx` (redundant)

**Create**:
- ⏳ `src/contexts/UnifiedThemeEngine.tsx` (NEW)

**Features**:
- Load themes from backend API
- Merge system presets + custom themes
- Apply CSS variables (colors, layout, components)
- Dark/light mode toggle
- LocalStorage sync
- Real-time updates

**API**:
```typescript
const {
  // Current state
  currentTheme,
  colorMode,
  isLoading,

  // Available themes
  systemThemes,
  customThemes,
  allThemes,

  // Actions
  setTheme,
  toggleColorMode,
  createTheme,
  updateTheme,
  deleteTheme,

  // Utils
  exportTheme,
  importTheme,
} = useUnifiedThemeEngine()
```

#### 2.2 Theme Switcher Component (⏳ TODO)
Enhanced switcher with:
- System themes section
- Custom themes section
- Dark/light toggle
- "Create theme" button
- Search/filter

**Files to Create**:
- ⏳ `src/components/theme/ThemeSwitcher.tsx` (replace old ones)

#### 2.3 Theme Builder UI (⏳ TODO)
Visual theme creation tool:
- Color pickers for all theme colors
- Layout density selector
- Component style controls
- Live preview panel
- Save/Export buttons

**Files to Create**:
- ⏳ `src/components/theme/ThemeBuilder.tsx`
- ⏳ `src/components/theme/ThemePreview.tsx`
- ⏳ `src/components/theme/ColorPicker.tsx`
- ⏳ `src/app/(privileged)/settings/themes/page.tsx`

#### 2.4 Type Definitions (⏳ TODO)
**Files to Create**:
- ⏳ `src/types/theme.ts`

```typescript
export interface ThemePreset {
  id: string
  slug: string
  name: string
  description: string
  category: 'professional' | 'creative' | 'efficiency' | 'specialized' | 'custom'
  isSystem: boolean
  isActive: boolean
  isDefault: boolean
  tags: string[]
  presetData: ThemePresetData
}

export interface ThemePresetData {
  colors: {
    dark: ColorScheme
    light: ColorScheme
  }
  layout: LayoutConfig
  components: ComponentConfig
  navigation: NavigationConfig
}
```

---

### **Phase 3: Migration & Cleanup** (⏳ TODO)
**Time**: ~2 hours

#### 3.1 Auto-Migration Utility (⏳ TODO)
Convert existing user preferences to new system:

```typescript
// src/lib/theme-migration.ts
export async function migrateOldThemes() {
  const oldTheme = localStorage.getItem('tsfsystem-theme')
  const oldLayout = localStorage.getItem('tsfsystem-layout')
  const oldDesignPreset = localStorage.getItem('tsfsystem-design-preset')

  // Map to nearest unified preset
  const newPreset = mapToUnifiedPreset(oldTheme, oldLayout, oldDesignPreset)

  // Save to backend
  await apiClient.post('/api/themes/migrate/', { preset: newPreset })

  // Clear old keys
  localStorage.removeItem('tsfsystem-theme')
  localStorage.removeItem('tsfsystem-layout')
  localStorage.removeItem('tsfsystem-design-preset')
}
```

#### 3.2 Archive Old Systems (⏳ TODO)
Move deprecated files to backup:

```bash
mkdir -p .backups/deprecated-themes-2026-03-12

# Archive old contexts
mv src/contexts/ThemeContext.tsx .backups/deprecated-themes-2026-03-12/
mv src/contexts/LayoutContext.tsx .backups/deprecated-themes-2026-03-12/
mv src/contexts/DesignEngineContext.tsx .backups/deprecated-themes-2026-03-12/

# Archive old components
mv src/components/shared/ThemeSwitcher.tsx .backups/deprecated-themes-2026-03-12/
mv src/components/shared/DesignEngineSwitcher.tsx .backups/deprecated-themes-2026-03-12/
mv src/components/shared/LayoutSwitcher.tsx .backups/deprecated-themes-2026-03-12/
```

#### 3.3 Remove Old Imports (⏳ TODO)
Search and replace across codebase:

```bash
# Find all files using old contexts
grep -r "from '@/contexts/ThemeContext'" src/
grep -r "from '@/contexts/LayoutContext'" src/
grep -r "from '@/contexts/DesignEngineContext'" src/

# Replace with new unified context
# (Manual or scripted find-replace)
```

#### 3.4 Update Root Layout (⏳ TODO)
**File**: `src/app/layout.tsx`

**Before**:
```tsx
<DesignEngineProvider>
  <ThemeProvider>
    <LayoutProvider>
      {children}
    </LayoutProvider>
  </ThemeProvider>
</DesignEngineProvider>
```

**After**:
```tsx
<UnifiedThemeEngineProvider>
  {children}
</UnifiedThemeEngineProvider>
```

---

## 📦 20 DEFAULT THEME PRESETS

### Professional (5)
1. ✅ **Corporate Minimal** (Light) - Apple-style, clean
2. ✅ **Corporate Dark** - Professional night mode
3. ✅ **Finance Pro** - Dense, emerald, data-focused
4. ✅ **Executive Light** - Spacious, premium
5. ✅ **Executive Dark** - Premium night mode

### Creative (5)
6. ✅ **Purple Dream** - Modern, creative (partial)
7. ⏳ **Purple Light** - Creative day mode
8. ⏳ **Ocean Blue** - Deep, trustworthy
9. ⏳ **Ocean Light** - Fresh, clean
10. ⏳ **Sunset Energy** - Bold, energetic

### Efficiency (5)
11. ⏳ **Dashboard Compact** - Maximum data density
12. ⏳ **Dashboard Light** - Clean analytics
13. ⏳ **Data Dense** - Terminal-style
14. ⏳ **Minimal Dark** - Focus mode
15. ⏳ **Minimal Light** - Distraction-free

### Specialized (5)
16. ⏳ **POS Fullscreen** - Retail terminal
17. ⏳ **POS Light** - Daylight POS
18. ⏳ **Monochrome** - Black & white elegance
19. ⏳ **High Contrast** - Accessibility (light)
20. ⏳ **Colorblind Safe** - Accessible colors

---

## 🔧 TECHNICAL DETAILS

### Database Schema
```sql
-- OrganizationTheme table
CREATE TABLE core_organization_theme (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES erp_organization(id),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    preset_data JSONB NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    base_theme_id INTEGER REFERENCES core_organization_theme(id),
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by_id INTEGER REFERENCES erp_user(id),

    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_org_theme_org_slug ON core_organization_theme(organization_id, slug);
CREATE INDEX idx_org_theme_org_active ON core_organization_theme(organization_id, is_active);
CREATE INDEX idx_org_theme_system ON core_organization_theme(is_system, is_active);

-- UserThemePreference table
CREATE TABLE core_user_theme_preference (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES erp_organization(id),
    user_id INTEGER NOT NULL UNIQUE REFERENCES erp_user(id),
    active_theme_id INTEGER REFERENCES core_organization_theme(id),
    color_mode VARCHAR(10) DEFAULT 'dark',
    custom_overrides JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_theme_org_user ON core_user_theme_preference(organization_id, user_id);
```

### API Endpoints
```
GET    /api/themes/                   - List themes (system + custom)
POST   /api/themes/                   - Create custom theme
GET    /api/themes/{id}/              - Get theme details
PATCH  /api/themes/{id}/              - Update custom theme
DELETE /api/themes/{id}/              - Delete custom theme
POST   /api/themes/{id}/activate/     - Set as active theme
GET    /api/themes/current/           - Get user's current theme
POST   /api/themes/toggle-mode/       - Toggle dark/light mode
POST   /api/themes/migrate/           - Auto-migrate old preferences
POST   /api/themes/export/{id}/       - Export theme as JSON
POST   /api/themes/import/            - Import theme from JSON
```

### CSS Variables Applied
```css
/* Colors */
--theme-primary
--theme-primary-dark
--theme-bg
--theme-surface
--theme-surface-hover
--theme-text
--theme-text-muted
--theme-border
--theme-accent
--theme-success
--theme-warning
--theme-error

/* Layout */
--layout-container-padding
--layout-section-spacing
--layout-card-padding
--layout-element-gap

/* Components */
--card-radius
--card-shadow
--card-border
--card-padding
--button-radius
--button-height
--button-padding
--button-font-size
--button-font-weight
--input-radius
--input-height
--input-padding
--input-font-size
--input-border

/* Typography */
--font-heading
--font-body
--font-size-h1
--font-size-h2
--font-size-h3
--font-size-body
--font-size-small

/* Navigation */
--nav-width
```

---

## ✅ TESTING CHECKLIST

### Backend Tests
- [ ] OrganizationTheme model saves correctly
- [ ] Theme validation works (reject invalid JSON)
- [ ] System themes cannot be deleted
- [ ] Custom themes can be created/updated/deleted
- [ ] Tenant isolation works (can't access other org's themes)
- [ ] Default theme selection works
- [ ] Theme usage tracking increments

### API Tests
- [ ] GET /api/themes/ returns system + custom themes
- [ ] POST /api/themes/ creates custom theme
- [ ] PATCH /api/themes/{id}/ updates theme
- [ ] DELETE /api/themes/{id}/ deletes custom theme (not system)
- [ ] POST /api/themes/{id}/activate/ sets active theme
- [ ] Dark/light toggle works

### Frontend Tests
- [ ] UnifiedThemeEngine loads themes from API
- [ ] CSS variables update when theme changes
- [ ] Dark/light toggle updates colors
- [ ] Theme switcher shows all themes
- [ ] Theme builder creates valid themes
- [ ] LocalStorage syncs properly
- [ ] Auto-migration runs on first load

### Integration Tests
- [ ] User selects theme → saves to database → persists on reload
- [ ] User creates custom theme → appears in switcher → can activate
- [ ] User toggles dark/light → colors update immediately
- [ ] Theme builder → create theme → save → activate → verify UI
- [ ] Old theme users → auto-migrate → new system works

---

## 📁 FILES TO CREATE/MODIFY

### Backend (Django)
**New Files**:
- ✅ `erp_backend/apps/core/models_themes.py`
- ✅ `erp_backend/apps/core/default_theme_presets.py` (partial)
- ⏳ `erp_backend/apps/core/management/commands/seed_themes.py`
- ⏳ `erp_backend/apps/core/serializers_themes.py`
- ⏳ `erp_backend/apps/core/views_themes.py`

**Modified Files**:
- ⏳ `erp_backend/apps/core/models.py` (import themes)
- ⏳ `erp_backend/erp/urls.py` (add theme routes)

**Migrations**:
- ⏳ `erp_backend/apps/core/migrations/XXXX_add_organization_theme.py`
- ⏳ `erp_backend/apps/core/migrations/XXXX_add_user_theme_preference.py`

### Frontend (Next.js)
**New Files**:
- ⏳ `src/contexts/UnifiedThemeEngine.tsx`
- ⏳ `src/components/theme/ThemeSwitcher.tsx`
- ⏳ `src/components/theme/ThemeBuilder.tsx`
- ⏳ `src/components/theme/ThemePreview.tsx`
- ⏳ `src/components/theme/ColorPicker.tsx`
- ⏳ `src/app/(privileged)/settings/themes/page.tsx`
- ⏳ `src/types/theme.ts`
- ⏳ `src/lib/theme-migration.ts`
- ⏳ `src/app/actions/settings/unified-theme.ts`

**Modified Files**:
- ⏳ `src/app/layout.tsx` (use new provider)
- ⏳ `src/components/admin/Sidebar.tsx` (use new switcher)

**Archived Files** (move to `.backups/deprecated-themes-2026-03-12/`):
- ❌ `src/contexts/ThemeContext.tsx`
- ❌ `src/contexts/LayoutContext.tsx`
- ❌ `src/contexts/DesignEngineContext.tsx`
- ❌ `src/components/shared/ThemeSwitcher.tsx`
- ❌ `src/components/shared/DesignEngineSwitcher.tsx`
- ❌ `src/components/shared/LayoutSwitcher.tsx`

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Backend Deployment
```bash
# On server
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Seed default themes
python manage.py seed_themes

# Verify
python manage.py shell
>>> from apps.core.models_themes import OrganizationTheme
>>> OrganizationTheme.objects.filter(is_system=True).count()
20  # Should return 20 system themes
```

### Step 2: Frontend Deployment
```bash
# Build frontend
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
npm run build

# Restart frontend service
systemctl restart tsfsystem-frontend.service
```

### Step 3: Verify
1. Login to application
2. Go to Settings → Themes
3. Verify all 20 system themes appear
4. Create a custom theme
5. Switch themes and verify CSS updates
6. Toggle dark/light mode
7. Reload page → theme persists

---

## 📊 SUCCESS METRICS

- ✅ **Single unified system** (no more confusion)
- ✅ **20 curated presets** (professional defaults)
- ✅ **Backend-driven** (database storage)
- ✅ **Per-tenant customization** (organizations create themes)
- ✅ **Dark/light toggle** (system-wide)
- ✅ **Theme builder** (visual creation tool)
- ✅ **Auto-migration** (seamless upgrade)
- ✅ **Zero breaking changes** (for end users)

---

## 📝 NEXT STEPS

**Option 1**: Proceed with full implementation
- I will create all remaining files
- Implement all API endpoints
- Build frontend components
- Test end-to-end
- Deploy to production

**Option 2**: Phase by phase approval
- Complete Phase 1 (backend) first → you review
- Then Phase 2 (frontend) → you review
- Then Phase 3 (migration) → you review

**Which approach do you prefer?**

---

**Status**: ✅ Plan complete, awaiting approval to proceed
**Estimated Total Time**: ~12 hours of development
**Risk Level**: Low (enhancing existing system, not full rewrite)
