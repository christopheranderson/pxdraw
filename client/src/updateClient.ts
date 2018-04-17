
import {OnPixelUpdateData} from "./main";
import * as signalR from "@aspnet/signalr";

/**
 * Client that receives the updates
 * Based on signalR.
 */

 interface UpdateClientParameters {
     onConnected?: () => void;
     onDisconnected?: () => void;
     onReceived: (data: OnPixelUpdateData) => void;
 }

export class UpdateClient {
    private params: UpdateClientParameters;
    private connection: signalR.HubConnection;

    constructor(params: UpdateClientParameters) {
        this.params = params;
    }

    /**
     * Initialize
     * @param url
     */
    public init(url: string): JQueryPromise<any> {
        // this.connection = new signalR.HubConnection('https://signalr21.azurewebsites.net/hubs/notifications');
        const options: signalR.IHubConnectionOptions = {
            logger: new signalR.ConsoleLogger(signalR.LogLevel.Trace)
        }
        this.connection = new signalR.HubConnection(url, options);
        this.connection.on('Changes', (data:any) => {
            if (!data) {
                return;
            }

            try {
                const docs: OnPixelUpdateData[] = JSON.parse(data);
                if (!Array.isArray(docs)) {
                    console.error(`Change data not an array ${docs}`);
                    return;
                }

                if (docs.length < 1) {
                    console.error(`Change data is empty`);
                    return;
                }

                for(const doc of docs)
                {
                    this.params.onReceived(doc);
                }

            } catch(e) {
                console.error(`Failed to parse change data: ${e}`);
                return;
            }

        });
        return <any>this.connection.start();

        // TODO generate fake updates for now
        // setInterval(this.generateRandomUpdate.bind(this), 1);
    }

    /**
     * Check if object is instance of OnPixelUpdateData
     * @param object
     */
    private static isOnPixelUpdateData(object: any): boolean {
        return 'x' in object && 'y' in object && 'color' in object && '_lsn' in object;
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