// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR
{
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

        public Startup(IConfiguration configuration, TelemetryClient telemetryClient)
        {
            this.Configuration = configuration;
            this.InsightsClient = telemetryClient;
        }

        public IConfiguration Configuration { get; }

        public TelemetryClient InsightsClient { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            CosmosDbConfiguration cosmosDbConfigurationForMonitoring = this.BuildConfigurationForSection("CosmosDB");
            CosmosDbConfiguration cosmosDbConfigurationForLeases = this.BuildConfigurationForSection("CosmosDBLeases");
            ChangeFeedProcessorBuilder changeFeedProcessorBuilder = new ChangeFeedProcessorBuilder();
            this.changeFeedEventHost = changeFeedProcessorBuilder
                                            .WithHostName("test")
                                            .WithLeasePrefix("test")
                                            .WithMonitoredCollection(cosmosDbConfigurationForMonitoring)
                                            .WithLeasesCollection(cosmosDbConfigurationForLeases).Build();
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

            applicationLifetime.ApplicationStopping.Register(this.DisposeResources);

            DocumentFeedObserverFactory documentFeedObserver = new DocumentFeedObserverFactory(this.InsightsClient, signalRHubContext);
            this.changeFeedEventHost.RegisterObserverFactoryAsync(documentFeedObserver).Wait();
        }

        protected void DisposeResources()
        {
            if (this.changeFeedEventHost != null && this.changeFeedEventHostStarted)
            {
                this.changeFeedEventHost.UnregisterObserversAsync().Wait();
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
