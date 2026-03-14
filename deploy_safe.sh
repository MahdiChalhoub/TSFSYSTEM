#!/bin/bash
# ╔════════════════════════════════════════════════════════════════════╗
# ║  TSFSYSTEM Safe Deploy — Coordinated Multi-Agent Deployment       ║
# ║                                                                    ║
# ║  PURPOSE: Prevents multiple agents from deploying simultaneously   ║
# ║  REPLACES: deploy_hotfix.sh (which is now deprecated)              ║
# ║                                                                    ║
# ║  FEATURES:                                                        ║
# ║  • Atomic server-side lock (mkdir-based, race-proof)               ║
# ║  • Queue system for concurrent agents                             ║
# ║  • Auto-batching: after deploy, drains queue with ONE cycle       ║
# ║  • Rsync --update: newer file always wins (no overwrites)         ║
# ║  • Memory protection: stops celery/mcp before build               ║
# ║  • 3-min cooldown between deploys                                  ║
# ║  • 30-min stale lock auto-cleanup                                  ║
# ║                                                                    ║
# ║  USAGE: ./deploy_safe.sh                                          ║
# ╚════════════════════════════════════════════════════════════════════╝

set -e

# ─────────────────────────────────────────────────────────
# CONFIGURATION (change these if needed)
# ─────────────────────────────────────────────────────────
REMOTE_HOST="root@91.99.186.183"
SSH_KEY="~/.ssh/id_deploy"
SSH_OPTS="-o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=3"
SSH="ssh -i $SSH_KEY $SSH_OPTS $REMOTE_HOST"
REMOTE_DIR="/root/TSFSYSTEM"
LOCAL_DIR="/root/.gemini/antigravity/scratch/TSFSYSTEM"

# Deploy coordinator paths (server-side)
DEPLOY_DIR="/root/.deploy"
LOCK_DIR="$DEPLOY_DIR/lock"
QUEUE_FILE="$DEPLOY_DIR/queue.txt"
COOLDOWN_FILE="$DEPLOY_DIR/cooldown.ts"
CURRENT_FILE="$DEPLOY_DIR/current.info"
HISTORY_FILE="$DEPLOY_DIR/history.log"

# Tuning
STALE_LOCK_SECONDS=1800    # 30 minutes — auto-clean stale locks
COOLDOWN_SECONDS=180        # 3 minutes — between deploys
MAX_QUEUE_WAIT=600          # 10 minutes — max time to wait in queue before giving up

# Agent identity
AGENT_ID="agent-$$-$(hostname -s 2>/dev/null || echo 'unknown')-$(date +%H%M%S)"
AGENT_VERSION="3.5.0-AG-$(date +'%y%m%d.%H%M')"

# Local lock (prevents same-machine double-runs)
LOCAL_LOCK="/tmp/tsf_deploy_safe.lock"

# ─────────────────────────────────────────────────────────
# COLORS & OUTPUT
# ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}ℹ️  ${NC}$1"; }
log_ok()    { echo -e "${GREEN}✅ ${NC}$1"; }
log_warn()  { echo -e "${YELLOW}⚠️  ${NC}$1"; }
log_error() { echo -e "${RED}❌ ${NC}$1"; }
log_step()  { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${NC}\n"; }
log_queue() { echo -e "${YELLOW}⏳ ${NC}$1"; }

# ─────────────────────────────────────────────────────────
# CLEANUP HANDLER
# ─────────────────────────────────────────────────────────
cleanup() {
    local exit_code=$?
    rm -f "$LOCAL_LOCK"

    # Only release server lock if WE are the deployer (not if we're queued)
    if [ "$I_AM_DEPLOYER" = "true" ]; then
        $SSH "rm -rf $LOCK_DIR 2>/dev/null; rm -f $CURRENT_FILE 2>/dev/null" 2>/dev/null || true
        log_info "Server lock released."
    fi

    if [ $exit_code -ne 0 ] && [ $exit_code -ne 2 ]; then
        log_error "Deploy failed with exit code $exit_code"
    fi
}
trap cleanup EXIT INT TERM

# ─────────────────────────────────────────────────────────
# LOCAL LOCK (same-machine protection)
# ─────────────────────────────────────────────────────────
if [ -f "$LOCAL_LOCK" ]; then
    LOCK_PID=$(cat "$LOCAL_LOCK" 2>/dev/null || echo "0")
    if kill -0 "$LOCK_PID" 2>/dev/null; then
        log_error "Another local deploy is running (PID: $LOCK_PID)."
        echo "   To force: rm $LOCAL_LOCK"
        exit 1
    else
        log_warn "Stale local lock found (PID $LOCK_PID dead). Cleaning up..."
        rm -f "$LOCAL_LOCK"
    fi
fi
echo $$ > "$LOCAL_LOCK"

I_AM_DEPLOYER="false"

# ─────────────────────────────────────────────────────────
# BANNER
# ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  🚀 TSFSYSTEM Safe Deploy — v2.0                         ║${NC}"
echo -e "${BOLD}║  Agent: ${AGENT_ID}${NC}"
echo -e "${BOLD}║  Version: ${AGENT_VERSION}${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────
# STEP 0: Ensure server deploy infrastructure exists
# ─────────────────────────────────────────────────────────
log_step "Step 0: Initializing Deploy Infrastructure"

$SSH "mkdir -p $DEPLOY_DIR && touch $QUEUE_FILE $HISTORY_FILE" 2>/dev/null || {
    log_error "Cannot connect to server. Check SSH key and connectivity."
    exit 1
}
log_ok "Deploy infrastructure ready on server."

# ─────────────────────────────────────────────────────────
# STEP 1: Rsync — Pull remote changes (newer wins)
# ─────────────────────────────────────────────────────────
log_step "Step 1: Pulling Remote Changes (newer wins)"

RSYNC_EXCLUDES=(
    --exclude 'node_modules'
    --exclude '.next'
    --exclude '.git'
    --exclude 'venv'
    --exclude '.venv'
    --exclude '**/venv'
    --exclude '**/.venv'
    --exclude '**/__pycache__'
    --exclude '.env'
    --exclude 'db_data'
    --exclude 'postgres_data'
    --exclude 'deploy_hotfix.sh'
    --exclude 'deploy_safe.sh'
    --exclude 'erp_backend/releases/'
    --exclude 'releases/'
    --exclude 'tmp/'
    --exclude '.antigravity-server/'
)

rsync -avz --update -e "ssh -i $SSH_KEY $SSH_OPTS" \
    "${RSYNC_EXCLUDES[@]}" \
    --exclude 'src/components/app-sidebar.tsx' \
    --exclude 'src/components/admin/Sidebar.tsx' \
    --exclude 'src/lib/branding.ts' \
    $REMOTE_HOST:$REMOTE_DIR/ $LOCAL_DIR/ 2>&1 | tail -5

log_ok "Remote changes pulled (newer files preserved)."

# ─────────────────────────────────────────────────────────
# STEP 2: Stamp version in branding
# ─────────────────────────────────────────────────────────
log_step "Step 2: Stamping Version"

BRANDING_FILE="$LOCAL_DIR/src/lib/branding.ts"
if [ -f "$BRANDING_FILE" ]; then
    sed -i "s/version: \".*\"/version: \"$AGENT_VERSION\"/" "$BRANDING_FILE"
    log_ok "Version stamped: $AGENT_VERSION"
else
    log_warn "branding.ts not found — skipping version stamp."
fi

# ─────────────────────────────────────────────────────────
# STEP 3: Rsync — Push local changes to server (newer wins)
# ─────────────────────────────────────────────────────────
log_step "Step 3: Pushing Local Changes to Server (newer wins)"

rsync -avz --update -e "ssh -i $SSH_KEY $SSH_OPTS" \
    "${RSYNC_EXCLUDES[@]}" \
    $LOCAL_DIR/ $REMOTE_HOST:$REMOTE_DIR/ 2>&1 | tail -5

log_ok "Local changes synced to server (newer files preserved)."

# ─────────────────────────────────────────────────────────
# STEP 4: Try to acquire server-side deploy lock
# ─────────────────────────────────────────────────────────
log_step "Step 4: Acquiring Deploy Lock"

LOCK_RESULT=$($SSH "
    # Ensure deploy dir exists
    mkdir -p $DEPLOY_DIR

    # Try atomic lock acquisition
    if mkdir $LOCK_DIR 2>/dev/null; then
        # SUCCESS — we got the lock
        echo '$AGENT_ID|$(date +%s)|$$' > $CURRENT_FILE
        echo 'ACQUIRED'
    else
        # FAILED — lock exists, check if stale
        if [ -d $LOCK_DIR ]; then
            LOCK_AGE=\$(( \$(date +%s) - \$(stat -c %Y $LOCK_DIR 2>/dev/null || echo 0) ))
            CURRENT_DEPLOYER=\$(cat $CURRENT_FILE 2>/dev/null || echo 'unknown')

            if [ \$LOCK_AGE -gt $STALE_LOCK_SECONDS ]; then
                # Stale lock — force-clean and re-acquire
                rm -rf $LOCK_DIR
                mkdir $LOCK_DIR 2>/dev/null
                echo '$AGENT_ID|\$(date +%s)|$$' > $CURRENT_FILE
                echo 'ACQUIRED_STALE'
            else
                # Active lock — report who and how long
                echo \"LOCKED|\$CURRENT_DEPLOYER|\$LOCK_AGE\"
            fi
        else
            # Lock dir doesn't exist (race condition?) — try again
            if mkdir $LOCK_DIR 2>/dev/null; then
                echo '$AGENT_ID|\$(date +%s)|$$' > $CURRENT_FILE
                echo 'ACQUIRED'
            else
                echo 'LOCKED|unknown|0'
            fi
        fi
    fi
" 2>/dev/null || echo "SSH_FAIL")

# ─────────────────────────────────────────────────────────
# STEP 5: Handle lock result
# ─────────────────────────────────────────────────────────

if echo "$LOCK_RESULT" | grep -q "^ACQUIRED"; then
    # ═══════════════════════════════════════════════════
    # WE GOT THE LOCK — DEPLOY NOW
    # ═══════════════════════════════════════════════════
    I_AM_DEPLOYER="true"

    if echo "$LOCK_RESULT" | grep -q "STALE"; then
        log_warn "Previous lock was stale (>30min). Force-cleaned and acquired."
    else
        log_ok "Deploy lock acquired! We are the deployer."
    fi

    # ── Check cooldown ──
    log_info "Checking cooldown..."
    COOLDOWN_RESULT=$($SSH "
        if [ -f $COOLDOWN_FILE ]; then
            LAST_DEPLOY=\$(cat $COOLDOWN_FILE)
            ELAPSED=\$(( \$(date +%s) - \$LAST_DEPLOY ))
            if [ \$ELAPSED -lt $COOLDOWN_SECONDS ]; then
                WAIT=\$(( $COOLDOWN_SECONDS - \$ELAPSED ))
                echo \"WAIT|\$WAIT\"
            else
                echo 'CLEAR'
            fi
        else
            echo 'CLEAR'
        fi
    " 2>/dev/null || echo "CLEAR")

    if echo "$COOLDOWN_RESULT" | grep -q "^WAIT"; then
        WAIT_TIME=$(echo "$COOLDOWN_RESULT" | cut -d'|' -f2)
        log_queue "Cooldown active. Waiting ${WAIT_TIME}s before deploying..."
        sleep "$WAIT_TIME"
    else
        log_ok "No cooldown — proceeding immediately."
    fi

    # ── Run the deploy pipeline ──
    log_step "Step 6: Running Deploy Pipeline"

    # Upload the server-side deploy script
    log_info "Uploading deploy worker to server..."
    rsync -avz -e "ssh -i $SSH_KEY $SSH_OPTS" \
        "$LOCAL_DIR/scripts/deploy/deploy_server.sh" \
        "$REMOTE_HOST:$REMOTE_DIR/scripts/deploy/deploy_server.sh" 2>/dev/null

    # Execute server-side deploy
    $SSH "chmod +x $REMOTE_DIR/scripts/deploy/deploy_server.sh && \
          bash $REMOTE_DIR/scripts/deploy/deploy_server.sh \
          '$AGENT_VERSION' '$AGENT_ID' '$DEPLOY_DIR' '$REMOTE_DIR'"

    DEPLOY_EXIT=$?

    if [ $DEPLOY_EXIT -eq 0 ]; then
        # ── Write cooldown timestamp ──
        $SSH "date +%s > $COOLDOWN_FILE" 2>/dev/null || true

        # ── Log to history ──
        $SSH "echo '$(date -u +%Y-%m-%dT%H:%M:%SZ) | $AGENT_VERSION | $AGENT_ID | SUCCESS' >> $HISTORY_FILE" 2>/dev/null || true

        # ── Check queue and drain if needed ──
        log_step "Step 7: Checking Deploy Queue"

        QUEUE_RESULT=$($SSH "
            if [ -s $QUEUE_FILE ]; then
                QUEUE_COUNT=\$(wc -l < $QUEUE_FILE)
                echo \"DRAIN|\$QUEUE_COUNT\"
                # Clear the queue
                > $QUEUE_FILE
            else
                echo 'EMPTY'
            fi
        " 2>/dev/null || echo "EMPTY")

        if echo "$QUEUE_RESULT" | grep -q "^DRAIN"; then
            QUEUE_COUNT=$(echo "$QUEUE_RESULT" | cut -d'|' -f2)
            log_info "Queue has ${QUEUE_COUNT} waiting agent(s). Running batched deploy..."
            echo ""
            log_step "Step 7b: Batched Deploy (for $QUEUE_COUNT queued agents)"

            # Run the pipeline AGAIN — files were already synced by queued agents
            $SSH "bash $REMOTE_DIR/scripts/deploy/deploy_server.sh \
                  '${AGENT_VERSION}-batch' '$AGENT_ID' '$DEPLOY_DIR' '$REMOTE_DIR'"

            BATCH_EXIT=$?
            if [ $BATCH_EXIT -eq 0 ]; then
                # Update cooldown after batch
                $SSH "date +%s > $COOLDOWN_FILE" 2>/dev/null || true
                $SSH "echo '$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${AGENT_VERSION}-batch | $AGENT_ID | BATCH-SUCCESS ($QUEUE_COUNT queued)' >> $HISTORY_FILE" 2>/dev/null || true
                log_ok "Batched deploy complete! All ${QUEUE_COUNT} queued agent changes included."
            else
                log_error "Batched deploy failed (exit $BATCH_EXIT). Queued agents may need to retry."
                $SSH "echo '$(date -u +%Y-%m-%dT%H:%M:%SZ) | ${AGENT_VERSION}-batch | $AGENT_ID | BATCH-FAILED' >> $HISTORY_FILE" 2>/dev/null || true
            fi
        else
            log_ok "Queue is empty. No batched deploy needed."
        fi

        # ── Release lock ──
        $SSH "rm -rf $LOCK_DIR; rm -f $CURRENT_FILE" 2>/dev/null || true
        I_AM_DEPLOYER="false"

        echo ""
        echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}${GREEN}║  ✅ Deploy Complete!                                       ║${NC}"
        echo -e "${BOLD}${GREEN}║  Version: ${AGENT_VERSION}${NC}"
        echo -e "${BOLD}${GREEN}║  Agent:   ${AGENT_ID}${NC}"
        echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    else
        log_error "Deploy pipeline failed (exit $DEPLOY_EXIT)."
        $SSH "echo '$(date -u +%Y-%m-%dT%H:%M:%SZ) | $AGENT_VERSION | $AGENT_ID | FAILED' >> $HISTORY_FILE" 2>/dev/null || true
        # Lock is released in cleanup trap
        exit 1
    fi

elif echo "$LOCK_RESULT" | grep -q "^LOCKED"; then
    # ═══════════════════════════════════════════════════
    # LOCK IS HELD — ADD TO QUEUE
    # ═══════════════════════════════════════════════════
    CURRENT_DEPLOYER=$(echo "$LOCK_RESULT" | cut -d'|' -f2)
    LOCK_AGE=$(echo "$LOCK_RESULT" | cut -d'|' -f3)

    # Add ourselves to the queue
    $SSH "echo '$AGENT_ID|$(date +%s)' >> $QUEUE_FILE" 2>/dev/null || true
    QUEUE_POS=$($SSH "wc -l < $QUEUE_FILE" 2>/dev/null || echo "?")

    echo ""
    echo -e "${BOLD}${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${YELLOW}║  ⏳ Deploy Queued — Another deploy is in progress          ║${NC}"
    echo -e "${BOLD}${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  Current deployer: ${CURRENT_DEPLOYER}${NC}"
    echo -e "${YELLOW}║  Running for:      ${LOCK_AGE}s${NC}"
    echo -e "${YELLOW}║  Your position:    #${QUEUE_POS} in queue${NC}"
    echo -e "${BOLD}${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  ✅ Your files ARE synced to the server (rsync complete).   ║${NC}"
    echo -e "${GREEN}║  🔄 Your changes WILL be included in the next deploy cycle.║${NC}"
    echo -e "${YELLOW}║  ℹ️  No manual retry needed — the current deployer will     ║${NC}"
    echo -e "${YELLOW}║     drain the queue automatically after finishing.          ║${NC}"
    echo -e "${BOLD}${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Log to history
    $SSH "echo '$(date -u +%Y-%m-%dT%H:%M:%SZ) | $AGENT_VERSION | $AGENT_ID | QUEUED (pos #$QUEUE_POS)' >> $HISTORY_FILE" 2>/dev/null || true

    # Exit with code 2 (queued — not an error)
    exit 2

elif echo "$LOCK_RESULT" | grep -q "SSH_FAIL"; then
    log_error "Cannot connect to server. SSH failed."
    echo "   Check: ssh -i $SSH_KEY $REMOTE_HOST 'echo OK'"
    exit 1

else
    log_error "Unexpected lock result: $LOCK_RESULT"
    exit 1
fi
