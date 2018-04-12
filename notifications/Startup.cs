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
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using PxDRAW.SignalR.ChangeFeed;
    using PxDRAW.SignalR.Hubs;
    using PxDRAW.SignalR.Models;

    internal class Startup
    {
        public Startup(IConfiguration configuration, TelemetryClient telemetryClient, IHostingEnvironment env, IServiceProvider serviceProvider)
        {
            this.Configuration = configuration;
            this.InsightsClient = telemetryClient;
        }

        public IConfiguration Configuration { get; }

        public TelemetryClient InsightsClient { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSignalR();
            services.AddSingleton<IChangeFeedReader>(new ChangeFeedReader(this.InsightsClient, this.BuildConfigurationForSection("CosmosDB")));
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, IApplicationLifetime applicationLifetime, IHubContext<ClientHub> signalRHubContext, IChangeFeedReader changeFeedReader)
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

            changeFeedReader.RegisterHub(signalRHubContext);
            changeFeedReader.Start();
        }

        private CosmosDbConfiguration BuildConfigurationForSection(string sectionName)
        {
            CosmosDbConfiguration cosmosDbConfiguration = new CosmosDbConfiguration();
            this.Configuration.GetSection(sectionName).Bind(cosmosDbConfiguration);
            return cosmosDbConfiguration;
        }
    }
}
