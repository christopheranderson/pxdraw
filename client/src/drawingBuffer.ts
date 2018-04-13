/**
 * Utility class that allows drawing arbitrary shapes and produces a set of de-duped pixel updates
 */
class DrawingBuffer {
    private static readonly FREEHAND_PEN_SIZE_PX = 2; // Freehand drawing uses thicker pen

    private isFreehand: boolean;
    private isPenDown: boolean = false;
    private lastPosition: Point2D = null;

    private updateAggregator: PixelUpdateAggregator;

    constructor(isFreehand: boolean) {
        this.isFreehand = isFreehand;
        this.updateAggregator = new PixelUpdateAggregator();
        this.reset();
    }

    /**
     * Move pen down
     * @param position
     * @param colorIndex
     * @return individual pixel updates for this operation
     */
    public penDown(position: Point2D, colorIndex: number): PixelUpdate[] {
        this.isPenDown = true;
        this.lastPosition = position;

        const updates = this.drawSpot(position, colorIndex);
        this.updateAggregator.addUpdates(updates);
        return updates;
    }

    /**
     * Move pen
     * @param position
     * @param colorIndex
     * @return individual pixel updates for this operation
     */
    public penMove(position: Point2D, colorIndex: number): PixelUpdate[] {
        if (!this.isPenDown || !this.isFreehand) {
            return [];
        }

        // Draw spot
        const updateAgg = new PixelUpdateAggregator();
        const updates = this.drawSpot(position, colorIndex);
        updateAgg.addUpdates(updates);

        // Interpolate from last position
        if (this.lastPosition) {
            const deltaX = position.x - this.lastPosition.x;
            const deltaY = position.y - this.lastPosition.y;
            const incr = Math.max(Math.abs(deltaX), Math.abs(deltaY)); // maximize resolution
            for (let i=0; i<incr; i++) {
                const xi = this.lastPosition.x + Math.round(i * deltaX / incr);
                const yi = this.lastPosition.y + Math.round(i * deltaY / incr);

                const updatesi = this.drawSpot({ x: xi, y: yi }, colorIndex);
                updateAgg.addUpdates(updatesi);
            }
        }
        this.lastPosition = position;
        this.updateAggregator.addUpdates(updateAgg.getAllUpdates());
        return updateAgg.getAllUpdates();
    }

    /**
     * Move pen up
     */
    public penUp() {
        this.isPenDown = false;
    }

    public getAllUpdates(): PixelUpdate[] {
        return this.updateAggregator.getAllUpdates();
    }

    /**
     * Draw single point: for freehand, draw neighboring points
     * @param position
     * @param colorIndex
     */
    public drawSpot(position: Point2D, colorIndex: number): PixelUpdate[] {
        const updates: PixelUpdate[] = [];
        if (!this.isFreehand) {
            updates.push({
                x: position.x,
                y: position.y,
                colorIndex: colorIndex
            });
        } else {
            for (let x = position.x - DrawingBuffer.FREEHAND_PEN_SIZE_PX; x < position.x + DrawingBuffer.FREEHAND_PEN_SIZE_PX + 1; x++) {
                for (let y = position.y - DrawingBuffer.FREEHAND_PEN_SIZE_PX; y < position.y + DrawingBuffer.FREEHAND_PEN_SIZE_PX + 1; y++) {
                    updates.push({
                        x: x,
                        y: y,
                        colorIndex: colorIndex
                    });
                }
            }
        }
        return updates;
    }

    public reset() {
        this.updateAggregator.clear();
    }
}

/**
 * Utility class to accumulate updates and return de-duped updates
 */
class PixelUpdateAggregator {
    private pixelUpdates: { [xy:string]: PixelUpdate };
    constructor() {
        this.clear();
    }
    public addUpdates(updates: PixelUpdate[]) {
        $.each(updates, (index:number, update:PixelUpdate) => {
            this.pixelUpdates[`${update.x}-${update.y}`] = update;
        });
    }

    public getAllUpdates(): PixelUpdate[] {
        const result: PixelUpdate[] = [];
        for (let xy in this.pixelUpdates) {
            result.push(this.pixelUpdates[xy]);
        }
        return result;
    }

    public clear() {
        this.pixelUpdates = {};
    }
}