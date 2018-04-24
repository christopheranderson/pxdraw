/**
 * Main entry point.
 *
 * Note:
 * We use "canvas" for all html5-canvas related code.
 * We use "board" for the actual representation of the board coming from the backend.
 *
 */
import { config } from "./config";
import { Canvas, DrawModes } from "./canvas";
import { UpdateClient } from "./updateClient";
import { User } from "./user";

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
    v32: number;
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
    userEndpoint: string;
    logoutEndpoint: string;
}

export interface FetchBoardData {
    board: ArrayBuffer;
    lsn: number;
}

export class Main {
    public static readonly LOCALHOST_CLIENT_PRINCIPAL_ID = 'PrincicalId';
    public static readonly LOCALHOST_CLIENT_PRINCIPAL_IDP = 'aad'; // use twitter for non-admin
    private static readonly REFRESH_BOARD_DELAY_MS = 30000;
    private static readonly DRAW_DELAY_S = 30;
    private static readonly TIME_UPDATE_MS = 1000; // Update every second

    // state
    public canvas: Canvas;
    private receivedUpdates: OnPixelUpdateData[] = []; // Assume for now they should be ordered by LSN asc
    private nextUpdateTime: Date;

    private updateClient: UpdateClient;
    private user: User;

    private loginEndpoint: string;
    private getBoardEndpoint: string;
    private updatePixelEndpoint: string;
    private websocketEndpoint: string;
    private userEndpoint: string;
    private logoutEndpoint: string;

    // UI
    private loginUrl: KnockoutObservable<string>;
    private logoutUrl: KnockoutObservable<string>;
    private isLoggedIn: KnockoutObservable<boolean>;
    private isAdmin: KnockoutObservable<boolean>;
    private isFreehandDrawing: KnockoutObservable<boolean>;
    private timerId: number;
    private remainingTimeDisplay: KnockoutObservable<string>;
    private isNow: KnockoutObservable<boolean>;

    public constructor() {
        this.canvas = new Canvas({
            onPixelUpdatesSubmitted: this.onPixelUpdatesFromUI.bind(this)
        });

        this.isNow = ko.observable(false);
        this.remainingTimeDisplay = ko.observable(null);
        this.remainingTimeDisplay.subscribe(() => {
            this.isNow(this.getRemainingMsBeforeDraw() <= 0);
        });
        this.loginUrl = ko.observable(null);
        this.logoutUrl = ko.observable(null);
        this.isLoggedIn = ko.observable(false);
        this.isAdmin = ko.observable(false);
        this.isFreehandDrawing = ko.observable(this.canvas.drawMode() === DrawModes.Freehand);
        this.isFreehandDrawing.subscribe((newValue: boolean) => {
            this.canvas.drawMode(newValue? DrawModes.Freehand:DrawModes.Pixel);
        });
        this.timerId = 0;
    }

    public async init(){
        this.updateClient = new UpdateClient({
            onReceived: this.onPixelUpdateFromRemote.bind(this)
        });

        await this.fetchMetadata();

        // TODO Remove test code
        // this.getBoardEndpoint = 'https://pxdrawbuild18dev.blob.core.windows.net/dev/board1';
        // this.websocketEndpoint = 'https://pxdraw-build18-notifcations.azurewebsites.net/hubs/notifications';
        // this.userEndpoint = 'http://blah';
        // this.loginEndpoint = 'http://login';
        // this.logoutEndpoint = 'http://logout';

        this.loginUrl(this.loginEndpoint);
        this.logoutUrl(this.logoutEndpoint);
        try {
            this.user = await User.getUser(this.userEndpoint);

            // TODO remove test code
            // this.user = {
            //     isAdmin: true,
            //     lastUpdate: new Date(new Date().getTime() - 3000),
            //     id: 'userid'
            // };

            this.isLoggedIn(true);
            this.isAdmin(this.user.isAdmin);
            this.enableDraw(true);
            this.isFreehandDrawing(this.user.isAdmin);
            this.updateNextUpdateTime(this.user.lastUpdate);

        } catch (e) {
            console.log("User is not logged in");
        }

        this.updateClient.init(this.websocketEndpoint);

        // Periodic board update
        this.updateBoard();
        setInterval(this.updateBoard.bind(this), Main.REFRESH_BOARD_DELAY_MS);
    }

    private processFetchBoardResponse(data: ArrayBuffer) {
        const board8Uint = Main.unpackBoardBlob(new Uint8Array(data));
        this.canvas.queueBoardUpdate(board8Uint);
    }

    private onPixelUpdateFromRemote(data: OnPixelUpdateData) {
        this.receivedUpdates.push(data);
        this.canvas.queuePixelUpdate(data);
    }

    private enableDraw(enable: boolean) {
        if (enable) {
            this.canvas.drawMode(this.user.isAdmin? DrawModes.Freehand:DrawModes.Pixel);
        } else {
            if (!this.user.isAdmin) {
                this.canvas.drawMode(DrawModes.Disabled);
            }
        }
    }

    /**
     * User submitted pixel updates through UI
     * @param updates
     */
    private onPixelUpdatesFromUI(updates: PixelUpdate[]) {
        this.submitPixelUpdates(updates).catch((err) => {
            console.error(err);
        });
    }

    private startUpdateTimer() {
        clearTimeout(this.timerId);

        const remainingMs = this.getRemainingMsBeforeDraw();
        if (remainingMs <= 0 || this.isAdmin()) {
            this.enableDraw(true);
            this.remainingTimeDisplay('Now!');
        } else {
            this.enableDraw(false);
            this.remainingTimeDisplay(`${Math.ceil(remainingMs / 1000)}s`);
            this.timerId = setTimeout(this.startUpdateTimer.bind(this), Main.TIME_UPDATE_MS);
        }
    }

    private getRemainingMsBeforeDraw(): number {
        if (!this.nextUpdateTime) {
            return 0;
        }
        return this.nextUpdateTime.getTime() - new Date().getTime();
    }

    private updateNextUpdateTime(lastUpdate: Date) {
        this.nextUpdateTime = new Date();

        if (lastUpdate) {
            this.nextUpdateTime = lastUpdate;
            this.nextUpdateTime.setSeconds(this.nextUpdateTime.getSeconds() + Main.DRAW_DELAY_S);
        }

        this.startUpdateTimer();
    }

    /**
     * Board blob is an array of 4-bit integer: 0-15 color index for each pixel.
     * Convert this into an easier array to read.
     *
     * @param blob
     * @return result is a [width * height] array of 1-byte
     */
    private static unpackBoardBlob(blob: Uint8Array): Uint8Array {
        const start = performance.now();
        const result = new Uint8Array(Canvas.BOARD_WIDTH_PX * Canvas.BOARD_HEIGHT_PX);

        for (var i = 0; i < blob.byteLength; i++) {
            const byte = blob[i];
            result[i * 2] = byte >> 4;
            result[i * 2 + 1] = byte & 0xF;
        }
        console.log(`unpackBoardBlob: ${performance.now() - start} ms`);
        return result;
    }

    private async fetchMetadata() {
        return new Promise((resolve, reject) => {
            $.ajax({
                type: 'GET',
                url: config.metadataEndpoint,
                crossDomain: true,
                success: (data: FetchMetadataResponseData, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                    this.loginEndpoint = data.loginEndpoint;
                    this.getBoardEndpoint = data.getBoardEndpoint;
                    this.updatePixelEndpoint = data.updatePixelEndpoint;
                    this.websocketEndpoint = data.websocketEndpoint;
                    this.userEndpoint = data.userEndpoint;
                    this.logoutEndpoint = data.logoutEndpoint;
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
        const start = performance.now();

        const validUpdates:OnPixelUpdateData[] = [];
        console.log(`Replaying ${this.receivedUpdates.length} received updates`);
        let count = 0;
        for (let i=0; i<this.receivedUpdates.length; i++) {
            const update = this.receivedUpdates[i];
            if (startLsn <= update._lsn) {
                validUpdates.push(update);
                this.canvas.queuePixelUpdate(update);
                count++;
            }
        }
        this.receivedUpdates = validUpdates;

        console.log(`Replayed ${count} updates took ${performance.now() - start} ms`);
    }

    private async submitPixelUpdates(updates: PixelUpdate[]):Promise<{}> {
        const remainingMs = this.getRemainingMsBeforeDraw();
        if (remainingMs > 0 && !this.user.isAdmin) {
            const error = `Must wait another ${remainingMs}ms`;
            return Promise.reject(new Error(error));
        }
        console.log(`Submitting ${updates.length} updates`);

        const numberOfBatches = updates.length / BATCH_SIZE;
        const promises = [];
        for(let i = 0; i < numberOfBatches; i++)
        {
            const data = JSON.stringify(updates.slice(i*BATCH_SIZE, (i+1)*BATCH_SIZE));
            promises.push(new Promise((resolve, reject) => {
                $.ajax({
                    type: 'POST',
                    url: this.updatePixelEndpoint,
                    contentType: "application/json",
                    xhrFields: {
                        withCredentials: true
                    },
                    beforeSend: function (request) {
                        if(config.isLocal) {
                            // locally, we spoof the header
                            request.setRequestHeader('x-ms-client-principal-id', Main.LOCALHOST_CLIENT_PRINCIPAL_ID);
                            request.setRequestHeader('x-ms-client-principal-idp', Main.LOCALHOST_CLIENT_PRINCIPAL_IDP);
                        }
                    },
                    data,
                    success: (data: any, textStatus: JQuery.Ajax.SuccessTextStatus, jqXHR: JQuery.jqXHR): void => {
                        console.log("Data: " + data + "\nStatus: " + textStatus);
                        this.updateNextUpdateTime(new Date());
                    },
                    error: (jqXHR: JQuery.jqXHR, textStatus: JQuery.Ajax.ErrorTextStatus, errorThrown: string): void => {
                        console.error(`Failed to submit pixel update:${errorThrown}`);

                        // TODO Remove test code
                        // this.updateNextUpdateTime(new Date());

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
