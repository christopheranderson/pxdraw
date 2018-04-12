// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR
{
    using System;
    using Microsoft.ApplicationInsights;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.AspNetCore.SignalR;
    using Microsoft.Azure.Documents.ChangeFeedProcessor;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using PxDRAW.SignalR.ChangeFeed;
    using PxDRAW.SignalR.Hubs;
    using PxDRAW.SignalR.Models;

    internal class Startup
    {
        private ChangeFeedEventHost changeFeedEventHost;
        private bool changeFeedEventHostStarted = false;
        private string environmentIdentifier;

        public Startup(IConfiguration configuration, TelemetryClient telemetryClient, IHostingEnvironment env)
        {
            this.Configuration = configuration;
            this.InsightsClient = telemetryClient;
            var computerName = Environment.GetEnvironmentVariable("COMPUTERNAME") ?? string.Empty;
            this.environmentIdentifier = $"{env.ApplicationName}-{computerName}";
        }

        public IConfiguration Configuration { get; }

        public TelemetryClient InsightsClient { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            try
            {
                string hostName = Guid.NewGuid().ToString();
                this.InsightsClient.TrackEvent($"Creating ChangeFeedEventHost in environment {this.environmentIdentifier}...");
                CosmosDbConfiguration cosmosDbConfigurationForMonitoring = this.BuildConfigurationForSection("CosmosDB");
                CosmosDbConfiguration cosmosDbConfigurationForLeases = this.BuildConfigurationForSection("CosmosDBLeases");
                this.InsightsClient.TrackEvent($"Detected configuration for PxDRAW collection: {cosmosDbConfigurationForMonitoring.ToString()}");
                this.InsightsClient.TrackEvent($"Detected configuration for PxDRAW leases: {cosmosDbConfigurationForLeases.ToString()}");
                ChangeFeedProcessorBuilder changeFeedProcessorBuilder = new ChangeFeedProcessorBuilder();
                this.changeFeedEventHost = changeFeedProcessorBuilder
                                                .WithHostName(hostName)
                                                .WithLeasePrefix(this.environmentIdentifier)
                                                .WithMonitoredCollection(cosmosDbConfigurationForMonitoring)
                                                .WithLeasesCollection(cosmosDbConfigurationForLeases).Build();
                this.InsightsClient.TrackEvent("ChangeFeedEventHost created.");
            }
            catch (System.Exception ex)
            {
                this.InsightsClient.TrackException(ex);
            }

            services.AddSignalR();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, IApplicationLifetime applicationLifetime, IHubContext<ClientHub> signalRHubContext)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            app.UseDefaultFiles();
            app.UseStaticFiles();
            app.UseSignalR(routes =>
            {
                routes.MapHub<ClientHub>("/hubs/chat");
            });

            applicationLifetime.ApplicationStopping.Register(this.OnStop);
            try
            {
                this.InsightsClient.TrackEvent("Initializing ChangeFeedEventHost...");
                DocumentFeedObserverFactory documentFeedObserver = new DocumentFeedObserverFactory(this.InsightsClient, signalRHubContext);
                this.changeFeedEventHost.RegisterObserverFactoryAsync(documentFeedObserver).Wait();
                this.changeFeedEventHostStarted = true;
                this.InsightsClient.TrackEvent("ChangeFeedEventHost initialized.");
            }
            catch (System.Exception ex)
            {
                this.InsightsClient.TrackException(ex);
            }
        }

        protected void OnStop()
        {
            try
            {
                if (this.changeFeedEventHost != null && this.changeFeedEventHostStarted)
                {
                    this.InsightsClient.TrackEvent("Stopping ChangeFeedEventHost...");
                    this.changeFeedEventHost.UnregisterObserversAsync().Wait();
                    this.InsightsClient.TrackEvent("ChangeFeedEventHost stopped.");
                }
            }
            catch (System.Exception ex)
            {
                this.InsightsClient.TrackException(ex);
            }
        }

        private CosmosDbConfiguration BuildConfigurationForSection(string sectionName)
        {
            CosmosDbConfiguration cosmosDbConfiguration = new CosmosDbConfiguration();
            this.Configuration.GetSection(sectionName).Bind(cosmosDbConfiguration);
            return cosmosDbConfiguration;
        }
    }
}
