using System;
using System.Collections.Generic;
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
        ///     "websocketEndpoint":string - uri for the SignalR pixel update notifications endpoint,
        ///     "userEndpoint":string - uri for the User info endpoint,
        ///     "adminEndpoint":string - uri for the admin login endpoint,
        ///     "logoutEndpoint":string - uri for the logout endpoint,
        ///     "throttleRate":int - rate in seconds of user pixel updates
        /// }
        /// 
        /// </summary>
        /// <param name="req"></param>
        /// <param name="log"></param>
        /// <param name="context"></param>
        /// <returns></returns>        
        [FunctionName("metadata")]
        public static async Task<HttpResponseMessage> Metadata([HttpTrigger(AuthorizationLevel.Anonymous, "get", "options", Route = null)]HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            try
            {
                string getBoardEndpoint = Environment.GetEnvironmentVariable("PXDRAW_GETBOARD_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_GETBOARD_ENDPOINT environment variable does not exist.");
                string loginEndpoint = Environment.GetEnvironmentVariable("PXDRAW_TWITTER_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_TWITTER_ENDPOINT environment variable does not exist.");
                string updatePixelEndpoint = Environment.GetEnvironmentVariable("PXDRAW_UPDATEPIXEL_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_UPDATEPIXEL_ENDPOINT environment variable does not exist.");
                string websocketEndpoint = Environment.GetEnvironmentVariable("PXDRAW_WEBSOCKET_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_WEBSOCKET_ENDPOINT environment variable does not exist.");
                string userEndpoint = Environment.GetEnvironmentVariable("PXDRAW_USER_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_USER_ENDPOINT environment variable does not exist.");
                string adminEndpoint = Environment.GetEnvironmentVariable("PXDRAW_ADMIN_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_ADMIN_ENDPOINT environment variable does not exist.");
                string logoutEndpoint = Environment.GetEnvironmentVariable("PXDRAW_LOGOUT_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_LOGOUT_ENDPOINT environment variable does not exist.");
                string topTweetsEndpoint = Environment.GetEnvironmentVariable("PXDRAW_TOP_TWEETS_ENDPOINT" ?? null);
                bool isPreRelease = (Environment.GetEnvironmentVariable("PXDRAW_ISPRERELEASE") == "true");
                int throttleRate = GetThrottleRate();

                var metadata = new Metadata
                {
                    GetBoardEndpoint = getBoardEndpoint,
                    LoginEndpoint = loginEndpoint,
                    UpdatePixelEndpoint = updatePixelEndpoint,
                    WebsocketEndpoint = websocketEndpoint,
                    UserEndpoint = userEndpoint,
                    LogoutEndpoint = logoutEndpoint,
                    ThrottleRate = throttleRate,
                    TopTweetsEndpoint = topTweetsEndpoint,
                };

                var res = req.CreateResponse(HttpStatusCode.OK, metadata);
                ApplyCORSRules(req, res);
                return res;
            }
            catch (Exception err)
            {
                log.LogError(err);
                var res = req.CreateErrorResponse(HttpStatusCode.InternalServerError, $"Could not complete the request. Reference {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }
        }

        [FunctionName("top-tweets")]
        public static async Task<HttpResponseMessage> TopTweets([HttpTrigger(AuthorizationLevel.Anonymous, "get", "options", Route = null)]HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            try {
                TweetService ts = TweetService.GetDefaultSingleton();
                List<Tweet> tweets = await ts.GetTopTweets();
                var res = req.CreateResponse(HttpStatusCode.OK, tweets);
                ApplyCORSRules(req, res);
                return res;
            }
            catch (Exception err)
            {
                log.LogError(err);
                var res = req.CreateErrorResponse(HttpStatusCode.InternalServerError, $"Could not complete the request. Reference {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }
        }


        /// <summary>
        /// Retrieves information about the user
        /// 
        /// GET /api/user
        /// 
        /// Returns
        /// - 200 if the request was a success
        /// - 429 if the user is not authenticated
        /// - 500 if there is a server error
        /// Content-type: application/json; utf8
        /// Body:
        /// {
        ///     "id":string - user's id
        ///     "lastInsert":DateTime - last insert recorded for the user
        ///     "isAdmin":boolean - if the user is an admin (and will be allowed to insert more than 1 pixel at a time)
        /// </summary>
        /// <param name="req"></param>
        /// <param name="log"></param>
        /// <param name="context"></param>
        /// <returns></returns>
        [FunctionName("user")]
        public static async Task<HttpResponseMessage> GetUser([HttpTrigger(AuthorizationLevel.Anonymous, "get", "options", Route = null)] HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            if (req.Method == HttpMethod.Options)
            {
                var res = req.CreateResponse();
                ApplyCORSRules(req, res);
                return res;
            }

            string userId;
            string idp;

            // Validate the user is authenticated
            try
            {
                // "x-ms-client-principal-id" is the flag that this is a valid token
                userId = req.Headers.FirstOrDefault(h => string.Equals(h.Key, "x-ms-client-principal-id", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault() ?? throw new InvalidOperationException("Principal id header was missing");
                idp = req.Headers.FirstOrDefault(h => string.Equals(h.Key, "x-ms-client-principal-idp", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault() ?? throw new InvalidOperationException("Identity provider header was missing");
            }
            catch (Exception err)
            {
                log.LogError(err);
                log.LogInformation($"Headers {HeadersToString(req.Headers)}");
                var res = req.CreateErrorResponse(HttpStatusCode.Unauthorized, $"Could not authenticate user. Reference {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }

            try
            {
                UserService us = UserService.GetDefaultSingleton();
                User user = await us.GetOrCreateUser(userId);
                user.IsAdmin = (idp == "aad"); // All users logged in through AAD are admins, everyone else is not
                var res = req.CreateResponse(user);
                ApplyCORSRules(req, res);
                return res;
            }
            catch (Exception err)
            {
                log.LogError(err);
                log.LogInformation($"Headers {HeadersToString(req.Headers)}");
                var res = req.CreateErrorResponse(HttpStatusCode.InternalServerError, $"Could not load user info. Reference {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
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
        public static async Task<HttpResponseMessage> UpdatePixel([HttpTrigger(AuthorizationLevel.Anonymous, "post", "options", Route = null)] HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            if(req.Method == HttpMethod.Options)
            {
                var res = req.CreateResponse();
                ApplyCORSRules(req, res);
                return res;
            }

            string userId;
            string idp;
            DateTime time = DateTime.UtcNow;

            // Validate the user is authenticated
            try
            {
                // "x-ms-client-principal-id" is the flag that this is a valid token
                userId = req.Headers.FirstOrDefault(h => string.Equals(h.Key, "x-ms-client-principal-id", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault() ?? throw new InvalidOperationException("Principal id header was missing");
                idp = req.Headers.FirstOrDefault(h => string.Equals(h.Key, "x-ms-client-principal-idp", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault() ?? throw new InvalidOperationException("Identity provider header was missing");
            }
            catch (Exception err)
            {
                log.LogError(err);
                log.LogInformation($"Headers {HeadersToString(req.Headers)}");
                var res = req.CreateErrorResponse(HttpStatusCode.Unauthorized, $"Could not authenticate user. Reference {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }

            // Grab pixels from request
            Pixel[] pixels;
            try
            {
                pixels = await req.Content.ReadAsAsync<Pixel[]>();
            }
            catch (Exception err)
            {
                log.LogError(err);
                var res = req.CreateErrorResponse(HttpStatusCode.BadRequest, $"Could not create pixel object from body content. Refer to {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }

            // Block bad users
            // User throttling
            // Admin should be the only one allowed to insert more than 1 pixel
            // Admin should be hte only one allowed to insert more often than 30 seconds
            try
            {
                UserService us = UserService.GetDefaultSingleton();
                User user = await us.GetOrCreateUser(userId);

                if(user.IsBlocked == true)
                {
                    // log for telemetry and then silently return their results.
                    log.LogInformation($"User {userId} is blocked.");
                    var fakeRes = req.CreateResponse(HttpStatusCode.Created, new
                    {
                        timestamp = time
                    });

                    ApplyCORSRules(req, fakeRes);
                    return fakeRes;
                }

                user.IsAdmin = (idp == "aad"); // All users logged in through AAD are admins, everyone else is not
                if(pixels.Length > 1 && !user.IsAdmin)
                {
                    var res = req.CreateErrorResponse(HttpStatusCode.BadRequest, $"User can only insert 1 pixel at a time. Refer to {context.InvocationId} for details.");
                    ApplyCORSRules(req, res);
                    return res;
                }

                if(!user.IsAdmin && user.LastInsert > time.AddSeconds(-1 * GetThrottleRate()))
                {
                    var res = req.CreateErrorResponse((HttpStatusCode)429, $"Too many pixel inserts. Refer to {context.InvocationId} for details.");
                    ApplyCORSRules(req, res);
                    return res;
                }

                user.LastInsert = time;
                await us.UpsertUser(user);
            }
            catch (Exception err)
            {
                log.LogError(err);
                var res = req.CreateErrorResponse(HttpStatusCode.BadRequest, $"Issue validating user. Refer to {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }

            // Insert pixels into Cosmos DB
            try
            {
                PixelService ps = PixelService.Singleton();
                await ps.InsertBatch(pixels, userId, time);
            }
            catch (Exception err)
            {
                log.LogError(err);
                var res = req.CreateErrorResponse(HttpStatusCode.InternalServerError, $"Could not insert pixels. Refer to {context.InvocationId} for details.");
                ApplyCORSRules(req, res);
                return res;
            }

            var response = req.CreateResponse(HttpStatusCode.Created, new {
                timestamp = time
            });

            ApplyCORSRules(req, response);
            return response;
        }

        [FunctionName("canary")]
        public static void Canary([TimerTrigger("0 */5 * * * *")]TimerInfo myTimer, ILogger log)
        {
            log.LogInformation("Function app is running healthy");
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

        private static void ApplyCORSRules(HttpRequestMessage req, HttpResponseMessage res)
        {
            if (req.Headers.Contains("Origin"))
            {
                var origin = req.Headers.GetValues("origin").FirstOrDefault();
                res.Headers.Add("Access-Control-Allow-Credentials", "true");
                res.Headers.Add("Access-Control-Allow-Origin", origin);
                res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                res.Headers.Add("Access-Control-Allow-Headers", "x-ms-client-principal-id");
                res.Headers.Add("Access-Control-Allow-Headers", "x-ms-client-principal-idp");
            }
        }

        private static int GetThrottleRate()
        {
            int throttleRate = 30;
            Int32.TryParse(Environment.GetEnvironmentVariable("PXDRAW_THROTTLE_RATE"), out throttleRate);
            return throttleRate;
        }
    }
}
