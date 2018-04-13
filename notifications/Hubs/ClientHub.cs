// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.Hubs
{
    using System;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.SignalR;

    /// <summary>
    /// SignalR client hub
    /// </summary>
    public class ClientHub : Hub
    {
        /// <summary>
        /// Handler of OnConnected event.
        /// </summary>
        /// <returns>A Task</returns>
        public override async Task OnConnectedAsync()
        {
            // TODO: Define if we want logging here
            await base.OnConnectedAsync();
        }

        /// <summary>
        /// Handler of OnDisconnected event.
        /// </summary>
        /// <param name="ex">Exception that generated the disconnection.</param>
        /// <returns>A Task</returns>
        public override async Task OnDisconnectedAsync(Exception ex)
        {
            // TODO: Define if we want logging here
            await base.OnDisconnectedAsync(ex);
        }
    }
}
