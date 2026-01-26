# Optimized Deployment Script for Shared Hosting
# This builds locally and deploys the pre-built app to avoid resource limits

Write-Host "🚀 Shared Hosting Deployment - Build Locally" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean previous build
Write-Host "Step 1: Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next
    Write-Host "✓ Removed old .next folder" -ForegroundColor Green
}

# Step 2: Build locally
Write-Host ""
Write-Host "Step 2: Building production bundle locally..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build completed successfully!" -ForegroundColor Green

# Step 3: Add everything including .next
Write-Host ""
Write-Host "Step 3: Staging all files (including .next)..." -ForegroundColor Yellow
git add .

# Step 4: Commit
Write-Host ""
Write-Host "Step 4: Committing..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Production build - $timestamp - Pre-built for shared hosting"

# Step 5: Push
Write-Host ""
Write-Host "Step 5: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "✅ Code and build pushed to GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next Steps on Hostinger:" -ForegroundColor Cyan
Write-Host "1. SSH into your server" -ForegroundColor White
Write-Host "2. Run: pkill -9 node  (Kill all processes)" -ForegroundColor White
Write-Host "3. Run: cd ~/public_html && git pull" -ForegroundColor White
Write-Host "4. Run: npm install --production" -ForegroundColor White
Write-Host "5. Run: npx prisma generate" -ForegroundColor White
Write-Host "6. Run: npx prisma db push" -ForegroundColor White
Write-Host "7. Run: npm start" -ForegroundColor White
Write-Host ""
Write-Host "💡 TIP: No need to build on server - it's pre-built!" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
