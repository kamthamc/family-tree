param location string = 'eastus'
param appName string = 'familytree'

// Storage Account for SQLite database file
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'st${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Cool'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// File Share for database
resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  name: '${storageAccount.name}/default/database'
  properties: {
    shareQuota: 5 // 5 GB
    enabledProtocols: 'SMB'
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  sku: {
    name: 'B1' // Basic tier
    tier: 'Basic'
  }
  properties: {
    reserved: true // Required for Linux
  }
}

// Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: 'acr${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// Key Vault for secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: '${appName}-vault'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: []
    enableRbacAuthorization: false
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2022-09-01' = {
  name: '${appName}-app'
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistry.properties.loginServer}/familytree:latest'
      healthCheckPath: '/health'
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'true'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistry.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: containerRegistry.listCredentials().username
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: containerRegistry.listCredentials().passwords[0].value
        }
        {
          name: 'DATABASE_URL'
          value: '/mnt/database/family.sqlite'
        }
        {
          name: 'MASTER_ENCRYPTION_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=master-encryption-key)'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=jwt-secret)'
        }
        {
          name: 'REFRESH_TOKEN_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=refresh-token-secret)'
        }
      ]
      azureStorageAccounts: {
        database: {
          type: 'AzureFiles'
          accountName: storageAccount.name
          shareName: 'database'
          mountPath: '/mnt/database'
          accessKey: storageAccount.listKeys().keys[0].value
        }
      }
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Grant App Service access to Key Vault
resource keyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-02-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: appService.identity.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output containerRegistryUrl string = containerRegistry.properties.loginServer
output keyVaultName string = keyVault.name
output storageAccountName string = storageAccount.name
