# 🏛️ TSF Layout Governance System

**Created**: 2026-03-12
**Version**: 1.0.0
**Status**: ✅ Production Ready

---

## 🎯 What This Is

This is **NOT** a theme system.
This is **NOT** about colors or fonts.

This is a **Layout Governance Agent** that forces every screen, component, and page to obey **ONE layout language**.

---

## 📦 What Was Created

### 1. **TSF Layout Standard v1** (The Constitution)
**File**: `src/lib/layout/layout-standards.ts`

Defines:
- **Foundations**: 12-column grid, spacing scale, border radius, shadows, breakpoints
- **Structural Rules**: Page structure requirements, data workspace rules, form rules
- **Component Rules**: Buttons, cards, tables, modals, badges, side panels
- **UX Rules**: Action placement, content hierarchy, workflow patterns

```typescript
import { TSF_LAYOUT_STANDARD, getSpacing, isValidSpacing } from '@/lib/layout/layout-standards';

// Valid spacing
const padding = getSpacing('lg'); // 24px

// Validate arbitrary value
if (!isValidSpacing(18)) {
  console.error('Invalid spacing - use approved scale');
}
```

---

### 2. **5 Layout Archetypes** (The Patterns)
**File**: `src/lib/layout/layout-archetypes.ts`

Instead of inventing layouts every time, choose from:

1. **Dashboard** - Overview pages, analytics, KPIs
2. **Data Workspace** - CRM lists, product catalogs, invoice lists
3. **Form Workflow** - Create/edit forms, wizards, setup pages
4. **Detail Record** - Customer profile, order details, invoice view
5. **Operational Workspace** - Receiving, dispatching, real-time operations

```typescript
import { selectArchetype, getArchetype } from '@/lib/layout/layout-archetypes';

const archetype = selectArchetype({
  hasTable: true,
  hasKPIs: false,
  primaryPurpose: 'list'
});
// → "data-workspace"

const definition = getArchetype('data-workspace');
console.log(definition.zones.required);
// → ["page-header", "filter-toolbar", "main-data-grid"]
```

---

### 3. **Layout Validator** (The Judge)
**File**: `src/lib/layout/layout-validator.ts`

Scores every page out of 100 based on:
- Hierarchy clarity (20 pts)
- Spacing consistency (15 pts)
- Grid alignment (15 pts)
- Action clarity (15 pts)
- Scanability (10 pts)
- Responsiveness (10 pts)
- Component consistency (10 pts)
- Workflow efficiency (5 pts)

```typescript
import { LayoutValidator, getValidationReport } from '@/lib/layout/layout-validator';

const score = LayoutValidator.validate({
  archetype: 'data-workspace',
  zones: ['page-header', 'filter-toolbar', 'main-data-grid', 'detail-drawer'],
  spacing: [16, 24, 32],
  borderRadii: [12],
  gridColumns: [6, 6],
  primaryActions: 1,
  secondaryActions: 2,
  destructiveActions: 0,
  nestingDepth: 2,
  hasHeader: true,
  hasFiltersAboveResults: true,
  hasKPIsBeforeData: true,
  hasStickyActions: false,
  hasEmptyStates: true,
  hasLoadingStates: true,
  mobileOptimized: true,
  tabletOptimized: true
});

console.log(score.total); // 92/100 (Grade: A)
console.log(score.problems); // []
console.log(getValidationReport(layout)); // Full text report
```

---

### 4. **Page Intake Schema** (The Requirements Format)
**File**: `src/lib/layout/page-intake-schema.ts`

Before generating any layout, fill out the intake form:

```typescript
import { PageIntake, validateIntake } from '@/lib/layout/page-intake-schema';

const intake: PageIntake = {
  module: 'crm',
  pageName: 'Customer List',
  businessGoal: 'Browse, search, and manage customer records',
  userRoles: ['salesperson', 'manager'],
  userExpertise: 'novice',
  primaryActions: ['Create Customer'],
  secondaryActions: ['Export', 'Import', 'Bulk Edit'],
  dataDensity: 'medium',
  recordType: 'customer',
  estimatedRecordCount: 200,
  workflowType: 'workspace',
  needsKPI: true,
  needsTable: true,
  needsFilters: true,
  needsDrawer: true,
  devicePriority: ['desktop', 'tablet', 'mobile'],
  mobileSupport: 'required'
};

const validation = validateIntake(intake);
if (!validation.valid) {
  console.error(validation.errors);
}
```

---

### 5. **Layout Architect Agent** (The Governor)
**File**: `.claude/agents/layout-architect-agent.md`

The agent that **enforces** all rules and generates compliant page blueprints.

**Workflow**:
1. Receive `PageIntake`
2. Classify page type
3. Select archetype
4. Build zone structure
5. Map components
6. Define responsive behavior
7. Validate (must score ≥70/100)
8. Output `PageBlueprint`

---

## 🚀 How to Use

### For Developers

#### 1. Creating a New Page

```typescript
// Step 1: Define page requirements
const intake: PageIntake = {
  module: 'inventory',
  pageName: 'Product Catalog',
  businessGoal: 'Browse and manage product catalog',
  primaryActions: ['Create Product'],
  workflowType: 'workspace',
  needsTable: true,
  needsFilters: true,
  needsDrawer: true,
  // ... etc
};

// Step 2: Ask Layout Architect Agent to generate blueprint
// (Use Claude Code with layout-architect-agent.md)

// Step 3: Implement using the blueprint zones
export default function ProductCatalogPage() {
  return (
    <PageLayout archetype="data-workspace">
      <PageHeader title="Product Catalog" actions={<CreateButton />} />
      <FilterToolbar fields={productFilters} />
      <DataGrid data={products} />
      <DetailDrawer />
    </PageLayout>
  );
}
```

#### 2. Validating Existing Page

```typescript
import { LayoutValidator } from '@/lib/layout/layout-validator';

// Extract layout properties from your page
const pageLayout = {
  archetype: 'dashboard',
  zones: ['page-header', 'kpi-strip', 'charts-row'],
  spacing: [16, 24, 32],
  borderRadii: [12],
  // ... etc
};

const score = LayoutValidator.validate(pageLayout);

if (score.total < 70) {
  console.error('Page does not meet TSF standards!');
  console.error(score.problems);
}
```

#### 3. Using Standard Spacing

```typescript
import { getSpacing, getBorderRadius } from '@/lib/layout/layout-standards';

// ✅ GOOD - Using approved tokens
<div style={{
  padding: `${getSpacing('lg')}px`,
  borderRadius: `${getBorderRadius('md')}px`
}}>

// ❌ BAD - Arbitrary values
<div style={{
  padding: '18px',  // Not in scale!
  borderRadius: '10px'  // Not in scale!
}}>
```

---

### For Agents

When building or reviewing pages:

1. **Load the Layout Architect Agent**:
   ```bash
   # Use the agent prompt
   cat .claude/agents/layout-architect-agent.md
   ```

2. **Receive PageIntake** (from business team or inferred from requirements)

3. **Generate PageBlueprint** following the workflow

4. **Validate** before generating code (must score ≥70)

5. **Output** compliant React components

---

## 📐 The 5 Archetypes Quick Reference

| Archetype | Use For | Required Zones |
|-----------|---------|----------------|
| **Dashboard** | Overview pages, analytics | page-header, kpi-strip |
| **Data Workspace** | Lists, catalogs, CRUD views | page-header, filter-toolbar, main-data-grid |
| **Form Workflow** | Create/edit forms, wizards | page-header, main-form, action-footer |
| **Detail Record** | Profile views, single records | page-header, summary-hero, tab-navigation, tab-content |
| **Operational Workspace** | Real-time operations | page-header, status-strip, decision-grid, action-footer |

---

## ✅ Validation Checklist

Before deploying any page, verify:

- [ ] Archetype chosen from approved 5
- [ ] All required zones present
- [ ] All spacing uses approved scale (4, 8, 12, 16, 24, 32, 48, 64, 96, 128)
- [ ] Border radii use approved scale (0, 4, 8, 12, 16, 24)
- [ ] Max 2 primary actions per section
- [ ] Filters appear ABOVE results
- [ ] KPIs appear BEFORE detailed data
- [ ] Max 3 levels of visual nesting
- [ ] Has empty states
- [ ] Has loading states
- [ ] Mobile strategy defined (if mobile support required)
- [ ] Validation score ≥70/100

---

## 🎯 Examples Included

### 1. Receiving Workspace (Operational)
See: `page-intake-schema.ts` → `EXAMPLE_INTAKE_RECEIVING`

### 2. Customer List (Data Workspace)
See: `page-intake-schema.ts` → `EXAMPLE_INTAKE_CUSTOMER_LIST`

### 3. Invoice Form (Form Workflow)
See: `page-intake-schema.ts` → `EXAMPLE_INTAKE_INVOICE_FORM`

---

## 🔄 Migration Path

For existing pages that don't follow this system:

### Step 1: Audit
```bash
# Run layout validation on all pages
npm run audit:layouts
```

### Step 2: Classify
Determine which archetype each page should use.

### Step 3: Refactor
Update pages to match approved archetype structure.

### Step 4: Validate
Ensure all pages score ≥70/100.

---

## 📊 Scoring Breakdown

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent - fully compliant |
| 80-89 | B | Good - minor improvements needed |
| 70-79 | C | Acceptable - passes validation |
| 60-69 | D | Poor - major issues |
| 0-59 | F | Failed - must be redesigned |

**Minimum passing score**: 70/100

---

## 🚫 Common Anti-Patterns to Avoid

1. ❌ **Random card placement** without header
2. ❌ **Arbitrary spacing** (e.g., 18px, 22px, 37px)
3. ❌ **Deep nesting** (card → card → card → card)
4. ❌ **Filters mixed with results**
5. ❌ **Too many primary actions** (>2 per section)
6. ❌ **Destructive actions** styled as primary
7. ❌ **Missing empty states**
8. ❌ **Missing loading states**
9. ❌ **Horizontal scroll on mobile**
10. ❌ **Inventing new layout patterns** instead of using archetypes

---

## 🎓 Philosophy

> "Do not ask: what beautiful layout should I make?
>
> Ask: which archetype fits this business screen?"

The goal is **CONSISTENCY** and **GOVERNANCE**, not creativity.

Every page should feel like it's part of the same system, because it follows the same rules.

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `src/lib/layout/layout-standards.ts` | Foundations, rules, constants |
| `src/lib/layout/layout-archetypes.ts` | 5 approved layout patterns |
| `src/lib/layout/layout-validator.ts` | Scoring and validation logic |
| `src/lib/layout/page-intake-schema.ts` | Requirements format + examples |
| `.claude/agents/layout-architect-agent.md` | Agent instructions |

---

## ✅ Status

- ✅ TSF Layout Standard v1 defined
- ✅ 5 Archetypes documented
- ✅ Validator with scoring system built
- ✅ Page intake schema created
- ✅ Layout Architect Agent documented
- ⏳ Integration into existing pages (TODO)
- ⏳ Component library updates (TODO)

---

## 🚀 Next Steps

1. **Deploy** these files to the codebase
2. **Train** development team on the system
3. **Audit** existing pages and score them
4. **Refactor** low-scoring pages (<70)
5. **Enforce** via CI/CD (reject PRs with score <70)
6. **Expand** with additional archetypes if needed (requires approval)

---

**Last Updated**: 2026-03-12
**Maintained By**: Layout Governance Team
