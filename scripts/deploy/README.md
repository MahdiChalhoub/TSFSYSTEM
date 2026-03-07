# TSF ERP System - Deployment Scripts

Automated deployment scripts for various hosting platforms.

## 📦 Available Scripts

### 1. Vercel Deployment (`deploy-vercel.sh`)

Deploy to Vercel platform (recommended for Next.js apps).

**Usage**:
```bash
# Deploy preview (staging)
./scripts/deploy/deploy-vercel.sh

# Deploy to production
./scripts/deploy/deploy-vercel.sh production
```

**Requirements**:
- Vercel CLI installed: `npm i -g vercel`
- Logged in to Vercel: `vercel login`
- Environment variables set in Vercel dashboard

**Environment Variables**:
```bash
export VERCEL_ORG="your-org-name"
export VERCEL_PROJECT="tsf-erp"
```

---

### 2. Docker Deployment (`deploy-docker.sh`)

Deploy using Docker containers and Docker Compose.

**Usage**:
```bash
# Deploy to staging
./scripts/deploy/deploy-docker.sh staging

# Deploy to production
./scripts/deploy/deploy-docker.sh production

# Deploy with specific tag
./scripts/deploy/deploy-docker.sh production v3.1.4
```

**Requirements**:
- Docker installed and running
- Docker Compose installed
- `.env.staging` or `.env.production` file exists

**Environment Variables** (optional):
```bash
export DOCKER_REGISTRY="registry.example.com"
```

**Files Needed**:
- `Dockerfile` (already exists in project root)
- `docker-compose.production.yml` (create if needed)
- `.env.production` (environment variables)

---

### 3. VPS Deployment (`deploy-vps.sh`)

Deploy to traditional VPS using PM2 and Nginx.

**Usage**:
```bash
# Deploy to production
./scripts/deploy/deploy-vps.sh production

# Deploy specific branch
./scripts/deploy/deploy-vps.sh production develop
```

**Requirements**:
- SSH access to VPS
- SSH keys set up (passwordless login)
- PM2 installed on server
- Nginx installed and configured on server

**Environment Variables**:
```bash
export DEPLOY_SERVER="user@your-server.com"
export DEPLOY_PATH="/var/www/tsf-frontend"
export DEPLOY_USER="deploy"
```

**Server Requirements**:
- Node.js 20+
- PM2: `npm i -g pm2`
- Nginx
- Git

---

### 4. Rollback Script (`rollback.sh`)

Emergency rollback for all deployment types.

**Usage**:
```bash
# Rollback Vercel to previous deployment
./scripts/deploy/rollback.sh vercel

# Rollback Docker to previous image
./scripts/deploy/rollback.sh docker

# Rollback VPS to previous backup
./scripts/deploy/rollback.sh vps

# Rollback to specific version
./scripts/deploy/rollback.sh docker v3.1.3
./scripts/deploy/rollback.sh vps backup-20260307_120000
```

**Safety**:
- Requires typing "ROLLBACK" to confirm
- Creates backups before rollback
- Verifies health after rollback

---

## 🚀 Deployment Workflow

### Standard Deployment Process

1. **Pre-deployment**:
   ```bash
   # Run tests locally
   npm run test
   npm run typecheck

   # Commit and push changes
   git add .
   git commit -m "feat: new feature"
   git push origin main
   ```

2. **Deploy to Staging**:
   ```bash
   # Vercel
   ./scripts/deploy/deploy-vercel.sh

   # Docker
   ./scripts/deploy/deploy-docker.sh staging

   # VPS (if you have separate staging server)
   export DEPLOY_SERVER="deploy@staging.tsf.ci"
   ./scripts/deploy/deploy-vps.sh staging
   ```

3. **Test on Staging**:
   - Run through [STAGING_VERIFICATION_CHECKLIST.md](../../STAGING_VERIFICATION_CHECKLIST.md)
   - Verify critical user flows
   - Check for errors in console and logs

4. **Deploy to Production**:
   ```bash
   # Vercel
   ./scripts/deploy/deploy-vercel.sh production

   # Docker
   ./scripts/deploy/deploy-docker.sh production

   # VPS
   export DEPLOY_SERVER="deploy@tsf.ci"
   ./scripts/deploy/deploy-vps.sh production
   ```

5. **Post-deployment**:
   - Monitor error logs (Sentry, server logs)
   - Check performance metrics
   - Verify health endpoints
   - Test critical functionality

6. **If Issues Occur**:
   ```bash
   # Immediate rollback
   ./scripts/deploy/rollback.sh [vercel|docker|vps]
   ```

---

## 📋 Pre-Deployment Checklist

Before running any deployment script, ensure:

- [ ] All tests pass: `npm run test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Build succeeds: `npm run build`
- [ ] Environment variables are set correctly
- [ ] Database migrations are applied (backend)
- [ ] Git changes are committed
- [ ] Changelog is updated
- [ ] Team is notified of deployment

---

## 🔐 Environment Variables

### Required for All Deployments

```bash
# Backend API
NEXT_PUBLIC_API_URL=https://saas.tsf.ci

# Optional
NEXT_PUBLIC_WS_URL=wss://saas.tsf.ci
NEXT_PUBLIC_APP_VERSION=v3.1.4
NODE_ENV=production
```

### Error Tracking (Recommended)

```bash
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your_auth_token
```

### Analytics (Optional)

```bash
# Google Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## 🐛 Troubleshooting

### Deployment Fails with "Build Error"

**Issue**: TypeScript or build errors
**Solution**:
```bash
# Check TypeScript errors
npm run typecheck

# Check build locally
npm run build

# View detailed errors
npm run build 2>&1 | tee build-error.log
```

### Deployment Succeeds but Site is Down

**Issue**: Application not starting
**Solution**:
```bash
# Check logs (Docker)
docker-compose -f docker-compose.production.yml logs frontend

# Check logs (VPS)
ssh user@server 'pm2 logs tsf-frontend'

# Check logs (Vercel)
vercel logs
```

### Environment Variables Not Working

**Issue**: Variables not accessible in app
**Solution**:
- Ensure variables start with `NEXT_PUBLIC_` for client-side access
- Restart application after changing env vars
- For Vercel: Set in dashboard and redeploy
- For Docker: Update `.env` file and restart containers
- For VPS: Update `.env` file and `pm2 restart`

### Rollback Not Working

**Issue**: Rollback script fails
**Solution**:
```bash
# Manual rollback (Docker)
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d

# Manual rollback (VPS)
ssh user@server
cd /var/www/tsf-frontend
git checkout <previous-commit>
npm ci
npm run build
pm2 restart tsf-frontend

# Manual rollback (Vercel)
vercel rollback
```

---

## 📊 Monitoring Post-Deployment

After deployment, monitor these metrics:

### Application Health
- [ ] Health endpoint returns 200: `/api/health`
- [ ] Homepage loads correctly
- [ ] Login functionality works
- [ ] Key pages load (inventory, finance, sales)

### Error Monitoring
- [ ] Check Sentry dashboard for new errors
- [ ] Review server logs for warnings
- [ ] Monitor API error rate

### Performance
- [ ] Response times < 2 seconds
- [ ] No memory leaks
- [ ] CPU usage normal
- [ ] Database connections stable

### Business Metrics
- [ ] Users can complete critical workflows
- [ ] Orders are processing correctly
- [ ] Payment processing works
- [ ] Reports generate correctly

---

## 🔄 Continuous Deployment (CI/CD)

For automated deployments, integrate these scripts into your CI/CD pipeline:

### GitHub Actions Example

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: TypeScript check
        run: npm run typecheck

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        run: |
          npm i -g vercel
          vercel --prod --token=$VERCEL_TOKEN
```

---

## 📞 Support

For deployment issues:
1. Check this README first
2. Review [DEPLOYMENT_INSTRUCTIONS.md](../../DEPLOYMENT_INSTRUCTIONS.md)
3. Check logs on the deployment platform
4. Contact DevOps team

---

## 📝 Changelog

### Version 1.0.0 (2026-03-07)
- Initial deployment scripts
- Support for Vercel, Docker, and VPS deployments
- Emergency rollback functionality
- Comprehensive error handling and verification

---

**Script Version**: 1.0.0
**Last Updated**: 2026-03-07
**Maintained By**: DevOps Team
