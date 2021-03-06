/**
 * Utility class that allows drawing arbitrary shapes and produces a set of de-duped pixel updates
 */
import {PixelUpdate, CanvasColor, Point2D} from "./main";

export class DrawingBuffer {
    private static readonly FREEHAND_PEN_SIZE_PX = 1; // Freehand drawing uses thicker pen

    public isFreehand: boolean;
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
     * @param color
     * @return individual pixel updates for this operation
     */
    public penDown(position: Point2D, color: number): PixelUpdate[] {
        this.isPenDown = true;
        this.lastPosition = position;

        // const updates = this.drawSpot(position, color);
        // this.updateAggregator.addUpdates(updates);
        // return updates;
        return [];
    }

    /**
     * Move pen
     * @param position
     * @param color
     * @return individual pixel updates for this operation
     */
    public penMove(position: Point2D, color: number): PixelUpdate[] {
        if (!this.isPenDown || !this.isFreehand) {
            return [];
        }

        // Draw spot
        const updateAgg = new PixelUpdateAggregator();
        const updates = this.drawSpot(position, color);
        updateAgg.addUpdates(updates);

        // Interpolate from last position
        if (this.lastPosition) {
            const deltaX = position.x - this.lastPosition.x;
            const deltaY = position.y - this.lastPosition.y;
            const incr = Math.max(Math.abs(deltaX), Math.abs(deltaY)); // maximize resolution
            for (let i=0; i<incr; i++) {
                const xi = this.lastPosition.x + Math.round(i * deltaX / incr);
                const yi = this.lastPosition.y + Math.round(i * deltaY / incr);

                const updatesi = this.drawSpot({ x: xi, y: yi }, color);
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
    public penUp(position: Point2D, color: number): PixelUpdate[] {
        this.isPenDown = false;

        let updates: PixelUpdate[] = [];

        if (!position) {
            // Touch up doesn't provide position
            position = this.lastPosition;
        }

        if (position) {
            updates = this.drawSpot(position, color);
            this.updateAggregator.addUpdates(updates);
        }
        return updates;
    }

    public getAllUpdates(): PixelUpdate[] {
        return this.updateAggregator.getAllUpdates();
    }

    /**
     * Draw single point: for freehand, draw neighboring points
     * @param position
     * @param color
     */
    public drawSpot(position: Point2D, color: number): PixelUpdate[] {
        const updates: PixelUpdate[] = [];
        if (!this.isFreehand) {
            updates.push({
                x: position.x,
                y: position.y,
                color: color
            });
        } else {
            const maxX = position.x + DrawingBuffer.FREEHAND_PEN_SIZE_PX + 1;
            const maxY = position.y + DrawingBuffer.FREEHAND_PEN_SIZE_PX + 1;
            for (let x = position.x - DrawingBuffer.FREEHAND_PEN_SIZE_PX; x < maxX; x++) {
                for (let y = position.y - DrawingBuffer.FREEHAND_PEN_SIZE_PX; y < maxY; y++) {
                    updates.push({
                        x: x,
                        y: y,
                        color: color
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