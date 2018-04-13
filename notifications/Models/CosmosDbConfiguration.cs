﻿// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.Models
{
    using System.Linq;

    internal class CosmosDbConfiguration
    {
        public string DatabaseName { get; set; }

        public string CollectionName { get; set; }

        public string Endpoint { get; set; }

        public string MasterKey { get; set; }

        public int? PollingInterval { get; set; }

        public string PreferredLocations { get; set; }

        public string[] ValidatedPreferredLocations
        {
            get => this.PreferredLocations?.Split(',').Select(location => location.Trim()).Where(location => !string.IsNullOrEmpty(location)).ToArray() ?? new string[0];
        }

        public override string ToString() => $"Endpoint:{this.Endpoint}, MasterKey:{this.MasterKey}, CollectionName:{this.CollectionName}, DatabaseName:{this.DatabaseName}";
    }
}
