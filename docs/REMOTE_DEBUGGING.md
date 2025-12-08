# Remote Debugging Guide (SQLite + Azure Files)

## Data Persistence

✅ **Your data is safe!** The SQLite database is stored in Azure Files, which persists across redeployments.

### How it works:
```
App Service Container → Mounts Azure Files at /mnt/database
                     → SQLite file: /mnt/database/family.sqlite
                     → Persists even when container restarts
```

## Secure Remote Debugging

### Quick Start

```bash
# Download database and start local debugging
cd server
./debug-remote.sh
```

This will:
1. Login to Azure
2. Fetch encryption keys from Key Vault
3. Download SQLite database from Azure Files
4. Create `.env.local` with proper configuration
5. Start local development server

### Manual Database Operations

**Download database:**
```bash
az storage file download \
  --account-name <storage-account> \
  --share-name database \
  --path family.sqlite \
  --dest ./data/family.sqlite \
  --auth-mode login
```

**Upload database (after local changes):**
```bash
./upload-database.sh
```

**⚠️ Important:** Always create a backup before uploading!

### Database Backups

**Automated backups** (recommended):
```bash
# Set up daily backup with Azure Automation
az automation schedule create \
  --resource-group familytree-rg \
  --automation-account-name familytree-automation \
  --name DailyBackup \
  --frequency Day \
  --interval 1
```

**Manual backup:**
```bash
# Download and save with timestamp
az storage file download \
  --account-name <storage-account> \
  --share-name database \
  --path family.sqlite \
  --dest "backup-$(date +%Y%m%d).sqlite" \
  --auth-mode login
```

## View Application Logs

```bash
# Stream live logs
az webapp log tail \
  --resource-group familytree-rg \
  --name familytree-app

# Download logs
az webapp log download \
  --resource-group familytree-rg \
  --name familytree-app \
  --log-file logs.zip
```

## Restore from Backup

```bash
# Upload backup file
az storage file upload \
  --account-name <storage-account> \
  --share-name database \
  --source backup-20231207.sqlite \
  --path family.sqlite \
  --auth-mode login

# Restart app
az webapp restart \
  --resource-group familytree-rg \
  --name familytree-app
```

## Security Best Practices

1. **Never commit `.env.local`** - Already in .gitignore
2. **Use Azure Key Vault** for all secrets
3. **Download database to debug** - Don't expose database publicly
4. **Always backup before uploading** - Automated in upload script
5. **Monitor access logs** via Application Insights

## Troubleshooting

**Database locked error:**
- Azure Files may lock the database during writes
- Solution: Enable WAL mode in SQLite (already configured)

**Slow performance:**
- Azure Files has ~60ms latency
- For production with high traffic, consider migrating to Azure SQL

**Connection issues:**
- Verify App Service has system-assigned identity
- Check Key Vault access policies
- Ensure storage account firewall allows Azure services
