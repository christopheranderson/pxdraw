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

class Canvas {
    private static readonly BOARD_WIDTH_PX = 1000;
    private static readonly BOARD_HEIGHT_PX = 1000;

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

    // state
    private isFreehandEnabled = true;
    private isMouseDown: boolean = false;
    private pendingUpdates: PixelUpdate[] = [];
    private boardState: Uint8ClampedArray;

    public constructor() {
        // initialize our canvas
        this.canvas = <HTMLCanvasElement>document.getElementById('canvas');
        this.context = this.canvas.getContext('2d');
        this.context.imageSmoothingEnabled = false;

        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), false);

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

        this.boardState = new Uint8ClampedArray(Canvas.BOARD_WIDTH_PX * Canvas.BOARD_HEIGHT_PX * 4);
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
        this.context.fillStyle = "white";
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

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
            this.paintPixel(position, this.selectedColorIndex());

            // don't dupe last updates
            if (this.pendingUpdates.length > 0) {
                const lastUpdate = this.pendingUpdates[this.pendingUpdates.length - 1];
                if (position.x === lastUpdate.position.x && position.y === lastUpdate.position.y &&
                    this.selectedColorIndex() === lastUpdate.colorIndex) {
                        // console.log('skipping redundant update');
                        return;
                    }
            }

            if (this.pendingUpdates)
            this.pendingUpdates.push({
                position: position,
                colorIndex: this.selectedColorIndex()
            });
        }
        // console.log(position);
    }

    private onMouseDown(e: MouseEvent) {
        this.isMouseDown = true;

        const position = this.getCanvasCoordinates(e.clientX, e.clientY);
        this.paintPixel(position, this.selectedColorIndex());
        this.pendingUpdates = [{
            position: position,
            colorIndex: this.selectedColorIndex()
        }];
    }

    private onMouseUp(e: MouseEvent) {
        this.isMouseDown = false;
        this.flushUpdates();
    }

    private flushUpdates() {
        this.submitPixelUpdates(this.pendingUpdates);
        this.pendingUpdates = [];
    }

    private paintPixel(position: Point2D, colorIndex: number) {
        const color = this.availableColors()[colorIndex];
        const imgData = this.context.createImageData(1,1);
        const d = imgData.data;
        d[0] = color.r;
        d[1] = color.g;
        d[2] = color.b;
        d[3] = color.a;
        this.context.putImageData(imgData, position.x, position.y);
    }

    /**
     * TODO For some reason, clicking close to the lower edge of a pixel draws on next pixel below
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

    private static convertBoard(image: ArrayBuffer) {

    }

    private fetchInitialBoard() {
        $.get("/api/build-demo/board",
            (data: any, status: number) => {
                alert("Data: " + data + "\nStatus: " + status);
                Canvas.convertBoard(data.image);


            });
    }

    private submitPixelUpdates(updates: PixelUpdate[]) {
        console.log('Submit updates', updates);
        return;
        // $.post("/Item/Create",
        //     {
        //         X: position.x,
        //         Y: position.y,
        //         Color: color,
        //         UserAgent: navigator.userAgent
        //     },
        //     function (data: any, status: number) {
        //         alert("Data: " + data + "\nStatus: " + status);
        //     });
    }

    public shutdown() {

    }
}

let canvas: Canvas;
$(document).ready(function () {
    canvas = new Canvas();
    ko.applyBindings(canvas);

});
// $(window).unload(function () {
//     canvas.shutdown();
// });