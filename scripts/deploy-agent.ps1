# Deploy Agent
param($Force = "full")

$SERVER_IP = "91.99.186.183"
$SSH_KEY = "$env:USERPROFILE\.ssh\id_deploy"
$APP_PATH = "/root/TSFSYSTEM"

Write-Host ">>> Starting Deploy Agent (Force=$Force)" -ForegroundColor Magenta

function Execute-Remote($cmd) {
    Write-Host ">>> Remote: $cmd" -ForegroundColor Gray
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no "root@$SERVER_IP" $cmd
}

Write-Host ">>> Pulling Code..."
Execute-Remote "cd $APP_PATH ; git stash ; git pull origin main"

if ($Force -eq "frontend" -or $Force -eq "full") {
    Write-Host ">>> Deploying Frontend..."
    Execute-Remote "cd $APP_PATH ; npm install ; npm run build ; pm2 restart nextjs"
}

if ($Force -eq "backend" -or $Force -eq "full") {
    Write-Host ">>> Deploying Backend..."
    Execute-Remote "cd $APP_PATH/erp_backend ; source venv/bin/activate ; pip install -r requirements.txt ; python manage.py migrate --no-input ; python manage.py collectstatic --noinput ; pm2 restart django"
}

Write-Host ">>> DEPLOY SUCCESSFUL" -ForegroundColor Green
