# Financial Pages UI Optimization

## Goal
Upgrade 4 new finance pages from basic raw HTML to premium design matching established TSF platform standards.

## Pages Modified

### Vouchers (`/finance/vouchers`)
- **Read from**: `getVouchers()`, `getFinancialAccounts()`, `getFinancialEvents()` server actions
- **Write to**: `createVoucher()`, `postVoucher()` server actions
- **User interactions**: Search, tab filter (All/Transfers/Receipts/Payments), create via Dialog, post draft vouchers
- **Workflow**: Load data → Browse/filter → Create via dialog → Post draft → Toast feedback

### Assets (`/finance/assets`)
- **Read from**: `getAssets()`, `getAssetSchedule()`, `getFinancialAccounts()` server actions
- **Write to**: `createAsset()`, `postDepreciation()` server actions
- **User interactions**: Search by name/category, acquire asset via Dialog, view depreciation schedule panel, post depreciation entries
- **Workflow**: Load data → Browse/search → Acquire via dialog → View schedule → Post depreciation → Toast feedback

### Deferred Expenses (`/finance/deferred-expenses`)
- **Read from**: `getDeferredExpenses()`, `getFinancialAccounts()` server actions
- **Write to**: `createDeferredExpense()`, `recognizeDeferredExpense()` server actions
- **User interactions**: Search, status tabs (All/Active/Completed), create via Dialog, recognize monthly expense
- **Workflow**: Load data → Browse/filter → Create via dialog → Recognize months → Toast feedback

### Profit Distribution (`/finance/profit-distribution`)
- **Read from**: `getProfitDistributions()`, `getFiscalYears()` server actions
- **Write to**: `calculateDistribution()`, `createDistribution()`, `postDistribution()` server actions
- **User interactions**: 2-step wizard (configure wallets + preview), add/remove allocation wallets, post distributions
- **Workflow**: Load data → Open wizard → Configure FY + wallets → Calculate → Preview → Create draft → Post

## Design Changes Applied (All 4 Pages)
| Feature | Before | After |
|---------|--------|-------|
| Components | Raw HTML | shadcn `Card`, `Table`, `Button`, `Badge`, `Dialog`, `Input` |
| Icons | None | Lucide-react icons throughout |
| Loading | No state | Skeleton loading screens |
| Animations | None | `animate-in fade-in` on mount |
| Feedback | Raw error divs | `toast()` from sonner |
| Empty States | Plain text | Icon + description + CTA button |
| Search | None | Search bars with filtering |
| Summary Cards | Plain border | Gradient backgrounds with icon badges |
| Typography | Generic | `font-serif` headers, `tracking-tight` |
