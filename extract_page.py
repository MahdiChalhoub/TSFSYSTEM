import os

page_path = '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/modules/migration/page.tsx'

with open(page_path, 'r') as f:
    lines = f.readlines()

def get_lines(start, end):
    # 1-indexed to 0-indexed
    return "".join(lines[start-1:end])

# Create components directory
components_dir = '/root/.gemini/antigravity/scratch/TSFSYSTEM/src/modules/migration/components'
os.makedirs(components_dir, exist_ok=True)

# 1. Extract types.ts
types_content = ""
for (s, e) in [(55, 83), (85, 88), (90, 99), (101, 101), (173, 178), (180, 190), (368, 379), (381, 393)]:
    content = get_lines(s, e)
    # Add export if missing
    if content.startswith('interface'):
        content = 'export ' + content
    elif content.startswith('type'):
        content = 'export ' + content
    types_content += content + "\n"

with open(os.path.join(components_dir, 'types.ts'), 'w') as f:
    f.write(types_content)

# 2. Extract MigrationPipeline.tsx
pipeline_imports = """"use client"
import React, { useState, useEffect } from "react"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, AlertTriangle, FileUp, Database, Search, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMigrationPipeline, resumeMigration } from "../actions"
import { PipelineData } from "./types"

"""
pipeline_content = get_lines(192, 362).replace('function MigrationPipeline', 'export function MigrationPipeline')
with open(os.path.join(components_dir, 'MigrationPipeline.tsx'), 'w') as f:
    f.write(pipeline_imports + pipeline_content)

# 3. Extract COAMappingModal.tsx
coa_imports = """"use client"
import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

"""
coa_content = get_lines(443, 627).replace('function COAMappingModal', 'export function COAMappingModal')
with open(os.path.join(components_dir, 'COAMappingModal.tsx'), 'w') as f:
    f.write(coa_imports + coa_content)

# 4. Extract MigrationReviewDashboard.tsx
dashboard_imports = """"use client"
import React, { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, RefreshCw, Eye, CheckCircle2, RotateCcw, AlertTriangle, Package, Tag, Layers, Ruler, Users, ShoppingCart, Banknote, Building2, Globe, Database } from "lucide-react"
import { toast } from "sonner"
import { MigrationJob, ReviewEntity, ReviewData } from "./types"
import { getMigrationReview, getMigrationSamples, approveMigrationEntity, getAccountMapping, saveAccountMapping } from "../actions"
import { COAMappingModal } from "./COAMappingModal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

// Recreate missing ENTITY_LABELS locally for the dashboard
const ENTITY_LABELS: Record<string, string> = {
    UNIT: "Units of Measure",
    CATEGORY: "Categories",
    BRAND: "Brands",
    PRODUCT: "Products",
    CONTACT: "Contacts",
    TRANSACTION: "Transactions",
    ORDER_LINE: "Order Lines",
    ACCOUNT: "Financial Accounts",
    ACCOUNT_TRANSACTION: "Account Transactions",
    TAX_RATE: "Tax Rates",
    BUSINESS_LOCATION: "Locations",
    EXPENSE_CATEGORY: "Expense Categories",
    PRODUCT_VARIATION: "Variations",
    CUSTOMER_GROUP: "Customer Groups",
    ACCOUNT_TYPE: "Account Types",
    USER: "Users",
    CURRENCY: "Currencies",
    COMBO_LINK: "Combo Links",
    EXPENSE: "Expenses",
    PAYMENT: "Payments",
    STOCK_ADJUSTMENT: "Stock Adjustments",
    STOCK_TRANSFER: "Stock Transfers",
    JOURNAL_ENTRY: "Journal Entries",
    INVENTORY: "Inventory"
}

// Recreate missing ENTITY_COLORS locally
const ENTITY_COLORS: Record<string, string> = {
    UNIT: "text-cyan-600", CATEGORY: "text-blue-600", BRAND: "text-indigo-600",
    PRODUCT: "text-purple-600", CONTACT: "text-pink-600", TRANSACTION: "text-amber-600",
    ORDER_LINE: "text-orange-600", ACCOUNT: "text-emerald-600", ACCOUNT_TRANSACTION: "text-teal-600",
    TAX_RATE: "text-neutral-600", BUSINESS_LOCATION: "text-sky-600", EXPENSE_CATEGORY: "text-rose-600",
    PRODUCT_VARIATION: "text-fuchsia-600", CUSTOMER_GROUP: "text-violet-600", ACCOUNT_TYPE: "text-lime-600",
    USER: "text-slate-600", CURRENCY: "text-yellow-600", COMBO_LINK: "text-stone-600",
}

const entityGroupMeta: Record<string, { icon: any, gradient: string }> = {
    config: { icon: Ruler, gradient: "from-blue-500/20 to-cyan-500/20" },
    catalog: { icon: Package, gradient: "from-purple-500/20 to-pink-500/20" },
    people: { icon: Users, gradient: "from-indigo-500/20 to-blue-500/20" },
    finance: { icon: Banknote, gradient: "from-emerald-500/20 to-teal-500/20" },
    transactions: { icon: ShoppingCart, gradient: "from-amber-500/20 to-orange-500/20" },
    other: { icon: Globe, gradient: "from-gray-500/20 to-gray-400/20" },
}

"""
dashboard_content = get_lines(629, 1228).replace('function MigrationReviewDashboard', 'export function MigrationReviewDashboard')
with open(os.path.join(components_dir, 'MigrationReviewDashboard.tsx'), 'w') as f:
    f.write(dashboard_imports + dashboard_content)

# 5. Modify page.tsx
# Remove all the extracted lines and add new imports
new_page_lines = lines[:54] + lines[99:100] + lines[101:172] + lines[1228:]

# Insert the new imports
import_insert_pos = -1
for i, line in enumerate(new_page_lines):
    if line.startswith('import { Separator }'):
        import_insert_pos = i + 1
        break

new_imports = """
import { MigrationJob, PreviewData, Business, WizardStep } from "./components/types"
import { MigrationPipeline } from "./components/MigrationPipeline"
import { MigrationReviewDashboard } from "./components/MigrationReviewDashboard"
"""

new_page_lines.insert(import_insert_pos, new_imports)

with open(page_path, 'w') as f:
    f.write("".join(new_page_lines))

print("Extraction complete!")
