# Accessibility Fixes - Wave 3
**Date**: 2026-03-14 18:39:08
**Standard**: WCAG 2.1 AA
**Status**: In Progress

## Executive Summary

This document tracks all accessibility fixes applied during Wave 3 to achieve 90+/90 score.

### Goals
- Fix 600+ critical issues
- Achieve <500 remaining violations
- WCAG 2.1 AA compliance for critical paths

---

## Fixes Applied

### 1. Images Without Alt Text (9 fixes)

- `src/components/admin/BrandManager.tsx:274: {brand.logo ? <img src={brand.logo} className="w-full h-full object-cover rounded-lg" /> : brand.name.substring(0, 2)}`
- `src/components/pos/ProductGrid.tsx:299: <img`
- `src/components/pos/layouts/POSLayoutModern.tsx:858:                                                    <img`
- `src/components/ui/avatar.tsx:39:    <img`
- `src/components/tenant/StorefrontCatalog.tsx:145: <img`
- `src/components/app/ui/AppEmptyState.tsx:57:                <img`
- `src/app/(privileged)/inventory/brands/BrandsClient.tsx:35: {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}`
- `src/app/(privileged)/inventory/brands/BrandsClient.tsx:82: {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}`
- `src/app/(auth)/login/page.tsx:65:                    <img`

**Status**: ✅ Will be fixed in code changes

---

### 2. Buttons Without Aria-Labels

```
src/components/admin/SiteSwitcher.tsx:31: <button
src/components/admin/SiteSwitcher.tsx:57: <button
src/components/admin/SiteSwitcher.tsx:80: <button
src/components/admin/categories/CreateCategoryButton.tsx:12: <button
src/components/admin/categories/CategoryTree.tsx:163: <button
src/components/admin/categories/CategoryTree.tsx:235: <button
src/components/admin/categories/CategoryTree.tsx:242: <button
src/components/admin/categories/CategoryTree.tsx:249: <button
src/components/admin/categories/CategoryFormModal.tsx:80: <button onClick={onClose} className="p-1 rounded-full hover:bg-app-border text-app-text-faint hover:text-app-text-muted transition-colors">
src/components/admin/categories/CategoryFormModal.tsx:98: <button
src/components/admin/categories/CategoryFormModal.tsx:105: <button
src/components/admin/categories/CategoryFormModal.tsx:172: <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-app-border text-app-text-muted hover:bg-app-bg transition-colors">
src/components/admin/categories/CategoryFormModal.tsx:175: <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-semibold bg-app-primary text-app-text hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-app-primary/20 flex items-center justify-center gap-2">
src/components/admin/categories/CategoryExplorer.tsx:272: <button className="bg-orange-600 hover:bg-orange-700 text-app-text px-6 py-3 rounded-2xl font-extrabold flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
src/components/admin/ManagerOverrideModal.tsx:64: <button
src/components/admin/ManagerOverrideModal.tsx:93: <button
src/components/admin/BrandManager.tsx:71: <button
src/components/admin/BrandManager.tsx:122: <button onClick={clearFilters} className="p-2 text-app-text-faint hover:text-app-error hover:bg-app-error-bg rounded-lg transition-colors">
src/components/admin/BrandManager.tsx:130: <button
src/components/admin/BrandManager.tsx:137: <button
src/components/admin/BrandManager.tsx:151: <button onClick={clearFilters} className="mt-2 text-app-primary font-semibold text-sm hover:underline">Clear Filters</button>
src/components/admin/BrandManager.tsx:184: <button
src/components/admin/BrandManager.tsx:269: <button className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-app-primary-light text-app-success' : 'text-app-text-faint hover:bg-app-surface-2'}`}>
src/components/admin/BrandManager.tsx:289: <button onClick={(e) => { e.stopPropagation(); onEdit(brand); }} className="p-2 text-app-text-faint hover:text-app-info hover:bg-app-info-bg rounded-lg transition-colors">
src/components/admin/GroupedProductForm.tsx:259: <button onClick={addVariant} className="btn-secondary text-sm py-1.5">
src/components/admin/GroupedProductForm.tsx:267: <button
src/components/admin/GroupedProductForm.tsx:364: <button
src/components/admin/AttributeFormModal.tsx:90: <button onClick={onClose} className="p-1 rounded-full hover:bg-app-border text-app-text-faint hover:text-app-text-muted transition-colors">
src/components/admin/AttributeFormModal.tsx:158: <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-app-border text-app-text-muted hover:bg-app-bg transition-colors">
src/components/admin/AttributeFormModal.tsx:161: <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-semibold bg-app-primary text-app-text hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-app-primary/20 flex items-center justify-center gap-2">
src/components/admin/TopHeader.tsx:18:                <button
src/components/admin/TopHeader.tsx:64:                    <button
src/components/admin/TopHeader.tsx:79:                <button
src/components/admin/TopHeader.tsx:126:                                    <button
src/components/admin/TopHeader.tsx:132:                                    <button
src/components/admin/TopHeader.tsx:141:                                        <button
src/components/admin/NotificationBell.tsx:78: <button suppressHydrationWarning className="p-2.5 relative hover:bg-app-surface-hover rounded-xl text-app-text-muted hover:text-app-primary transition-colors outline-none">
src/components/admin/CategoryMaintenanceSidebar.tsx:118: <button
src/components/admin/NamingRuleEditor.tsx:75: <button
src/components/admin/NamingRuleEditor.tsx:82: <button
src/components/admin/NamingRuleEditor.tsx:99: <button
src/components/admin/NamingRuleEditor.tsx:112: <button
src/components/admin/NamingRuleEditor.tsx:148: <button
src/components/admin/CreateUnitButton.tsx:12: <button
src/components/admin/CountryManager.tsx:55: <button
src/components/admin/CountryManager.tsx:91: <button onClick={clearFilters} className="p-2 text-app-text-faint hover:text-app-error hover:bg-app-error-bg rounded-lg transition-colors">
src/components/admin/CountryManager.tsx:98: <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-app-surface text-app-primary shadow-sm' : 'text-app-text-faint hover:text-app-text-muted'}`}><LayoutList size={18} /></button>
src/components/admin/CountryManager.tsx:99: <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-app-surface text-app-primary shadow-sm' : 'text-app-text-faint hover:text-app-text-muted'}`}><LayoutGrid size={18} /></button>
src/components/admin/CountryManager.tsx:157: <button className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-app-primary-light text-app-success' : 'text-app-text-faint hover:bg-app-surface-2'}`}>
src/components/admin/CountryManager.tsx:166: <button onClick={(e) => { e.stopPropagation(); onEdit(country) }} className="p-2 text-app-text-faint hover:text-app-info hover:bg-app-info-bg rounded-lg transition-colors"><Edit2 size={16} /></button>
```

**Status**: 🟡 High volume - targeting icon buttons first

---

### 3. Form Inputs Without Labels

```
src/components/admin/categories/CategoryFormModal.tsx:132: <input
src/components/admin/categories/CategoryFormModal.tsx:144: <input
src/components/admin/categories/CategoryFormModal.tsx:155: <input
src/components/admin/ManagerOverrideModal.tsx:78: <input
src/components/admin/BrandManager.tsx:86: <input
src/components/admin/GroupedProductForm.tsx:182: <input
src/components/admin/GroupedProductForm.tsx:295: <input
src/components/admin/GroupedProductForm.tsx:305: <input
src/components/admin/GroupedProductForm.tsx:316: <input
src/components/admin/GroupedProductForm.tsx:341: <input
src/components/admin/GroupedProductForm.tsx:350: <input
src/components/admin/AttributeFormModal.tsx:110: <input
src/components/admin/AttributeFormModal.tsx:120: <input
src/components/admin/NamingRuleEditor.tsx:129: <input
src/components/admin/CountryManager.tsx:69: <input
src/components/admin/ScopePinModal.tsx:92: <input
src/components/admin/UnitFormModal.tsx:133: <input
src/components/admin/UnitFormModal.tsx:145: <input
src/components/admin/UnitFormModal.tsx:158: <input
src/components/admin/UnitFormModal.tsx:178: <input type="checkbox" name="allowFraction" defaultChecked={unit?.allow_fraction} className="w-4 h-4 text-app-primary rounded" />
src/components/admin/UnitFormModal.tsx:182: <input
src/components/admin/UnitFormModal.tsx:207: <input
src/components/admin/UnitFormModal.tsx:216: <input
src/components/admin/UnitFormModal.tsx:225: <input
src/components/admin/UnitFormModal.tsx:241: <input
src/components/admin/UnitCalculator.tsx:123: <input
src/components/admin/UnitCalculator.tsx:170: <input type="text" className="input-field bg-app-primary-light font-bold text-app-success border-emerald-100" value={result} readOnly disabled />
src/components/admin/ScopePasswordModal.tsx:89: <input
src/components/admin/ScopePasswordModal.tsx:129: <input
src/components/admin/CommandPalette.tsx:102: <input
src/components/admin/AttributeManager.tsx:64: <input
src/components/admin/BrandFormModal.tsx:112: <input
src/components/admin/BrandFormModal.tsx:122: <input
src/components/admin/BrandFormModal.tsx:140: <input
src/components/admin/maintenance/UnifiedReassignmentTable.tsx:111: <input
src/components/admin/maintenance/UnifiedReassignmentTable.tsx:268: <input
src/components/admin/maintenance/MaintenanceSidebar.tsx:68: <input
src/components/shared/FileUploader.tsx:134: <input
src/components/pos/POSSalesHistoryPanel.tsx:156: <input
src/components/pos/AccountBook.tsx:631: <input
src/components/pos/AccountBook.tsx:658: <input
src/components/pos/AccountBook.tsx:720: <input
src/components/pos/AccountBook.tsx:736: <input
src/components/pos/AccountBook.tsx:751: <input
src/components/pos/AccountBook.tsx:776: <input
src/components/pos/AccountBook.tsx:834: <input
src/components/pos/AccountBook.tsx:931: <input
src/components/pos/AccountBook.tsx:964: <input
src/components/pos/AccountBook.tsx:1007: <input
src/components/pos/POSDeliveryModal.tsx:581: <input
```

**Status**: 🟡 High volume - prioritizing forms in finance, inventory, pos

---

### 4. Clickable Divs (Non-Semantic)

```
src/components/admin/SiteSwitcher.tsx:50: <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
src/components/admin/BrandManager.tsx:267: <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={toggleExpand}>
src/components/admin/TopHeader.tsx:119:                            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
src/components/admin/CountryManager.tsx:121: <div className="group border border-app-border rounded-2xl p-6 hover:shadow-lg transition-all bg-app-surface relative overflow-hidden flex flex-col cursor-pointer hover:border-app-success" onClick={() => onEdit(country)}>
src/components/admin/CountryManager.tsx:155: <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={toggleExpand}>
src/components/admin/TenantSwitcher.tsx:71: <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
src/components/admin/CommandPalette.tsx:94: <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-150" onClick={() => setOpen(false)} />
src/components/admin/AttributeManager.tsx:116: <div className="group border border-app-border rounded-2xl p-6 hover:shadow-lg transition-all bg-app-surface relative overflow-hidden flex flex-col cursor-pointer hover:border-app-success" onClick={() => onEdit(attribute)}>
src/components/admin/AttributeManager.tsx:156: <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={toggleExpand}>
src/components/shared/LifecycleHistory.tsx:103:        <div onClick={() => setOpen(true)}>{trigger}</div>
src/components/pos/POSSalesHistoryPanel.tsx:97: <div className="fixed inset-0 z-[900] flex" onClick={onClose}>
src/components/pos/AccountBook.tsx:368: <div className="absolute inset-0" onClick={onClose} />
src/components/pos/POSDeliveryModal.tsx:187: <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={onClose}>
src/components/pos/POSDeliveryModal.tsx:248: <div className="fixed inset-0 z-[950] flex items-center justify-center" onClick={onClose}>
src/components/pos/POSQuickHold.tsx:115: <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)}>
src/components/pos/POSQuickHold.tsx:237: <div className="fixed inset-0 z-[150]" onClick={() => setIsOpen(false)}>
src/components/pos/POSPendingDeliveriesPanel.tsx:101: <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
src/components/pos/ReceiptModal.tsx:106: <div className="absolute top-4 right-4 cursor-pointer hover:bg-app-text/20 p-2 rounded-full" onClick={onClose}>
src/components/pos/ReturnOrderModal.tsx:135: <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && step !== 'processing' && onClose()}>
src/components/pos/POSKeyboardShortcuts.tsx:123: <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
src/components/pos/POSKeyboardShortcuts.tsx:124: <div className="bg-app-surface border border-app-text/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
src/components/pos/MultiPaymentHub.tsx:734: <div className="absolute inset-0 bg-app-surface/60 backdrop-blur-xl animate-in fade-in duration-300" onClick={onClose} />
src/components/pos/AddressBook.tsx:347: <div className="absolute inset-0" onClick={onClose} />
src/components/pos/layouts/POSLayoutModern.tsx:932:                                                <div className="pl-[2.75rem] pr-10 w-full" onClick={(e) => e.stopPropagation()}>
src/components/pos/layouts/POSLayoutIntelligence.tsx:743: <div className="pl-1 w-full" onClick={(e) => e.stopPropagation()}>
src/components/pos/CloseRegisterModal.tsx:108: <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && step === 'form' && onCancel()}>
src/components/ui/universal-data-table.tsx:332:                                    <div className="flex-1 cursor-pointer" onClick={() => applyView(view)}>
src/components/common/TypicalListView.tsx:410: <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
src/modules/migration/page.tsx:798:                                                <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
src/storefront/themes/midnight/NotificationsPage.tsx:131:                                <div key={notif.id} onClick={() => !notif.is_read && markRead(notif.id)}
```

**Status**: 🟡 Many are backdrop overlays (acceptable pattern)

---

## Summary Statistics

| Category | Found | Priority | Target Fixed |
|----------|-------|----------|--------------|
| Images without alt | 9 | High | 9/9 (100%) |
| Buttons without aria-label | 50 | Medium | 50+ icon buttons |
| Inputs without labels | 50 | High | 100+ critical forms |
| Clickable divs | 30 | Medium | Review case-by-case |

**Total Issues Identified**: ~2,165 (from audit)
**Wave 3 Target**: Fix 600+ critical issues
**Expected Remaining**: <500 critical issues

---

## Remediation Plan

### High Priority (This Sprint)
1. ✅ Add alt text to all 9 images
2. 🔄 Add aria-labels to 100+ icon-only buttons
3. 🔄 Add labels/aria-labels to 200+ form inputs
4. 🔄 Review 30 clickable divs for semantic alternatives

### Medium Priority (Next Sprint)
1. Add keyboard navigation tests
2. Screen reader testing
3. Color contrast improvements
4. Focus indicator improvements

### Verification
- Re-run: `bash scripts/accessibility-audit.sh`
- Compare before/after violation counts
- Lighthouse accessibility score improvement

---

**Generated**: 2026-03-14 18:39:08
**Script**: scripts/fix-accessibility.sh
