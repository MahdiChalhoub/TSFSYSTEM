# Migration v2.0 - Business Selection Feature

## ✅ Implementation Complete

Successfully added business selection step to the Migration v2.0 wizard, following the v1 workflow pattern.

## 📋 Changes Made

### 1. Type Definitions (`src/types/migration-v2.ts`)

**Added Business Interface:**
```typescript
export interface Business {
    id: number
    name: string
    products?: number
    contacts?: number
    transactions?: number
    stock_records?: number
}
```

**Updated WizardStep Type:**
```typescript
export type WizardStep =
    | 'REVIEW_SCOPE'
    | 'SELECT_DATA_SOURCE'
    | 'SELECT_BUSINESS'      // ⭐ NEW STEP
    | 'SELECT_ORG'
    | 'VALIDATE'
    | 'MASTER_DATA'
    | 'ENTITIES'
    | 'TRANSACTIONS'
    | 'STOCK'
    | 'VERIFICATION'
    | 'COMPLETE';
```

### 2. API Client (`src/lib/api/migration-v2-client.ts`)

**Added getBusinesses Function:**
```typescript
export async function getBusinesses(jobId: number): Promise<Business[]> {
    try {
        const response = await authFetch(`${MIGRATION_V2_BASE}/jobs/${jobId}/businesses/`);
        return response.businesses || response.results || response || [];
    } catch (err) {
        console.error('Failed to load businesses from SQL file:', err);
        return [];
    }
}
```

### 3. Wizard Page (`src/app/(privileged)/migration_v2/jobs/new/page.tsx`)

#### State Management
- Added `businesses` state for storing businesses from SQL
- Added `selectedBusiness` state for tracking selection
- Added `uploadedFileId` state for tracking file uploads

#### New Functions
1. **loadBusinesses()** - Fetches businesses from backend after SQL upload
2. **handleSelectBusiness(business)** - Handles business selection and navigation
3. **Updated handleUploadFile()** - Creates job first, then parses SQL
4. **Updated handleSelectCloudFile()** - Creates job with cloud file reference
5. **Updated loadOrganizations()** - Loads ALL target organizations (not just current user's)

#### New UI Section
Added comprehensive business selection UI at line 421-492:
- Shows loading state while parsing SQL
- Displays all businesses found in SQL file
- Shows business statistics (products, contacts, transactions)
- Empty state with "Try another file" option
- Hover effects and click interactions

## 🔄 Correct Wizard Flow (v1 Pattern)

```
1. REVIEW_SCOPE
   ↓ User confirms scope (FULL, PRODUCTS, etc.) and source (ULTIMATE_POS, etc.)

2. SELECT_DATA_SOURCE
   ↓ User chooses: Upload from PC OR Pick from Cloud Storage

3. SELECT_BUSINESS ⭐ NEW
   ↓ Backend parses SQL file and extracts businesses
   ↓ User selects SOURCE business (e.g., "Main Store - 9000 products")

4. SELECT_ORG
   ↓ User selects TARGET TSF organization (where to import INTO)

5. VALIDATE
   ↓ Check COA and posting rules

6. MASTER_DATA
   ↓ Import categories, brands, units

7. ENTITIES
   ↓ Import customers, suppliers, products

8. COMPLETE
   ↓ Show summary
```

## 🎯 Key Concepts

### Source Business vs Target Organization

**SOURCE Business (SELECT_BUSINESS):**
- **What**: Business data FROM the uploaded SQL file
- **Example**: "Main Store" with 9,000 products, 500 contacts
- **Purpose**: User selects which business to migrate FROM
- **Data comes from**: Parsing the UltimatePOS SQL dump

**TARGET Organization (SELECT_ORG):**
- **What**: TSF organization where data will be migrated INTO
- **Example**: "TSF Demo Company" (UUID: abc-123-def)
- **Purpose**: User selects where to import TO
- **Data comes from**: `/api/saas/my-organizations/` endpoint

## 🔗 Backend Requirements

The frontend now expects these endpoints:

### 1. Parse Businesses from SQL
```
GET /api/migration-v2/jobs/{job_id}/businesses/

Expected Response:
{
  "businesses": [
    {
      "id": 1,
      "name": "Main Store",
      "products": 9000,
      "contacts": 500,
      "transactions": 2000
    }
  ]
}
```

### 2. Update Job with Target Organization
```
PATCH /api/migration-v2/jobs/{job_id}/
{
  "target_organization_id": "uuid-here",
  "source_business_id": 1
}
```

## 🎨 UI Highlights

### Business Selection Cards
- Large clickable cards for each business
- Shows business name prominently
- Displays statistics: products, contacts, transactions
- Icons for visual clarity (ShoppingCart, Package, Users)
- Hover effects with border color change
- Loading state while parsing SQL
- Empty state with retry option

### Organization Selection
- Updated description to clarify it's the TARGET
- Shows selected business name in blue text
- Maintains same card-based selection UI

## ✅ TypeScript Validation

All changes passed TypeScript checks:
```bash
npm run typecheck
✅ No TypeScript errors in src/
```

## 📝 Testing Checklist

### Frontend Testing
- [ ] Navigate to `/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS`
- [ ] Confirm scope and source
- [ ] Choose "Upload from PC"
- [ ] Select a .sql file
- [ ] Upload file → should create job and move to SELECT_BUSINESS
- [ ] Verify loading state shows "Parsing businesses from SQL file..."
- [ ] (Mock) See list of businesses with statistics
- [ ] Click a business → should move to SELECT_ORG
- [ ] See selected business name in description
- [ ] Choose target organization → should proceed to VALIDATE

### Backend Testing (Required)
- [ ] Implement `/api/migration-v2/jobs/{id}/businesses/` endpoint
- [ ] Parse UltimatePOS SQL dump to extract businesses table
- [ ] Return business data with statistics
- [ ] Handle errors gracefully (malformed SQL, missing tables, etc.)

## 🚀 Next Steps

### Immediate
1. **Backend**: Implement `getBusinesses` endpoint to parse SQL files
2. **Backend**: Add business selection to job model
3. **Backend**: Update validation to use selected business

### Future Enhancements
1. Add "Back" button to navigate between steps
2. Show progress indicator at top of wizard
3. Add business preview modal with more details
4. Support multiple business selection (batch migration)
5. Add search/filter for organizations list

## 📚 Related Files

- `src/types/migration-v2.ts` - Type definitions
- `src/lib/api/migration-v2-client.ts` - API client
- `src/app/(privileged)/migration_v2/jobs/new/page.tsx` - Wizard UI
- `src/app/(privileged)/migration_v2/page.tsx` - Dashboard (entry point)

## 🔍 Implementation Pattern

This implementation follows TSFSYSTEM's patterns:
- ✅ Uses AppCard components
- ✅ Uses theme variables (--app-text, --app-surface, etc.)
- ✅ Follows v1's wizard flow
- ✅ TypeScript strict mode compliant
- ✅ Error handling with toast notifications
- ✅ Loading states for async operations
- ✅ Responsive design (grid-cols-1 md:grid-cols-2)
- ✅ Lucide React icons only

---

**Last Updated**: 2026-03-08
**Status**: ✅ Frontend Complete, Backend Pending
**Version**: v2.0.1
