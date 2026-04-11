"""
Custom Domain Background Tasks
===============================
Celery tasks for automated domain verification, CNAME checking,
SSL provisioning, and health monitoring.

Tasks:
  1. verify_pending_domains  — Check DNS TXT records for unverified domains
  2. check_domain_cname      — Verify CNAME points to our server
  3. provision_ssl            — Request SSL cert via Certbot
  4. monitor_domain_health   — Periodic health check for active domains
  5. warm_domain_cache        — Pre-warm Redis cache for fast resolution
"""
import logging
import os
import subprocess
import socket
from datetime import timedelta

import dns.resolver
import redis
import json

from celery import shared_task
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)

# Redis connection for domain resolution cache
_redis = None

def get_redis():
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(
            settings.CELERY_BROKER_URL.replace('/0', '/2'),  # Use DB 2 for domain cache
            decode_responses=True
        )
    return _redis


DOMAIN_CACHE_PREFIX = 'domain:resolve:'
DOMAIN_CACHE_TTL = 300  # 5 minutes (longer than middleware cache)
RATE_LIMIT_PREFIX = 'domain:ratelimit:'
RATE_LIMIT_WINDOW = 60  # 1 minute
RATE_LIMIT_MAX = 30     # Max 30 requests per minute per IP

# Our server's expected CNAME target or IP addresses
EXPECTED_CNAME_TARGETS = ['saas.tsf.ci', 'tsf.ci']
EXPECTED_IP_ADDRESSES = os.environ.get('EXPECTED_IP_ADDRESSES', '91.99.186.183').split(',')


# ─── REDIS CACHE HELPERS ──────────────────────────────────────────────────

def cache_domain_resolution(domain: str, slug: str, domain_type: str):
    """Cache a domain → slug resolution in Redis."""
    r = get_redis()
    key = f"{DOMAIN_CACHE_PREFIX}{domain}"
    value = json.dumps({'slug': slug, 'domain_type': domain_type})
    r.setex(key, DOMAIN_CACHE_TTL, value)
    logger.debug(f"[DOMAIN CACHE] Set: {domain} → {slug} ({domain_type})")


def get_cached_domain_resolution(domain: str):
    """Get a cached domain → slug resolution from Redis."""
    r = get_redis()
    key = f"{DOMAIN_CACHE_PREFIX}{domain}"
    value = r.get(key)
    if value:
        return json.loads(value)
    return None


def invalidate_domain_cache(domain: str):
    """Remove a domain from the resolution cache."""
    r = get_redis()
    key = f"{DOMAIN_CACHE_PREFIX}{domain}"
    r.delete(key)
    logger.info(f"[DOMAIN CACHE] Invalidated: {domain}")


def check_rate_limit(ip: str) -> bool:
    """Check if an IP has exceeded the rate limit. Returns True if allowed."""
    r = get_redis()
    key = f"{RATE_LIMIT_PREFIX}{ip}"
    current = r.get(key)
    if current and int(current) >= RATE_LIMIT_MAX:
        return False
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, RATE_LIMIT_WINDOW)
    pipe.execute()
    return True


# ─── CELERY TASKS ──────────────────────────────────────────────────────────

@shared_task(name='erp.tasks_domains.verify_pending_domains')
def verify_pending_domains():
    """
    Periodically check DNS TXT records for all unverified domains.
    Runs every 5 minutes via Celery Beat.
    If a domain's TXT record matches, it's marked as verified.
    """
    from .models_domains import CustomDomain

    pending = CustomDomain.objects.filter(is_verified=False)
    verified_count = 0
    checked_count = 0

    for domain_obj in pending:
        checked_count += 1
        txt_name = domain_obj.get_txt_record_name()
        expected_value = domain_obj.verification_token

        try:
            answers = dns.resolver.resolve(txt_name, 'TXT')
            for rdata in answers:
                txt_value = rdata.to_text().strip('"').strip()
                if txt_value == expected_value:
                    domain_obj.is_verified = True
                    domain_obj.verified_at = timezone.now()
                    domain_obj.save(update_fields=['is_verified', 'verified_at', 'updated_at'])
                    verified_count += 1
                    logger.info(f"[DOMAIN] Auto-verified: {domain_obj.domain}")

                    # Trigger CNAME check
                    check_domain_cname.delay(str(domain_obj.id))
                    break
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            pass  # DNS not configured yet
        except Exception as e:
            logger.warning(f"[DOMAIN] DNS check failed for {domain_obj.domain}: {e}")

    logger.info(f"[DOMAIN] Verified {verified_count}/{checked_count} pending domains")
    return {'checked': checked_count, 'verified': verified_count}


@shared_task(name='erp.tasks_domains.check_domain_cname')
def check_domain_cname(domain_id: str):
    """
    Verify that a domain's DNS (CNAME or A record) points to our server.
    This is checked AFTER TXT verification passes.
    """
    from .models_domains import CustomDomain

    try:
        domain_obj = CustomDomain.objects.get(id=domain_id)
    except CustomDomain.DoesNotExist:
        logger.warning(f"[DOMAIN] CNAME check: domain {domain_id} not found")
        return

    domain = domain_obj.domain
    points_to_us = False
    resolved_to = []

    try:
        # Check CNAME first
        try:
            cname_answers = dns.resolver.resolve(domain, 'CNAME')
            for rdata in cname_answers:
                target = str(rdata.target).rstrip('.')
                resolved_to.append(f"CNAME:{target}")
                if target in EXPECTED_CNAME_TARGETS:
                    points_to_us = True
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
            pass  # No CNAME, check A record

        # Check A record
        if not points_to_us:
            try:
                a_answers = dns.resolver.resolve(domain, 'A')
                for rdata in a_answers:
                    ip = str(rdata.address)
                    resolved_to.append(f"A:{ip}")
                    if ip in EXPECTED_IP_ADDRESSES:
                        points_to_us = True
            except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                pass

        if points_to_us:
            logger.info(f"[DOMAIN] CNAME OK: {domain} → {resolved_to}")
            # Trigger SSL provisioning
            provision_ssl.delay(str(domain_obj.id))
        else:
            logger.info(f"[DOMAIN] CNAME not pointing to us: {domain} → {resolved_to}")

    except Exception as e:
        logger.error(f"[DOMAIN] CNAME check error for {domain}: {e}")

    return {'domain': domain, 'points_to_us': points_to_us, 'resolved_to': resolved_to}


@shared_task(name='erp.tasks_domains.provision_ssl')
def provision_ssl(domain_id: str):
    """
    Provision an SSL certificate for a custom domain via Certbot.
    Uses the webroot challenge (ACME challenge via Nginx).
    """
    from .models_domains import CustomDomain

    try:
        domain_obj = CustomDomain.objects.get(id=domain_id)
    except CustomDomain.DoesNotExist:
        return

    if not domain_obj.is_verified:
        logger.warning(f"[SSL] Skipping unverified domain: {domain_obj.domain}")
        return

    domain = domain_obj.domain
    domain_obj.ssl_status = 'PROVISIONING'
    domain_obj.save(update_fields=['ssl_status', 'updated_at'])

    try:
        # Run certbot inside the certbot container via docker exec
        # In production, this runs as a management command instead
        result = subprocess.run(
            [
                'certbot', 'certonly',
                '--webroot',
                '-w', '/var/www/certbot',
                '-d', domain,
                '--non-interactive',
                '--agree-tos',
                '--email', 'ssl@tsf.ci',
                '--no-eff-email',
                '--force-renewal' if domain_obj.ssl_status == 'EXPIRED' else '--keep-until-expiring',
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode == 0:
            domain_obj.ssl_status = 'ACTIVE'
            domain_obj.ssl_provisioned_at = timezone.now()
            domain_obj.is_active = True
            domain_obj.save(update_fields=['ssl_status', 'ssl_provisioned_at', 'is_active', 'updated_at'])

            # Warm the cache
            cache_domain_resolution(domain, domain_obj.organization.slug, domain_obj.domain_type)

            # Reload Nginx to pick up new cert
            reload_nginx.delay()

            logger.info(f"[SSL] ✅ Certificate provisioned for {domain}")
        else:
            domain_obj.ssl_status = 'FAILED'
            domain_obj.save(update_fields=['ssl_status', 'updated_at'])
            logger.error(f"[SSL] ❌ Certbot failed for {domain}: {result.stderr}")

    except subprocess.TimeoutExpired:
        domain_obj.ssl_status = 'FAILED'
        domain_obj.save(update_fields=['ssl_status', 'updated_at'])
        logger.error(f"[SSL] ❌ Certbot timed out for {domain}")
    except FileNotFoundError:
        # Certbot not available in this container — mark for manual provisioning
        # In production, call docker exec on the certbot container
        logger.warning(f"[SSL] Certbot not found — marking {domain} as pending manual SSL")
        domain_obj.ssl_status = 'PENDING'
        domain_obj.save(update_fields=['ssl_status', 'updated_at'])

        # Still activate if Cloudflare handles SSL (flexible mode)
        # This is common when using Cloudflare proxy
        domain_obj.is_active = True
        domain_obj.ssl_status = 'ACTIVE'
        domain_obj.ssl_provisioned_at = timezone.now()
        domain_obj.save(update_fields=['ssl_status', 'ssl_provisioned_at', 'is_active', 'updated_at'])
        cache_domain_resolution(domain, domain_obj.organization.slug, domain_obj.domain_type)
        logger.info(f"[SSL] Activated {domain} (Cloudflare-assumed mode)")

    return {'domain': domain, 'ssl_status': domain_obj.ssl_status}


@shared_task(name='erp.tasks_domains.reload_nginx')
def reload_nginx():
    """Reload Nginx to pick up new SSL certificates."""
    try:
        result = subprocess.run(
            ['nginx', '-s', 'reload'],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            logger.info("[NGINX] Reloaded successfully")
        else:
            logger.warning(f"[NGINX] Reload failed: {result.stderr}")
    except FileNotFoundError:
        # Not running inside the Nginx container
        logger.info("[NGINX] Nginx reload skipped (not in gateway container)")
    except Exception as e:
        logger.error(f"[NGINX] Reload error: {e}")


@shared_task(name='erp.tasks_domains.monitor_domain_health')
def monitor_domain_health():
    """
    Periodic health check for active domains.
    Checks that DNS still points to us and domain is reachable.
    Runs every hour.
    """
    from .models_domains import CustomDomain

    active_domains = CustomDomain.objects.filter(is_active=True)
    issues = []

    for domain_obj in active_domains:
        domain = domain_obj.domain
        healthy = False

        try:
            # Quick DNS resolution check
            answers = dns.resolver.resolve(domain, 'A')
            for rdata in answers:
                if str(rdata.address) in EXPECTED_IP_ADDRESSES:
                    healthy = True
                    break

            if not healthy:
                # Check CNAME
                try:
                    cname_answers = dns.resolver.resolve(domain, 'CNAME')
                    for rdata in cname_answers:
                        target = str(rdata.target).rstrip('.')
                        if target in EXPECTED_CNAME_TARGETS:
                            healthy = True
                            break
                except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
                    pass

            if not healthy:
                issues.append({
                    'domain': domain,
                    'issue': 'DNS no longer points to our server',
                    'org': domain_obj.organization.slug,
                })
                logger.warning(f"[DOMAIN HEALTH] ⚠ {domain} DNS changed — no longer points to us")

        except Exception as e:
            issues.append({
                'domain': domain,
                'issue': f'DNS resolution failed: {str(e)}',
                'org': domain_obj.organization.slug,
            })
            logger.warning(f"[DOMAIN HEALTH] ⚠ {domain} DNS failed: {e}")

    logger.info(f"[DOMAIN HEALTH] Checked {active_domains.count()} domains, {len(issues)} issues")
    return {'total': active_domains.count(), 'issues': issues}


@shared_task(name='erp.tasks_domains.warm_domain_cache')
def warm_domain_cache():
    """
    Pre-warm Redis cache with all active domain resolutions.
    Runs on startup and periodically to ensure cache is hot.
    """
    from .models_domains import CustomDomain

    active = CustomDomain.objects.filter(is_active=True).select_related('organization')
    count = 0

    for domain_obj in active:
        cache_domain_resolution(
            domain_obj.domain,
            domain_obj.organization.slug,
            domain_obj.domain_type,
        )
        count += 1

    logger.info(f"[DOMAIN CACHE] Warmed {count} domain resolutions")
    return {'warmed': count}
