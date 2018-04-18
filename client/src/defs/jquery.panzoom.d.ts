/*  Type definitions for jquery.panzoom
    https://github.com/timmywil/jquery.panzoom
 */

interface PanzoomOption {
    increment?: number;
    cursor?: string;
    which?: number;
    panOnlyWhenZoomed?: boolean;
    disablePan?: boolean;
    minScale?: number;
    maxScale?: number;
    contain?: string;
}

interface Panzoom {
    parent: () => JQuery;
    panzoom: (eventName: string, ...args: any[]) => void;
    on: (eventName: string, handler: (e: any, panzoom: any, transform: number[]) => void) => void;
}

interface JQuery<TElement extends Node = HTMLElement> extends Iterable<TElement> {
    panzoom: (config: PanzoomOption) => Panzoom;
}