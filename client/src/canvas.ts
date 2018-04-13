/**
 * Canvas-related code
 */
interface CanvasParameters {
    onPixelUpdatesSubmitted: (updates: PixelUpdate[]) => void; // called when pixel updates submitted by user
}

class Canvas {
    public static readonly BOARD_WIDTH_PX = 1000;
    public static readonly BOARD_HEIGHT_PX = 1000;

    // 16 colors according to this: http://www.december.com/html/spec/color16codes.html
    private static readonly COLOR_PALETTE_16: CanvasColor[] = [
        { r: 0, g: 0, b: 0, a: 255 }, // black
        { r: 128, g: 128, b: 128, a: 255 }, // gray
        { r: 192, g: 192, b: 192, a: 255 }, // silver
        { r: 255, g: 255, b: 255, a: 255 }, // white
        { r: 128, g: 0, b: 0, a: 255 }, // maroon
        { r: 255, g: 0, b: 0, a: 255 }, // red
        { r: 128, g: 128, b: 0, a: 255 }, // olive
        { r: 255, g: 255, b: 0, a: 255 }, // yellow
        { r: 0, g: 255, b: 0, a: 255 }, //green
        { r: 0, g: 128, b: 0, a: 255 }, // lime
        { r: 0, g: 128, b: 128, a: 255 }, // teal
        { r: 0, g: 255, b: 255, a: 255 }, // aqua
        { r: 0, g: 0, b: 128, a: 255 }, // navy
        { r: 0, g: 0, b: 255, a: 255 }, // blue
        { r: 128, g: 0, b: 128, a: 255 }, // purple
        { r: 255, g: 0, b: 255, a: 255 } // fuchsia
    ];

    private zoomScale = 1;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private currentPositionStr: KnockoutObservable<string>;
    private availableColors: KnockoutObservableArray<CanvasColor>;
    private selectedColorIndex: KnockoutObservable<number>;
    private params: CanvasParameters;

    // state
    private isFreehandEnabled = true;
    private isMouseDown: boolean = false;
    private drawingBuffer: DrawingBuffer;

     // This array buffer will hold color data to be drawn to the canvas.
     private buffer: ArrayBuffer;
     // This view into the buffer is used to construct the PixelData object
     // for drawing to the canvas
     private readBuffer: Uint8ClampedArray;
     // This view into the buffer is used to write.  Values written should be
     // 32 bit colors stored as AGBR (rgba in reverse).
     private writeBuffer: Uint32Array;


    // private queuedUpdate: PixelUpdate[] = [];

    public constructor(params: CanvasParameters) {
        this.params = params;

        this.canvas = <HTMLCanvasElement>document.getElementById('canvas');
        this.context = this.canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;

        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.canvas.addEventListener('touchstart', this.onMouseDown.bind(this), false);
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        this.canvas.addEventListener('touchend', this.onMouseUp.bind(this), false);
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        this.canvas.addEventListener('touchmove', this.onMouseMove.bind(this), false);

        var $section = $('#canvas-container');
        var $panzoom = $section.find('#canvas').panzoom({
            cursor: 'default',
            which: 3,
            // panOnlyWhenZoomed: true,
            // disablePan: true,
            minScale: 1,
            maxScale: 40
        });
        $panzoom.parent().on('mousewheel.focal', function( e:any ) {
          e.preventDefault();
          var delta = e.delta || e.originalEvent.wheelDelta;
          var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
          $panzoom.panzoom('zoom', zoomOut, {
            animate: false,
            focal: e
          });
        });

        const self = this;
        $panzoom.on('panzoomchange', function(e: any, panzoom: any, transform: number[]) {
            self.zoomScale = transform[0];
        });
        this.currentPositionStr = ko.observable('');

        this.availableColors = ko.observableArray(Canvas.COLOR_PALETTE_16);
        this.selectedColorIndex = ko.observable(0);

        this.buffer = new ArrayBuffer(Canvas.BOARD_WIDTH_PX * Canvas.BOARD_HEIGHT_PX * 4);
        this.readBuffer = new Uint8ClampedArray(this.buffer);
        this.writeBuffer = new Uint32Array(this.buffer);

        this.drawingBuffer = new DrawingBuffer(this.isFreehandEnabled);

        // TODO REMOVE THIS
        this.loadDummyImage();
    }

    private selectColorIndex(index: number) {
        this.selectedColorIndex(index);
    }

    private toRGBA(index: number) {
        const color = this.availableColors()[index];
        return `rgba(${color.r},${color.g},${color.b},${color.a})`;
    }

    /**
     * For testing make sure something's there
     */
    private loadDummyImage() {
        // this.context.fillStyle = "white";
        // this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // get the size of our canvas
        var canvas_width = this.canvas.width,
            canvas_height = this.canvas.height;

        var canvas_center_x = canvas_width / 2;
        var canvas_center_y = canvas_height / 2;

        var canvasPos = { "deltaX": 0, "deltaY": 0 };

        var initialImageWidth = 500;
        var newImageHeight = 0;

        var image_height:number, image_width:number;

        var imageXPos:number, imageYPos:number;

        // load our large image
        var img: any;
        img = new Image();
        const self = this;

        img.onload = function () {

            /*
            # image is done loading, now we can paint it to the canvas

            1) 0, 0 represents the x,y of the upper left corner where we place the image

            2) canvas_width, canvas_height represents how large we want to display the image

            3) The image might have a different scaling than the canvas so we might see
               the image stretch or shrink.

            4) let's calculate how to correctly display the image using the aspect ratio to fit
               a pre-defined width (500px);
            */

            image_height = img.height;
            image_width = img.width;
            newImageHeight = image_height / image_width * initialImageWidth;

            calculate_center();

            canvasPos.deltaX = imageXPos;
            canvasPos.deltaY = imageYPos;

            self.context.drawImage(img, imageXPos, imageYPos, initialImageWidth, newImageHeight);
        }
        img.src = "img/tshirt_red.png";

        var calculate_center = function () {

            // center of the image currently
            var image_center_x = initialImageWidth / 2;
            var image_center_y = newImageHeight / 2;

            // subtract the cavas size by the image center, that's how far we need to move it.
            imageXPos = canvas_center_x - image_center_x;
            imageYPos = canvas_center_y - image_center_y;

        }
    }

    private onMouseMove(e: MouseEvent) {
        const position = this.getCanvasCoordinates(e.clientX, e.clientY);
        this.currentPositionStr(`(${position.x}, ${position.y})`);

        if (this.isFreehandEnabled && this.isMouseDown) {
            const updates = this.drawingBuffer.penMove(position, this.selectedColorIndex());
            $.each(updates, (index:number, update: PixelUpdate) => {
                this.paintToCanvas(update);
            });
        }
    }

    private onMouseDown(e: MouseEvent) {
        this.isMouseDown = true;
        const position = this.getCanvasCoordinates(e.clientX, e.clientY);

        const updates = this.drawingBuffer.penDown(position, this.selectedColorIndex());
        $.each(updates, (index:number, update: PixelUpdate) => {
            this.paintToCanvas(update);
        });
}

    private onMouseUp(e: MouseEvent) {
        this.isMouseDown = false;
        this.drawingBuffer.penUp();
        this.flushUpdates();
    }

    private flushUpdates() {
        this.params.onPixelUpdatesSubmitted(this.drawingBuffer.getAllUpdates());
        this.drawingBuffer.reset();
    }

    private paintToCanvas(update: PixelUpdate) {
        const color = this.availableColors()[update.color];
        if (!color) {
            console.error('Unknown color', update.color);
            return;
        }
        const imgData = this.context.createImageData(1,1);
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
        // for now, just draw it
        this.paintToCanvas(data);
    }

    /**
     * The internal color palette structure stores colors as AGBR (reversed RGBA) to make writing to the color buffer easier.
     * @param colorIndex
     * @return 32-bit ABGR value corresponding to the color index. Use black if unknown.
     */
    private colorIndex2ABGR(colorIndex: number) {
        if (colorIndex < 0 || colorIndex >= this.availableColors().length) {
            colorIndex = 0;
        }
        const color = this.availableColors()[colorIndex];
        const dataView = new DataView(new ArrayBuffer(4));
        dataView.setUint8(0, color.a);
        dataView.setUint8(1, color.b);
        dataView.setUint8(2, color.g);
        dataView.setUint8(3, color.r);
        return dataView.getUint32(0);
    }

    private paintToBuffer(position: Point2D, color: number) {
        const i = Canvas.coordinates2BufferIndex(position);
        this.writeBuffer[i] = this.colorIndex2ABGR(color);
    }

    private static coordinates2BufferIndex(position: Point2D): number {
        return position.y * Canvas.BOARD_WIDTH_PX + position.x;
    }

    public renderBoard(board: Uint8Array) {
        // For now, just draw it directly onto canvas
        let x = 0;
        let y = 0;
        for (let i = 0; i<board.byteLength; i++) {
            const color = board[i];
            // this.paintPixel({ x:x, y:y }, color);
            this.paintToBuffer({ x:x, y:y }, color);

            if (++x >= Canvas.BOARD_WIDTH_PX) {
                x = 0;
                y++;
            }
        }

        // Now paint over canvas
        const imageData = new ImageData(this.readBuffer, Canvas.BOARD_WIDTH_PX, Canvas.BOARD_HEIGHT_PX);
        this.context.putImageData(imageData, 0, 0);
    }
}
