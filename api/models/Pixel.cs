﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace pxdraw.api.models
{
    class Pixel
    {
        [JsonProperty("x", Required = Required.Always)]
        public int X {get; set;}
        [JsonProperty("y", Required = Required.Always)]
        public int Y { get; set; }
        [JsonProperty("color", Required = Required.Always)]
        public int Color { get; set; }
        [JsonProperty("boardId")]
        public string BoardId { get; set; }
        [JsonProperty("userId")]
        public string UserId { get; set; }
        [JsonProperty("lastUpdated")]
        public DateTime LastUpdated { get; set; }
    }
}
