# ✅ Migration v2.0 Frontend - CORRECTED FLOW

**Date**: March 7, 2026 02:30 UTC
**Status**: ✅ **FLOW FIXED - READY TO TEST**

---

## 🎯 The Correct Flow (FINAL)

### **Entry Point**: `/migration_v2` (Dashboard)

**User sees**:
- Dashboard with existing migration jobs
- Button: "New Migration"

**User clicks "New Migration"** → Goes to Step 1

---

### **Step 1: Select Import Scope**
**Page**: `/migration_v2` (same page, shows module selector)

User selects WHAT to import:
- ✅ **Full Migration** (recommended) - Products, Contacts, Transactions, Stock
- Products Only
- Contacts Only
- Transactions Only
- Stock/Inventory

**Example**: User clicks "Full Migration" → Goes to Step 2

---

### **Step 2: Select Source System**
**Page**: `/migration_v2` (same page, shows source selector)

User selects WHERE from:
- ✅ **UltimatePOS** (available)
- Odoo (coming soon)
- QuickBooks (coming soon)
- CSV/Excel (coming soon)

**Example**: User clicks "UltimatePOS"
→ Navigates to: `/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS`

---

### **Step 3: Review Scope & Source** ✅
**Page**: `/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS`

**Shows**:
```
┌─────────────────────────┐  ┌───────────────────────────┐
│   Import Scope          │  │   Source Application      │
│                         │  │                           │
│   Full Migration        │  │   UltimatePOS             │
│   All data (products,   │  │   Laravel/MySQL POS       │
│   contacts, trans...)   │  │   system                  │
└─────────────────────────┘  └───────────────────────────┘

                [Continue →]
```

**Action**: User confirms → Goes to Step 4

---

### **Step 4: Select Data Source** ⭐ **KEY STEP - LIKE V1**
**Page**: Same wizard page

**Two Options**:

#### **Option A: Upload from PC**
```
┌──────────────────────────────────┐
│   💾 Upload from PC              │
│                                  │
│   📁 Drag & drop or browse      │
│   .sql file from your computer   │
│                                  │
│   [Browse Files]                 │
└──────────────────────────────────┘
```

#### **Option B: Pick from Cloud Storage**
```
┌──────────────────────────────────┐
│   ☁️ Pick from Cloud Storage     │
│                                  │
│   📊 u739151801_dataPOS.sql     │
│      23 MB • Jan 15, 2026        │
│                                  │
│   📊 backup_2024.sql             │
│      45 MB • Dec 1, 2025         │
└──────────────────────────────────┘
```

**Features**:
- Local upload: File picker, drag & drop (TODO: implement chunked upload)
- Cloud storage: Searchable list of .sql files from `/api/proxy/storage/files/?category=MIGRATION`
- Can switch between Local ⇄ Cloud
- Shows "OR USE CLOUD SERVER" divider (like v1)

**Action**: User selects file → Goes to Step 5

---

### **Step 5: Select Target Organization** ✅
**Page**: Same wizard page

**Shows**: Grid of organizations
```
┌─────────────────┐  ┌─────────────────┐
│  🏢 ACME Corp   │  │  🏢 Beta Inc    │
│  acme-corp      │  │  beta-inc       │
└─────────────────┘  └─────────────────┘
```

**Action**: User clicks organization
→ Creates migration job via API
→ Goes to Step 6

---

### **Step 6: Validate Prerequisites** ✅
**Page**: Same wizard page

**Runs validation** checking:
- COA exists (minimum 10 accounts)
- Posting rules configured
- Customer root account exists
- Supplier root account exists

**Shows results**:
- ✅ **Green**: Validation passed → [Continue to Import]
- ❌ **Red**: Validation failed → Shows errors with "Fix this →" links

**Action**: If valid → Goes to Step 7

---

### **Step 7-8: Import Master Data & Entities** ✅
**Page**: Same wizard page

**Shows**:
- Real-time progress bar
- Current step description
- Percentage complete
- Polling every 3 seconds

**Imports**:
- Step 7: Master data (units, categories, brands, products)
- Step 8: Entities (customers/suppliers with auto COA creation)

**Action**: When complete → Goes to Step 9

---

### **Step 9: Complete** ✅
**Page**: Same wizard page

**Shows**:
```
✅ Migration Complete!

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  📦 9,000   │ │  👥 500     │ │  🛒 0       │ │  ✅ 0       │
│  Products   │ │  Contacts   │ │  Sales      │ │  Verified   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

[View All Jobs]  [View Details]
```

**Actions**:
- View All Jobs → Back to dashboard
- View Details → Job detail page

---

## 🔄 Complete User Journey

```
Dashboard
   ↓ [New Migration]
Select Scope (FULL)
   ↓
Select Source (ULTIMATE_POS)
   ↓ Navigates with URL params
Wizard Page (/jobs/new?scope=FULL&source=ULTIMATE_POS)
   ↓
Review Scope/Source ✓
   ↓
SELECT DATA SOURCE ⭐
   ├─ Option A: Upload from PC
   └─ Option B: Cloud Storage
   ↓
Select Organization
   ↓
Validate COA + Posting Rules
   ↓
Import Master Data (progress bar)
   ↓
Import Entities (progress bar)
   ↓
Complete (statistics + actions)
```

---

## 📁 Files Structure

```
src/app/(privileged)/migration_v2/
├── page.tsx                          ✅ Dashboard (scope + source selector)
└── jobs/
    ├── page.tsx                      ✅ Job list
    ├── new/
    │   └── page.tsx                  ✅ Wizard (7 steps)
    └── [id]/
        └── page.tsx                  ✅ Job detail

src/types/
└── migration-v2.ts                   ✅ TypeScript types

src/lib/api/
└── migration-v2-client.ts            ✅ API client
```

---

## 🎨 What Changed from Previous Version

| Before (WRONG) | After (CORRECT ✅) |
|----------------|-------------------|
| Started with org selection | Starts with dashboard |
| Upload was step 3 (after org) | **Upload is step 4 (BEFORE org)** ⭐ |
| No cloud storage UI | **Cloud storage with searchable list** |
| Upload choice not obvious | **Clear choice: PC OR Cloud** |
| Flow: org → upload → validate | **Flow: scope → upload → org → validate** |

---

## 🔑 Key Improvements

### **1. Logical Order**
- You need the DATA FILE before you know which organization
- Old flow was backwards (org first, then file)
- New flow: Choose what/where → Get the file → Choose target org

### **2. Cloud Storage Integration** ⭐
```typescript
// Loads .sql files from cloud
const response = await fetch('/api/proxy/storage/files/?category=MIGRATION', {
    credentials: 'include',
});
const sqlFiles = data.results.filter(f =>
    f.original_filename.toLowerCase().endsWith('.sql')
);
```

### **3. Two Upload Options (Like V1)**
```
Local Upload:                Cloud Storage:
┌─────────────┐             ┌─────────────┐
│  💾 Browse  │             │  ☁️ Search  │
│  Drag/Drop  │             │  Select     │
│  File size  │             │  File info  │
└─────────────┘             └─────────────┘
      ↓                           ↓
────────── OR USE CLOUD SERVER ──────────
```

---

## 🎯 Why This Flow Is Better

### **Old Flow Problem**:
```
1. Select Organization (BUT YOU DON'T HAVE THE FILE YET!)
2. Upload file (NOW you have the file...)
3. Validate (Checking COA that you selected WITHOUT seeing the data)
```

### **New Flow Solution**:
```
1. Review what you're importing (scope + source) ✓
2. GET THE FILE (local or cloud) ⭐
3. Select target organization (now you know what data you have)
4. Validate (check if org is ready for THIS specific data)
5. Import (everything is ready)
```

---

## 🧪 Testing Checklist

- [ ] Dashboard loads with "New Migration" button
- [ ] Can select scope (FULL, PRODUCTS, etc.)
- [ ] Can select source (ULTIMATE_POS)
- [ ] URL params correct: `?scope=FULL&source=ULTIMATE_POS`
- [ ] Wizard shows scope/source review
- [ ] Upload step shows two options: PC & Cloud
- [ ] Cloud storage loads .sql files
- [ ] Can switch between Local ⇄ Cloud
- [ ] Organization selection works
- [ ] Job creation succeeds
- [ ] Validation runs and shows results
- [ ] Import progress updates in real-time
- [ ] Complete screen shows statistics
- [ ] Can navigate back to job list

---

## 📊 URL Flow

```
User Journey                      URL
───────────────────────────────────────────────────────────
Dashboard                    →    /migration_v2
Select Scope (FULL)          →    /migration_v2
Select Source (ULTIMATE_POS) →    /migration_v2
                                  ↓ navigates to
Wizard Starts                →    /migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS
Review Scope/Source          →    (same page, step 1)
Upload File                  →    (same page, step 2) ⭐
Select Organization          →    (same page, step 3)
Validate                     →    (same page, step 4)
Import                       →    (same page, steps 5-6)
Complete                     →    (same page, step 7)
View Details                 →    /migration_v2/jobs/{id}
Back to List                 →    /migration_v2/jobs
```

---

## ✨ Key Features Implemented

1. ✅ **Dashboard** with job list and "New Migration" button
2. ✅ **Scope selector** (FULL, PRODUCTS, CONTACTS, etc.)
3. ✅ **Source selector** (ULTIMATE_POS, Odoo, etc.)
4. ✅ **Upload choice** (Local PC OR Cloud Storage) ⭐
5. ✅ **Cloud storage integration** (lists .sql files with search)
6. ✅ **Organization selection** (after upload)
7. ✅ **Pre-flight validation** (COA + posting rules)
8. ✅ **Real-time progress** (polling with progress bars)
9. ✅ **Completion summary** (statistics grid)
10. ✅ **Navigation** (back to list, view details)

---

## 🚀 Ready to Test!

The wizard now has the **CORRECT FLOW**:

**Scope → Source → Upload (PC or Cloud) → Organization → Validate → Import → Complete**

This matches the v1 logic but with cleaner architecture and better UX!

---

**Access URLs**:
- Dashboard: https://saas.tsf.ci/migration_v2
- Wizard: https://saas.tsf.ci/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS
- Job List: https://saas.tsf.ci/migration_v2/jobs
