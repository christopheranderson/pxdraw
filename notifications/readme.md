# PxDRAW Notification service

This service acts as a notification layer, creating a SignalR host and a IHostedService that polls the collection's Change Feed for changes and notifies all the connected SignalR clients.

## Local set up instructions

### Requirements

* Visual Studio 2017 15.7 or [ASP.NET Core 2.1 Preview 2 SDK & Runtime](https://www.microsoft.com/net/download/all).
* Azure Cosmos DB Emulator

Create a collection named `pixels` within a `pxdraw` database. All inserts/updates happening in that collection will be notified.

To configure a different collection, please see [appsettings.Development.json](./appsettings.Development.json).

* CosmosDB > DatabaseName: Name of the database where changes will occur.
* CosmosDB > CollectionName: Name of the database where changes will occur.
* CosmosDB > PreferredLocations: Comma separated list of [PreferredLocations](https://docs.microsoft.com/dotnet/api/microsoft.azure.documents.client.connectionpolicy.preferredlocations?view=azure-dotnet).
* CosmosDB > Endpoint: Cosmos DB Account endpoint.
* CosmosDB > MasterKey: Cosmos DB Account master key.

## Deploy instructions

TBD

## LICENSE

[MIT](../LICENSE)