using System.Collections.Generic;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Host;
using pxdraw.updateprocessor.models;
using Microsoft.Azure.WebJobs.Extensions.Http;
using System.Net.Http;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;
using Microsoft.Azure.Documents;
using System;
using System.IO;

namespace pxdraw.updateprocessor
{
    public static class Functions
    {
        [FunctionName("UpdateProcessor")]
        public async static Task UpdateProcessor([CosmosDBTrigger(
            databaseName: "%PXDRAW_COSMOS_DATABASE%",
            collectionName: "%PXDRAW_COSMOS_COLLECTION%",
            ConnectionStringSetting = "PXDRAW_COSMOSDB_CONNECTION",
            LeaseCollectionName = "%PXDRAW_COSMOS_LEASE_COLLECTION%")]IReadOnlyList<Document> docs, TraceWriter log)
        {
            if (docs != null && docs.Count > 0)
            {
                log.Info($"Processing {docs.Count} pixels");
                var bu = BlobClient.GetDefaultSingleton();
                var containerName = GetDefaultConatinerName();
                var boardName = GetDefaultBoardName();
                var blob = await bu.GetBlob(containerName, boardName); // TODO: cache this blob in memory and then use HEAD requests to compare ETAG?
                var board = new Board(blob);
                foreach (var doc in docs)
                {
                    try
                    {
                        var pixels = Pixel.PixelsFromDocument(doc);
                        foreach(var pixel in pixels)
                        {
                            board.InsertPixel(pixel);
                        }
                    }
                    catch (Exception e)
                    {
                        // log and continue
                        log.Error($"Could not insert pixel: {doc.Id}", e);
                    }
                }
                await bu.UpdateBlob(containerName, boardName, board.Bitmap);
            }
        }

        [FunctionName("reset-board")]
        public async static Task<HttpResponseMessage> ResetBoard([HttpTrigger(authLevel: AuthorizationLevel.Function)] HttpRequestMessage req, ILogger log, ExecutionContext context)
        {
            log.LogInformation("Resetting board");
            // bool isRandom = req.Headers.Contains("x-pxdraw-random");

            var bu = BlobClient.GetDefaultSingleton();
            var containerName = GetDefaultConatinerName();
            var boardName = GetDefaultBoardName();

            Board board = Board.GenerateBoardFromTshirt(Path.Combine(context.FunctionAppDirectory, "./content/tshirt.png"));
            await bu.UpdateBlob(containerName, boardName, board.Bitmap);
            return req.CreateResponse();
        }

        [FunctionName("canary")]
        public static void Canary([TimerTrigger("0 */5 * * * *")]TimerInfo myTimer, ILogger log)
        {
            log.LogInformation("Function app is running healthy");
        }

        private static string GetDefaultConatinerName()
        {
            return Environment.GetEnvironmentVariable("PXDRAW_CONTAINER_NAME") ?? throw new InvalidOperationException("PXDRAW_CONTAINER_NAME environment variable is not present");
        }

        private static string GetDefaultBoardName()
        {
            return Environment.GetEnvironmentVariable("PXDRAW_BOARD_NAME") ?? throw new InvalidOperationException("PXDRAW_BOARD_NAME environment variable is not present");
        }
    }
}
