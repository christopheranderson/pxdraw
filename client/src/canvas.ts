/**
 * Canvas-related code
 */
import { PixelUpdate, CanvasColor, Point2D } from "./main";
import { DrawingBuffer } from "./drawingBuffer";

interface CanvasParameters {
    onPixelUpdatesSubmitted: (updates: PixelUpdate[]) => void; // called when pixel updates submitted by user
    onDisabledPixelInsert: () => void; // called when the canvas receives a pixel update when in Disabled mode
}

enum TouchStates {
    SingleDown,
    MultiDown,
    Up
}

export enum DrawModes {
    Freehand,
    Pixel,
    Disabled
}

interface Rect {
    x1: number,
    y1: number,
    x2: number,
    y2: number
}

export class Canvas {
    public static readonly BOARD_WIDTH_PX = 1000;
    public static readonly BOARD_HEIGHT_PX = 1000;
    private static readonly ZOOM_MIN_SCALE = 0.1;
    private static readonly ZOOM_MAX_SCALE = 40;
    private static readonly UNSTABLE_ZOOM = 0.5;
    private static readonly MIN_MOUSE_MOVE_PX = 5; // minimum mouse move that qualifies as a drag
    public static readonly INITIAL_ZOOM = 20;

    // 16 colors according to this: http://www.december.com/html/spec/color16codes.html
    private static readonly COLOR_PALETTE_16: CanvasColor[] = [
        { r: 0, g: 0, b: 0, a: 255, v32: 0 }, // black
        { r: 128, g: 128, b: 128, a: 255, v32: 0 }, // gray
        { r: 192, g: 192, b: 192, a: 255, v32: 0 }, // silver
        { r: 255, g: 255, b: 255, a: 255, v32: 0 }, // white
        { r: 128, g: 0, b: 0, a: 255, v32: 0 }, // maroon
        { r: 255, g: 0, b: 0, a: 255, v32: 0 }, // red
        { r: 128, g: 128, b: 0, a: 255, v32: 0 }, // olive
        { r: 255, g: 255, b: 0, a: 255, v32: 0 }, // yellow
        { r: 0, g: 255, b: 0, a: 255, v32: 0 }, //green
        { r: 0, g: 128, b: 0, a: 255, v32: 0 }, // lime
        { r: 0, g: 128, b: 128, a: 255, v32: 0 }, // teal
        { r: 0, g: 255, b: 255, a: 255, v32: 0 }, // aqua
        { r: 0, g: 0, b: 128, a: 255, v32: 0 }, // navy
        { r: 0, g: 0, b: 255, a: 255, v32: 0 }, // blue
        { r: 128, g: 0, b: 128, a: 255, v32: 0 }, // purple
        { r: 255, g: 0, b: 255, a: 255, v32: 0 } // fuchsia
    ];

    private zoomScale = 1;

    /*
     * Issue: the Edge browser will blur pixels (anti-aliasing) when zooming in the main canvas (this.canvas).
     * In order to address this limitation, a secondary canvas (this.viewportCanvas) is placed right behind the
     * main canvas in the DOM.
     * The main canvas is still in the front in order to receive all mouse events (zoom, pan, click, drag).
     * Drawing is still done on the main canvas, but any change to main canvas triggers a copy to the viewport canvas
     * using DrawImage, which draws at the correct zoom scale non-blurred on Edge.
     * Main canvas is transparent (opacity 0), in order to show the content of the viewport canvas.
     * The viewport canvas is never transformed like the main canvas when zooming and panning: its scale is
     * always 1 and position is fixed and covers the main canvas container. We use css position: absolute, but
     * set z-index lower than main canvas z-index, in order for the mouse events to be sent to the main canvas and not
     * the viewport canvas.
     */
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private viewportCanvas: HTMLCanvasElement;
    private viewportContext: CanvasRenderingContext2D;

    private currentPositionStr: KnockoutObservable<string>;
    private availableColors: KnockoutObservableArray<CanvasColor>;
    private selectedColorIndex: KnockoutObservable<number>;
    private params: CanvasParameters;
    private panZoomElement: Panzoom;
    private canvasContainerElement: JQuery<HTMLElement>;

    // state
    private drawingBuffer: DrawingBuffer;
    private touchState: TouchStates;
    private lastMouseDownPosition: Point2D;
    private totalDragDistance: number;
    public drawMode: KnockoutObservable<DrawModes>;

    // This array buffer will hold color data to be drawn to the canvas.
    private buffer: ArrayBuffer;
    // This view into the buffer is used to construct the PixelData object
    // for drawing to the canvas
    private readBuffer: Uint8ClampedArray;
    // This view into the buffer is used to write.  Values written should be
    // 32 bit colors stored as AGBR (rgba in reverse).
    private writeBuffer: Uint32Array;

    // TODO: Remove this once LSN supported
    private historyBuffer: PixelUpdate[] = [];

    private drawingQueue: PixelUpdate[] = [];
    private pendingBoard: Uint8Array = null;

    private readonly MIN_BATCH_SIZE = 10;
    private readonly MAX_BATCH_SIZE = 300;
    private readonly STEP_SIZE = 50;
    private currentBatchSize = this.MIN_BATCH_SIZE;

    public constructor(params: CanvasParameters) {
        // Pre-calculate palette values to speed up renderBoard()
        // The internal color palette structure stores colors as AGBR (reversed RGBA) to make writing to the color buffer easier.
        $.each(Canvas.COLOR_PALETTE_16, (index: number, color: CanvasColor) => {
            color.v32 = (color.a << 24) + (color.b << 16) + (color.g << 8) + color.r;
        });

        this.drawMode = ko.observable(DrawModes.Disabled);
        this.drawMode.subscribe((newValue: DrawModes) => {
            this.drawingBuffer.isFreehand = newValue === DrawModes.Freehand;
        });

        this.params = params;

        this.canvas = <HTMLCanvasElement>document.getElementById('canvas');
        this.context = this.canvas.getContext('2d');
        this.viewportCanvas = <HTMLCanvasElement>document.getElementById('viewport-canvas');
        this.viewportContext = this.viewportCanvas.getContext('2d');

        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.canvas.addEventListener('touchstart', this.onMouseDown.bind(this), false);
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        this.canvas.addEventListener('touchend', this.onMouseUp.bind(this), false);
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        this.canvas.addEventListener('touchmove', this.onMouseMove.bind(this), false);

        this.canvasContainerElement = $('#canvas-container');

        this.panZoomElement = this.canvasContainerElement.find('#canvas').panzoom({
            cursor: 'default',
            which: 3,
            // panOnlyWhenZoomed: true,
            // disablePan: false,
            minScale: Canvas.ZOOM_MIN_SCALE,
            maxScale: Canvas.ZOOM_MAX_SCALE,
            // contain: 'automatic'
        });
        this.panZoomElement.parent().on('mousewheel.focal', (e: any) => {
            e.preventDefault();
            var delta = e.delta || e.originalEvent.wheelDelta;
            var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
            this.panZoomElement.panzoom('zoom', zoomOut, {
                animate: false,
                focal: e
            });
        });

        this.panZoomElement.on('panzoomchange', (e: any, panzoom: any, transform: number[]) => {
            this.zoomScale = transform[0];
            this.updateViewportCanvas();
        });

        $('#coordinates-container').draggable({ axis: 'y', containment: "#canvas-container", scroll: false });

        window.onresize = this.onWindowResize.bind(this);

        this.currentPositionStr = ko.observable('');

        this.availableColors = ko.observableArray(Canvas.COLOR_PALETTE_16);
        this.selectedColorIndex = ko.observable(0);

        this.buffer = new ArrayBuffer(Canvas.BOARD_WIDTH_PX * Canvas.BOARD_HEIGHT_PX * 4);
        this.readBuffer = new Uint8ClampedArray(this.buffer);
        this.writeBuffer = new Uint32Array(this.buffer);

        this.drawingBuffer = new DrawingBuffer(this.drawMode() === DrawModes.Freehand);
        this.touchState = TouchStates.Up;
        this.lastMouseDownPosition = null;
        this.totalDragDistance = 0;

        this.onWindowResize();

        this.startRenderingLoop(this.flushDrawingQueue.bind(this));
    }

    private onWindowResize() {
        // Viewport canvas size matches canvas container size
        this.viewportCanvas.width = this.canvasContainerElement.width();
        this.viewportCanvas.height = this.canvasContainerElement.height();
        this.centerCanvas();
    }

    public centerCanvas() {
        const BORDER_PX = 1;
        const containerWidth = this.canvasContainerElement.width();
        const containerHeight = this.canvasContainerElement.height();
        let zoomX =  (containerWidth - BORDER_PX) / Canvas.BOARD_WIDTH_PX;
        let zoomY =  (containerHeight - BORDER_PX) / Canvas.BOARD_HEIGHT_PX;
        const zoom = Math.min(zoomX, zoomY);
        let panX = containerWidth / 2 - (Canvas.BOARD_WIDTH_PX / 2);
        let panY = containerHeight / 2 - (Canvas.BOARD_HEIGHT_PX / 2);
        const canvasRect = this.canvas.getBoundingClientRect();
        this.panZoomElement.panzoom('zoom', zoom, {
            animate: false,
            focal: { clientX: canvasRect.left, clientY: canvasRect.top }
        });
        this.panZoomElement.panzoom('pan', panX, panY, { relative: false });
        this.panZoomElement.panzoom('option', 'minScale', zoom);
    }

    private flushDrawingQueue() {
        let xmin: number = Canvas.BOARD_WIDTH_PX;
        let xmax: number = 0;
        let ymin: number = Canvas.BOARD_HEIGHT_PX;
        let ymax: number = 0;

        if (this.pendingBoard) {
            this.renderBoard(this.pendingBoard);
            xmin = 0;
            ymin = 0;
            xmax = Canvas.BOARD_WIDTH_PX;
            ymax = Canvas.BOARD_HEIGHT_PX;
        }

        $.each(this.drawingQueue, (index: number, update: PixelUpdate) => {
            this.paintToCanvas(update);
            xmin = Math.min(xmin, update.x);
            ymin = Math.min(ymin, update.y);
            xmax = Math.max(xmax, update.x + 1);
            ymax = Math.max(ymax, update.y + 1);
        });

        if (this.drawingQueue.length > 0 || this.pendingBoard) {
            this.updateViewportCanvas({ x1: xmin, y1: ymin, x2: xmax, y2: ymax });
        }

        this.drawingQueue = [];
        this.pendingBoard = null;
    }

    /**
     *
     * @param fn
     * @return canceling function
     */
    private startRenderingLoop(fn:()=> void): () => void {
        const executeFn = (ts: number) => {
            fn();
            requestId = window.requestAnimationFrame(executeFn);
        };
        let requestId = window.requestAnimationFrame(executeFn);
        return () => {
            window.cancelAnimationFrame(requestId);
        };
    }

    private selectColorIndex(index: number) {
        this.selectedColorIndex(index);
    }

    private toRGBA(index: number) {
        const color = this.availableColors()[index];
        return `rgba(${color.r},${color.g},${color.b},${color.a})`;
    }


    private getIntermediateBatchSize(): number {
        const batchSize = this.currentBatchSize;
        this.currentBatchSize = (this.currentBatchSize + this.STEP_SIZE) % this.MAX_BATCH_SIZE;
        return this.currentBatchSize;
    }

    private onMouseMove(e: MouseEvent | TouchEvent) {
        let position;
        if (e instanceof MouseEvent) {
            if (e.button !== 0) {
                // Ignore all but left button down
                return;
            }
            position = this.getCanvasCoordinates(e.clientX, e.clientY);

        } else if (e instanceof TouchEvent) {
            if (e.touches.length > 1 || this.touchState === TouchStates.MultiDown) {
                this.touchState = TouchStates.MultiDown;
                // Multitouching (pinching)
                return;
            }
            const t = (<TouchEvent>e).touches[0];
            position = this.getCanvasCoordinates(t.clientX, t.clientY);

            e.stopImmediatePropagation();
        } else {
            console.error('Unknown event', e);
            return;
        }

        this.currentPositionStr(`${position.x + 1}, ${position.y + 1}`);

        if (this.drawMode() === DrawModes.Freehand && this.touchState === TouchStates.SingleDown) {
            const updates = this.drawingBuffer.penMove(position, this.selectedColorIndex());
            $.each(updates, (index: number, update: PixelUpdate) => {
                this.queuePixelUpdate(update);
            });
            const pendingUpdates = this.drawingBuffer.getAllUpdates();
            if(pendingUpdates.length > this.getIntermediateBatchSize()) {
                this.params.onPixelUpdatesSubmitted(pendingUpdates);
                this.drawingBuffer.reset();
            }
        } else {
            if (this.touchState === TouchStates.SingleDown) {
                if (this.zoomScale < Canvas.UNSTABLE_ZOOM) {
                    // Zoom too low, panning to jittery and position diverges. Disable panning.
                    return;
                }
                const dx = position.x - this.lastMouseDownPosition.x;
                const dy = position.y - this.lastMouseDownPosition.y;
                this.panZoomElement.panzoom('pan', dx, dy, { relative: true });
                this.totalDragDistance += Math.hypot(dx, dy);
            }
        }
    }

    private onMouseDown(e: MouseEvent | TouchEvent) {
        this.totalDragDistance = 0;
        this.currentBatchSize = this.MIN_BATCH_SIZE;

        let position;
        if (e instanceof MouseEvent) {
            if (e.button !== 0) {
                // Ignore all but left button down
                return;
            }
            this.touchState = TouchStates.SingleDown;
            position = this.getCanvasCoordinates(e.clientX, e.clientY);

        } else if (e instanceof TouchEvent) {
            const t = (<TouchEvent>e).touches[0];
            position = this.getCanvasCoordinates(t.clientX, t.clientY);

            switch (this.touchState) {
                case TouchStates.Up: this.touchState = TouchStates.SingleDown; break;
                case TouchStates.SingleDown:
                case TouchStates.MultiDown:
                    this.touchState = TouchStates.MultiDown;
                    break;
                default: break;
            }
        } else {
            console.error('Unknown event', e);
            return;
        }

        this.lastMouseDownPosition = position;

        if (this.drawMode() === DrawModes.Freehand || this.drawMode() === DrawModes.Pixel) {
            const updates = this.drawingBuffer.penDown(position, this.selectedColorIndex());
            $.each(updates, (index: number, update: PixelUpdate) => {
                this.queuePixelUpdate(update);
            });
        }
    }

    private onMouseUp(e: MouseEvent | TouchEvent) {
        if (this.touchState === TouchStates.SingleDown) {
            let position = null;
            if (e instanceof MouseEvent) {
                if (e.button !== 0) {
                    // Ignore all but left button down
                    return;
                }
                position = this.getCanvasCoordinates(e.clientX, e.clientY);
            } else if (e instanceof TouchEvent) {

                if (e.touches.length > 1) {
                    const t = (<TouchEvent>e).touches[0];
                    position = this.getCanvasCoordinates(t.clientX, t.clientY);
                }

            } else {
                console.error('Unknown event', e);
                return;
            }

            const hasMouseMoved = this.totalDragDistance > Canvas.MIN_MOUSE_MOVE_PX;
            if ((this.drawMode() === DrawModes.Pixel && !hasMouseMoved) || this.drawMode() === DrawModes.Freehand) {
                const updates = this.drawingBuffer.penUp(position, this.selectedColorIndex());
                $.each(updates, (index: number, update: PixelUpdate) => {
                    this.queuePixelUpdate(update);
                });
                this.params.onPixelUpdatesSubmitted(this.drawingBuffer.getAllUpdates());
            } else if(this.drawMode() === DrawModes.Disabled && !hasMouseMoved) {
                this.params.onDisabledPixelInsert();
            }
            this.drawingBuffer.reset();
        }

        this.touchState = TouchStates.Up;
    }

    private paintToCanvas(update: PixelUpdate) {
        const color = this.availableColors()[update.color];
        if (!color) {
            console.error('Unknown color', update.color);
            return;
        }
        const imgData = this.context.createImageData(1, 1);
        const d = imgData.data;
        d[0] = color.r;
        d[1] = color.g;
        d[2] = color.b;
        d[3] = color.a;
        this.context.putImageData(imgData, update.x, update.y);
    }

    /**
     * Convert mouse x,y to canvas x,y
     * @param x
     * @param y
     */
    private getCanvasCoordinates(x: number, y: number): Point2D {
        var r = this.canvas.getBoundingClientRect();

        return {
            x: Math.floor((x - r.left) / this.zoomScale),
            y: Math.floor((y - r.top) / this.zoomScale)
        }
    }

    public queuePixelUpdate(data: PixelUpdate) {
        this.historyBuffer.push(data);
        this.drawingQueue.push(data);
    }

    public queueBoardUpdate(board: Uint8Array) {
        this.pendingBoard = board;
    }

    private renderBoard(board: Uint8Array) {
        const start = performance.now();

        // For now, just draw it directly onto canvas
        let x = 0;
        let y = 0;
        for (let i = 0; i < board.byteLength; i++) {
            const color = Canvas.COLOR_PALETTE_16[board[i]];
            this.writeBuffer[y * Canvas.BOARD_WIDTH_PX + x] = color.v32;

            if (++x >= Canvas.BOARD_WIDTH_PX) {
                x = 0;
                y++;
            }
        }

        while(this.historyBuffer.length > 0)
        {
            let px = this.historyBuffer.pop();
            const color = Canvas.COLOR_PALETTE_16[px.color];
            this.writeBuffer[px.y * Canvas.BOARD_WIDTH_PX + px.x] = color.v32;
        }

        // Now paint over canvas
        const imageData = new ImageData(this.readBuffer, Canvas.BOARD_WIDTH_PX, Canvas.BOARD_HEIGHT_PX);
        this.context.putImageData(imageData, 0, 0);

        console.log(`renderBoard(): ${performance.now() - start} ms`);
    }

    /**
     * Copy canvas onto viewport canvas (this addresses blurred Edge pixel issue)
     * @param updateRect if specified: only copy this rectangle (in source coordinates)
     */
    private updateViewportCanvas(updateRect?: Rect) {
        const c = this.canvas.getBoundingClientRect();
        const v = this.viewportCanvas.getBoundingClientRect();
        const cx = c.left - v.left;
        const cy = c.top - v.top;

        // More precise and self-contained than using this.zoomScale
        const zoomScale = c.width / Canvas.BOARD_WIDTH_PX;

        if (!updateRect) {
            this.viewportContext.clearRect(0, 0, v.width, v.height);
        }

        let sx = 0;
        let sy = 0;
        let sw = Canvas.BOARD_WIDTH_PX;
        let sh = Canvas.BOARD_HEIGHT_PX;
        let dx = cx;
        let dy = cy;
        let dw = Canvas.BOARD_WIDTH_PX * zoomScale;
        let dh = Canvas.BOARD_HEIGHT_PX * zoomScale;

        if (updateRect) {
            sx = updateRect.x1;
            sy = updateRect.y1;
            sw = updateRect.x2 - updateRect.x1;
            sh = updateRect.y2 - updateRect.y1;
            dx = cx + updateRect.x1 * zoomScale;
            dy = cy + updateRect.y1 * zoomScale;
            dw = sw * zoomScale;
            dh = sh * zoomScale;
        }

        this.viewportContext.mozImageSmoothingEnabled = false;
        this.viewportContext.webkitImageSmoothingEnabled = false;
        (<any>this.viewportContext).msImageSmoothingEnabled = false;
        this.viewportContext.imageSmoothingEnabled = false;
        this.viewportContext.drawImage(this.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
        // console.log('updateViewportCanvas', sx, sy, sw, sh, dx, dy, dw, dh);
    }

    /**
     *
     * @param value true: zoom in, false: zoom out, or number for zoom value
     */
    public executeZoom(value: boolean | number) {
        const containerPos = this.canvasContainerElement.position();
        const center:Point2D = {
            x: containerPos.left + this.canvasContainerElement.width() / 2,
            y: containerPos.top + this.canvasContainerElement.height() / 2
        };

        this.panZoomElement.panzoom('zoom', value, {
            animate: false,
            focal: {
                clientX: center.x,
                clientY: center.y
            }
        });
    }

    private zoomIn(data:any, e: Event) {
        this.executeZoom(false);
    }

    private zoomOut(data:any, e: Event) {
        this.executeZoom(true);
    }
}
