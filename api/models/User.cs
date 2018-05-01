using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace pxdraw.api.models
{
    public class User
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        [JsonProperty("lastInsert")]
        public DateTime LastInsert { get; set; }
        [JsonProperty("isAdmin")]
        public bool IsAdmin { get; set; }
        [JsonProperty("isBlocked")]
        public bool IsBlocked { get; set; }

        public bool CanInsertPixel(int timeoutDurationInSeconds)
        {
            if((DateTime.Now - LastInsert).TotalSeconds >= timeoutDurationInSeconds)
            {
                return true;
            }

            // No timeouts for admins
            if(IsAdmin)
            {
                return true;
            }

            return false;
        }
    }
}
