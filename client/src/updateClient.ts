
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
        const options: signalR.IHubConnectionOptions = {
            logger: new signalR.ConsoleLogger(signalR.LogLevel.Trace)
        }
        this.connection = new signalR.HubConnection(url, options);
        this.connection.on('Changes', (data:any) => {
            if (!data) {
                return;
            }

            try {
                const docs: OnPixelUpdateData[] = UpdateClient.smoosh(JSON.parse(data));
                if (!Array.isArray(docs)) {
                    console.error(`Change data not an array ${docs}`);
                    return;
                }

                if (docs.length < 1) {
                    console.error(`Change data is empty`);
                    return;
                }

                console.log(`Received ${docs.length} updates`);
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
    }

    /**
     * Check if object is instance of OnPixelUpdateData
     * @param object
     */
    private static isOnPixelUpdateData(object: any): boolean {
        return 'x' in object && 'y' in object && 'color' in object && '_lsn' in object;
    }

    private static smoosh(docs: any[]): OnPixelUpdateData[] {
        const updates: OnPixelUpdateData[] = [];

        if(!Array.isArray(docs))
        {
            throw new Error("Not an array");
        }

        for(const doc of docs) {
            if(doc.items !== undefined)
            {
                for(var pixel of doc.items) {
                    updates.push(pixel);
                }
            } else {
                updates.push(doc);
            }
        }

        return updates
    }
 }