# PxDRAW Notification service

This service acts as a notification layer, creating a SignalR host and a IHostedService that polls the collection's Change Feed for changes and notifies all the connected SignalR clients.

## Local set up instructions

### Requirements

* Visual Studio 2017 15.7 or [ASP.NET Core 2.1 Preview 2 SDK & Runtime](https://www.microsoft.com/net/download/all).
* Azure Cosmos DB Emulator

Create a collection named `pixels` within a `pxdraw` database. All inserts/updates happening in that collection will be notified.

To configure a different collection, please see [appsettions.Development.json](./appsettions.Development.json).

## Deploy instructions

TBD

## LICENSE

[MIT](../LICENSE)