#!/bin/bash
set -e

# Configuration
RG_NAME="rg-familytree-prod-centralindia-001"
LOCATION="centralindia"
# Unique App Name (alphanumeric, lowercase)
CONFIG_FILE="azure/config.env"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    TIMESTAMP=$(date +%s)
    APP_NAME="ftree${TIMESTAMP}"
    echo "APP_NAME=$APP_NAME" > "$CONFIG_FILE"
fi

echo "Starting Deployment to Azure ($LOCATION)..."
echo "Resource Group: $RG_NAME"
echo "App Name: $APP_NAME"

# 1. Create Resource Group
echo "-----------------------------------"
echo "Creating Resource Group..."
az group create --name $RG_NAME --location $LOCATION

# 2. Deploy Infrastructure
echo "-----------------------------------"
echo "Deploying Bicep Template..."
# Deploy and capture output
DEPLOYMENT=$(az deployment group create \
  --resource-group $RG_NAME \
  --template-file azure/bicep/main.bicep \
  --parameters appName=$APP_NAME location=$LOCATION \
  --output json)

# Extract Outputs
KEY_VAULT_NAME=$(echo $DEPLOYMENT | jq -r '.properties.outputs.keyVaultName.value')
ACR_URL=$(echo $DEPLOYMENT | jq -r '.properties.outputs.containerRegistryUrl.value')
APP_SERVICE_URL=$(echo $DEPLOYMENT | jq -r '.properties.outputs.appServiceUrl.value')

echo "Infrastructure Deployed."
echo "Key Vault: $KEY_VAULT_NAME"
echo "ACR: $ACR_URL"

# 2.5 Grant Access to Current User (Access Policy)
echo "-----------------------------------"
echo "Granting User Access to Key Vault..."
USER_ID=$(az ad signed-in-user show --query id -o tsv)
az keyvault set-policy --name $KEY_VAULT_NAME --object-id $USER_ID --secret-permissions set get list delete >/dev/null
echo "Access Policy Set."

# 3. Configure Secrets (if missing)
echo "-----------------------------------"
echo "Configuring Secrets..."

# Check if secret exists (simplified check)
check_secret() {
    az keyvault secret show --vault-name $KEY_VAULT_NAME --name $1 &>/dev/null
}

if ! check_secret "jwt-secret"; then
    echo "Setting JWT Secret..."
    JWT_SECRET=$(openssl rand -hex 32)
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name jwt-secret --value "$JWT_SECRET" >/dev/null
fi

if ! check_secret "master-encryption-key"; then
    echo "Setting Master Encryption Key..."
    # Generate 32-byte key
    MASTER_KEY=$(openssl rand -hex 32)
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name master-encryption-key --value "$MASTER_KEY" >/dev/null
fi

if ! check_secret "refresh-token-secret"; then
    echo "Setting Refresh Token Secret..."
    REFRESH_SECRET=$(openssl rand -hex 32)
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name refresh-token-secret --value "$REFRESH_SECRET" >/dev/null
fi

# 4. Build and Push (Cloud Build)
echo "-----------------------------------"
echo "Building Docker Image in Azure (Cloud Build)..."
ACR_NAME=${ACR_URL%%.*}

# This uploads source code and builds in the cloud
# No local Docker required
az acr build --registry $ACR_NAME --image familytree:latest .


# 5. Restart App Service
echo "-----------------------------------"
echo "Restarting App Service to pull new image..."
az webapp restart --name "${APP_NAME}-app" --resource-group $RG_NAME

echo "-----------------------------------"
echo "Deployment Complete!"
echo "App URL: $APP_SERVICE_URL"
