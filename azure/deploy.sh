#!/bin/bash
set -e

# Default Configuration
DEFAULT_REGION="centralindia"
DEFAULT_ENV="prod"

# Help Function
function show_help {
    echo "Usage: ./deploy.sh [REGION] [ENV_NAME]"
    echo "  REGION: Azure Region (default: $DEFAULT_REGION)"
    echo "  ENV_NAME: Environment Name (default: $DEFAULT_ENV)"
    echo ""
    echo "Example: ./deploy.sh eastus dev"
}

# Parse Arguments
REGION=${1:-$DEFAULT_REGION}
ENV_NAME=${2:-$DEFAULT_ENV}

if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Resource Group Name
RG_NAME="rg-familytree-${ENV_NAME}-${REGION}"
LOCATION=$REGION

# Unique App Name (alphanumeric, lowercase) configuration
# We store config based on the environment/region combo to allow multiple deployments
CONFIG_FILE="azure/config-${ENV_NAME}-${REGION}.env"
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    TIMESTAMP=$(date +%s)
    APP_NAME="ftree${TIMESTAMP}"
    echo "APP_NAME=$APP_NAME" > "$CONFIG_FILE"
fi

echo "-----------------------------------"
echo "Starting Deployment..."
echo "Region: $LOCATION"
echo "Environment: $ENV_NAME"
echo "Resource Group: $RG_NAME"
echo "App Name: $APP_NAME"
echo "-----------------------------------"

# 1. Create Resource Group
echo "Creating Resource Group..."
az group create --name $RG_NAME --location $LOCATION --output none
echo "Resource Group Created."

# 2. Deploy Bicep (Infrastructure)
echo "-----------------------------------"
echo "Deploying Bicep Template..."
DEPLOYMENT=$(az deployment group create \
  --resource-group $RG_NAME \
  --template-file azure/bicep/main.bicep \
  --parameters appName=$APP_NAME location=$LOCATION \
  --query properties.outputs \
  --output json)

# Extract Outputs
KEY_VAULT_NAME=$(echo $DEPLOYMENT | jq -r '.keyVaultName.value')
ACR_URL=$(echo $DEPLOYMENT | jq -r '.containerRegistryUrl.value')
APP_SERVICE_URL=$(echo $DEPLOYMENT | jq -r '.appServiceUrl.value')

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

# JWT_SECRET
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name jwt-secret >/dev/null 2>&1; then
    echo "JWT Secret exists."
else
    echo "Setting JWT Secret..."
    JWT_SECRET=$(openssl rand -hex 32)
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name jwt-secret --value "$JWT_SECRET" >/dev/null
fi

# MASTER_ENCRYPTION_KEY
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name master-encryption-key >/dev/null 2>&1; then
    echo "Master Encryption Key exists."
else
    echo "Setting Master Encryption Key..."
    MASTER_KEY=$(openssl rand -hex 32)
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name master-encryption-key --value "$MASTER_KEY" >/dev/null
fi

# REFRESH_TOKEN_SECRET
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name refresh-token-secret >/dev/null 2>&1; then
    echo "Refresh Token Secret exists."
else
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
echo "Check $APP_SERVICE_URL/health to verify."
