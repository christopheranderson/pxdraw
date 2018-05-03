// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.ChangeFeed
{
    using System;
    using System.Collections.Generic;
    using System.Globalization;
    using System.Linq;
    using System.Net;
    using System.Runtime.ExceptionServices;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.ApplicationInsights;
    using Microsoft.ApplicationInsights.DataContracts;
    using Microsoft.ApplicationInsights.DependencyCollector;
    using Microsoft.ApplicationInsights.Extensibility;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Azure.Documents;
    using Microsoft.Azure.Documents.Client;
    using Microsoft.Azure.Documents.Linq;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.Hosting;
    using Newtonsoft.Json;
    using PxDRAW.SignalR.Hubs;
    using PxDRAW.SignalR.Models;

    internal class ChangeFeedReader : IHostedService
    {
        private const int DefaultMaxItemCount = 100;

        // Polling delay is used when there are no changes in the feed
        private const int DefaultPollingIntervalInMilliseconds = 50;
        private readonly TelemetryClient telemetryClient;
        private readonly CosmosDbConfiguration cosmosDbConfiguration;
        private bool isRunning = false;
        private IHubContext<ClientHub> signalRHubContext;
        private DocumentClient documentClient;
        private Uri collectionLink;

        public ChangeFeedReader(IConfiguration configuration, IHubContext<ClientHub> signalRHubContext)
        {
            var cosmosDbConfiguration = ChangeFeedReader.BuildConfigurationForSection(configuration, "CosmosDB");
            this.cosmosDbConfiguration = cosmosDbConfiguration;
            this.signalRHubContext = signalRHubContext;
            TelemetryConfiguration telemetryConfiguration = TelemetryConfiguration.Active;
            telemetryConfiguration.InstrumentationKey = ChangeFeedReader.DetectAppInsightsInstrumentationKey(configuration);
            telemetryConfiguration.TelemetryInitializers.Add(new OperationCorrelationTelemetryInitializer());
            telemetryConfiguration.TelemetryInitializers.Add(new HttpDependenciesParsingTelemetryInitializer());
            this.telemetryClient = new TelemetryClient();
        }

        public Task StartAsync(CancellationToken cancellation)
        {
            if (this.isRunning)
            {
                return Task.CompletedTask;
            }

            if (this.documentClient == null)
            {
                this.telemetryClient.TrackEvent($"Creating DocumentClient...");
                this.documentClient = new DocumentClient(new Uri(this.cosmosDbConfiguration.Endpoint), this.cosmosDbConfiguration.MasterKey, ChangeFeedReader.BuildConnectionPolicy(this.cosmosDbConfiguration));
                this.collectionLink = UriFactory.CreateDocumentCollectionUri(this.cosmosDbConfiguration.DatabaseName, this.cosmosDbConfiguration.CollectionName);
                this.telemetryClient.TrackEvent($"DocumentClient ready.");
            }

            this.isRunning = true;
            TimeSpan feedPollDelay = TimeSpan.FromMilliseconds(this.cosmosDbConfiguration.PollingInterval.HasValue ? this.cosmosDbConfiguration.PollingInterval.Value : ChangeFeedReader.DefaultPollingIntervalInMilliseconds);
            return Task.Run(async () =>
            {
                this.telemetryClient.TrackEvent($"ChangeFeedReader running.");
                ChangeFeedOptions options = new ChangeFeedOptions
                {
                    MaxItemCount = -1,
                    PartitionKeyRangeId = "0",
                };

                while (this.isRunning)
                {
                    IDocumentQuery<Document> query = this.documentClient.CreateDocumentChangeFeedQuery(this.collectionLink, options);

                    do
                    {
                        ExceptionDispatchInfo exceptionDispatchInfo = null;
                        FeedResponse<Document> readChangesResponse = null;
                        var operation = this.telemetryClient.StartOperation(new RequestTelemetry() { Name = "ChangeFeedReader.ReadFeed" });
                        DateTimeOffset feedDependencyStartTime = DateTimeOffset.UtcNow;
                        try
                        {
                            readChangesResponse = await query.ExecuteNextAsync<Document>();
                            this.telemetryClient.TrackDependency("CosmosDB.ChangeFeed", "ExecuteNextAsync", feedDependencyStartTime, DateTimeOffset.UtcNow.Subtract(feedDependencyStartTime), true);
                            options.RequestContinuation = readChangesResponse.ResponseContinuation;
                        }
                        catch (DocumentClientException ex)
                        {
                            exceptionDispatchInfo = ExceptionDispatchInfo.Capture(ex);
                            this.telemetryClient.TrackDependency("CosmosDB.ChangeFeed", "ExecuteNextAsync", feedDependencyStartTime, DateTimeOffset.UtcNow.Subtract(feedDependencyStartTime), false);
                        }

                        if (exceptionDispatchInfo != null)
                        {
                            DocumentClientException dcex = (DocumentClientException)exceptionDispatchInfo.SourceException;

                            if ((HttpStatusCode)dcex.StatusCode == HttpStatusCode.NotFound && (SubStatusCode)ChangeFeedReader.GetSubStatusCode(dcex) != SubStatusCode.ReadSessionNotAvailable)
                            {
                                 // Most likely, the database or collection was removed while we were enumerating.
                                this.telemetryClient.TrackException(dcex);
                                this.telemetryClient.StopOperation(operation);
                                this.isRunning = false;
                                break;
                            }
                            else if ((HttpStatusCode)dcex.StatusCode == HttpStatusCode.Gone)
                            {
                                SubStatusCode subStatusCode = (SubStatusCode)ChangeFeedReader.GetSubStatusCode(dcex);
                                this.telemetryClient.TrackException(dcex);
                            }
                            else if ((int)dcex.StatusCode == 429 ||
                                 (HttpStatusCode)dcex.StatusCode == HttpStatusCode.ServiceUnavailable)
                            {
                                this.telemetryClient.TrackEvent($"Retriable exception: {dcex.Message}");
                            }
                            else if (dcex.Message.Contains("Reduce page size and try again."))
                            {
                                // Temporary workaround to compare exception message, until server provides better way of handling this case.
                                if (!options.MaxItemCount.HasValue)
                                {
                                    options.MaxItemCount = DefaultMaxItemCount;
                                }
                                else if (options.MaxItemCount <= 1)
                                {
                                    this.telemetryClient.TrackEvent($"Cannot reduce maxItemCount further as it's already at {options.MaxItemCount}.");
                                    this.telemetryClient.TrackException(new Exception("Cannot reduce maxItemCount"));
                                }
                                else
                                {
                                    options.MaxItemCount /= 2;
                                    this.telemetryClient.TrackEvent($"Reducing maxItemCount, new value: {options.MaxItemCount}.");
                                }
                            }
                            else
                            {
                                this.telemetryClient.TrackException(dcex);
                            }

                            await Task.Delay(dcex.RetryAfter != TimeSpan.Zero ? dcex.RetryAfter : feedPollDelay, cancellation);
                        }

                        if (readChangesResponse != null)
                        {
                            var results = readChangesResponse.ToList();
                            if (results.Count > 0)
                            {
                                this.telemetryClient.TrackTrace($"Detected {results.Count} documents.");
                                DateTimeOffset signalRDependencyStartTime = DateTimeOffset.UtcNow;
                                try
                                {
                                    var response = results.Select((d) => new
                                    {
                                        items = d.GetPropertyValue<List<Pixel>>("items"),
                                        _lsn = d.GetPropertyValue<long>("_lsn"),
                                    });

                                    await this.signalRHubContext.Clients.All.SendAsync("Changes", JsonConvert.SerializeObject(response));
                                    this.telemetryClient.TrackDependency("SignalR", "SendAsync", signalRDependencyStartTime, DateTimeOffset.UtcNow.Subtract(signalRDependencyStartTime), true);
                                }
                                catch (Exception ex)
                                {
                                    this.telemetryClient.TrackException(ex);
                                    this.telemetryClient.TrackDependency("SignalR", "SendAsync", signalRDependencyStartTime, DateTimeOffset.UtcNow.Subtract(signalRDependencyStartTime), false);
                                }
                                this.telemetryClient.StopOperation(operation);
                                this.telemetryClient.Flush();
                            }
                            else
                            {
                                this.telemetryClient.StopOperation(operation);
                                this.telemetryClient.Flush();
                                await Task.Delay(feedPollDelay, cancellation);
                            }
                        }
                        else
                        {
                            this.telemetryClient.StopOperation(operation);
                            this.telemetryClient.Flush();
                        }
                    }
                    while (query.HasMoreResults && this.isRunning);
                }
            });
        }

        public Task StopAsync(CancellationToken cancellation)
        {
            this.telemetryClient.TrackEvent($"ChangeFeedReader shutting down.");
            this.telemetryClient.Flush();
            this.isRunning = false;
            return Task.CompletedTask;
        }

        private static CosmosDbConfiguration BuildConfigurationForSection(IConfiguration configuration, string sectionName)
        {
            CosmosDbConfiguration cosmosDbConfiguration = new CosmosDbConfiguration();
            configuration.GetSection(sectionName).Bind(cosmosDbConfiguration);
            return cosmosDbConfiguration;
        }

        private static ConnectionPolicy BuildConnectionPolicy(CosmosDbConfiguration cosmosDbConfiguration)
        {
            ConnectionPolicy connectionPolicy = new ConnectionPolicy();

            if (cosmosDbConfiguration.Endpoint.Contains("localhost"))
            {
                // Emulator does not support PreferredLocations
                return connectionPolicy;
            }

            foreach (var region in cosmosDbConfiguration.ValidatedPreferredLocations)
            {
                connectionPolicy.PreferredLocations.Add(region);
            }

            return connectionPolicy;
        }

        private static string DetectAppInsightsInstrumentationKey(IConfiguration configuration)
        {
            return configuration.GetSection("ApplicationInsights")?.GetValue<string>("InstrumentationKey", string.Empty) ?? string.Empty;
        }

        private static int GetSubStatusCode(DocumentClientException exception)
        {
            const string SubStatusHeaderName = "x-ms-substatus";
            string valueSubStatus = exception.ResponseHeaders.Get(SubStatusHeaderName);
            if (!string.IsNullOrEmpty(valueSubStatus))
            {
                int subStatusCode = 0;
                if (int.TryParse(valueSubStatus, NumberStyles.Integer, CultureInfo.InvariantCulture, out subStatusCode))
                {
                    return subStatusCode;
                }
            }

            return -1;
        }
    }
}
