/**
 * Main entry point.
 *
 * Note:
 * We use "canvas" for all html5-canvas related code.
 * We use "board" for the actual representation of the board coming from the backend.
 *
 */
import { config } from "./config";
import { Canvas } from "./canvas";
import { UpdateClient } from "./updateClient";

const BATCH_SIZE = 300;

export interface Point2D {
    x: number;
    y: number;
}

export interface CanvasColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface PixelUpdate extends Point2D {
    color: number;
}

export interface OnPixelUpdateData extends PixelUpdate {
    _lsn: number;
}

export interface FetchMetadataResponseData {
    loginEndpoint: string;
    getBoardEndpoint: string;
    updatePixelEndpoint: string;
    websocketEndpoint: string;
}

export interface FetchBoardData {
    board: ArrayBuffer;
    lsn: number;
}

class Main {
    private static readonly LOCALHOST_CLIENT_PRINCIPAL_ID = 'PrincicalId';
    private static readonly REFRESH_BOARD_DELAY_MS = 30000;

    // state
    public canvas: Canvas;
    private receivedUpdates: OnPixelUpdateData[] = []; // Assume for now they should be ordered by LSN asc

    private updateClient: UpdateClient;

    private loginEndpoint: string;
    private getBoardEndpoint: string;
    private updatePixelEndpoint: string;
    private websocketEndpoint: string;

    private remainingTimeDisplay: KnockoutObservable<string>;

    public constructor() {
        this.canvas = new Canvas({
            onPixelUpdatesSubmitted: this.onPixelUpdatesFromUI.bind(this)
        });

        this.remainingTimeDisplay = ko.observable('00:00');
    }

    public async init(){
        this.updateClient = new UpdateClient({
            onReceived: this.onPixelUpdateFromRemote.bind(this)
        });

        await this.fetchMetadata();
        // this.getBoardEndpoint = 'https://pxdrawbuild18dev.blob.core.windows.net/dev/board1';
        // this.websocketEndpoint = 'https://pxdraw-build18-notifcations.azurewebsites.net/hubs/notifications';

        this.updateClient.init(this.websocketEndpoint);

        // Periodic board update
        this.updateBoard();
        setInterval(this.updateBoard.bind(this), Main.REFRESH_BOARD_DELAY_MS);
    }

    private processFetchBoardResponse(data: ArrayBuffer) {
        const board8Uint = Main.unpackBoardBlob(new Uint8Array(data));
        this.canvas.renderBoard(board8Uint);
    }

    private onPixelUpdateFromRemote(data: OnPixelUpdateData) {
        this.receivedUpdates.push(data);
        this.canvas.queuePixelUpdate(data);
    }

    /**
     * User submitted pixel updates through UI
     * @param updates
     */
    private onPixelUpdatesFromUI(updates: PixelUpdate[]) {
        this.submitPixelUpdates(updates).catch((err) => {
            console.error(err)
        });
    }

    /**
     * Board blob is an array of 4-bit integer: 0-15 color index for each pixel.
     * Convert this into an easier array to read.
     *
     * @param blob
     * @return result is a [width * height] array of 1-byte
     */
    private static unpackBoardBlob(blob: Uint8Array): Uint8Array {
        const result = new Uint8Array(Canvas.BOARD_WIDTH_PX * Canvas.BOARD_HEIGHT_PX);

        for (var i = 0; i < blob.byteLength; i++) {
            result[i * 2] = blob[i] >> 4;
            result[i * 2 + 1] = blob[i] & 0xF;
        }
        return result;
    }

    private async fetchMetadata() {
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: config.metadataEndpoint,
                success: (data: FetchMetadataResponseData, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                    this.loginEndpoint = data.loginEndpoint;
                    this.getBoardEndpoint = data.getBoardEndpoint;
                    this.updatePixelEndpoint = data.updatePixelEndpoint;
                    this.websocketEndpoint = data.websocketEndpoint;
                    resolve();
                },
                error: (jqXHR: JQuery.jqXHR, textStatus: JQuery.Ajax.ErrorTextStatus, errorThrown: string): void => {
                    console.error(`Failed to fetch metadata:${errorThrown}`);
                    reject(errorThrown);
                }
            });
        });
    }

    private async fetchBoard(): Promise<{}> {
        // TODO Get LSN from board
        const currentLSN = this.receivedUpdates && this.receivedUpdates.length > 0 ?
            this.receivedUpdates[this.receivedUpdates.length - 1] : 0;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', this.getBoardEndpoint, true);
            xhr.responseType = 'arraybuffer';
            xhr.addEventListener('load', function () {
                if (xhr.status === 200) {
                    if (!xhr.response) {
                        console.error('Fetching board returned no data');
                    }
                    resolve({ board: xhr.response, lsn: currentLSN });
                }
            })
            xhr.send();
        });
    }

    private updateBoard() {
        this.fetchBoard().then((result: FetchBoardData) => {
            this.processFetchBoardResponse(result.board);
            this.replayAndCleanupUpdates(result.lsn);
        });
    }

    /**
     * Cull obsolete lsn's
     * @param startLsn
     */
    private replayAndCleanupUpdates(startLsn: number) {
        const validUpdates:OnPixelUpdateData[] = [];
        console.log(`Replaying ${this.receivedUpdates.length} received updates`);
        for (let i=0; i<this.receivedUpdates.length; i++) {
            const update = this.receivedUpdates[i];
            if (startLsn <= update._lsn) {
                validUpdates.push(update);
                this.canvas.queuePixelUpdate(update);
            }
        }
        this.receivedUpdates = validUpdates;
    }

    private async submitPixelUpdates(updates: PixelUpdate[]) {
        const numberOfBatches = updates.length / BATCH_SIZE;
        const promises = [];
        for(let i = 0; i < numberOfBatches; i++)
        {
            const data = JSON.stringify(updates.slice(i*BATCH_SIZE, (i+1)*BATCH_SIZE));
            promises.push(new Promise((resolve, reject) => {
                $.ajax({
                    type: 'POST',
                    url: this.updatePixelEndpoint,
                    dataType: "json",
                    contentType: "application/json",
                    beforeSend: function (request) {
                        if(config.isLocal) {
                            // locally, we spoof the header
                            request.setRequestHeader('x-ms-client-principal-id', Main.LOCALHOST_CLIENT_PRINCIPAL_ID);
                        }
                    },
                    data,
                    success: (data: any, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                        console.log("Data: " + data + "\nStatus: " + textStatus);
                    },
                    error: (jqXHR: JQuery.jqXHR, textStatus: JQuery.Ajax.ErrorTextStatus, errorThrown: string): void => {
                        console.error(`Failed to submit pixel update:${errorThrown}`);
                        reject(errorThrown);
                    }
                });
            }));
        }
        return Promise.all(promises);
    }
}

$(document).ready(async () => {
    const main = new Main();
    await main.init();
    ko.applyBindings(main);
});
