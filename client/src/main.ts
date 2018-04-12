/**
 * Main entry point.
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

interface PixelUpdate {
    position: Point2D;
    colorIndex: number;
}

interface FetchImageResponseData {
    blob: ArrayBuffer; // the actual image (array of 4-bit integers)
    LSN: number; // corresponding LSN
}

interface PixelUpdatesResponseData {
    success: boolean;
}

interface OnPixelUpdateData {
    update: PixelUpdate;
    LSN: number;
}

class Main {
    private static readonly PIXEL_UPDATE_URL = 'signalR/site';

    // state
    public canvas: Canvas;
    private receivedUpdates: OnPixelUpdateData[] = []; // Assume for now they should be ordered by LSN asc
    private boardState: Uint8ClampedArray;

    private updateClient: UpdateClient;

    public constructor() {
        this.canvas = new Canvas({
            onPixelUpdatesSubmitted: this.onPixelUpdatesFromUI.bind(this)
        });

        this.updateClient = new UpdateClient({
            connectionUrl: Main.PIXEL_UPDATE_URL,
            onReceived: this.onPixelUpdateFromRemote.bind(this)
        });
    }

    private processFetchBoardResponse(data: FetchImageResponseData) {
        const image16Color = Main.unpackBoardBlob(new Uint8Array(data.blob));
    }

    private onPixelUpdateFromRemote(data: OnPixelUpdateData) {
        this.receivedUpdates.push(data);
        this.canvas.queuePixelUpdate(data.update);
    }

    /**
     * User submitted pixel updates through UI
     * @param updates
     */
    private onPixelUpdatesFromUI(updates: PixelUpdate[]) {
        this.requestPixelUpdates(updates);
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

    private fetchBoard() {
        $.get("/api/build-demo/board",
            (data: FetchImageResponseData, status: number) => {
                alert("Data: " + data + "\nStatus: " + status);
                this.processFetchBoardResponse(data);
            });
    }

    private requestPixelUpdates(updates: PixelUpdate[]) {
        console.log('Submit updates', updates);
        $.ajax({
           type: 'POST',
           url: '/api/build-demo/pixel',
           data: updates,
           success: (data: PixelUpdatesResponseData, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                console.log("Data: " + data + "\nStatus: " + status);
            }
        });
    }
}

$(document).ready(function () {
    const main = new Main();
    ko.applyBindings(main.canvas);
});
