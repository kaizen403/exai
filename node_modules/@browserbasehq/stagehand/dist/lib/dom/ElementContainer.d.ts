import { StagehandContainer } from "./StagehandContainer";
export declare class ElementContainer implements StagehandContainer {
    private el;
    constructor(el: HTMLElement);
    getViewportHeight(): number;
    getScrollHeight(): number;
    scrollTo(offset: number): Promise<void>;
    private waitForScrollEnd;
}
