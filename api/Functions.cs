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
using pxdraw.api.services;

namespace pxdraw.api
{
    public static class Functions
    {
        public static string boardId = "default";

        /// <summary>
        /// Retrieves metadata about current pxdraw application
        /// 
        /// GET /api/metadata
        /// 
        /// Returns
        /// Status Codes:
        /// - 200 if the request was a success.
        /// - 5xx indicates the service is unhealthy.
        /// Content-type: application/json; utf8
        /// Body:
        /// {
        ///     "getBoardEndpoint":string - uri for the board blob,
        ///     "loginEndpoint":string - uri for the login endpoint,
        ///     "updatePixelEndpoint":string - uri for the update pixel endpoint,
        ///     "websocketEndpoint":string - uri for the SignalR pixel update notifications endpoint
        /// }
        /// 
        /// </summary>
        /// <param name="req"></param>
        /// <param name="log"></param>
        /// <param name="context"></param>
        /// <returns></returns>        
        [FunctionName("metadata")]
        public static async Task<HttpResponseMessage> Metadata([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = null)]HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            try
            {
                string getBoardEndpoint = Environment.GetEnvironmentVariable("PXDRAW_GETBOARD_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_GETBOARD_ENDPOINT environment variable does not exist.");
                string loginEndpoint = Environment.GetEnvironmentVariable("PXDRAW_LOGIN_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_LOGIN_ENDPOINT environment variable does not exist.");
                string updatePixelEndpoint = Environment.GetEnvironmentVariable("PXDRAW_UPDATEPIXEL_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_UPDATEPIXEL_ENDPOINT environment variable does not exist.");
                string websocketEndpoint = Environment.GetEnvironmentVariable("PXDRAW_WEBSOCKET_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_WEBSOCKET_ENDPOINT environment variable does not exist.");

                var metadata = new Metadata
                {
                    GetBoardEndpoint = getBoardEndpoint,
                    LoginEndpoint = loginEndpoint,
                    UpdatePixelEndpoint = updatePixelEndpoint,
                    WebsocketEndpoint = websocketEndpoint,
                };

                return req.CreateResponse(HttpStatusCode.OK, metadata);
            }
            catch (Exception err)
            {
                log.LogError(err);
                return req.CreateErrorResponse(HttpStatusCode.InternalServerError, $"Could not complete the request. Reference {context.InvocationId} for details.");
            }
        }

        /// <summary>
        /// Inserts pixel updates into Cosmos DB
        /// 
        /// POST /api/update-pixel
        /// [
        ///     {
        ///         "x":int[0-999] - x coordinate for the pixel,
        ///         "y":int[0-999] - y coordinate for the pixel,
        ///         "color":int[0-15] - color enum value for the pixel
        ///     } [1-*]
        /// ]
        /// Returns
        /// Status Codes:
        /// - 201 if the request was sucessfully inserted
        /// - 401 if the user is not authenticated. Client should reauthenticate.
        /// - 429 if the service is currently overloaded. Client should backoff.
        /// - 5xx indicates the service is unhealthy.
        /// </summary>
        /// <param name="req"></param>
        /// <param name="log"></param>
        /// <param name="context"></param>
        /// <returns></returns>
        [FunctionName("update-pixel")]
        public static async Task<HttpResponseMessage> UpdatePixel([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)] HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            string userId;
            DateTime time = new DateTime();

            // Validate the user is authenticated
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

            // TODO: Admin should be the only one allowed to insert more than 1 pixel

            // Grab pixels from request
            Pixel[] pixels;
            try
            {
                pixels = await req.Content.ReadAsAsync<Pixel[]>();
                foreach(var pixel in pixels)
                {
                    pixel.UserId = userId;
                    pixel.LastUpdated = time;
                }
            }
            catch (Exception err)
            {
                log.LogError(err);
                return req.CreateErrorResponse(HttpStatusCode.BadRequest, $"Could not create pixel object from body content. Refer to {context.InvocationId} for details.");
            }
            
            // Insert pixels into Cosmos DB
            try
            {
                PixelService ps = PixelService.Singleton();
                await ps.InsertBatch(pixels);
            }
            catch (Exception err)
            {
                log.LogError(err);
                return req.CreateErrorResponse(HttpStatusCode.InternalServerError, $"Could not insert pixels. Refer to {context.InvocationId} for details.");
            }

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
