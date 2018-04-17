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

namespace pxdraw.updateprocessor
{
    public static class Functions
    {
        [FunctionName("UpdateProcessor")]
        public async static Task UpdateProcessor([CosmosDBTrigger(
            databaseName: "pxdraw",
            collectionName: "board1",
            ConnectionStringSetting = "PXDRAW_COSMOSDB_CONNECTION",
            LeaseCollectionName = "leases")]IReadOnlyList<Document> docs, TraceWriter log)
        {
            if (docs != null && docs.Count > 0)
            {
                log.Info($"Processing {docs.Count} pixels");
                var account = BlobUtilities.GetStorageAccount();
                var blob = await BlobUtilities.GetBlob(account); // TODO: cache this blob in memory and then use HEAD requests to compare ETAG?
                var board = new Board(blob);
                foreach (var doc in docs)
                {
                    try
                    {
                        var pixel = Pixel.FromDocument(doc);
                        board.InsertPixel(pixel);
                    }
                    catch (Exception e)
                    {
                        // log and continue
                        log.Error($"Could not insert pixel: {doc.Id}", e);
                    }
                }
                await BlobUtilities.UpdateBlob(account, board.Bitmap);
            }
        }

        [FunctionName("reset-board")]
        public async static Task<HttpResponseMessage> ResetBoard([HttpTrigger(authLevel: AuthorizationLevel.Function)] HttpRequestMessage req, ILogger log)
        {
            log.LogInformation("Resetting board");
            bool isRandom = req.Headers.Contains("x-pxdraw-random");

            Board board = Board.GenerateBoard(isRandom);
            var account = BlobUtilities.GetStorageAccount();
            await BlobUtilities.UpdateBlob(account, board.Bitmap);
            return req.CreateResponse();
        }
    }
}
