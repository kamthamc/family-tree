#!/bin/bash
# Secure remote debugging with SQLite database download

set -e

echo "🔐 Logging into Azure..."
az login --use-device-code

echo ""
RESOURCE_GROUP="familytree-rg"
VAULT_NAME="familytree-vault"
STORAGE_ACCOUNT=$(az storage account list -g $RESOURCE_GROUP --query "[0].name" -o tsv)

echo "🔑 Fetching secrets from Azure Key Vault..."
MASTER_KEY=$(az keyvault secret show \
  --vault-name $VAULT_NAME \
  --name master-encryption-key \
  --query value -o tsv)

echo "✅ Secrets retrieved"

echo ""
echo "📥 Downloading SQLite database from Azure Files..."
mkdir -p ./data

# Download database file
az storage file download \
  --account-name $STORAGE_ACCOUNT \
  --share-name database \
  --path family.sqlite \
  --dest ./data/family.sqlite \
  --auth-mode login

echo "✅ Database downloaded to ./data/family.sqlite"

echo ""
echo "📝 Creating .env.local with local database..."

cat > .env.local << EOF
# Remote debugging configuration (local SQLite copy)
# Generated: $(date)

DATABASE_URL=./data/family.sqlite
MASTER_ENCRYPTION_KEY=$MASTER_KEY
JWT_SECRET=local-dev-secret
JWT_EXPIRY=15m
REFRESH_TOKEN_SECRET=local-refresh-secret
REFRESH_TOKEN_EXPIRY=7d
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173
EOF

echo "✅ .env.local created"
echo ""
echo "⚠️  WARNING: You're working with a COPY of the production database"
echo "   Changes will NOT sync back to Azure automatically"
echo ""
echo "🚀 Starting local development server..."
echo "   Press Ctrl+C to stop"
echo ""

# Start development server
bun run dev
