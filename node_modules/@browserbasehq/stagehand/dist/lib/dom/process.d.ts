import { StagehandContainer } from "./StagehandContainer";
export declare function isElementNode(node: Node): node is Element;
export declare function isTextNode(node: Node): node is Text;
export declare function processDom(chunksSeen: Array<number>): Promise<{
    outputString: string;
    selectorMap: Record<number, string[]>;
    chunk: number;
    chunks: number[];
}>;
export declare function processAllOfDom(): Promise<{
    outputString: string;
    selectorMap: {};
}>;
export declare function processElements(chunk: number, scrollToChunk?: boolean, indexOffset?: number, container?: StagehandContainer): Promise<{
    outputString: string;
    selectorMap: Record<number, string[]>;
}>;
export declare function storeDOM(): string;
export declare function restoreDOM(storedDOM: string): void;
export declare function createTextBoundingBoxes(): void;
export declare function getElementBoundingBoxes(xpath: string): Array<{
    text: string;
    top: number;
    left: number;
    width: number;
    height: number;
}>;
