#!/bin/bash
# Upload local database changes back to Azure

set -e

echo "📤 Uploading database to Azure Files..."

RESOURCE_GROUP="familytree-rg"
STORAGE_ACCOUNT=$(az storage account list -g $RESOURCE_GROUP --query "[0].name" -o tsv)

# Backup current remote database first
echo "💾 Creating backup of remote database..."
BACKUP_NAME="family-backup-$(date +%Y%m%d-%H%M%S).sqlite"

az storage file download \
  --account-name $STORAGE_ACCOUNT \
  --share-name database \
  --path family.sqlite \
  --dest "./data/$BACKUP_NAME" \
  --auth-mode login

echo "✅ Backup created: ./data/$BACKUP_NAME"

# Upload new database
echo "📤 Uploading local database..."
az storage file upload \
  --account-name $STORAGE_ACCOUNT \
  --share-name database \
  --source ./data/family.sqlite \
  --path family.sqlite \
  --auth-mode login

echo "✅ Database uploaded successfully"
echo ""
echo "⚠️  IMPORTANT: Restart the Azure App Service to use the new database"
echo "   Run: az webapp restart -g $RESOURCE_GROUP -n familytree-app"
