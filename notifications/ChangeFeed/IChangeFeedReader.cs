// ----------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  Licensed under the MIT license.
// ----------------------------------------------------------------

namespace PxDRAW.SignalR.ChangeFeed
{
    using Microsoft.AspNetCore.SignalR;
    using PxDRAW.SignalR.Hubs;

    /// <summary>
    /// Something
    /// </summary>
    public interface IChangeFeedReader
    {
        void RegisterHub(IHubContext<ClientHub> signalRHubContext);

        void Start();

        void Stop();
    }
}