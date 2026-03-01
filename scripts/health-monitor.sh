#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TSF Production Health Monitor
# ═══════════════════════════════════════════════════════════
#
# Checks the health of all TSF production services and
# reports any issues. Can be run manually or via cron.
#
# Usage:
#   bash scripts/health-monitor.sh                 # One-time check
#   bash scripts/health-monitor.sh --watch          # Continuous (every 60s)
#   bash scripts/health-monitor.sh --watch 30       # Every 30 seconds
#
# Cron setup (every 5 minutes):
#   */5 * * * * cd /root/.gemini/antigravity/scratch/TSFSYSTEM && bash scripts/health-monitor.sh >> logs/health.log 2>&1
# ═══════════════════════════════════════════════════════════

PROD_URL="${PROD_URL:-https://saas.tsf.ci}"
API_URL="${API_URL:-https://saas.tsf.ci/api}"
WATCH_MODE=false
INTERVAL=60

# Parse args
if [ "$1" == "--watch" ]; then
    WATCH_MODE=true
    if [ -n "$2" ]; then
        INTERVAL=$2
    fi
fi

# ── Color codes ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Health Check Function ──
check_health() {
    local TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    local ISSUES=0
    
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  TSF Health Check — $TIMESTAMP"
    echo "═══════════════════════════════════════════"

    # 1. Frontend (Next.js)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD_URL" 2>/dev/null)
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
        echo -e "  ${GREEN}✅${NC} Frontend:     $HTTP_CODE — OK"
    elif [ "$HTTP_CODE" -eq 000 ]; then
        echo -e "  ${RED}❌${NC} Frontend:     UNREACHABLE"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "  ${RED}❌${NC} Frontend:     $HTTP_CODE"
        ISSUES=$((ISSUES + 1))
    fi

    # 2. API (Django)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$API_URL/" 2>/dev/null)
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
        echo -e "  ${GREEN}✅${NC} API:          $HTTP_CODE — OK"
    elif [ "$HTTP_CODE" -eq 000 ]; then
        echo -e "  ${RED}❌${NC} API:          UNREACHABLE"
        ISSUES=$((ISSUES + 1))
    else
        echo -e "  ${RED}❌${NC} API:          $HTTP_CODE — SERVER ERROR"
        ISSUES=$((ISSUES + 1))
    fi

    # 3. Login Page (critical user path)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD_URL/login" 2>/dev/null)
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
        echo -e "  ${GREEN}✅${NC} Login Page:   $HTTP_CODE — OK"
    else
        echo -e "  ${RED}❌${NC} Login Page:   $HTTP_CODE"
        ISSUES=$((ISSUES + 1))
    fi

    # 4. POS Page (revenue-critical)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD_URL/sales" 2>/dev/null)
    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
        echo -e "  ${GREEN}✅${NC} POS/Sales:    $HTTP_CODE — OK"
    else
        echo -e "  ${YELLOW}⚠️${NC}  POS/Sales:    $HTTP_CODE (may require auth)"
    fi

    # 5. PWA Manifest (mobile install)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROD_URL/manifest.json" 2>/dev/null)
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo -e "  ${GREEN}✅${NC} PWA Manifest: $HTTP_CODE — OK"
    else
        echo -e "  ${YELLOW}⚠️${NC}  PWA Manifest: $HTTP_CODE"
    fi

    # 6. SSL Certificate Check
    SSL_EXPIRY=$(echo | openssl s_client -servername $(echo $PROD_URL | sed 's|https://||') -connect $(echo $PROD_URL | sed 's|https://||'):443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$SSL_EXPIRY" ]; then
        DAYS_LEFT=$(( ($(date -d "$SSL_EXPIRY" +%s) - $(date +%s)) / 86400 ))
        if [ "$DAYS_LEFT" -gt 30 ]; then
            echo -e "  ${GREEN}✅${NC} SSL Cert:     ${DAYS_LEFT} days remaining"
        elif [ "$DAYS_LEFT" -gt 7 ]; then
            echo -e "  ${YELLOW}⚠️${NC}  SSL Cert:     ${DAYS_LEFT} days remaining — RENEW SOON"
        else
            echo -e "  ${RED}❌${NC} SSL Cert:     ${DAYS_LEFT} days — CRITICAL"
            ISSUES=$((ISSUES + 1))
        fi
    fi

    # 7. Backend Services (local checks if running on server)
    if command -v systemctl &>/dev/null; then
        # Check Gunicorn/Django
        if systemctl is-active --quiet gunicorn 2>/dev/null; then
            echo -e "  ${GREEN}✅${NC} Gunicorn:     Running"
        elif pgrep -f "gunicorn" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✅${NC} Gunicorn:     Running (non-systemd)"
        fi

        # Check Celery Worker
        if pgrep -f "celery.*worker" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✅${NC} Celery:       Running"
        else
            echo -e "  ${YELLOW}⚠️${NC}  Celery:       Not detected"
        fi

        # Check Celery Beat
        if pgrep -f "celery.*beat" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✅${NC} Celery Beat:  Running"
        else
            echo -e "  ${YELLOW}⚠️${NC}  Celery Beat:  Not detected"
        fi

        # Check Nginx
        if pgrep -f "nginx" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✅${NC} Nginx:        Running"
        fi
    fi

    # 8. Disk Space
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
    if [ "$DISK_USAGE" -lt 80 ]; then
        echo -e "  ${GREEN}✅${NC} Disk:         ${DISK_USAGE}% used"
    elif [ "$DISK_USAGE" -lt 90 ]; then
        echo -e "  ${YELLOW}⚠️${NC}  Disk:         ${DISK_USAGE}% used — CLEAN UP"
    else
        echo -e "  ${RED}❌${NC} Disk:         ${DISK_USAGE}% used — CRITICAL"
        ISSUES=$((ISSUES + 1))
    fi

    # 9. Memory
    MEM_USAGE=$(free | awk '/Mem:/ {printf("%.0f", $3/$2 * 100)}')
    if [ "$MEM_USAGE" -lt 80 ]; then
        echo -e "  ${GREEN}✅${NC} Memory:       ${MEM_USAGE}% used"
    elif [ "$MEM_USAGE" -lt 90 ]; then
        echo -e "  ${YELLOW}⚠️${NC}  Memory:       ${MEM_USAGE}% used — HIGH"
    else
        echo -e "  ${RED}❌${NC} Memory:       ${MEM_USAGE}% used — CRITICAL"
        ISSUES=$((ISSUES + 1))
    fi

    # 10. Recent Backend Errors (last 5 minutes of logs)
    if [ -f "/var/log/gunicorn/error.log" ]; then
        RECENT_ERRORS=$(find /var/log/gunicorn/error.log -mmin -5 -exec grep -c "ERROR\|CRITICAL\|Traceback" {} \; 2>/dev/null)
        if [ -n "$RECENT_ERRORS" ] && [ "$RECENT_ERRORS" -gt 0 ]; then
            echo -e "  ${RED}❌${NC} Errors:       $RECENT_ERRORS errors in last 5 min"
            ISSUES=$((ISSUES + 1))
        else
            echo -e "  ${GREEN}✅${NC} Errors:       Clean (no recent errors)"
        fi
    fi

    # Summary
    echo "───────────────────────────────────────────"
    if [ "$ISSUES" -gt 0 ]; then
        echo -e "  ${RED}⚡ $ISSUES ISSUE(S) DETECTED${NC}"
    else
        echo -e "  ${GREEN}✅ ALL SYSTEMS HEALTHY${NC}"
    fi
    echo "═══════════════════════════════════════════"

    return $ISSUES
}

# ── Main ──
if [ "$WATCH_MODE" = true ]; then
    echo "🔄 Watch mode — checking every ${INTERVAL}s (Ctrl+C to stop)"
    while true; do
        check_health
        sleep $INTERVAL
    done
else
    check_health
    exit $?
fi
