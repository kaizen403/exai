import { LogLine } from "../../types/log";
import { LLMClient } from "../llm/LLMClient";
import { LLMProvider } from "../llm/LLMProvider";
import { StagehandContext } from "../StagehandContext";
import { StagehandPage } from "../StagehandPage";
import { ObserveResult } from "@/types/stagehand";
/**
 * NOTE: Vision support has been removed from this version of Stagehand.
 * If useVision or verifierUseVision is set to true, a warning is logged and
 * the flow continues as if vision = false.
 */
export declare class StagehandActHandler {
    private readonly stagehandPage;
    private readonly verbose;
    private readonly llmProvider;
    private readonly enableCaching;
    private readonly logger;
    private readonly actionCache;
    private readonly actions;
    private readonly userProvidedInstructions?;
    constructor({ verbose, llmProvider, enableCaching, logger, stagehandPage, userProvidedInstructions, }: {
        verbose: 0 | 1 | 2;
        llmProvider: LLMProvider;
        enableCaching: boolean;
        logger: (logLine: LogLine) => void;
        llmClient: LLMClient;
        stagehandPage: StagehandPage;
        stagehandContext: StagehandContext;
        userProvidedInstructions?: string;
    });
    /**
     * Perform an immediate Playwright action based on an ObserveResult object
     * that was returned from `page.observe(...)`.
     */
    actFromObserveResult(observe: ObserveResult): Promise<{
        success: boolean;
        message: string;
        action: string;
    }>;
    private _recordAction;
    private _verifyActionCompletion;
    private _performPlaywrightMethod;
    private _getComponentString;
    private getElement;
    private _checkIfCachedStepIsValid_oneXpath;
    private _getValidCachedStepXpath;
    private _runCachedActionIfAvailable;
    act({ action, steps, chunksSeen, llmClient, retries, requestId, variables, previousSelectors, skipActionCacheForThisStep, domSettleTimeoutMs, }: {
        action: string;
        steps?: string;
        chunksSeen: number[];
        llmClient: LLMClient;
        retries?: number;
        requestId?: string;
        variables: Record<string, string>;
        previousSelectors: string[];
        skipActionCacheForThisStep: boolean;
        domSettleTimeoutMs?: number;
    }): Promise<{
        success: boolean;
        message: string;
        action: string;
    }>;
}
