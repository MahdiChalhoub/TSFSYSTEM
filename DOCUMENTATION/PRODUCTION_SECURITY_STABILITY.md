# Production Security and Stability Documentation

## Goal
Ensure the production environment is stable, secure, and resilient to resource exhaustion and downtime.

## Fixes Implemented

### 1. Database Connectivity (Port 5433)
**Goal**: Prevent "Connection Refused" errors caused by Django attempting to connect to the default PostgreSQL port (5432).
- **Change**: Hardcoded `PORT: 5433` and `HOST: 127.0.0.1` in `core/settings.py` as production defaults.
- **Rationale**: The production PostgreSQL cluster is configured on port 5433 to avoid conflicts. Environment variables are supported but fallback protects against service restarts failing to load `.env`.

### 2. Memory Stability (Swap File)
**Goal**: Prevent backend crashes (OOM) on low-memory VPS (4GB RAM).
- **Action**: Created a **2GB swap file** (`/swapfile`) on the Hetzner server.
- **Verification**: `free -m` now shows total virtual memory expanded significantly.

### 3. Session Security
**Goal**: Reduce the risk of long-lived hijacked sessions.
- **Configuration**:
    - `SESSION_COOKIE_AGE = 3600` (1 Hour)
    - `SESSION_EXPIRE_AT_BROWSER_CLOSE = True`
    - `SESSION_SAVE_EVERY_REQUEST = True`

### 4. Admin Panel Obfuscation (Secret Path)
**Goal**: Prevent automated brute-force attacks on `/admin/`.
- **New Path**: `/tsf-system-kernel-7788/` (Proxy configured in Nginx and allowed in Next.js Middleware).

## Infrastructure Details

### Server Context
- **OS**: Ubuntu 24.04 (Hetzner VPS)
- **Processes**: Managed via PM2 (`nextjs`, `django`)
- **Web Server**: Nginx (serving static/media and proxying API/Frontend)

## Data Movement
- **Environment**: Managed via `/root/TSFSYSTEM/erp_backend/.env`.
- **Logs**: Located in `/root/TSFSYSTEM/erp_backend/logs/` and `journalctl`.

## How it achieves stability
By combining persistent swap space, hardcoded production port defaults, and reduced session lifetimes, the platform minimizes the "crash surface" and ensures that intermittent service interruptions do not lead to permanent downtime.
