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
        private readonly int BATCH_SIZE = 300;
        private DocumentClient _Client;
        private Uri _CollectionUri;
        private static PixelService _Singleton;
        private PixelService(DocumentClient client, Uri collectionUri) {
            _Client = client;
            _CollectionUri = collectionUri;
        }

        public static PixelService Singleton(Uri collectionUri = null, DocumentClient client = null)
        {
            if(_Singleton == null)
            {
                var _client = client ?? CreateDefaultClient();
                var _collectionUri = collectionUri ?? CreateDefaultCollectionUri();
                _Singleton = new PixelService(_client, _collectionUri);
            }

            return _Singleton;
        }

        public async Task Insert(Pixel[] pixels)
        {
            var batches = CreateBatches(pixels);
            foreach(var batch in batches)
            {
                await InsertBatch(batch);
            }
        }

        public async Task InsertBatch(Pixel[] pixels)
        {
            dynamic batch = new {
                items = pixels
            };

            await _Client.CreateDocumentAsync(_CollectionUri, batch);
        }

        private List<Pixel[]> CreateBatches(Pixel[] pixels)
        {
            var list = new List<Pixel[]>();
            for(var i = 0; i < pixels.Length; i = i + BATCH_SIZE)
            {
                list.Add(pixels.Skip(i).Take(Math.Min(BATCH_SIZE, pixels.Length - i)).ToArray());
            }
            return list;
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
