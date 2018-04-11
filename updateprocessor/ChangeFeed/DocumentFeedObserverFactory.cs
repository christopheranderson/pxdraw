// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.ChangeFeed
{
    using Microsoft.ApplicationInsights;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Azure.Documents.ChangeFeedProcessor;
    using PxDRAW.SignalR.Hubs;

    internal class DocumentFeedObserverFactory : IChangeFeedObserverFactory
    {
        private readonly IHubContext<ClientHub> hubContext;
        private readonly TelemetryClient telemetryClient;

        public DocumentFeedObserverFactory(TelemetryClient telemetryClient, IHubContext<ClientHub> hubContext)
        {
            this.hubContext = hubContext;
            this.telemetryClient = telemetryClient;
        }

        public IChangeFeedObserver CreateObserver()
        {
            return new DocumentFeedObserver(this.telemetryClient, this.hubContext);
        }
    }
}
