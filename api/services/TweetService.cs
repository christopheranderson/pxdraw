using Microsoft.Azure.Documents;
using Microsoft.Azure.Documents.Client;
using Microsoft.Azure.Documents.Linq;
using pxdraw.api.models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace pxdraw.api.services
{
    class TweetService : DocumentService
    {
        private Uri _CollectionUri;
        private static TweetService _singleton;
        public static TweetService GetDefaultSingleton()
        {
            if (_singleton == null)
            {
                var client = CreateDefaultClient();
                var collectionUri = CreateDefaultCollectionUri();
                _singleton = new TweetService(client, collectionUri);
            }
            return _singleton;
        }

        public TweetService(DocumentClient client, Uri userCollectionUri) : base(client)
        {
            _CollectionUri = userCollectionUri;
        }

        public async Task<List<Tweet>> GetTopTweets()
        {
            List<Tweet> tweets = new List<Tweet>();
            SqlQuerySpec query = new SqlQuerySpec("SELECT TOP 20 url FROM c WHERE c.approved == true ORDER BY c._ts DESC");
            var queryable = _Client.CreateDocumentQuery<Tweet>(_CollectionUri, query).AsDocumentQuery();

            while (queryable.HasMoreResults)
            {
                foreach (var t in await queryable.ExecuteNextAsync<Tweet>())
                {
                    tweets.Add(t);
                }
            }
            return tweets;
        }

        private static Uri CreateDefaultCollectionUri()
        {
            string collectionUri = Environment.GetEnvironmentVariable("PXDRAW_TWEET_COLLECTION_URI") ?? throw new InvalidOperationException("PXDRAW_TWEET_COLLECTION_URI environment variable does not exist");
            return new Uri(collectionUri, UriKind.Relative);
        }
    }
}
