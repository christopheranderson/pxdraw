# ARM template for PxDraw

## Things you have to do after deploying

- Cosmos DB
	- DB/Collection creation
- Storage
	- Create container & set access level to blob anonymous
	- CORS
	- CacheControl (need to creat board first (see below))
- UpdateProcessor
	- Hit the reset board API to create initial board

## Other notes

Template doesn't create a Cosmos DB or App Insights by default (since we have manys stages sharing 1 db/collection, app insights)

You can create one with this template:

```json
    "app_insights": {
      "name": "[concat(toLower(parameters('base_name')))]"
    },
    "cosmos": {
      "name": "[concat(toLower(parameters('base_name')))]"
    },
```


```json
{
      "comments": "Database for everything",
      "type": "Microsoft.DocumentDB/databaseAccounts",
      "kind": "GlobalDocumentDB",
      "name": "[variables('cosmos').name]",
      "apiVersion": "2015-04-08",
      "location": "[resourceGroup().location]",
      "tags": {
        "defaultExperience": "DocumentDB"
      },
      "scale": null,
      "properties": {
        "databaseAccountOfferType": "Standard",
        "consistencyPolicy": {
          "defaultConsistencyLevel": "Session",
          "maxIntervalInSeconds": 5,
          "maxStalenessPrefix": 100
        },
        "name": "[variables('cosmos').name]"
      },
      "dependsOn": []
    },
```

App Insights

```json
    {
      "comments": "Application Insights for Everything",
      "type": "microsoft.insights/components",
      "kind": "other",
      "name": "[variables('app_insights').name]",
      "apiVersion": "2015-05-01",
      "location": "westus2",
      "tags": {},
      "properties": {
      },
      "dependsOn": []
    },
```