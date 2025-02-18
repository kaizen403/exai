import { LogLine } from "../../types/log";
import { AvailableModel, ClientOptions } from "../../types/model";
import { LLMClient } from "./LLMClient";
export declare class LLMProvider {
    private modelToProviderMap;
    private logger;
    private enableCaching;
    private cache;
    constructor(logger: (message: LogLine) => void, enableCaching: boolean);
    cleanRequestCache(requestId: string): void;
    getClient(modelName: AvailableModel, clientOptions?: ClientOptions): LLMClient;
}
