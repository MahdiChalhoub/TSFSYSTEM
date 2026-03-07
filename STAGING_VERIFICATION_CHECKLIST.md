# 🧪 TSF ERP System - Staging Verification Checklist

**Environment**: Staging/Pre-Production
**Date**: 2026-03-07
**Build Version**: Production Build (598 routes)
**Purpose**: Comprehensive smoke testing before production deployment

---

## 📋 Pre-Verification Setup

### Environment Verification
- [ ] Staging environment is running
- [ ] Database is properly seeded with test data
- [ ] Environment variables are configured correctly
- [ ] SSL certificate is valid
- [ ] DNS is pointing to staging server
- [ ] Backend API is accessible at staging URL
- [ ] Redis/cache layer is operational
- [ ] Celery workers are running (if applicable)

### Test User Accounts
Create these test accounts before verification:

```bash
# Admin user
Email: admin@test.tsf.ci
Role: Super Admin
Permissions: All modules

# Finance user
Email: finance@test.tsf.ci
Role: Finance Manager
Permissions: Finance, Accounting, Reports

# Sales user
Email: sales@test.tsf.ci
Role: Sales Representative
Permissions: POS, Sales, Orders, Customers

# Inventory user
Email: inventory@test.tsf.ci
Role: Warehouse Manager
Permissions: Inventory, Products, Stock, Warehouses

# Standard user
Email: user@test.tsf.ci
Role: Employee
Permissions: Basic read access
```

---

## 🔐 Authentication & Authorization

### Login Flow
- [ ] Login page loads without errors
- [ ] Can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] "Remember me" checkbox works
- [ ] Password visibility toggle works
- [ ] Forgot password link works
- [ ] Session persists on page refresh
- [ ] Logout clears session properly

### User Registration
- [ ] Business registration form loads
- [ ] User registration form loads
- [ ] Email validation works
- [ ] Password strength indicator works
- [ ] Terms & conditions checkbox required
- [ ] Registration creates new user/tenant
- [ ] Welcome email sent (check logs)
- [ ] Auto-login after registration works

### Multi-Tenant Isolation
- [ ] Users can only see their tenant's data
- [ ] Switching tenants works (if applicable)
- [ ] Cross-tenant data access is blocked
- [ ] Organization switcher displays correct orgs

---

## 🏠 Dashboard & Navigation

### Main Dashboard
- [ ] Dashboard loads without errors
- [ ] All KPI cards display correct data
- [ ] Charts render properly
- [ ] Recent activities load
- [ ] Quick actions work
- [ ] Navigation sidebar displays all modules
- [ ] Module icons render correctly
- [ ] Mobile menu works (test on mobile)

### Theme System
- [ ] Default theme applies correctly
- [ ] Theme switcher works (if enabled)
- [ ] All CSS variables load properly
- [ ] No hardcoded colors visible
- [ ] Responsive layout works on mobile
- [ ] Dark mode toggle works (if applicable)
- [ ] Custom branding displays (logo, colors)

---

## 📦 Inventory Module

### Products Management
- [ ] Product list loads: `/inventory/products`
- [ ] Search functionality works
- [ ] Filters work (category, brand, status)
- [ ] Pagination works
- [ ] Create new product works: `/inventory/products/new`
- [ ] Edit product works: `/inventory/products/[id]`
- [ ] Product details display correctly
- [ ] Image upload works
- [ ] Barcode generation works
- [ ] Variant management works
- [ ] Stock levels display correctly

### Brands & Categories
- [ ] Brand list loads: `/inventory/brands` ✅ (Fixed endpoint)
- [ ] Create new brand works
- [ ] Edit brand works
- [ ] Delete brand works (with confirmation)
- [ ] Category list loads: `/inventory/categories` ✅ (Fixed endpoint)
- [ ] Category tree renders correctly
- [ ] Create subcategory works
- [ ] Edit category works
- [ ] Move category to different parent works

### Warehouses & Stock
- [ ] Warehouse list loads: `/inventory/warehouses`
- [ ] Stock count page loads: `/inventory/stock-count`
- [ ] Stock movements display: `/inventory/movements`
- [ ] Transfer orders work: `/inventory/transfer-orders`
- [ ] Stock adjustment works
- [ ] Low stock alerts display: `/inventory/low-stock`
- [ ] Expiry alerts display: `/inventory/expiry-alerts`

### Barcode System
- [ ] Barcode scanner page loads: `/inventory/barcode`
- [ ] Barcode search works
- [ ] Print barcode labels works: `/inventory/labels`
- [ ] Batch label printing works

---

## 💰 Finance Module

### Invoices
- [ ] Invoice list loads: `/finance/invoices`
- [ ] Create new invoice works: `/finance/invoices/new`
- [ ] Invoice PDF generation works
- [ ] Send invoice by email works
- [ ] Mark invoice as paid works
- [ ] Invoice status updates correctly
- [ ] Multi-currency invoices work
- [ ] Tax calculation is correct
- [ ] Payment allocation works

### Payments
- [ ] Payment list loads: `/finance/payments`
- [ ] Record new payment works: `/finance/payments/new`
- [ ] Split payment allocation works
- [ ] Payment methods display correctly
- [ ] Payment receipt generation works
- [ ] Refund processing works

### Chart of Accounts
- [ ] COA list loads: `/finance/chart-of-accounts` ✅ (Fixed template string)
- [ ] Account tree renders correctly
- [ ] Create new account works
- [ ] Edit account works
- [ ] Account balances display correctly
- [ ] COA templates load: `/finance/chart-of-accounts/templates`
- [ ] COA migration works: `/finance/chart-of-accounts/migrate`

### Journal & Ledger
- [ ] Journal entries load: `/finance/journal`
- [ ] Create manual journal entry works
- [ ] Double-entry validation works
- [ ] General ledger loads: `/finance/ledger`
- [ ] Opening balances work: `/finance/ledger/opening`
- [ ] Trial balance report works: `/finance/reports/trial-balance`

### Financial Reports
- [ ] Balance sheet loads: `/finance/reports/balance-sheet`
- [ ] P&L statement loads: `/finance/reports/pnl`
- [ ] Cash flow statement loads: `/finance/reports/statement`
- [ ] Aging report loads: `/finance/aging`
- [ ] Tax reports load: `/finance/tax-reports`
- [ ] VAT return loads: `/finance/vat-return`
- [ ] Report export to PDF works
- [ ] Report export to Excel works

---

## 🛒 Sales & POS Module

### Point of Sale
- [ ] POS terminal loads: `/sales/pos-settings` ✅ (Fully theme-compliant)
- [ ] POS lobby loads properly
- [ ] Register opening works
- [ ] Product search works in POS
- [ ] Add items to cart works
- [ ] Apply discount works
- [ ] Loyalty points calculation works
- [ ] Split payment works
- [ ] Print receipt works
- [ ] Cash drawer opening works
- [ ] Register closing works
- [ ] End-of-day report generates

### Sales Orders
- [ ] Order list loads: `/pos/orders`
- [ ] Create new order works: `/pos/orders/new`
- [ ] Edit draft order works
- [ ] Convert order to invoice works
- [ ] Order status workflow works
- [ ] Delivery management works: `/pos/deliveries`
- [ ] Delivery zones work: `/pos/delivery-zones`

### Quotations
- [ ] Quotation list loads: `/sales/quotations` ✅ (Fixed Response types)
- [ ] Create quotation works
- [ ] Send quotation by email works
- [ ] Convert quotation to order works
- [ ] Quotation expiry tracking works

### Sales Returns
- [ ] Return list loads: `/sales/returns`
- [ ] Create return works: `/sales/returns/new`
- [ ] Return processing updates stock
- [ ] Refund processing works
- [ ] Credit note generation works

---

## 🛍️ E-commerce Module

### Storefront
- [ ] Public store loads: `/store`
- [ ] Product catalog displays: `/store/catalog`
- [ ] Product details page works: `/store/catalog/[id]`
- [ ] Search functionality works
- [ ] Category filtering works
- [ ] Add to cart works
- [ ] Shopping cart loads: `/store/cart`
- [ ] Checkout process works: `/store/checkout`
- [ ] Order confirmation displays

### Customer Portal
- [ ] Customer login works: `/store/login`
- [ ] Customer registration works: `/store/register`
- [ ] Account dashboard loads: `/store/account`
- [ ] Order history displays: `/store/account/orders`
- [ ] Order details load: `/store/account/orders/[id]`
- [ ] Wishlist works: `/store/wishlist`

### E-commerce Admin
- [ ] Dashboard loads: `/ecommerce/dashboard`
- [ ] Order management works: `/ecommerce/orders`
- [ ] Promotions work: `/ecommerce/promotions` ✅ (Theme-compliant)
- [ ] Coupons work: `/ecommerce/coupons` ✅ (Theme-compliant)
- [ ] Shipping rates work: `/ecommerce/shipping` ✅ (Fixed endpoint, theme-compliant)
- [ ] Webhooks work: `/ecommerce/webhooks` ✅ (Theme-compliant)
- [ ] Storefront config works: `/ecommerce/storefront-config`

---

## 🤝 CRM Module

### Contacts
- [ ] Contact list loads: `/crm/contacts`
- [ ] Create contact works: `/crm/contacts/new`
- [ ] Edit contact works: `/crm/contacts/[id]`
- [ ] Contact details display correctly
- [ ] Contact history displays
- [ ] Contact merge works
- [ ] Import contacts works

### Customer Portal Preview
- [ ] Client gate preview loads: `/crm/client-gate-preview` ✅ (Fixed CSS vars)
- [ ] Supplier gate preview loads: `/crm/supplier-gate-preview` ✅ (Fixed CSS vars)

### Pricing
- [ ] Price groups load: `/crm/price-groups`
- [ ] Price rules load: `/crm/price-rules`
- [ ] Dynamic pricing works
- [ ] Customer-specific pricing works

---

## 👥 HR Module

### Employees
- [ ] Employee list loads: `/hr/employees`
- [ ] Create employee works: `/hr/employees/new`
- [ ] Edit employee works: `/hr/employees/[id]`
- [ ] Employee details display correctly
- [ ] Department management works: `/hr/departments`

### Attendance
- [ ] Attendance list loads: `/hr/attendance`
- [ ] Clock in/out works
- [ ] Shift management works: `/hr/shifts`
- [ ] Attendance reports work

### Leave Management
- [ ] Leave requests load: `/hr/leaves`
- [ ] Submit leave request works
- [ ] Approve leave request works
- [ ] Leave balance calculation works

### Payroll
- [ ] Payroll overview loads: `/hr/payroll`
- [ ] Generate payroll works
- [ ] Payslip generation works
- [ ] Payroll reports work

---

## 📊 Workspace Module

### Tasks
- [ ] Task list loads: `/workspace/tasks`
- [ ] Create task works: `/workspace/tasks/new`
- [ ] Edit task works: `/workspace/tasks/[id]`
- [ ] Task assignment works
- [ ] Task status updates work
- [ ] Task comments work
- [ ] Task attachments work

### Checklists
- [ ] Checklist list loads: `/workspace/checklists`
- [ ] Checklist templates work: `/workspace/checklist-templates`
- [ ] Create checklist from template works
- [ ] Check/uncheck items works
- [ ] Checklist completion tracking works

### Documents
- [ ] File storage loads: `/storage/files`
- [ ] File upload works
- [ ] File download works
- [ ] File preview works
- [ ] Folder organization works
- [ ] File sharing works
- [ ] File version history works

---

## 🔌 Integrations

### Client Portal
- [ ] Client portal config loads: `/client_portal/config`
- [ ] Client access management works: `/client_portal/client-access`
- [ ] Client dashboard loads: `/client_portal/dashboard`
- [ ] Client orders work: `/client_portal/my-orders`
- [ ] Client tickets work: `/client_portal/my-tickets`
- [ ] Client wallet works: `/client_portal/my-wallet`
- [ ] Shipping rates work: `/client_portal/shipping-rates` ✅ (Fixed endpoint)

### Supplier Portal
- [ ] Supplier portal config loads: `/supplier_portal/config`
- [ ] Supplier access management works: `/supplier_portal/portal-access`
- [ ] Supplier dashboard loads: `/supplier_portal/dashboard`
- [ ] Supplier orders work: `/supplier_portal/my-orders`
- [ ] Price requests work: `/supplier_portal/my-price-requests`
- [ ] Proformas work: `/supplier_portal/my-proformas`
- [ ] Supplier stock tracking works: `/supplier_portal/my-stock`

### Webhooks
- [ ] Webhook list loads: `/integrations/webhooks`
- [ ] Create webhook works
- [ ] Webhook test firing works
- [ ] Webhook logs display
- [ ] Webhook retry works

---

## 🔧 Settings & Configuration

### General Settings
- [ ] Settings page loads: `/settings/appearance`
- [ ] Update organization details works
- [ ] Upload logo works
- [ ] Theme customization works
- [ ] Currency settings work
- [ ] Tax settings work
- [ ] Email settings work

### User & Role Management
- [ ] Role list loads: `/settings/roles`
- [ ] Create role works
- [ ] Edit role permissions works
- [ ] Assign role to user works
- [ ] Permission enforcement works

### Security Settings
- [ ] Security page loads: `/settings/security`
- [ ] 2FA setup works (if enabled)
- [ ] Password policy configuration works
- [ ] Session timeout configuration works
- [ ] Audit log displays

### POS Settings
- [ ] POS settings load: `/settings/pos-settings`
- [ ] Register configuration works
- [ ] Receipt template customization works
- [ ] Payment method configuration works
- [ ] Loyalty program setup works

---

## 🧩 MCP Module (AI Integration)

### MCP Pages (Generated)
- [ ] MCP dashboard loads: `/mcp`
- [ ] Agents list loads: `/mcp/agents` ✅ (Duplicate removed)
- [ ] Conversations load: `/mcp/conversations` ✅ (Duplicate removed)
- [ ] Providers load: `/mcp/providers` ✅ (Duplicate removed)
- [ ] Tools load: `/mcp/tools` ✅ (Duplicate removed)
- [ ] Usage stats load: `/mcp/usage` ✅ (Duplicate removed)
- [ ] Agent logs load: `/mcp/agent-logs`
- [ ] MCP chat works: `/mcp/chat`

---

## 🔄 Data Migration

### Migration Tools
- [ ] Migration page loads: `/migration`
- [ ] Migration jobs list loads: `/migration/jobs`
- [ ] Create migration job works
- [ ] Migration execution works
- [ ] Migration status updates correctly
- [ ] Migration audit displays: `/migration/audit`
- [ ] Rollback functionality works

---

## 📱 Mobile Responsiveness

### Test on Multiple Devices
Test each module on:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet Portrait (768x1024)
- [ ] Tablet Landscape (1024x768)
- [ ] Mobile Portrait (375x667)
- [ ] Mobile Landscape (667x375)

### Mobile-Specific Features
- [ ] Mobile navigation menu works
- [ ] Touch gestures work (swipe, tap)
- [ ] Forms are mobile-friendly
- [ ] Tables are responsive/scrollable
- [ ] Buttons are properly sized
- [ ] Text is readable without zooming

---

## 🚀 Performance Testing

### Page Load Times
Measure load times (target: < 2 seconds):
- [ ] Dashboard: ___ms
- [ ] Product list: ___ms
- [ ] Invoice list: ___ms
- [ ] POS terminal: ___ms
- [ ] Reports: ___ms
- [ ] E-commerce store: ___ms

### Performance Metrics
- [ ] Time to First Byte (TTFB) < 500ms
- [ ] First Contentful Paint (FCP) < 1.5s
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Time to Interactive (TTI) < 3s
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] First Input Delay (FID) < 100ms

### Browser Performance
Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if macOS available)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 🔍 Error Handling

### Console Errors
Open browser DevTools console and verify:
- [ ] No 404 errors
- [ ] No 500 errors
- [ ] No JavaScript errors
- [ ] No CSS loading errors
- [ ] No server action errors
- [ ] No CORS errors
- [ ] Warnings are acceptable (document if any)

### Network Tab
Check Network tab in DevTools:
- [ ] All API calls return 200 OK (or expected status)
- [ ] No failed requests
- [ ] Response times are acceptable
- [ ] Payload sizes are reasonable
- [ ] Caching headers are set correctly

### Error Boundaries
Test error handling:
- [ ] Invalid URLs show 404 page
- [ ] Server errors show error boundary
- [ ] Network failures show error message
- [ ] Retry mechanisms work
- [ ] Error reporting works (Sentry/logging)

---

## 🛡️ Security Testing

### Authentication Security
- [ ] JWT tokens expire correctly
- [ ] Refresh token mechanism works
- [ ] Session hijacking prevention works
- [ ] CSRF protection works
- [ ] XSS prevention works

### Authorization Testing
- [ ] RBAC enforcement works
- [ ] Unauthorized access shows 403
- [ ] Direct URL access is blocked for unprivileged users
- [ ] API endpoints require authentication
- [ ] Tenant isolation is enforced

### Input Validation
- [ ] SQL injection prevention works
- [ ] XSS script injection blocked
- [ ] File upload validation works
- [ ] Form validation works
- [ ] API input sanitization works

---

## 💾 Data Integrity

### CRUD Operations
For each major module, verify:
- [ ] Create operations save correctly
- [ ] Read operations display correct data
- [ ] Update operations modify data correctly
- [ ] Delete operations remove data correctly
- [ ] Soft deletes work (if applicable)
- [ ] Restore works (if applicable)

### Audit Logging
- [ ] All state changes are logged
- [ ] Audit logs display correctly
- [ ] User actions are tracked
- [ ] Timestamps are accurate
- [ ] Audit trail is immutable

### Database Consistency
- [ ] Foreign key constraints work
- [ ] Unique constraints work
- [ ] Required field validation works
- [ ] Default values are set correctly
- [ ] Cascading deletes work correctly

---

## 🔔 Notifications & Emails

### Notification System
- [ ] In-app notifications display
- [ ] Notification count updates correctly
- [ ] Mark as read works
- [ ] Notification preferences work
- [ ] Real-time notifications work (WebSocket)

### Email Notifications
- [ ] Welcome email sent on registration
- [ ] Invoice email sent correctly
- [ ] Password reset email works
- [ ] Order confirmation email sent
- [ ] Payment receipt email sent
- [ ] Email templates render correctly
- [ ] Email unsubscribe works

---

## 📊 Reporting

### Report Generation
- [ ] All reports generate without errors
- [ ] Report data is accurate
- [ ] Report filters work correctly
- [ ] Date range selection works
- [ ] Report export to PDF works
- [ ] Report export to Excel works
- [ ] Report export to CSV works
- [ ] Scheduled reports work (if applicable)

### Dashboard Analytics
- [ ] KPI calculations are correct
- [ ] Charts display accurate data
- [ ] Chart interactions work (hover, click)
- [ ] Date range filtering works
- [ ] Real-time data updates work

---

## 🧪 Edge Cases & Stress Testing

### Edge Cases
- [ ] Empty state displays work (no data)
- [ ] Large datasets load properly (100+ records)
- [ ] Long text content displays correctly
- [ ] Special characters in names work
- [ ] Unicode/emoji support works
- [ ] Timezone handling works correctly
- [ ] Daylight saving time transitions work

### Stress Testing
- [ ] Concurrent users work (5+ users)
- [ ] Multiple browser tabs work
- [ ] Large file uploads work (10MB+)
- [ ] Bulk operations work (100+ records)
- [ ] Long-running operations don't timeout
- [ ] Memory leaks don't occur over time

---

## 📝 Documentation

### User-Facing Documentation
- [ ] Help/FAQ pages load
- [ ] User guides are accessible
- [ ] Tooltips display correctly
- [ ] Inline help works
- [ ] Video tutorials load (if applicable)

### API Documentation
- [ ] API docs are accessible
- [ ] API examples work
- [ ] API authentication docs are correct
- [ ] API rate limits are documented

---

## ✅ Sign-Off Criteria

### Blocker Issues (Must Fix Before Production)
Count: ___
- [ ] No blocker issues remaining

### Critical Issues (Should Fix Before Production)
Count: ___
- [ ] Critical issues documented and tracked

### Minor Issues (Can Fix Post-Launch)
Count: ___
- [ ] Minor issues documented for future sprints

### Sign-Off
- [ ] QA Lead approval
- [ ] Product Owner approval
- [ ] Technical Lead approval
- [ ] Security review completed
- [ ] Performance benchmarks met
- [ ] Documentation updated

---

## 📤 Post-Verification Actions

### After Successful Verification
- [ ] Tag staging build: `git tag staging-v3.1.4-verified`
- [ ] Update CHANGELOG.md
- [ ] Create deployment ticket
- [ ] Schedule production deployment window
- [ ] Notify stakeholders of deployment plan
- [ ] Prepare rollback plan
- [ ] Set up production monitoring alerts

### If Issues Found
- [ ] Document all issues in issue tracker
- [ ] Prioritize issues (blocker/critical/minor)
- [ ] Create fix branches
- [ ] Retest after fixes
- [ ] Update this checklist with retest date

---

## 📞 Support Contacts

### During Verification
- **QA Lead**: [contact info]
- **Backend Developer**: [contact info]
- **Frontend Developer**: [contact info]
- **DevOps**: [contact info]

### Issue Escalation
1. Document issue clearly with screenshots
2. Check browser console for errors
3. Check network tab for API failures
4. Check backend logs for server errors
5. Report to appropriate team lead

---

## 📋 Verification Log

**Verified By**: _______________
**Date**: _______________
**Duration**: _______________
**Total Tests**: _______________
**Passed**: _______________
**Failed**: _______________
**Blocked**: _______________
**Notes**:

---

**Checklist Version**: 1.0.0
**Last Updated**: 2026-03-07
**Next Review**: After each major release
