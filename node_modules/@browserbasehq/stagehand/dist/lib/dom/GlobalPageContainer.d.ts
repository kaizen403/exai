import { StagehandContainer } from "./StagehandContainer";
export declare class GlobalPageContainer implements StagehandContainer {
    getViewportHeight(): number;
    getScrollHeight(): number;
    scrollTo(offset: number): Promise<void>;
    private waitForScrollEnd;
}
