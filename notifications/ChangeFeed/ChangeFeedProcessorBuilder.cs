// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.ChangeFeed
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;
    using Microsoft.Azure.Documents.ChangeFeedProcessor;
    using Microsoft.Azure.Documents.Client;
    using PxDRAW.SignalR.Models;

    internal class ChangeFeedProcessorBuilder
    {
        private DocumentCollectionInfo monitoredCollection;
        private DocumentCollectionInfo leasesCollection;
        private string leasesPrefix;
        private string hostName;

        public ChangeFeedProcessorBuilder WithMonitoredCollection(CosmosDbConfiguration cosmosDbConfiguration)
        {
            this.monitoredCollection = new DocumentCollectionInfo()
            {
                DatabaseName = "pxdraw",
                CollectionName = "pixels",
                ConnectionPolicy = ChangeFeedProcessorBuilder.BuildConnectionPolicy(cosmosDbConfiguration),
                Uri = new Uri(cosmosDbConfiguration.Endpoint),
                MasterKey = cosmosDbConfiguration.MasterKey,
            };

            return this;
        }

        public ChangeFeedProcessorBuilder WithLeasesCollection(CosmosDbConfiguration cosmosDbConfiguration)
        {
            this.leasesCollection = new DocumentCollectionInfo()
            {
                DatabaseName = "pxdraw",
                CollectionName = "leases",
                ConnectionPolicy = ChangeFeedProcessorBuilder.BuildConnectionPolicy(cosmosDbConfiguration),
                Uri = new Uri(cosmosDbConfiguration.Endpoint),
                MasterKey = cosmosDbConfiguration.MasterKey,
            };

            return this;
        }

        public ChangeFeedProcessorBuilder WithLeasePrefix(string prefix)
        {
            this.leasesPrefix = prefix;
            return this;
        }

        public ChangeFeedProcessorBuilder WithHostName(string hostName)
        {
            this.hostName = hostName;
            return this;
        }

        public ChangeFeedEventHost Build()
        {
            if (string.IsNullOrEmpty(this.leasesPrefix))
            {
                throw new ArgumentNullException(nameof(this.leasesPrefix));
            }

            if (string.IsNullOrEmpty(this.hostName))
            {
                throw new ArgumentNullException(nameof(this.hostName));
            }

            if (this.monitoredCollection == null)
            {
                throw new ArgumentNullException(nameof(this.monitoredCollection));
            }

            if (this.leasesCollection == null)
            {
                throw new ArgumentNullException(nameof(this.leasesCollection));
            }

            ChangeFeedOptions feedOptions = new ChangeFeedOptions();
            ChangeFeedHostOptions feedHostOptions = new ChangeFeedHostOptions()
            {
                LeasePrefix = this.leasesPrefix,
            };

            ChangeFeedEventHost host = new ChangeFeedEventHost(this.hostName, this.monitoredCollection, this.leasesCollection, feedOptions, feedHostOptions);
            return host;
        }

        private static ConnectionPolicy BuildConnectionPolicy(CosmosDbConfiguration cosmosDbConfiguration)
        {
            if (cosmosDbConfiguration.Endpoint.Contains("localhost"))
            {
                // Emulator does not support Direct/TCP
                return new ConnectionPolicy();
            }

            ConnectionPolicy connectionPolicy = new ConnectionPolicy()
            {
                ConnectionMode = ConnectionMode.Direct,
                ConnectionProtocol = Protocol.Tcp,
            };

            foreach (var region in cosmosDbConfiguration.ValidatedPreferredLocations)
            {
                connectionPolicy.PreferredLocations.Add(region);
            }

            return connectionPolicy;
        }
    }
}
