import { z } from "zod";
import { LogLine } from "../types/log";
import { Page, BrowserContext } from "../types/page";
import { ActOptions, ActResult, ConstructorParams, ExtractOptions, ExtractResult, InitFromPageOptions, InitFromPageResult, InitOptions, InitResult, ObserveOptions, ObserveResult } from "../types/stagehand";
import { LLMProvider } from "./llm/LLMProvider";
export declare class Stagehand {
    private stagehandPage;
    private stagehandContext;
    private intEnv;
    browserbaseSessionID?: string;
    readonly domSettleTimeoutMs: number;
    readonly debugDom: boolean;
    readonly headless: boolean;
    verbose: 0 | 1 | 2;
    llmProvider: LLMProvider;
    enableCaching: boolean;
    private apiKey;
    private projectId;
    private externalLogger?;
    private browserbaseSessionCreateParams?;
    variables: {
        [key: string]: unknown;
    };
    private contextPath?;
    private llmClient;
    private userProvidedInstructions?;
    constructor({ env, apiKey, projectId, verbose, debugDom, llmProvider, llmClient, headless, logger, browserbaseSessionCreateParams, domSettleTimeoutMs, enableCaching, browserbaseSessionID, modelName, modelClientOptions, systemPrompt, }?: ConstructorParams);
    get logger(): (logLine: LogLine) => void;
    get page(): Page;
    get env(): "LOCAL" | "BROWSERBASE";
    get context(): BrowserContext;
    init(
    /** @deprecated Use constructor options instead */
    initOptions?: InitOptions): Promise<InitResult>;
    /** @deprecated initFromPage is deprecated and will be removed in the next major version. */
    initFromPage({ page, }: InitFromPageOptions): Promise<InitFromPageResult>;
    private pending_logs_to_send_to_browserbase;
    private is_processing_browserbase_logs;
    log(logObj: LogLine): void;
    private _run_browserbase_log_processing_cycle;
    private _log_to_browserbase;
    /** @deprecated Use stagehand.page.act() instead. This will be removed in the next major release. */
    act(options: ActOptions): Promise<ActResult>;
    /** @deprecated Use stagehand.page.extract() instead. This will be removed in the next major release. */
    extract<T extends z.AnyZodObject>(options: ExtractOptions<T>): Promise<ExtractResult<T>>;
    /** @deprecated Use stagehand.page.observe() instead. This will be removed in the next major release. */
    observe(options?: ObserveOptions): Promise<ObserveResult[]>;
    close(): Promise<void>;
}
export * from "../types/browser";
export * from "../types/log";
export * from "../types/model";
export * from "../types/playwright";
export * from "../types/stagehand";
export * from "../types/page";
export * from "./llm/LLMClient";
