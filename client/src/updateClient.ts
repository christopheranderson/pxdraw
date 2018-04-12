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
    constructor(params: UpdateClientParameters) {
        this.params = params;

    }

    /**
     * Initialize
     * @param url
     */
    public init(url: string) {
        // TODO generate fake updates for now
        setInterval(this.generateRandomUpdate.bind(this), 1);
    }

    private generateRandomUpdate() {
        const x = Math.floor(Math.random() * 100) + 450;
        const y = Math.floor(Math.random() * 100) + 450;
        const color = Math.floor(Math.random() * 16);
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