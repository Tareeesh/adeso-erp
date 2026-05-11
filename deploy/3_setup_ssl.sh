#!/bin/bash
# Step 3: Set up HTTPS with Let's Encrypt.
# Prerequisites:
#   - Your domain's DNS A record must point to 20.83.156.15
#   - The ERP stack must already be running (step 2 complete)
# Usage:  bash deploy/3_setup_ssl.sh erp.adesoafrica.org

set -e

DOMAIN="${1:?Usage: bash 3_setup_ssl.sh <your-domain>}"
EMAIL="thussein@adesoafrica.org"
NGINX_CONF="/etc/nginx/sites-available/adeso-erp"

echo "==> Installing nginx host config for $DOMAIN ..."
sudo cp "$HOME/adeso-erp/deploy/nginx-host.conf" "$NGINX_CONF"
sudo sed -i "s/YOUR_DOMAIN/$DOMAIN/g" "$NGINX_CONF"

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/adeso-erp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "==> Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

echo "==> Setting up auto-renewal..."
sudo systemctl enable certbot.timer 2>/dev/null || \
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -

echo ""
echo "===================================================="
echo " SSL enabled!"
echo " ERP is live at: https://$DOMAIN"
echo ""
echo " Update APP_URL in deploy/.env.production:"
echo "   APP_URL=https://$DOMAIN"
echo " Then restart: docker compose -f deploy/docker-compose.prod.yml up -d"
echo "===================================================="
