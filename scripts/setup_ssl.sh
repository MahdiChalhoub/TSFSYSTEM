#!/bin/bash
# SSL Setup Script for TSF Platform
# Run this on your production server

echo "=== TSF SSL Certificate Setup ==="

# Create directories
mkdir -p nginx/ssl
mkdir -p certbot/conf
mkdir -p certbot/www

# Step 1: Generate self-signed cert for initial nginx startup
if [ ! -f nginx/ssl/nginx.crt ]; then
    echo "📜 Generating self-signed certificate for initial startup..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/nginx.key \
        -out nginx/ssl/nginx.crt \
        -subj "/C=US/ST=State/L=City/O=TSF/CN=tsf.ci"
    echo "✅ Self-signed certificate created"
fi

# Step 2: Start nginx with HTTP-only for ACME challenge
echo "🔄 Restarting nginx for ACME challenge..."
docker-compose up -d nginx

# Step 3: Get Let's Encrypt certificate
echo ""
echo "🔐 Getting Let's Encrypt certificate..."
echo "Make sure your domain DNS points to this server!"
echo ""

# Replace with your domain(s)
DOMAINS="-d saas.tsf.ci -d tsf.ci"
EMAIL="admin@tsf.ci"

docker run --rm \
    -v $(pwd)/certbot/conf:/etc/letsencrypt \
    -v $(pwd)/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    $DOMAINS

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL Certificate obtained successfully!"
    echo ""
    echo "📝 Now uncomment the HTTPS server block in nginx/nginx.conf"
    echo "   and restart: docker-compose restart nginx"
else
    echo ""
    echo "❌ Failed to obtain certificate. Check:"
    echo "   1. DNS records point to this server"
    echo "   2. Port 80 is open"
    echo "   3. Domain is accessible"
fi
