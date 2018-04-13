// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.ChangeFeed
{
    using System;
    using System.Globalization;
    using System.Linq;
    using System.Runtime.ExceptionServices;
    using System.Threading;
    using System.Threading.Tasks;
    using Microsoft.ApplicationInsights;
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
        private readonly TelemetryClient telemetryClient;
        private readonly CosmosDbConfiguration cosmosDbConfiguration;
        private bool isRunning = false;
        private IHubContext<ClientHub> signalRHubContext;
        private DocumentClient documentClient;
        private Uri collectionLink;

        public ChangeFeedReader(TelemetryClient telemetryClient, IConfiguration configuration, IHubContext<ClientHub> signalRHubContext)
        {
            var cosmosDbConfiguration = ChangeFeedReader.BuildConfigurationForSection(configuration, "CosmosDB");
            this.telemetryClient = telemetryClient;
            this.cosmosDbConfiguration = cosmosDbConfiguration;
            this.signalRHubContext = signalRHubContext;
            this.telemetryClient.TrackEvent($"Detected configuration for PxDRAW collection: {cosmosDbConfiguration.ToString()}");
        }

        public Task StartAsync(CancellationToken cancellation)
        {
            // TODO: read latest LSN from Blob
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
            TimeSpan feedPollDelay = TimeSpan.FromSeconds(this.cosmosDbConfiguration.PollingInterval.HasValue ? this.cosmosDbConfiguration.PollingInterval.Value : 5);
            return Task.Run(async () =>
            {
                this.telemetryClient.TrackEvent($"Task running.");
                ChangeFeedOptions options = new ChangeFeedOptions
                {
                    MaxItemCount = -1,
                    StartFromBeginning = true,
                    PartitionKeyRangeId = "0",
                };

                while (this.isRunning)
                {
                    IDocumentQuery<Document> query = this.documentClient.CreateDocumentChangeFeedQuery(this.collectionLink, options);

                    do
                    {
                        ExceptionDispatchInfo exceptionDispatchInfo = null;
                        FeedResponse<Document> readChangesResponse = null;
                        try
                        {
                            readChangesResponse = await query.ExecuteNextAsync<Document>();
                            options.RequestContinuation = readChangesResponse.ResponseContinuation;
                        }
                        catch (DocumentClientException ex)
                        {
                            exceptionDispatchInfo = ExceptionDispatchInfo.Capture(ex);
                        }

                        if (exceptionDispatchInfo != null)
                        {
                            DocumentClientException dcex = (DocumentClientException)exceptionDispatchInfo.SourceException;

                            if ((StatusCode)dcex.StatusCode == StatusCode.NotFound && (SubStatusCode)this.GetSubStatusCode(dcex) != SubStatusCode.ReadSessionNotAvailable)
                            {
                                 // Most likely, the database or collection was removed while we were enumerating.
                                this.telemetryClient.TrackException(dcex);
                                this.isRunning = false;
                                break;
                            }
                            else if ((StatusCode)dcex.StatusCode == StatusCode.Gone)
                            {
                                SubStatusCode subStatusCode = (SubStatusCode)this.GetSubStatusCode(dcex);
                                this.telemetryClient.TrackException(dcex);
                            }
                            else if ((StatusCode)dcex.StatusCode == StatusCode.TooManyRequests ||
                                 (StatusCode)dcex.StatusCode == StatusCode.ServiceUnavailable)
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
                                    exceptionDispatchInfo.Throw();
                                }

                                 options.MaxItemCount /= 2;
                                 this.telemetryClient.TrackEvent($"Reducing maxItemCount, new value: {options.MaxItemCount}.");
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
                            this.telemetryClient.TrackTrace($"Detected {results.Count} documents.");
                            if (results.Count > 0)
                            {
                                await this.signalRHubContext.Clients.All.SendAsync("Changes", JsonConvert.SerializeObject(results));
                            }
                            else
                            {
                                await Task.Delay(feedPollDelay, cancellation);
                            }
                        }
                    }
                    while (query.HasMoreResults && this.isRunning);

                    this.telemetryClient.TrackEvent($"Loop {this.isRunning}.");
                }
            });
        }

        public Task StopAsync(CancellationToken cancellation)
        {
            this.telemetryClient.TrackEvent($"Task end.");
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
                // Emulator does not support Direct/TCP
                return connectionPolicy;
            }

            foreach (var region in cosmosDbConfiguration.ValidatedPreferredLocations)
            {
                connectionPolicy.PreferredLocations.Add(region);
            }

            return connectionPolicy;
        }

        private int GetSubStatusCode(DocumentClientException exception)
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
