# Brand-Category Linking Implementation Plan

## 📋 Objective
Enable **many-to-many relationship** between Brands and Categories so that:
- When creating/editing a brand, you can link it to specific categories
- When adding a product and selecting a category, only relevant brands appear in the dropdown
- Improves data quality and user experience

---

## 🎯 Use Case Example

**Scenario:**
- Categories: "Shampoo", "Electronics", "Snacks"
- Brands: "Head & Shoulders", "Pantene" (linked to Shampoo), "Samsung", "Apple" (linked to Electronics)

**Expected Behavior:**
1. When user selects category "Shampoo" in product form
2. Brand dropdown shows ONLY: "Head & Shoulders", "Pantene"
3. Samsung and Apple are hidden (not relevant to Shampoo)

---

## 📐 Implementation Steps

### **STEP 1: Update Database Schema** ⚙️

#### Current Schema (Brand model):
```prisma
model Brand {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  shortName String?
  logo     String?
  
  countries Country[] // Already has many-to-many with Country
  
  products Product[]
  productGroups ProductGroup[]
}
```

#### New Schema (Add Category relation):
```prisma
model Brand {
  id       Int       @id @default(autoincrement())
  name     String    @unique
  shortName String?
  logo     String?
  
  countries  Country[]  // Many-to-Many with Country
  categories Category[] // NEW: Many-to-Many with Category
  
  products Product[]
  productGroups ProductGroup[]
}
```

#### Category Model (Add Brand relation):
```prisma
model Category {
  id       Int       @id @default(autoincrement())
  name     String
  code     String?   @unique
  shortName String?

  parentId Int?
  parent   Category? @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")
  
  brands   Brand[]   // NEW: Many-to-Many with Brand
  
  products Product[]
  productGroups ProductGroup[]
  parfums  Parfum[]
}
```

**Action:** Update `prisma/schema.prisma` and run `npx prisma db push`

---

### **STEP 2: Update Brand Actions** 🔧

**File:** `src/app/actions/brands.ts`

#### Add function to link/unlink categories:
```typescript
export async function updateBrandCategories(brandId: number, categoryIds: number[]) {
    await prisma.brand.update({
        where: { id: brandId },
        data: {
            categories: {
                set: categoryIds.map(id => ({ id }))
            }
        }
    });
    revalidatePath('/admin/inventory/brands');
}
```

#### Update getBrands to include categories:
```typescript
export async function getBrands() {
    return prisma.brand.findMany({
        include: {
            countries: true,
            categories: true, // NEW: Include linked categories
            _count: { select: { products: true } }
        },
        orderBy: { name: 'asc' }
    });
}
```

---

### **STEP 3: Update BrandFormModal UI** 🎨

**File:** `src/components/admin/BrandFormModal.tsx`

#### Add category multi-select:
```tsx
export function BrandFormModal({ 
    isOpen, 
    onClose, 
    brand, 
    countries,
    categories // NEW: Pass categories as prop
}: BrandFormModalProps) {
    const [selectedCategories, setSelectedCategories] = useState<number[]>(
        brand?.categories?.map(c => c.id) || []
    );
    
    // ... existing code ...
    
    return (
        <div>
            {/* Existing fields: name, shortName, logo */}
            
            {/* NEW: Category Selection */}
            <div>
                <label className="block text-sm font-medium mb-2">
                    Linked Categories
                </label>
                <p className="text-xs text-gray-500 mb-2">
                    Select categories where this brand applies
                </p>
                
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {categories.map(category => (
                        <label key={category.id} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={selectedCategories.includes(category.id)}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setSelectedCategories([...selectedCategories, category.id]);
                                    } else {
                                        setSelectedCategories(selectedCategories.filter(id => id !== category.id));
                                    }
                                }}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm">{category.name}</span>
                        </label>
                    ))}
                </div>
            </div>
            
            {/* Update submit to include categories */}
        </div>
    );
}
```

---

### **STEP 4: Update Product Form** 📦

**File:** `src/components/admin/GroupedProductForm.tsx` (or wherever product form is)

#### Add function to fetch filtered brands:
```typescript
'use server';
export async function getBrandsByCategory(categoryId: number | null) {
    if (!categoryId) {
        // If no category selected, return all brands
        return prisma.brand.findMany({
            orderBy: { name: 'asc' }
        });
    }
    
    // Return only brands linked to this category
    return prisma.brand.findMany({
        where: {
            categories: {
                some: { id: categoryId }
            }
        },
        orderBy: { name: 'asc' }
    });
}
```

#### Update form to reload brands when category changes:
```tsx
const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
const [availableBrands, setAvailableBrands] = useState<Brand[]>(allBrands);

const handleCategoryChange = async (categoryId: number | null) => {
    setSelectedCategory(categoryId);
    
    // Fetch filtered brands
    const filteredBrands = await getBrandsByCategory(categoryId);
    setAvailableBrands(filteredBrands);
    
    // Reset brand selection if current brand is not in filtered list
    if (selectedBrand && !filteredBrands.find(b => b.id === selectedBrand)) {
        setSelectedBrand(null);
    }
};
```

---

### **STEP 5: Update Brand Manager Display** 📊

**File:** `src/components/admin/BrandManager.tsx`

#### Show linked categories in brand card:
```tsx
<div className="brand-card">
    <h3>{brand.name}</h3>
    
    {/* NEW: Show linked categories */}
    <div className="mt-2">
        <p className="text-xs text-gray-500 mb-1">Categories:</p>
        <div className="flex flex-wrap gap-1">
            {brand.categories?.length > 0 ? (
                brand.categories.map(cat => (
                    <span key={cat.id} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                        {cat.name}
                    </span>
                ))
            ) : (
                <span className="text-xs text-gray-400 italic">All categories</span>
            )}
        </div>
    </div>
</div>
```

---

## 🧪 Testing Checklist

After implementation:

- [ ] **Database Migration:**
  - [ ] Run `npx prisma db push`
  - [ ] Verify many-to-many table created in database

- [ ] **Brand Management:**
  - [ ] Create new brand with category links
  - [ ] Edit existing brand and add/remove categories
  - [ ] Verify categories display on brand cards
  - [ ] Test with no categories selected (should work for all)

- [ ] **Product Form:**
  - [ ] Select a category
  - [ ] Verify brand dropdown shows only linked brands
  - [ ] Select "All" or null category → verify all brands shown
  - [ ] Change category → verify brand dropdown updates

- [ ] **Edge Cases:**
  - [ ] Brand with no categories → should appear for ALL categories
  - [ ] Category with no brands → brand dropdown should be empty or show message
  - [ ] Hierarchical categories → test parent vs child category filtering

---

## ⚠️ Important Considerations

### **Should parent category brands inherit to children?**

**Example:**
- Category Tree: "Personal Care" > "Hair Care" > "Shampoo"
- Brand "Pantene" linked to "Hair Care"

**Question:** When user selects "Shampoo" category, should "Pantene" appear?

**Options:**
1. **YES - Include parent brands:** Check all categories in the hierarchy
2. **NO - Exact match only:** Only brands linked directly to "Shampoo"

**Recommendation:** Start with **exact match** for simplicity, add hierarchy later if needed.

---

## 🎯 Expected Benefits

1. ✅ **Data Quality:** Prevents invalid brand-category combinations
2. ✅ **User Experience:** Shorter, relevant dropdowns
3. ✅ **Speed:** Faster product entry with fewer choices
4. ✅ **Organization:** Clear mapping of brands to categories

---

## 📝 Files to Modify

1. ✏️ `prisma/schema.prisma` - Add many-to-many relation
2. ✏️ `src/app/actions/brands.ts` - Update CRUD operations
3. ✏️ `src/components/admin/BrandFormModal.tsx` - Add category multi-select
4. ✏️ `src/components/admin/BrandManager.tsx` - Display linked categories
5. ✏️ `src/components/admin/GroupedProductForm.tsx` - Filter brands by category
6. ✏️ `src/app/admin/inventory/brands/page.tsx` - Pass categories to BrandManager

---

**Status:** READY TO IMPLEMENT  
**Estimated Time:** 1-2 hours  
**Complexity:** Medium (requires schema change + UI updates)
