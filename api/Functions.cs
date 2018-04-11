using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.Azure.WebJobs.Host;
using Microsoft.Extensions.Logging;
using pxdraw.api.models;

namespace pxdraw.api
{
    public static class Functions
    {
        public static string boardId = "default";

        // Returns metadata about all the endpoints 
        [FunctionName("metadata")]
        public static async Task<HttpResponseMessage> Metadata([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = null)]HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            var metadata = new Metadata{
                GetBoardEndpoint = "",
                LoginEndpoint = "",
                UpdatePixelEndpoint = "",
                WebsocketEndpoint = "",
            };

            return req.CreateResponse<Metadata>(HttpStatusCode.OK, metadata); ;
        }

        [FunctionName("update-pixel")]
        public static async Task<HttpResponseMessage> UpdatePixel([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)] HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            string userId;
            try
            {
                // "x-ms-client-principal-id" is the flag that this is a valid token
                userId = req.Headers.FirstOrDefault(h => string.Equals(h.Key, "x-ms-client-principal-id", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault() ?? throw new InvalidOperationException("Principal id header was missing");
            }
            catch (Exception err)
            {
                log.LogError(err);
                log.LogInformation($"Headers {HeadersToString(req.Headers)}");
                return req.CreateErrorResponse(HttpStatusCode.Unauthorized, $"Could not authenticate user. Reference {context.InvocationId} for details.");
            }

            // TODO: User throttling

            try
            {
                Pixel pixel = await req.Content.ReadAsAsync<Pixel>();
            }
            catch (Exception err)
            {
                log.LogError(err);
                return req.CreateErrorResponse(HttpStatusCode.BadRequest, $"Could not create pixel object from body content. Refer to {context.InvocationId} for details.");
            }

            // TODO: Upsert pixel to Cosmos DB

            return req.CreateResponse(HttpStatusCode.Accepted);
        }

        private static string HeadersToString(HttpRequestHeaders headers)
        {
            string output = "";
            foreach (var h in headers)
            {
                foreach (var h2 in h.Value)
                {
                    output += $"{h.Key}: {h2.Substring(0, Math.Min(30, h2.Length))}\n";
                }
            }
            return output;
        }
    }
}
