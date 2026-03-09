# 🚀 Deployment Guide - March 8, 2026

## Quick Deploy Checklist

### **1. Backend Deployment**

```bash
# 1. Pull latest changes
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
source venv/bin/activate

# 2. Create the scope toggle permission
python manage.py seed_scope_permission

# 3. Restart backend services
sudo systemctl restart tsfsystem-backend.service

# Or if using PM2:
# pm2 restart all
```

### **2. Frontend Deployment**

```bash
# 1. Build frontend
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
npm run build

# 2. Restart frontend service
sudo systemctl restart tsfsystem-frontend.service

# Or if using PM2:
# pm2 restart tsfsystem-frontend
```

### **3. Post-Deployment Configuration**

#### **Setup Scope Toggle Permission**

**Option A: Via Django Admin**
1. Go to `/admin/`
2. Navigate to **RBAC → Permissions**
3. Verify `core.can_toggle_scope` exists
4. Go to **RBAC → Roles**
5. Edit roles that need toggle access (Manager, CFO, etc.)
6. Add `core.can_toggle_scope` permission
7. Save

**Option B: Via Django Shell**
```bash
python manage.py shell
```

```python
from kernel.rbac.models import Permission, Role

# Verify permission exists
perm = Permission.objects.get(code='core.can_toggle_scope')
print(f"✅ Permission: {perm.name}")

# Assign to Manager role (example)
manager_role = Role.objects.filter(name='Manager').first()
if manager_role:
    manager_role.permissions.add(perm)
    print(f"✅ Added to {manager_role.name}")

# Assign to CFO role (example)
cfo_role = Role.objects.filter(name='CFO').first()
if cfo_role:
    cfo_role.permissions.add(perm)
    print(f"✅ Added to {cfo_role.name}")

exit()
```

#### **Setup Scope Passwords (Optional)**

Only needed if you want users to have separate official passwords:

```python
python manage.py shell
```

```python
from erp.models import User

# Set official password for a user
user = User.objects.get(username='john')
user.set_scope_pin('official', 'official_password_123')
user.save()
print(f"✅ Official password set for {user.username}")

exit()
```

#### **Configure Organization Default Scope (Optional)**

```python
python manage.py shell
```

```python
from erp.models import Organization

org = Organization.objects.get(slug='your-org-slug')
settings = org.settings.get('global_financial_settings', {})
settings['defaultScope'] = 'INTERNAL'  # or 'OFFICIAL'
org.settings['global_financial_settings'] = settings
org.save()
print(f"✅ Default scope set to {settings['defaultScope']}")

exit()
```

---

## 🧪 Testing

### **Test 1: Scope Toggle Visibility**

1. **Test with superuser**: Should see toggle
2. **Test with Manager (has permission)**: Should see toggle
3. **Test with Cashier (no permission)**: Should NOT see toggle
4. **Test with official password**: Should NOT see toggle, forced to OFFICIAL view

### **Test 2: Migration Business Selection**

1. Upload a SQL file from UltimatePOS
2. Wait for "Analyzing SQL file..." message
3. Should show list of businesses with counts
4. Select a business
5. Verify stats show real numbers (not NaN)

---

## 📊 Monitoring

### **Check Celery Tasks**

```bash
# Check if analysis tasks are running
celery -A erp inspect active

# Check for failed tasks
celery -A erp inspect failed
```

### **Check Logs**

```bash
# Backend logs
tail -f /var/log/tsfsystem/backend.log

# Celery logs
tail -f /var/log/tsfsystem/celery.log

# Frontend logs (if using PM2)
pm2 logs tsfsystem-frontend
```

---

## 🔄 Rollback (if needed)

### **Quick Rollback**

```bash
# 1. Checkout previous version
git checkout <previous-commit-hash>

# 2. Rebuild frontend
npm run build

# 3. Restart services
sudo systemctl restart tsfsystem-backend.service
sudo systemctl restart tsfsystem-frontend.service
```

### **Remove Scope Permission (if needed)**

```python
python manage.py shell
```

```python
from kernel.rbac.models import Permission

# Remove from all roles
perm = Permission.objects.get(code='core.can_toggle_scope')
perm.roles.clear()
print("✅ Permission removed from all roles")

# Optionally delete permission
# perm.delete()

exit()
```

---

## ✅ Verification

After deployment, verify:

- [ ] Frontend builds without errors
- [ ] Backend starts without errors
- [ ] Permission `core.can_toggle_scope` exists
- [ ] Scope toggle appears for authorized users
- [ ] Official password users see no toggle
- [ ] Migration wizard shows business selection
- [ ] Migration stats show real numbers (not NaN)

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: v3.1.x
**Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Completed

---

## 📞 Support

Issues? Check:
1. `IMPLEMENTATION_SUMMARY.md` - Complete overview
2. `SCOPE_TOGGLE_SETUP_GUIDE.md` - Detailed setup guide
3. `DOCUMENTATION/scope_access_control.md` - Technical docs
