# Cloudflare Origin Certificate Setup for TSF.ci

## Why Use Cloudflare Origin Certificate?
- ✅ No DNS validation needed (avoids Let's Encrypt issues)
- ✅ 15-year validity (vs 90 days for Let's Encrypt)
- ✅ Perfect for Cloudflare proxied domains
- ✅ Free and instant generation
- ✅ Works with wildcard domains (*.tsf.ci)

## Steps to Get Certificate:

### 1. Log into Cloudflare Dashboard
   - Go to https://dash.cloudflare.com
   - Select the `tsf.ci` domain

### 2. Navigate to SSL/TLS → Origin Server
   - Click on "SSL/TLS" in the sidebar
   - Click on "Origin Server" tab
   - Click "Create Certificate" button

### 3. Configure Certificate
   - Leave "Let Cloudflare generate a private key..." selected
   - Hostnames: Ensure these are listed:
     - tsf.ci
     - *.tsf.ci
   - Certificate Validity: 15 years (default)
   - Click "Create"

### 4. Copy the Certificate Files
   Cloudflare will show you two text blocks:

   **A. Origin Certificate** (starts with `-----BEGIN CERTIFICATE-----`)
   - Copy this ENTIRE text

   **B. Private Key** (starts with `-----BEGIN PRIVATE KEY-----`)
   - Copy this ENTIRE text

   **IMPORTANT**: Save the private key NOW - Cloudflare won't show it again!

### 5. Install on Server
   Run these commands on the server:

   ```bash
   # Backup current certificates
   sudo cp -r /etc/letsencrypt/live/tsf.ci /etc/letsencrypt/live/tsf.ci.backup-$(date +%Y%m%d)

   # Create the new certificate file
   sudo nano /etc/letsencrypt/live/tsf.ci/fullchain.pem
   # (Paste the Origin Certificate, save and exit)

   # Create the new private key file
   sudo nano /etc/letsencrypt/live/tsf.ci/privkey.pem
   # (Paste the Private Key, save and exit)

   # Set proper permissions
   sudo chmod 644 /etc/letsencrypt/live/tsf.ci/fullchain.pem
   sudo chmod 600 /etc/letsencrypt/live/tsf.ci/privkey.pem

   # Test Nginx configuration
   sudo nginx -t

   # Reload Nginx
   sudo systemctl reload nginx
   ```

### 6. Verify SSL Settings in Cloudflare
   - Go to SSL/TLS → Overview
   - Ensure SSL/TLS encryption mode is set to: **Full (strict)**
   - This mode requires a valid certificate on the origin (which we just installed)

### 7. Test
   Wait 30-60 seconds for Cloudflare cache to update, then test:
   ```bash
   curl -I https://saas.tsf.ci
   curl -I https://tsf.ci
   ```

## Expected Results:
- HTTP 200 or 301/302 redirect
- No more 522 errors
- Valid SSL connection from browser

## Troubleshooting:
If still seeing 522 errors:
1. Check Nginx is running: `systemctl status nginx`
2. Check frontend is running: `systemctl status tsfsystem-frontend`
3. Check backend is running: `systemctl status tsfsystem`
4. Verify Cloudflare SSL mode is "Full (strict)"
5. Clear Cloudflare cache: Caching → Configuration → Purge Everything

---

## Alternative: Let's Encrypt Certificate (Not Recommended)

If you prefer Let's Encrypt over Cloudflare Origin Certificate, you'll need to:
1. Temporarily disable Cloudflare proxy (DNS-only mode) for validation
2. Run certbot: `sudo certbot certonly --webroot -w /var/www/html -d tsf.ci -d *.tsf.ci`
3. Re-enable Cloudflare proxy after successful validation
4. Set up auto-renewal with certbot

However, this approach requires disabling the site temporarily and managing 90-day renewals.
