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
    class BlobUtilities
    {
        public static CloudStorageAccount GetStorageAccount()
        {
            var connectionString = Environment.GetEnvironmentVariable("PXDRAW_STORAGE");
            if(!CloudStorageAccount.TryParse(connectionString, out CloudStorageAccount account))
            {
                throw new InvalidOperationException("PXDRAW_STORAGE connection string is missing.");
            }
            return account;
        }

        public async static Task<Byte[]> GetBlob(CloudStorageAccount account)
        {
            var client = account.CreateCloudBlobClient();
            var container = client.GetContainerReference("dev");
            byte[] blob = new byte[500000];
            await container.GetBlockBlobReference("board1").DownloadToByteArrayAsync(blob, 0);
            return blob;
        }

        public async static Task UpdateBlob(CloudStorageAccount account, byte[] blob)
        {
            var client = account.CreateCloudBlobClient();
            var container = client.GetContainerReference("dev");
            await container.GetBlockBlobReference("board1").UploadFromByteArrayAsync(blob, 0, blob.Length);
        }
    }
}
