/**
 * Main entry point.
 *
 * Note:
 * We use "canvas" for all html5-canvas related code.
 * We use "board" for the actual representation of the board coming from the backend.
 *
 */
interface Point2D {
    x: number;
    y: number;
}

interface CanvasColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface PixelUpdate extends Point2D {
    color: number;
}

interface FetchBoardResponseData {
    blob: ArrayBuffer; // the actual image (array of 4-bit integers)
    LSN: number; // corresponding LSN
}

interface OnPixelUpdateData extends PixelUpdate {
    _lsn: number;
}

interface FetchMetadataResponseData {
    loginEndpoint: string;
    getBoardEndpoint: string;
    updatePixelEndpoint: string;
    websocketEndpoint: string;
}

class Main {
    private static readonly LOCALHOST_CLIENT_PRINCIPAL_ID = 'PrincicalId';

    // state
    public canvas: Canvas;
    private receivedUpdates: OnPixelUpdateData[] = []; // Assume for now they should be ordered by LSN asc

    private updateClient: UpdateClient;

    private loginEndpoint: string;
    private getBoardEndpoint: string;
    private updatePixelEndpoint: string;
    private websocketEndpoint: string;

    public constructor() {

    }

    public async init(){
        this.canvas = new Canvas({
            onPixelUpdatesSubmitted: this.onPixelUpdatesFromUI.bind(this)
        });

        this.updateClient = new UpdateClient({
            onReceived: this.onPixelUpdateFromRemote.bind(this)
        });

        await this.fetchMetadata();
        this.updateClient.init(this.websocketEndpoint);
        this.fetchBoard();
    }

    private processFetchBoardResponse(data: FetchBoardResponseData) {
        const board8Uint = Main.unpackBoardBlob(new Uint8Array(data.blob));
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
        this.submitPixelUpdates(updates);
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

    /**
     * TODO: return proper promises and fetch board outside
     */
    private async fetchMetadata() {
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: 'http://localhost:7071/api/metadata',
                beforeSend: function (request) {
                    request.setRequestHeader('x-ms-client-principal-id', Main.LOCALHOST_CLIENT_PRINCIPAL_ID);
                },
                success: (data: FetchMetadataResponseData, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                    console.log("Data: " + data + "\nStatus: " + status);
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

    /**
     * TODO: return proper promise
     */
    private fetchBoard() {
        /* Uncomment this to fetch the real board
         *

        $.get(this.getBoardEndpoint,
            (data: FetchBoardResponseData) => {
                alert("Data: " + data + "\nStatus: " + status);
                this.processFetchBoardResponse(data);
            });

        */

        /* TODO: testing code: generate fake board for now */
        setTimeout(() => {
            // Randomize
            // const buffer = new Uint8Array(Canvas.BOARD_WIDTH_PX * Canvas.BOARD_HEIGHT_PX / 2);
            // for (let i = 0; i < buffer.byteLength; i++) {
            //     const color1 = Math.floor(Math.random() * 15);
            //     const color2 = 15;
            //     buffer[i] = 3; //color1 + (color2 << 4); // Always same color alternating to check endianness
            // }

            // this.processFetchBoardResponse({
            //     blob: buffer.buffer,
            //     LSN: 0
            // });
        }, 0);
        /* ******************************* */

    }

    private async submitPixelUpdates(updates: PixelUpdate[]) {
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'POST',
                url: this.updatePixelEndpoint,
                dataType: "json",
                contentType: "application/json",
                beforeSend: function (request) {
                    request.setRequestHeader('x-ms-client-principal-id', Main.LOCALHOST_CLIENT_PRINCIPAL_ID);
                },
                data: JSON.stringify(updates, null, " "),
                success: (data: any, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                    console.log("Data: " + data + "\nStatus: " + textStatus);
                },
                error: (jqXHR: JQuery.jqXHR, textStatus: JQuery.Ajax.ErrorTextStatus, errorThrown: string): void => {
                    console.error(`Failed to submit pixel update:${errorThrown}`);
                    reject(errorThrown);
                }
            });
        });
    }
}

$(document).ready(async () => {
    const main = new Main();
    await main.init();
    ko.applyBindings(main.canvas);
});
