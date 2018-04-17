using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.WindowsAzure.Storage.Blob;
using Microsoft.WindowsAzure.Storage;

namespace pxdraw.updateprocessor
{
    internal class BlobClient
    {
        CloudBlobClient client;
        private CloudStorageAccount account;
        private static BlobClient _defaultsingleton;
        public static BlobClient GetDefaultSingleton()
        {
            if(_defaultsingleton == null)
            {
                var connectionString = Environment.GetEnvironmentVariable("PXDRAW_STORAGE");
                if (!CloudStorageAccount.TryParse(connectionString, out CloudStorageAccount account))
                {
                    throw new InvalidOperationException("PXDRAW_STORAGE connection string is missing.");
                }
                _defaultsingleton = new BlobClient(account);
            }
            return _defaultsingleton;
        }

        public BlobClient(CloudStorageAccount account)
        {
            this.account = account;
            client = account.CreateCloudBlobClient();
        }

        public async Task<Byte[]> GetBlob(string containername, string boardname, int blobsize = 500000)
        {
            var container = client.GetContainerReference(containername);
            byte[] blob = new byte[blobsize];
            await container.GetBlockBlobReference(boardname).DownloadToByteArrayAsync(blob, 0);
            return blob;
        }

        public async Task UpdateBlob(string containername, string boardname, byte[] blob)
        {
            var client = account.CreateCloudBlobClient();
            var container = client.GetContainerReference(containername);
            await container.GetBlockBlobReference(boardname).UploadFromByteArrayAsync(blob, 0, blob.Length);
        }
    }
}
