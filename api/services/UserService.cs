using Microsoft.Azure.Documents;
using Microsoft.Azure.Documents.Client;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using pxdraw.api.models;
using User = pxdraw.api.models.User;

namespace pxdraw.api.services
{
    public class UserService : DocumentService
    {
        private Uri _CollectionUri;
        private static UserService _singleton;
        public static UserService GetDefaultSingleton()
        {
            if(_singleton  == null)
            {
                var client = CreateDefaultClient();
                var collectionUri = CreateDefaultCollectionUri();
                _singleton = new UserService(client, collectionUri);
            }
            return _singleton;
        }

        public UserService(DocumentClient client, Uri userCollectionUri) : base(client)
        {
            _CollectionUri = userCollectionUri;
        }

        public async Task<User> GetUser(string UserId)
        {
            var user = await _Client.ReadDocumentAsync<User>(UriFactory.CreateDocumentUri("pxdraw", "users", UserId));
            return user;
        }

        public async Task<User> GetOrCreateUser(string UserId)
        {
            User user;
            try
            {
                user = await GetUser(UserId);
            }
            catch
            {
                user = new User
                {
                    Id = UserId,
                    LastInsert = DateTime.UtcNow.AddDays(-1),
                };
                var response = await _Client.CreateDocumentAsync(UriFactory.CreateDocumentCollectionUri("pxdraw", "users"), user);
            }
            return user;
        }

        public async Task UpsertUser(User user)
        {
            await _Client.UpsertDocumentAsync(UriFactory.CreateDocumentCollectionUri("pxdraw", "users"), user);
        }

        private static Uri CreateDefaultCollectionUri()
        {
            string collectionUri = Environment.GetEnvironmentVariable("PXDRAW_COSMOS_USER_COLLECTION_URI") ?? throw new InvalidOperationException("PXDRAW_COSMOS_COLLECTION_URI environment variable does not exist");
            return new Uri(collectionUri, UriKind.Relative);
        }
    }
}
