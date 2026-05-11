#!/bin/bash
# Step 1: Replace Windows VM with Ubuntu 22.04 and open firewall ports.
# Run from your local machine: bash deploy/1_azure_vm_replace.sh
set -e

RESOURCE_GROUP="NEARSERVER"
VM_NAME="ERPSERVER"
NIC_NAME="erpserver915_z1"
DISK_NAME="ERPSERVER_disk1_7797b0bde21f498bb6bb97d94c1cb5ec"
NSG_NAME="ERPSERVER-nsg"
ADMIN_USER="adeso"
SSH_KEY_PATH="$HOME/.ssh/adeso_erp"
SERVER_IP="20.83.156.15"

# Generate SSH key pair if not already present
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "==> Generating SSH key at $SSH_KEY_PATH ..."
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "adeso-erp-deploy"
fi

echo ""
echo "==> Deleting Windows VM '$VM_NAME' (takes ~2 min)..."
az vm delete -g "$RESOURCE_GROUP" -n "$VM_NAME" --yes

echo "==> Deleting old OS disk..."
az disk delete -g "$RESOURCE_GROUP" -n "$DISK_NAME" --yes --no-wait

echo "==> Creating Ubuntu 22.04 VM (reusing existing NIC + public IP)..."
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --nics "$NIC_NAME" \
  --image Ubuntu2204 \
  --size Standard_B2ms \
  --admin-username "$ADMIN_USER" \
  --ssh-key-values "${SSH_KEY_PATH}.pub" \
  --os-disk-size-gb 30 \
  --storage-sku StandardSSD_LRS

echo "==> Opening firewall ports (SSH=22, HTTP=80, HTTPS=443)..."
az network nsg rule create -g "$RESOURCE_GROUP" --nsg-name "$NSG_NAME" \
  --name SSH   --protocol tcp --priority 100 --direction Inbound \
  --destination-port-range 22  --access Allow

az network nsg rule create -g "$RESOURCE_GROUP" --nsg-name "$NSG_NAME" \
  --name HTTP  --protocol tcp --priority 110 --direction Inbound \
  --destination-port-range 80  --access Allow

az network nsg rule create -g "$RESOURCE_GROUP" --nsg-name "$NSG_NAME" \
  --name HTTPS --protocol tcp --priority 120 --direction Inbound \
  --destination-port-range 443 --access Allow

echo ""
echo "===================================================="
echo " VM ready!"
echo " IP  : $SERVER_IP"
echo " SSH : ssh -i $SSH_KEY_PATH ${ADMIN_USER}@${SERVER_IP}"
echo "===================================================="
echo ""
echo "Next: run deploy/2_server_setup.sh"
echo "  ssh -i $SSH_KEY_PATH ${ADMIN_USER}@${SERVER_IP} 'bash -s' < deploy/2_server_setup.sh"
