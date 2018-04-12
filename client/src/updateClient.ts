/**
 * Client that receives the updates
 * Based on signalR.
 */

 interface UpdateClientParameters {
     connectionUrl: string;
     onConnected?: () => void;
     onDisconnected?: () => void;
     onReceived: (data: OnPixelUpdateData) => void;
 }

 class UpdateClient {
    private params: UpdateClientParameters;
    constructor(params: UpdateClientParameters) {
        this.params = params;

        setInterval(this.generateRandomUpdate.bind(this), 1);
    }

    private generateRandomUpdate() {
        const x = Math.round(Math.random() * 100);
        const y = Math.round(Math.random() * 100);
        const color = Math.round(Math.random() * 16);
        const update:OnPixelUpdateData = {
            update: {
                position: { x: x, y: y },
                colorIndex: color
            },
            LSN: 0
        }
        this.params.onReceived(update);
    }
 }