#!/bin/bash
set -e

# Version Configuration (Update this on every deploy)
AGENT_VERSION="2.8.2-AG-$(date +'%y%m%d.%H%M')"
echo "🚀 Preparing deployment for version: $AGENT_VERSION"

# Update version in code before deploying
sed -i "s/version: \".*\"/version: \"$AGENT_VERSION\"/" src/lib/branding.ts

echo "📡 Syncing Backend Files..."
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/apps/inventory/views.py root@91.99.186.183:/root/TSFSYSTEM/erp_backend/apps/inventory/views.py

echo "📡 Syncing Frontend Core Files..."
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/\(privileged\)/sales/page.tsx root@91.99.186.183:/root/TSFSYSTEM/src/app/\(privileged\)/sales/page.tsx
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/\(privileged\)/sales/actions.ts root@91.99.186.183:/root/TSFSYSTEM/src/app/\(privileged\)/sales/actions.ts
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/commercial.ts root@91.99.186.183:/root/TSFSYSTEM/src/app/actions/commercial.ts
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/types/pos-layout.ts root@91.99.186.183:/root/TSFSYSTEM/src/types/pos-layout.ts
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/lib/branding.ts root@91.99.186.183:/root/TSFSYSTEM/src/lib/branding.ts

echo "📡 Syncing POS Components..."
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/ProductGrid.tsx root@91.99.186.183:/root/TSFSYSTEM/src/components/pos/ProductGrid.tsx
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutModern.tsx root@91.99.186.183:/root/TSFSYSTEM/src/components/pos/layouts/
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx root@91.99.186.183:/root/TSFSYSTEM/src/components/pos/layouts/
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx root@91.99.186.183:/root/TSFSYSTEM/src/components/pos/layouts/

echo "📡 Syncing Sidebar & UI..."
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/admin/Sidebar.tsx root@91.99.186.183:/root/TSFSYSTEM/src/components/admin/Sidebar.tsx
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/AGENT_RELEASE.md root@91.99.186.183:/root/TSFSYSTEM/AGENT_RELEASE.md

echo "🚀 Synchronizing Frontend Container Files..."
# We copy explicitly to ensure the build inside the container uses our latest changes
ssh -i ~/.ssh/id_deploy root@91.99.186.183 << 'EOF'
    docker cp /root/TSFSYSTEM/src/lib/branding.ts tsf_frontend:/app/src/lib/branding.ts
    docker cp /root/TSFSYSTEM/src/app/\(privileged\)/sales/page.tsx tsf_frontend:/app/src/app/\(privileged\)/sales/page.tsx
    docker cp /root/TSFSYSTEM/src/app/\(privileged\)/sales/actions.ts tsf_frontend:/app/src/app/\(privileged\)/sales/actions.ts
    docker cp /root/TSFSYSTEM/src/app/actions/commercial.ts tsf_frontend:/app/src/app/actions/commercial.ts
    docker cp /root/TSFSYSTEM/src/types/pos-layout.ts tsf_frontend:/app/src/types/pos-layout.ts
    docker cp /root/TSFSYSTEM/src/components/pos/ProductGrid.tsx tsf_frontend:/app/src/components/pos/ProductGrid.tsx
    docker cp /root/TSFSYSTEM/src/components/pos/layouts/POSLayoutModern.tsx tsf_frontend:/app/src/components/pos/layouts/POSLayoutModern.tsx
    docker cp /root/TSFSYSTEM/src/components/pos/layouts/POSLayoutClassic.tsx tsf_frontend:/app/src/components/pos/layouts/POSLayoutClassic.tsx
    docker cp /root/TSFSYSTEM/src/components/pos/layouts/POSLayoutCompact.tsx tsf_frontend:/app/src/components/pos/layouts/POSLayoutCompact.tsx
    docker cp /root/TSFSYSTEM/src/components/admin/Sidebar.tsx tsf_frontend:/app/src/components/admin/Sidebar.tsx
EOF

echo "🔄 Restarting Backend..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker restart tsf_backend"

echo "🏗️  Rebuilding Frontend (Production)..."
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker exec tsf_frontend npm run build && docker restart tsf_frontend"

echo "✅ Deployment Successful! Version: $AGENT_VERSION"
