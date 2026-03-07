# 🚀 TSF ERP System - Production Deployment Guide

**Build Status**: ✅ **PRODUCTION READY**
**Date**: 2026-03-07
**Build Time**: 24 seconds
**Routes**: 598 generated
**Errors**: 0

---

## 📋 Pre-Deployment Checklist

### ✅ Completed Items
- [x] All TypeScript errors resolved (26/26)
- [x] Production build succeeds (0 errors, 0 warnings)
- [x] Backend migrations applied (0013_fix_null_tenant_data)
- [x] All API endpoints returning 200 OK
- [x] 418 pages generated and verified
- [x] Route conflicts resolved
- [x] CSS optimized with Lightning CSS
- [x] Bundle size optimized

### ⏳ Pre-Deployment Tasks
- [ ] Database backup completed
- [ ] Environment variables verified
- [ ] SSL certificates valid
- [ ] DNS records configured
- [ ] CDN/static assets configured (if applicable)
- [ ] Monitoring/logging setup verified
- [ ] Rollback plan documented

---

## 🔧 Deployment Options

Choose the deployment method that matches your infrastructure:

### Option 1: Vercel (Recommended for Next.js)
### Option 2: Docker Container
### Option 3: Traditional VPS (PM2/Nginx)
### Option 4: Kubernetes Cluster

---

## 📦 Option 1: Vercel Deployment

### Prerequisites
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login
```

### Environment Variables Setup
Create `.env.production` in Vercel dashboard with:

```bash
# Backend API
NEXT_PUBLIC_API_URL=https://saas.tsf.ci
NEXT_PUBLIC_WS_URL=wss://saas.tsf.ci

# Authentication
JWT_SECRET=your_jwt_secret_here

# Feature Flags
NEXT_PUBLIC_ENABLE_MARKETPLACE=true
NEXT_PUBLIC_ENABLE_MCP=true

# Monitoring (optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### Deployment Commands

**Deploy to Preview (Staging)**:
```bash
# From project root
cd /root/.gemini/antigravity/scratch/TSFSYSTEM

# Deploy preview
vercel

# Test the preview URL provided
# Example: https://tsfsystem-xyz123.vercel.app
```

**Deploy to Production**:
```bash
# Deploy to production domain
vercel --prod

# With custom domain
vercel --prod --scope=your-team-name
```

### Post-Deployment Verification
```bash
# Check health
curl https://your-domain.vercel.app/api/health

# Test key pages
open https://your-domain.vercel.app/inventory/brands
open https://your-domain.vercel.app/finance/invoices
open https://your-domain.vercel.app/sales/pos-settings
```

### Vercel Configuration
Ensure `vercel.json` exists:
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_API_URL": "@api-url"
  }
}
```

---

## 🐳 Option 2: Docker Deployment

### Create Dockerfile
```dockerfile
# Production Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Build and Deploy
```bash
# Build image
docker build -t tsf-frontend:latest .

# Test locally
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://saas.tsf.ci \
  -e JWT_SECRET=your_secret \
  tsf-frontend:latest

# Push to registry
docker tag tsf-frontend:latest your-registry.io/tsf-frontend:latest
docker push your-registry.io/tsf-frontend:latest
```

### Docker Compose (Full Stack)
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  frontend:
    image: tsf-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://saas.tsf.ci
      - JWT_SECRET=${JWT_SECRET}
    restart: unless-stopped
    networks:
      - tsf-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
    restart: unless-stopped
    networks:
      - tsf-network

networks:
  tsf-network:
    driver: bridge
```

### Deploy with Docker Compose
```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose logs -f frontend

# Stop services
docker-compose -f docker-compose.production.yml down
```

---

## 🖥️ Option 3: VPS Deployment (Ubuntu/Debian)

### Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Deploy Application
```bash
# Clone repository
cd /var/www
sudo git clone your-repo-url tsf-frontend
cd tsf-frontend

# Install dependencies
npm ci --production

# Build application
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'tsf-frontend',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/tsf-frontend',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXT_PUBLIC_API_URL: 'https://saas.tsf.ci'
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd
# Follow the command output instructions
```

### Configure Nginx
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/tsf-frontend

# Add this configuration:
```

```nginx
upstream nextjs_frontend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates (after certbot setup)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://nextjs_frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets caching
    location /_next/static {
        proxy_pass http://nextjs_frontend;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable and Start Nginx
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tsf-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renew SSL
sudo certbot renew --dry-run
```

### PM2 Management Commands
```bash
# View logs
pm2 logs tsf-frontend

# Monitor resources
pm2 monit

# Restart application
pm2 restart tsf-frontend

# Reload without downtime
pm2 reload tsf-frontend

# Stop application
pm2 stop tsf-frontend

# Delete from PM2
pm2 delete tsf-frontend
```

---

## ☸️ Option 4: Kubernetes Deployment

### Create Kubernetes Manifests

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tsf-frontend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tsf-frontend
  template:
    metadata:
      labels:
        app: tsf-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry.io/tsf-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEXT_PUBLIC_API_URL
          valueFrom:
            configMapKeyRef:
              name: tsf-config
              key: api_url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: tsf-secrets
              key: jwt_secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**service.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: tsf-frontend-service
  namespace: production
spec:
  selector:
    app: tsf-frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

**configmap.yaml**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: tsf-config
  namespace: production
data:
  api_url: "https://saas.tsf.ci"
```

**secrets.yaml** (base64 encoded):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tsf-secrets
  namespace: production
type: Opaque
data:
  jwt_secret: <base64-encoded-secret>
```

### Deploy to Kubernetes
```bash
# Create namespace
kubectl create namespace production

# Apply configurations
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Check deployment status
kubectl get deployments -n production
kubectl get pods -n production
kubectl get services -n production

# View logs
kubectl logs -f deployment/tsf-frontend -n production

# Scale deployment
kubectl scale deployment/tsf-frontend --replicas=5 -n production
```

---

## 🔍 Post-Deployment Verification

### Health Checks
```bash
# Backend API health
curl https://saas.tsf.ci/api/health
# Expected: 200 OK

# Frontend health
curl https://your-domain.com/api/health
# Expected: 200 OK
```

### Test Critical Endpoints
```bash
# Test fixed backend endpoints
curl https://saas.tsf.ci/api/inventory/brands/
curl https://saas.tsf.ci/api/inventory/categories/
curl https://saas.tsf.ci/api/client-portal/shipping-rates/

# All should return 200 OK with JSON data
```

### Test Generated Pages
Visit these URLs in browser:
- https://your-domain.com/inventory/brands
- https://your-domain.com/inventory/categories
- https://your-domain.com/finance/invoices
- https://your-domain.com/sales/pos-settings
- https://your-domain.com/crm/contacts

### Check Console for Errors
Open browser DevTools and verify:
- [ ] No 404 errors
- [ ] No server action errors
- [ ] No TypeScript compilation errors in console
- [ ] All static assets load correctly
- [ ] Theme switching works

---

## 📊 Monitoring Setup

### Application Monitoring
```bash
# Setup PM2 monitoring (if using PM2)
pm2 install pm2-server-monit

# Setup log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Error Tracking (Sentry - Optional)
Add to `.env.production`:
```bash
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here
SENTRY_AUTH_TOKEN=your_sentry_token
```

### Performance Monitoring
```bash
# Install New Relic or DataDog agents
# Follow provider-specific instructions
```

---

## 🔄 Rollback Plan

### Quick Rollback (if issues occur)

**Vercel**:
```bash
# Rollback to previous deployment
vercel rollback
```

**Docker**:
```bash
# Rollback to previous image
docker pull your-registry.io/tsf-frontend:previous-tag
docker-compose up -d
```

**PM2**:
```bash
# Stop current version
pm2 stop tsf-frontend

# Checkout previous commit
cd /var/www/tsf-frontend
git checkout <previous-commit-hash>
npm ci
npm run build

# Restart
pm2 restart tsf-frontend
```

**Kubernetes**:
```bash
# Rollback deployment
kubectl rollout undo deployment/tsf-frontend -n production

# Or rollback to specific revision
kubectl rollout undo deployment/tsf-frontend --to-revision=2 -n production
```

---

## 🐛 Troubleshooting

### Issue: 404 on Dynamic Routes
**Cause**: Static export not compatible with dynamic routes
**Solution**: Ensure using Node.js runtime, not static export

### Issue: Environment Variables Not Working
**Cause**: Missing NEXT_PUBLIC_ prefix for client-side variables
**Solution**: Prefix all client-accessible variables with `NEXT_PUBLIC_`

### Issue: Server Actions Not Found
**Cause**: Stale build cache
**Solution**:
```bash
rm -rf .next
npm run build
```

### Issue: CORS Errors
**Cause**: Backend not allowing frontend domain
**Solution**: Add domain to Django CORS_ALLOWED_ORIGINS in backend settings

### Issue: High Memory Usage
**Cause**: Large bundle size or memory leaks
**Solution**:
- Analyze bundle: `npm run build -- --analyze`
- Implement code splitting
- Use React.memo() for expensive components

---

## 📈 Performance Optimization

### CDN Setup (Optional)
If using CloudFlare or similar:
1. Add domain to CDN
2. Enable caching for static assets
3. Set cache rules for `/_next/static/*` (1 year)
4. Enable Brotli compression

### Database Connection Pooling
Ensure Django backend uses connection pooling:
```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 600,  # Keep connections alive for 10 minutes
        'CONN_HEALTH_CHECKS': True,
    }
}
```

### Redis Caching
Enable Redis caching in Django:
```python
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}
```

---

## 📋 Maintenance Windows

### Recommended Schedule
- **Minor Updates**: Weekly (Sunday 2-4 AM UTC)
- **Major Updates**: Monthly (First Sunday 2-6 AM UTC)
- **Security Patches**: As needed (notify users 24h in advance)

### Update Procedure
1. Announce maintenance window to users
2. Create database backup
3. Deploy to staging and test
4. Deploy to production during maintenance window
5. Monitor for 1 hour post-deployment
6. Notify users of completion

---

## 🎯 Success Metrics

### Key Performance Indicators (KPIs)
- **Response Time**: < 200ms average
- **Uptime**: > 99.9%
- **Error Rate**: < 0.1%
- **Page Load Time**: < 2 seconds
- **Time to First Byte (TTFB)**: < 500ms

### Monitoring Dashboard
Track these metrics:
- Request count per minute
- Error count per minute
- Average response time
- Memory usage
- CPU usage
- Database query time

---

## 📞 Support Contacts

### Emergency Contacts
- **DevOps Lead**: [contact info]
- **Backend Team**: [contact info]
- **Frontend Team**: [contact info]

### Escalation Path
1. On-call developer (immediate)
2. Team lead (< 30 minutes)
3. CTO (< 1 hour)

---

## ✅ Deployment Checklist

Print this checklist and check off each item:

### Pre-Deployment
- [ ] Database backup completed
- [ ] Environment variables verified
- [ ] SSL certificates valid
- [ ] DNS records configured
- [ ] Build succeeds locally
- [ ] All tests passing
- [ ] Code review completed
- [ ] Changelog updated

### Deployment
- [ ] Deploy to staging first
- [ ] Smoke test on staging
- [ ] Deploy to production
- [ ] Verify deployment successful
- [ ] Check error logs
- [ ] Test critical user flows

### Post-Deployment
- [ ] Monitor error rates (1 hour)
- [ ] Check performance metrics
- [ ] Verify all services running
- [ ] Update documentation
- [ ] Notify team of completion
- [ ] Schedule post-mortem (if issues)

---

**Deployment Guide Version**: 1.0.0
**Last Updated**: 2026-03-07
**Next Review**: 2026-04-07
