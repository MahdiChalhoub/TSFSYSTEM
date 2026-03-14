# Accessibility Audit Report
**Date**: 2026-03-14
**Standard**: WCAG 2.1 AA

## Executive Summary

- **Images without alt text**: 9
- **Buttons without accessible labels**: 1522
- **Inputs without labels**: 573
- **Divs with onClick (should be buttons)**: 61

## Detailed Findings

### 1. Images without alt text

**Severity**: High
**WCAG Criterion**: 1.1.1 Non-text Content (Level A)

Files with images missing alt text:
src/components/admin/BrandManager.tsx:274: {brand.logo ? <img src={brand.logo} className="w-full h-full object-cover rounded-lg" /> : brand.name.substring(0, 2)}
src/components/pos/ProductGrid.tsx:299: <img
src/components/pos/layouts/POSLayoutModern.tsx:858:                                                    <img
src/components/ui/avatar.tsx:39:    <img
src/components/tenant/StorefrontCatalog.tsx:145: <img
src/components/app/ui/AppEmptyState.tsx:57:                <img
src/app/(privileged)/inventory/brands/BrandsClient.tsx:35: {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}
src/app/(privileged)/inventory/brands/BrandsClient.tsx:82: {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}
src/app/(auth)/login/page.tsx:65:                    <img

### 2. Buttons without accessible labels

**Severity**: Medium
**WCAG Criterion**: 4.1.2 Name, Role, Value (Level A)

Icon-only buttons should have aria-label:
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

### 3. Form inputs without labels

**Severity**: High
**WCAG Criterion**: 1.3.1 Info and Relationships (Level A)

All inputs should have associated labels or aria-label:
src/components/admin/categories/CategoryFormModal.tsx:125: <input type="hidden" name="parentId" value={selectedParent} />
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
src/components/admin/AttributeFormModal.tsx:147: <input key={id} type="hidden" name="categoryIds" value={id} />
src/components/admin/NamingRuleEditor.tsx:129: <input
src/components/admin/CountryManager.tsx:69: <input
src/components/admin/ScopePinModal.tsx:92: <input
src/components/admin/UnitFormModal.tsx:109: <input type="hidden" name="baseUnitId" value={unitType === 'derived' ? selectedParentId : ''} />
src/components/admin/UnitFormModal.tsx:133: <input

### 4. Non-semantic interactive elements

**Severity**: Medium
**WCAG Criterion**: 4.1.2 Name, Role, Value (Level A)

Use semantic HTML (button, a) instead of div with onClick:
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

## Recommendations

### High Priority
1. Add alt text to all images
2. Add labels or aria-label to all form inputs
3. Replace clickable divs with semantic buttons

### Medium Priority
1. Add aria-labels to icon-only buttons
2. Ensure keyboard navigation works for all interactive elements
3. Test with screen readers (NVDA, JAWS, VoiceOver)

### Best Practices
- Use semantic HTML elements
- Ensure sufficient color contrast (4.5:1 for normal text)
- Support keyboard navigation (Tab, Enter, Escape)
- Test with automated tools (axe, Lighthouse)
- Manual testing with screen readers

## Tools for Testing
- **Automated**: axe DevTools, Lighthouse, WAVE
- **Screen Readers**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac)
- **Keyboard Testing**: Navigate entire app using only Tab/Enter/Escape

