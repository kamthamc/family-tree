# Azure Deployment Guide

## Prerequisites
- **Azure CLI** (`az`) installed and logged in.
- **Git** repository initiated.

## Rapid Deployment
We provide a generic deployment script that handles Resource Groups, Infrastructure (Bicep), Key Vault policies, and Docker Builds.

```bash
# Deploy to Central India (Production)
./azure/deploy.sh centralindia prod

# Deploy to East US (Dev)
./azure/deploy.sh eastus dev
```

## Infrastructure
- **App Service (Linux/Container)**: Hosts the Bun application.
- **Azure Container Registry (ACR)**: Stores Docker images.
- **Key Vault**: Securely manages secrets (JWT, Encryption Keys).
- **Storage Account (Azure Files)**: Persists the SQLite database (`/mnt/database`).

## Environment Variables
The application does **not** rely on build-time environment variables for API connection.
- Frontend uses relative paths (`/api/...`).
- Backend serves Frontend assets.
- `VITE_API_URL` is only used for local dev (proxied).

## Health & Maintenance
- **Health Check**: `/health` endpoint configured in App Service.
- **Caching**: Static assets are cached aggressively via HTTP headers (Immutable for 1 year).
- **Database Migrations**: Automatically run on container startup (`start.sh`).
