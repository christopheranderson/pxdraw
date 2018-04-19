using Microsoft.Azure.Documents.Client;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace pxdraw.api.services
{
    public abstract class DocumentService
    {
        internal DocumentClient _Client;
        internal DocumentService(DocumentClient client)
        {
            this._Client = client;
        }

        internal static DocumentClient CreateDefaultClient()
        {
            string endpoint = Environment.GetEnvironmentVariable("PXDRAW_COSMOS_ENDPOINT") ?? throw new InvalidOperationException("PXDRAW_COSMOS_ENDPOINT environment variable does not exist");
            string masterKey = Environment.GetEnvironmentVariable("PXDRAW_COSMOS_MASTERKEY") ?? throw new InvalidOperationException("PXDRAW_COSMOS_MASTER environment variable does not exist");
            return new DocumentClient(new Uri(endpoint), masterKey);
        }
    }
}
