#!/bin/bash
set -e
echo "Deploying backend fix..."
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/apps/inventory/views.py root@91.99.186.183:/root/TSFSYSTEM/erp_backend/apps/inventory/views.py
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker restart tsf_backend"

echo "Deploying frontend fix..."
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/\(privileged\)/sales/page.tsx root@91.99.186.183:/root/TSFSYSTEM/src/app/\(privileged\)/sales/page.tsx
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/types/pos-layout.ts root@91.99.186.183:/root/TSFSYSTEM/src/types/pos-layout.ts
scp -i ~/.ssh/id_deploy /root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/pos/layouts/POSLayout* root@91.99.186.183:/root/TSFSYSTEM/src/components/pos/layouts/
ssh -i ~/.ssh/id_deploy root@91.99.186.183 "docker exec tsf_frontend npm run build && docker restart tsf_frontend"
echo "Done!"
