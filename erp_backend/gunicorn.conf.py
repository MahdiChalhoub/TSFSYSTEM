# ══════════════════════════════════════════════════════════════════════════════
# gunicorn.conf.py — Production Gunicorn Configuration for TSF Platform
#
# Enables zero-downtime deploys through:
#   1. Graceful worker restarts via SIGHUP
#   2. Pre-fork worker model for maximum concurrency
#   3. Automatic worker recycling to prevent memory leaks
#   4. Structured logging for deployment observability
# ══════════════════════════════════════════════════════════════════════════════

import multiprocessing

# ── Server Socket ─────────────────────────────────────────────────────────────
bind = "0.0.0.0:8000"
backlog = 2048

# ── Worker Configuration ──────────────────────────────────────────────────────
# Workers = (2 * CPU cores) + 1 is the recommended formula.
# We cap at 4 to balance memory usage on a small VPS.
workers = min(multiprocessing.cpu_count() * 2 + 1, 4)
worker_class = "gthread"
threads = 2

# ── Graceful Restart Settings ─────────────────────────────────────────────────
# graceful_timeout: Seconds to wait for workers to finish requests before
# forcefully killing them during a restart (SIGHUP).
graceful_timeout = 30

# timeout: Kill workers that are silent for this many seconds.
# Prevents hung workers from blocking the server.
timeout = 60

# max_requests: Automatically restart workers after N requests to prevent
# memory leaks from accumulating over time.
max_requests = 1000
max_requests_jitter = 50  # Stagger restarts to avoid thundering herd

# ── Pre-load Application ─────────────────────────────────────────────────────
# Load the Django app BEFORE forking workers.
# This means code changes require a SIGHUP to the master process.
# Benefits: Shared memory for app code, faster worker boot.
preload_app = True

# ── Logging ───────────────────────────────────────────────────────────────────
accesslog = "/var/log/tsf-backend-access.log"
errorlog = "/var/log/tsf-backend-error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# ── Process Naming ────────────────────────────────────────────────────────────
proc_name = "tsf-backend"

# ── Server Hooks for Observability ────────────────────────────────────────────
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("TSF Backend starting...")

def on_reload(server):
    """Called when a SIGHUP triggers a graceful restart."""
    server.log.info("♻️  Graceful reload triggered — spawning new workers...")

def post_worker_init(worker):
    """Called after a worker has been initialized."""
    worker.log.info(f"Worker {worker.pid} initialized")

def worker_exit(server, worker):
    """Called when a worker exits."""
    server.log.info(f"Worker {worker.pid} exiting (max_requests recycling)")
