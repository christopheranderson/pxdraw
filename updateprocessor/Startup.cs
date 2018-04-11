// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR
{
    using Microsoft.ApplicationInsights;
    using Microsoft.AspNetCore.Builder;
    using Microsoft.AspNetCore.Hosting;
    using Microsoft.Extensions.Configuration;
    using Microsoft.Extensions.DependencyInjection;
    using PxDRAW.SignalR.Hubs;
    using PxDRAW.SignalR.Models;

    internal class Startup
    {
        public Startup(IConfiguration configuration, TelemetryClient telemetryClient)
        {
            this.Configuration = configuration;
            this.InsightsClient = telemetryClient;
        }

        public IConfiguration Configuration { get; }

        public TelemetryClient InsightsClient { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSignalR();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, IApplicationLifetime applicationLifetime)
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
        }

        protected void DisposeResources()
        {
            // Stop the Change Feed Processor
        }

        private CosmosDbConfiguration BuildConfigurationForSection(string sectionName)
        {
            CosmosDbConfiguration cosmosDbConfiguration = new CosmosDbConfiguration();
            this.Configuration.GetSection(sectionName).Bind(cosmosDbConfiguration);
            return cosmosDbConfiguration;
        }
    }
}
