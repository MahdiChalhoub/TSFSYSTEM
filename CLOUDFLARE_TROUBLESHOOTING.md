# Cloudflare SSL Troubleshooting - 522/Timeout Issues

**Date**: 2026-03-07
**Status**: Origin Certificate installed ✅, but HTTPS still timing out ⚠️

---

## Current Status

### ✅ What's Working:
1. **Frontend service**: Running on port 3000, responding in 240ms
2. **Backend service**: Running on port 8000, all endpoints working
3. **Nginx**: Active, SSL configured with Cloudflare Origin Certificate
4. **Local HTTPS**: SSL handshake successful (verified with openssl)
5. **Local HTTP**: localhost:3000 returns HTTP 200 with 25KB content
6. **Certificate**: Installed correctly (CloudFlare Origin CA, valid until 2041)

### ⚠️ What's Not Working:
- **Public HTTPS access**: Connection hangs after SSL handshake (no 522 error, just timeout)
- TLS handshake completes successfully
- Cloudflare connects to origin
- But no data is returned (times out after 30 seconds)

---

## Root Cause Analysis

This behavior (SSL handshake works, but connection hangs) typically means:

1. **Cloudflare SSL/TLS mode mismatch**
   - Origin Certificate requires "Full (strict)" mode
   - If set to "Full" or "Flexible", it may cause issues

2. **Cloudflare cache not updated**
   - Old SSL configuration cached
   - Need to purge cache

3. **Firewall blocking Cloudflare IPs**
   - Nginx might be blocking or rate-limiting Cloudflare

4. **Nginx timeout settings**
   - Proxy timeouts might be too short

---

## Step-by-Step Fix

### Step 1: Verify Cloudflare SSL/TLS Settings

1. **Go to Cloudflare Dashboard**
   - Log in to https://dash.cloudflare.com
   - Select the `tsf.ci` domain

2. **Check SSL/TLS Mode**
   - Navigate to: **SSL/TLS → Overview**
   - Current mode should be: **Full (strict)** ✅
   - If not, change it to: **Full (strict)**
   - Click "Save"

   **What each mode means**:
   - **Off**: No HTTPS (don't use this!)
   - **Flexible**: Cloudflare ↔ Visitors = HTTPS, Cloudflare ↔ Origin = HTTP (not secure)
   - **Full**: Cloudflare ↔ Origin = HTTPS with any certificate (even self-signed)
   - **Full (strict)**: Cloudflare ↔ Origin = HTTPS with valid CA certificate (REQUIRED for Origin Certificates)

3. **Verify Origin Server Settings**
   - Navigate to: **SSL/TLS → Origin Server**
   - You should see your Origin Certificate listed
   - If not, create a new one (instructions in CLOUDFLARE_ORIGIN_CERT_SETUP.md)

### Step 2: Clear Cloudflare Cache

1. **Purge All Cache**
   - Navigate to: **Caching → Configuration**
   - Click: **Purge Everything**
   - Confirm the action
   - Wait 30-60 seconds for cache to clear

2. **Alternative: Purge Specific URLs**
   - If you don't want to purge everything
   - Click: **Custom Purge**
   - Enter URLs:
     ```
     https://tsf.ci/
     https://saas.tsf.ci/
     https://tsf.ci/login
     ```
   - Click "Purge"

### Step 3: Check Cloudflare Firewall Rules

1. **Review Firewall Events**
   - Navigate to: **Security → Events**
   - Look for blocked requests to tsf.ci
   - If you see blocked requests, adjust firewall rules

2. **Check WAF Rules**
   - Navigate to: **Security → WAF**
   - Ensure no rules are blocking legitimate traffic
   - Temporarily disable "Bot Fight Mode" if enabled (for testing)

### Step 4: Verify DNS Settings

1. **Check DNS Records**
   - Navigate to: **DNS → Records**
   - Verify these A/AAAA records exist and are proxied (orange cloud):
     ```
     A      tsf.ci        → 91.99.11.249 (Proxied ☁️)
     A      *.tsf.ci      → 91.99.11.249 (Proxied ☁️)
     A      saas          → 91.99.11.249 (Proxied ☁️)
     ```
   - The orange cloud (☁️) means "Proxied" - this is correct
   - Gray cloud means "DNS Only" - change to Proxied

### Step 5: Test Again

After making changes, wait 30-60 seconds, then test:

```bash
# From the server
curl -I https://tsf.ci --max-time 10

# Or use online tools
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=tsf.ci
# This will show SSL configuration and any issues
```

---

## Advanced Troubleshooting

### Check Nginx Access Logs for Cloudflare Requests

```bash
# Monitor in real-time
tail -f /var/log/nginx/access.log | grep -i cloudflare

# Check recent Cloudflare requests
tail -100 /var/log/nginx/access.log | grep -E "CF-Connecting-IP|cf-ray"
```

**Expected**: You should see requests with Cloudflare headers (CF-Ray, CF-Connecting-IP)

**If no requests**: Cloudflare isn't reaching the origin → Check DNS settings

### Verify Cloudflare IPs are Allowed

Cloudflare IPs that should be allowed:
```
# IPv4 ranges
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22

# IPv6 ranges
2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32
```

These should NOT be blocked by your firewall.

### Test Without Cloudflare

Temporarily bypass Cloudflare to test direct connection:

```bash
# Add to /etc/hosts (for testing only)
echo "91.99.11.249 test.tsf.local" >> /etc/hosts

# Test direct connection
curl -I https://test.tsf.local/ --resolve test.tsf.local:443:91.99.11.249 --insecure

# Remove test entry when done
sed -i '/test.tsf.local/d' /etc/hosts
```

### Check for IPv6 Issues

Cloudflare prefers IPv6. If there's an IPv6 connectivity issue:

```bash
# Check if server has IPv6
ip -6 addr show

# Test IPv6 connectivity
ping6 -c 3 2606:4700:4700::1111

# If no IPv6, consider disabling in Cloudflare
# Dashboard → Network → IPv6 Compatibility → Off
```

---

## Quick Reference: Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| 522 Error | Origin unreachable | Check firewall, verify services running |
| 525 Error | SSL handshake failed | Check certificate, verify SSL mode |
| 526 Error | Invalid SSL certificate | Install proper certificate |
| Connection timeout | SSL mode mismatch or cache | Set to "Full (strict)", purge cache |
| ERR_SSL_PROTOCOL_ERROR | Wrong SSL/TLS version | Update Nginx SSL config |

---

## What We've Already Done

✅ Installed Cloudflare Origin Certificate
✅ Verified certificate is valid (CloudFlare Origin CA)
✅ Set proper file permissions (644 for cert, 600 for key)
✅ Reloaded Nginx
✅ Verified SSL handshake works locally
✅ Confirmed frontend is responding (HTTP 200)
✅ Confirmed backend is responding (HTTP 200)
✅ No errors in Nginx logs

---

## What Needs to Be Checked in Cloudflare Dashboard

⚠️ **SSL/TLS Mode**: Ensure it's set to "Full (strict)"
⚠️ **Cache**: Purge all cached content
⚠️ **DNS**: Verify A records are proxied (orange cloud)
⚠️ **Firewall**: Check no rules are blocking traffic
⚠️ **Bot Protection**: Temporarily disable if enabled

---

## Contact & Next Steps

If issue persists after following all steps above:

1. **Check Cloudflare Status Page**: https://www.cloudflarestatus.com/
2. **Review Cloudflare SSL/TLS Recommender**:
   - Dashboard → SSL/TLS → Edge Certificates
   - Click "Configure SSL/TLS Recommender"
3. **Contact Cloudflare Support** (if on paid plan)
4. **Alternative**: Use Let's Encrypt certificate instead (requires DNS change)

---

**Last Updated**: 2026-03-07 02:58 UTC
**Server**: 91.99.11.249 (ubuntu-32gb-fsn1-1)
**Status**: Waiting for Cloudflare dashboard verification
