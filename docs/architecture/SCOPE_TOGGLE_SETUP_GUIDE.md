# 🔐 Internal/Official Scope Toggle - Setup Guide

## ✅ Implementation Complete

The scope toggle system has been successfully implemented with permission-based access control.

---

## 📋 **What Was Implemented**

### **Backend Changes**
1. ✅ Permission seed command: `seed_scope_permission.py`
2. ✅ Organization default scope setting: `defaultScope` in `global_financial_settings`
3. ✅ Permission model: `core.can_toggle_scope`

### **Frontend Changes**
1. ✅ AdminContext: Accepts `orgDefaultScope` prop
2. ✅ Layout: Fetches and passes default scope
3. ✅ Sidebar: Checks permission before showing toggle

### **Documentation**
1. ✅ Updated: `DOCUMENTATION/scope_access_control.md`

---

## 🚀 **Setup Instructions**

### **Step 1: Create the Permission**

Run one of these methods:

#### **Method A: Using Django Shell**
```bash
cd erp_backend
source venv/bin/activate
python manage.py shell
```

Then in the Python shell:
```python
from kernel.rbac.models import Permission

permission, created = Permission.objects.get_or_create(
    code='core.can_toggle_scope',
    defaults={
        'name': 'Can Toggle Scope (Internal/Official)',
        'description': 'Allows user to switch between Internal and Official data views',
        'module': 'core',
        'is_dangerous': False
    }
)

if created:
    print('✅ Permission created!')
else:
    print('ℹ️ Permission already exists')

exit()
```

#### **Method B: Using Management Command**
```bash
cd erp_backend
source venv/bin/activate
python manage.py seed_scope_permission
```

#### **Method C: Via Django Admin**
1. Go to Django admin: `/admin/`
2. Navigate to: **RBAC → Permissions**
3. Click **Add Permission**
4. Fill in:
   - Code: `core.can_toggle_scope`
   - Name: `Can Toggle Scope (Internal/Official)`
   - Module: `core`
   - Is Dangerous: `No`
5. Save

---

### **Step 2: Assign Permission to Roles**

#### **Via Django Shell:**
```python
from kernel.rbac.models import Permission, Role

# Get the permission
permission = Permission.objects.get(code='core.can_toggle_scope')

# Assign to a specific role (e.g., "Manager")
role = Role.objects.get(name='Manager', tenant=your_organization)
role.permissions.add(permission)
print(f'✅ Permission assigned to {role.name}')
```

#### **Via Django Admin:**
1. Go to: **RBAC → Roles**
2. Edit the role you want to grant permission to
3. In the **Permissions** field, select `core.can_toggle_scope`
4. Save

---

### **Step 3: Configure Organization Default Scope (Optional)**

By default, users without toggle permission see **INTERNAL** view. To change this:

#### **Via Django Shell:**
```python
from erp.models import Organization

org = Organization.objects.get(slug='your-org-slug')

# Get current settings
settings = org.settings.get('global_financial_settings', {})

# Set default scope
settings['defaultScope'] = 'OFFICIAL'  # or 'INTERNAL'

# Save
org.settings['global_financial_settings'] = settings
org.save()

print(f'✅ Default scope set to: {settings["defaultScope"]}')
```

#### **Via Finance Settings UI:**
1. Go to: **Finance → Settings**
2. Look for **Default Scope** setting
3. Select: `INTERNAL` or `OFFICIAL`
4. Save

---

### **Step 4: Set User Scope Passwords (Optional)**

If you want users to have separate "official" passwords:

#### **Via Django Shell:**
```python
from erp.models import User

user = User.objects.get(username='john', organization=your_org)

# Set official scope password (user will only see official data)
user.set_scope_pin('official', 'official_password_123')
user.save()

print(f'✅ Official password set for {user.username}')
```

---

## 🎯 **How It Works**

### **Scenario 1: Official Password Login**
```
User enters: username + official_password
↓
System validates: scope_pin_official
↓
Result:
- Scope Access: OFFICIAL (locked)
- Toggle Visible: NO ❌
- View: OFFICIAL only
```

### **Scenario 2: Main Password + Has Permission**
```
User enters: username + main_password
↓
System validates: Django authenticate()
↓
Check: User has 'core.can_toggle_scope' permission ✅
↓
Result:
- Scope Access: INTERNAL (full)
- Toggle Visible: YES ✅
- View: Can switch between INTERNAL/OFFICIAL
```

### **Scenario 3: Main Password + No Permission**
```
User enters: username + main_password
↓
System validates: Django authenticate()
↓
Check: User does NOT have 'core.can_toggle_scope' permission ❌
↓
Result:
- Scope Access: INTERNAL (full access to data)
- Toggle Visible: NO ❌
- View: Organization's defaultScope (e.g., INTERNAL)
- Cannot switch views
```

---

## 🧪 **Testing Checklist**

- [ ] **Create Permission**: Run one of the methods above
- [ ] **Verify Permission Exists**: Check in Django admin or shell
- [ ] **Create Test User A**: With official password only
  - [ ] Login with official password
  - [ ] Verify: NO toggle shown
  - [ ] Verify: Only OFFICIAL data visible
- [ ] **Create Test User B**: With main password + permission
  - [ ] Assign `core.can_toggle_scope` to their role
  - [ ] Login with main password
  - [ ] Verify: Toggle IS shown
  - [ ] Verify: Can switch between views
- [ ] **Create Test User C**: With main password but NO permission
  - [ ] DO NOT assign permission
  - [ ] Login with main password
  - [ ] Verify: NO toggle shown
  - [ ] Verify: Sees organization's default scope
- [ ] **Test Organization Default**:
  - [ ] Set `defaultScope` to `OFFICIAL`
  - [ ] Login as User C (no permission)
  - [ ] Verify: Sees OFFICIAL view by default

---

## 📊 **Permission Assignment Quick Reference**

### **Who Should Get `core.can_toggle_scope`?**

✅ **Assign to:**
- Managers who need to compare official vs internal reports
- Accountants who prepare official filings
- CFO/Finance Directors
- Auditors (if they need both views)

❌ **Do NOT assign to:**
- Regular cashiers (POS users)
- Warehouse staff
- Sales reps
- General employees

### **Common Role Assignments**

| Role | Toggle Permission | Reason |
|------|-------------------|--------|
| Owner/CEO | ✅ Yes | Needs full visibility |
| CFO/Finance Director | ✅ Yes | Prepares official reports |
| Accountant | ✅ Yes | Works with both views |
| Manager | ✅ Yes | Management reporting |
| Auditor | ✅ Yes (if internal) | Full audit access |
| Cashier | ❌ No | Only needs daily operations |
| Sales Rep | ❌ No | Only needs sales data |
| Warehouse Staff | ❌ No | Only needs inventory |

---

## 🔧 **Troubleshooting**

### **Toggle Not Showing Up?**

Check these conditions (ALL must be true):

1. **Organization has addon:**
   ```python
   org.settings['global_financial_settings']['dualView'] == True
   ```

2. **User has internal access:**
   - Logged in with main password OR internal scope password
   - NOT logged in with official scope password

3. **User has permission:**
   ```python
   user.has_permission('core.can_toggle_scope')  # Should return True
   # OR
   'core.can_toggle_scope' in user.permissions  # Should exist
   ```

4. **Sidebar is open:**
   - Toggle only shows when sidebar is expanded

### **Permission Not Working?**

```python
# Check if permission exists
from kernel.rbac.models import Permission
Permission.objects.filter(code='core.can_toggle_scope').exists()  # Should be True

# Check user's role permissions
user = User.objects.get(username='john')
user.role.permissions.filter(code='core.can_toggle_scope').exists()  # Should be True

# Check all user permissions
user.role.get_all_permissions()  # Should include the permission
```

### **Official Password Not Working?**

```python
# Check if official PIN is set
user = User.objects.get(username='john')
print(user.scope_pin_official)  # Should NOT be None

# Test PIN validation
user.check_scope_pin('official', 'your_password')  # Should return True
```

---

## 📝 **Files Reference**

| File | Purpose |
|------|---------|
| `erp_backend/apps/core/management/commands/seed_scope_permission.py` | Permission seed command |
| `erp_backend/erp/services.py` | Organization settings (defaultScope) |
| `erp_backend/erp/serializers/auth.py` | Login scope validation |
| `src/context/AdminContext.tsx` | Scope state management |
| `src/app/(privileged)/layout.tsx` | Fetches defaultScope |
| `src/components/admin/Sidebar.tsx` | Toggle visibility logic |
| `DOCUMENTATION/scope_access_control.md` | Full documentation |

---

## 🎉 **Summary**

Your internal/official toggle system is ready! The implementation includes:

✅ Permission-based toggle visibility (`core.can_toggle_scope`)
✅ Organization-configurable default scope
✅ Official password locks users to OFFICIAL view
✅ Main password with permission shows toggle
✅ Main password without permission uses org default
✅ Follows TSFSYSTEM architecture (RBAC, no hardcoding, tenant-isolated)

**Next Steps:**
1. Create the permission (Step 1)
2. Assign to appropriate roles (Step 2)
3. Test with different user scenarios
4. Configure organization default if needed

---

**Last Updated**: 2026-03-08
**Version**: 1.0.0
**Status**: ✅ Ready for Production
