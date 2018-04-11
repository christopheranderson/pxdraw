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
            await this.Clients.All.SendAsync("SendAction", "client", "joined");
        }

        /// <summary>
        /// Handler of OnDisconnected event.
        /// </summary>
        /// <param name="ex">Exception that generated the disconnection.</param>
        /// <returns>A Task</returns>
        public override async Task OnDisconnectedAsync(Exception ex)
        {
            await this.Clients.All.SendAsync("SendAction", "client", "left");
        }

        /// <summary>
        /// Handler of Send event.
        /// </summary>
        /// <param name="message">A Message</param>
        /// <returns>A Task</returns>
        public async Task Send(string message)
        {
            await this.Clients.All.SendAsync("SendMessage", "client", message);
        }
    }
}
