/// <reference path="../node_modules/@aspnet/signalr/dist/esm/index.d.ts" />

/**
 * Client that receives the updates
 * Based on signalR.
 */

 interface UpdateClientParameters {
     onConnected?: () => void;
     onDisconnected?: () => void;
     onReceived: (data: OnPixelUpdateData) => void;
 }

 class UpdateClient {
    private params: UpdateClientParameters;
    private connection:any; // TODO Add types here

    constructor(params: UpdateClientParameters) {
        this.params = params;
    }

    /**
     * Initialize
     * @param url
     */
    public init(url: string): JQueryPromise<any> {
        // this.connection = new signalR.HubConnection('https://signalr21.azurewebsites.net/hubs/notifications');
        this.connection = new signalR.HubConnection(url);
        this.connection.on('Changes', (data:any) => {
            // TODO Error checking here
            if (!data) {
                return;
            }

            // TODO handle parse issue
            const docs: OnPixelUpdateData[] = JSON.parse(data);
            if (docs.length < 1) {
                console.error('No valid update');
                return;
            }

            this.params.onReceived(docs[0])
        });
        return this.connection.start();

        // TODO generate fake updates for now
        // setInterval(this.generateRandomUpdate.bind(this), 1);
    }

    private generateRandomUpdate() {
        const x = Math.floor(Math.random() * 100) + 450;
        const y = Math.floor(Math.random() * 100) + 450;
        const color = Math.floor(Math.random() * 16);
        const update:OnPixelUpdateData = {
            x: x,
            y: y,
            color: color,
            _lsn: 0
        }
        this.params.onReceived(update);
    }
 }