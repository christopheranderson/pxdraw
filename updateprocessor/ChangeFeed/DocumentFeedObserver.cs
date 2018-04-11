// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.ChangeFeed
{
    using System.Collections.Generic;
    using System.Linq;
    using System.Reflection.Metadata;
    using System.Threading.Tasks;
    using Microsoft.ApplicationInsights;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Azure.Documents.ChangeFeedProcessor;
    using PxDRAW.SignalR.Hubs;

    internal class DocumentFeedObserver
    {
        private readonly IHubContext<ClientHub> hubContext;
        private readonly TelemetryClient telemetryClient;

        public DocumentFeedObserver(TelemetryClient telemetryClient, IHubContext<ClientHub> hubContext)
        {
            this.hubContext = hubContext;
            this.telemetryClient = telemetryClient;
        }

        public Task OpenAsync(ChangeFeedObserverContext context)
        {
            this.telemetryClient.TrackTrace($"Observer opened, PartitionRange {context.PartitionKeyRangeId}");
            return Task.CompletedTask;
        }

        public Task CloseAsync(ChangeFeedObserverContext context, ChangeFeedObserverCloseReason reason)
        {
            this.telemetryClient.TrackTrace($"Observer closed, {context.PartitionKeyRangeId}");
            this.telemetryClient.TrackTrace($"Reason for shutdown, {reason}");
            return Task.CompletedTask;
        }

        public async Task ProcessChangesAsync(ChangeFeedObserverContext context, IReadOnlyList<Document> documents)
        {
            await this.hubContext.Clients.All.SendAsync("Changes", documents.ToList());
        }
        }
}
