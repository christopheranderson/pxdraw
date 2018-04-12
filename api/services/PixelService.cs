using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Azure.Documents.Client;
using pxdraw.api.models;

namespace pxdraw.api.services
{
    class PixelService
    {
        private DocumentClient _Client;
        private Uri _CollectionUri;
        private static PixelService _Singleton;
        private PixelService(DocumentClient client) {
            _Client = client;
        }

        public static PixelService Singleton(Uri collectionUri = null, DocumentClient client = null)
        {
            if(_Singleton == null)
            {
                var _client = client ?? CreateDefaultClient();
                _Singleton = new PixelService(_client);
            }

            return _Singleton;
        }

        public async Task InsertBatch(Pixel[] pixels)
        {
            List<Task> tasks = new List<Task>(pixels.Length);
            foreach(var pixel in pixels)
            {
                tasks.Add(_Client.CreateDocumentAsync(_CollectionUri, pixel));
            }
            await Task.WhenAll(tasks);
        }

        private static DocumentClient CreateDefaultClient()
        {
            string endpoint = Environment.GetEnvironmentVariable("PXDRAW_COSMOS_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_COSMOS_ENDPOINT environment variable does not exist");
            string masterKey = Environment.GetEnvironmentVariable("PXDRAW_COSMOS_MASTERKEY") ?? throw new InvalidOperationException("PXDRAW_COSMOS_MASTER environment variable does not exist");
            return new DocumentClient(new Uri(endpoint), masterKey);
        }

        private static Uri CreateDefaultCollectionUri()
        {
            string collectionUri = Environment.GetEnvironmentVariable("PXDRAW_COSMOS_COLLECTION_URI") ?? throw new InvalidOperationException("PXDRAW_COSMOS_COLLECTION_URI environment variable does not exist");
            return new Uri(collectionUri, UriKind.Relative);
        }
    }
}
