# 🚀 Quick Start - Inventory Intelligence System

**5-Minute Setup Guide**

---

## ⚡ Prerequisites Check

```bash
# Check Python
python3 --version  # Need 3.10+

# Check Node.js
node --version  # Need 16+

# Check PostgreSQL
psql --version  # Need 12+
```

---

## 🔧 Step 1: Backend Setup (2 minutes)

```bash
# Navigate to backend
cd /root/current/erp_backend

# Activate virtual environment
source venv/bin/activate  # or: source .venv/bin/activate

# Apply migration (if not done)
python manage.py migrate erp

# Create test data
python create_test_data.py

# Copy the auth token from output - you'll need it!
# Look for: "Use this token for API testing: Token abc123..."

# Start backend server
python manage.py runserver 0.0.0.0:8000
```

**Verify**: Open http://localhost:8000/api/inventory/intelligence/classify-abc/

---

## 🎨 Step 2: Frontend Setup (1 minute)

**Open a NEW terminal:**

```bash
# Navigate to frontend
cd /root/current

# Install dependencies (if first time)
npm install

# Start frontend dev server
npm run dev
```

**Verify**: Open http://localhost:3000

---

## 🧪 Step 3: Test the System (2 minutes)

### Option A: Frontend UI (Recommended)

1. **Navigate to Intelligence Dashboard**:
   ```
   http://localhost:3000/inventory/intelligence
   ```

2. **Test Transfer Analysis** (The crown jewel!):
   - Click **"Transfer"** tab
   - Fill in form:
     - Product ID: `1` (from test data)
     - From Warehouse: `1`
     - To Warehouse: `2`
     - Quantity: `50`
     - Reason: `Testing the system`
   - Click **"Analyze Transfer"**

3. **See the Magic**:
   - ✅ **6-component direct cost** breakdown
   - ✅ **3-component opportunity cost** (PURPLE HIGHLIGHTED!)
   - ✅ Approval recommendation (Green/Red/Yellow)
   - ✅ Transfer quality score (0-100)
   - ✅ Executive summary

### Option B: API Testing

```bash
# Replace TOKEN with the token from create_test_data.py output
export TOKEN="your-token-here"

# Test transfer analysis
curl -X POST http://localhost:8000/api/inventory/intelligence/analyze-transfer/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "from_warehouse_id": 1,
    "to_warehouse_id": 2,
    "quantity": 50,
    "reason": "Testing"
  }'
```

**Expected**: JSON response with complete cost analysis!

---

## 🎯 What to Test

### 1. Demand Forecast
- Tab: **Forecast**
- Product ID: `1`
- Days: `30`
- See: Daily predictions with confidence scores

### 2. Transfer Analysis ⭐
- Tab: **Transfer**
- See: **6+3 cost breakdown** with purple opportunity costs!

### 3. Allocation Optimizer
- Tab: **Allocation**
- Strategy: `Smart`
- See: Multi-warehouse allocation

### 4. ABC Classification
- Tab: **ABC**
- Click: `Run ABC Analysis`
- See: Product classifications (A/B/C)

### 5. Stockout Risk
- Tab: **Stockout**
- Product ID: `1`
- See: Risk probability and days until stockout

### 6. Reorder Optimizer
- Tab: **Reorder**
- Product ID: `1`
- See: Optimal reorder point with safety stock

---

## 📊 Quick Reference

### URLs
- **Frontend**: http://localhost:3000/inventory/intelligence
- **Backend API**: http://localhost:8000/api/inventory/intelligence/
- **Django Admin**: http://localhost:8000/admin/
- **API Schema**: http://localhost:8000/api/schema/

### Test Data IDs
Check the output from `create_test_data.py` for:
- Product IDs (usually 1-5)
- Warehouse IDs (usually 1-3)
- Auth Token

### Default Credentials
If you created a superuser:
- Username: `testuser`
- Password: `testpass123`

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check port 8000 is free
lsof -i :8000
# If busy: kill -9 <PID>

# Check database connection
python manage.py dbshell
# Type \q to exit
```

### Frontend won't start
```bash
# Check port 3000 is free
lsof -i :3000
# If busy: kill -9 <PID>

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Unauthorized 401"
```bash
# Get new token
cd /root/current/erp_backend
python create_test_data.py | grep "Token"
```

### "Product/Warehouse not found"
```bash
# Recreate test data
cd /root/current/erp_backend
python create_test_data.py
```

### Frontend shows "Network Error"
```bash
# Check .env.local
cat /root/current/.env.local
# Should have: NEXT_PUBLIC_API_URL=http://localhost:8000

# Check backend is running
curl http://localhost:8000/api/inventory/intelligence/classify-abc/
```

---

## 📚 Next Steps

### For Development
1. **Read API Docs**: `.ai/INVENTORY_API_COMPLETE.md`
2. **Read Frontend Guide**: `.ai/FRONTEND_INTELLIGENCE_COMPLETE.md`
3. **Run E2E Tests**: `.ai/END_TO_END_TESTING_GUIDE.md`

### For Deployment
1. **Read Deployment Guide**: `.ai/FINAL_DEPLOYMENT_REPORT.md`
2. **Configure Production**: Update `.env.production`
3. **Run Tests**: Follow E2E testing guide
4. **Deploy to Staging**: Test with real data
5. **Deploy to Production**: Go live!

### For Customization
1. **Decision Rules**: `.ai/DECISION_RULES_EXAMPLES.md`
2. **Configuration**: Modify `module.json`
3. **Add Features**: Extend components

---

## ✅ Success Criteria

You'll know it's working when:
- ✅ Dashboard loads at http://localhost:3000/inventory/intelligence
- ✅ All 7 tabs are clickable
- ✅ Transfer analysis shows **6+3 cost breakdown**
- ✅ Opportunity costs are **highlighted in PURPLE**
- ✅ Approval recommendation shows (Green/Red/Yellow)
- ✅ No console errors in browser DevTools

---

## 🎉 You're Ready!

The system is now running and ready for testing.

**Time to complete**: ~5 minutes
**What you have**: Enterprise-grade inventory intelligence
**Competitive advantage**: Industry-first opportunity cost analysis

**Enjoy your 11/10 ERP system!** 🚀

---

## 📞 Need Help?

- **Quick Issues**: Check "Troubleshooting" section above
- **API Questions**: See `.ai/INVENTORY_API_COMPLETE.md`
- **Frontend Questions**: See `.ai/FRONTEND_INTELLIGENCE_COMPLETE.md`
- **Architecture**: See `ANTIGRAVITY_CONSTRAINTS.md`
- **Everything Else**: See `.ai/MASTER_COMPLETION_SUMMARY.md`

**Happy coding!** 🎊
