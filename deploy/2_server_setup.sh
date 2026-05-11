#!/bin/bash
# Step 2: Bootstrap the Ubuntu VM.
# Run from your local machine:
#   ssh -i ~/.ssh/adeso_erp adeso@20.83.156.15 'bash -s' < deploy/2_server_setup.sh
set -e

echo "==> Updating system packages..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

echo "==> Installing nginx + certbot..."
sudo apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> Installing git..."
sudo apt-get install -y -qq git

echo "==> Cloning ADESO ERP repo..."
git clone https://github.com/Tareeesh/adeso-erp.git "$HOME/adeso-erp"

echo "==> Creating required directories..."
mkdir -p "$HOME/adeso-erp/certbot/conf" "$HOME/adeso-erp/certbot/www"

echo "==> Disabling default nginx site..."
sudo rm -f /etc/nginx/sites-enabled/default

echo ""
echo "===================================================="
echo " Server setup complete!"
echo ""
echo " Next steps:"
echo "  1. Copy .env.production to the server:"
echo "       scp -i ~/.ssh/adeso_erp deploy/.env.production adeso@20.83.156.15:~/adeso-erp/deploy/"
echo ""
echo "  2. Start the ERP stack:"
echo "       ssh -i ~/.ssh/adeso_erp adeso@20.83.156.15"
echo "       cd ~/adeso-erp"
echo "       newgrp docker  # apply docker group without logout"
echo "       docker compose -f deploy/docker-compose.prod.yml up -d --build"
echo ""
echo "  3. Verify it's running at http://20.83.156.15"
echo "===================================================="
