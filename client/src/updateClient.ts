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
    private connection:SignalR.Connection;

    constructor(params: UpdateClientParameters) {
        this.params = params;
    }

    /**
     * Initialize
     * @param url
     */
    public init(url: string): JQueryPromise<any> {
        this.connection = $.connection(url);
        this.connection.received((data:any) => {
            // TODO Error checking here
            if (!data) {
                return;
            }

            // TODO handle parse issue
            const update: OnPixelUpdateData = JSON.parse(data);

            this.params.onReceived(update)
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
            update: {
                x: x,
                y: y,
                colorIndex: color
            },
            LSN: 0
        }
        this.params.onReceived(update);
    }
 }