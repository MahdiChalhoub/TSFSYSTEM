# Quick Deployment Script for Hostinger
# Run this to quickly deploy all emergency fixes

Write-Host "🚀 TSF CI - Emergency Fix Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if changes are saved
Write-Host "Step 1: Checking for uncommitted changes..." -ForegroundColor Yellow
git status

Write-Host ""
$confirm = Read-Host "Continue with deployment? (y/n)"
if ($confirm -ne "y") {
    Write-Host "Deployment cancelled." -ForegroundColor Red
    exit
}

# Step 2: Add all files
Write-Host ""
Write-Host "Step 2: Staging all changes..." -ForegroundColor Yellow
git add .

# Step 3: Commit
Write-Host ""
Write-Host "Step 3: Committing changes..." -ForegroundColor Yellow
git commit -m "EMERGENCY FIX: Resolve POS timeout - Add pagination, caching, indexes, and optimization for 1000+ products"

# Step 4: Push to GitHub
Write-Host ""
Write-Host "Step 4: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "✅ Code pushed to GitHub successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Log in to Hostinger hPanel" -ForegroundColor White
Write-Host "2. Go to Git section and click 'Pull'" -ForegroundColor White  
Write-Host "3. Run database migration:" -ForegroundColor White
Write-Host "   npx prisma db push" -ForegroundColor Gray
Write-Host "4. Restart Node.js application in hPanel" -ForegroundColor White
Write-Host "5. Test at https://tsf.ci/admin/sales" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
