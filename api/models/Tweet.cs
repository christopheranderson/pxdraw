using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace pxdraw.api.models
{
    class Tweet
    {
        [JsonProperty("url")]
        public string Url { get; set; }
        [JsonProperty("id")]
        public string Id { get; set; }
    }
}
