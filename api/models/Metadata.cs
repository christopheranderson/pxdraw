using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace pxdraw.api.models
{
    class Metadata
    {
        [JsonProperty("loginEndpoint", NullValueHandling = NullValueHandling.Include)]
        public string LoginEndpoint { get; set; }
        [JsonProperty("getBoardEndpoint", NullValueHandling = NullValueHandling.Include)]
        public string GetBoardEndpoint { get; set; }
        [JsonProperty("updatePixelEndpoint", NullValueHandling = NullValueHandling.Include)]
        public string UpdatePixelEndpoint { get; set; }
        [JsonProperty("websocketEndpoint", NullValueHandling = NullValueHandling.Include)]
        public string WebsocketEndpoint { get; set; }
        [JsonProperty("userEndpoint", NullValueHandling = NullValueHandling.Include)]
        public string UserEndpoint { get; set; }
        [JsonProperty("logoutEndpoint", NullValueHandling = NullValueHandling.Include)]
        public string LogoutEndpoint { get; set; }
        [JsonProperty("throttleRate", NullValueHandling = NullValueHandling.Include)]
        public int ThrottleRate { get; set; }
    }
}
