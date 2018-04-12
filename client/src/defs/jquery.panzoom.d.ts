/*  Type definitions for jquery.panzoom
    https://github.com/timmywil/jquery.panzoom
 */

 interface PanzoomConfig {
    cursor?: string;
    which?: number;
    panOnlyWhenZoomed?: boolean;
    disablePan?: boolean;
    minScale?: number;
    maxScale?: number;
 }

 interface Panzoom {
    parent: () => JQuery;
    panzoom: (eventName:string, event: any, opts: any) => void;
    on: (eventName: string, handler:(e: any, panzoom: any, transform: number[])=>void ) => void;
 }

 interface JQuery<TElement extends Node = HTMLElement> extends Iterable<TElement> {
    panzoom: (config: PanzoomConfig) => Panzoom;
}