#!/bin/bash
set -e

# Configuration
RG_NAME="${1:-rg-familytree-prod-centralindia}"
LOCATION="${2:-centralindia}"
APP_NAME="${3:-familytreeapp}" # Should match your Bicep/Deploy naming
GITHUB_REPO="${4:-chaitanyakkamatham/family-tree}" # CHANGE THIS to your actual repo "user/repo"

IDENTITY_NAME="id-${APP_NAME}-github"

echo "Creating User Assigned Identity: $IDENTITY_NAME in $RG_NAME..."

# 1. Create Identity (if not exists, idempotent)
az identity create --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" --location "${LOCATION}"

# Get Client ID and Principal ID
CLIENT_ID=$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" --query 'clientId' -o tsv)
PRINCIPAL_ID=$(az identity show --name "${IDENTITY_NAME}" --resource-group "${RG_NAME}" --query 'principalId' -o tsv)
SUBSCRIPTION_ID=$(az account show --query 'id' -o tsv)
TENANT_ID=$(az account show --query 'tenantId' -o tsv)

echo "Identity Created."
echo "  Client ID: $CLIENT_ID"
echo "  Principal ID: $PRINCIPAL_ID"

# 2. Creating Federated Credential (for Main branch)
echo "Creating Federated Credential for 'main' branch..."
az identity federated-credential create \
  --name "github-actions-main" \
  --identity-name "${IDENTITY_NAME}" \
  --resource-group "${RG_NAME}" \
  --issuer "https://token.actions.githubusercontent.com" \
  --subject "repo:${GITHUB_REPO}:ref:refs/heads/main" \
  --audience "api://AzureADTokenExchange" \
  || echo "Credential might already exist, skipping..."

# 3. Assign Permissions (Contributor on Resource Group)
echo "Assigning Contributor role to Identity on Resource Group..."
az role assignment create \
  --assignee "$PRINCIPAL_ID" \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RG_NAME}" \
  || echo "Role assignment might already exist."

# 4. Output for GitHub Secrets
echo ""
echo "--------------------------------------------------------"
echo "SETUP COMPLETE!"
echo "--------------------------------------------------------"
echo "Please add the following secrets/vars to your GitHub Repository:"
echo ""
echo "AZURE_CLIENT_ID:       $CLIENT_ID"
echo "AZURE_TENANT_ID:       $TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo ""
echo "Use the updated workflow file."
echo "--------------------------------------------------------"
