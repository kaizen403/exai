import type { BrowserContext as PlaywrightContext } from "@playwright/test";
import { Stagehand } from "./index";
export declare class StagehandContext {
    private readonly stagehand;
    private readonly intContext;
    private constructor();
    static init(context: PlaywrightContext, stagehand: Stagehand): Promise<StagehandContext>;
    get context(): PlaywrightContext;
}
