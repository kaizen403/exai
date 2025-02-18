import { Annotation, StateGraph } from "@langchain/langgraph";
import { START, END } from "@langchain/langgraph";
import {
  loadChatHistory,
  indexChats,
  queryOrRespond,
  generate,
} from "./nodes.mjs";

const RootState = Annotation.Root({
  messages: Annotation({
    reducer: (left, right) =>
      Array.isArray(right) ? left.concat(right) : left.concat([right]),
    default: () => [],
  }),
  docs: Annotation({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  txtContent: Annotation({ type: "string" }),
  senderName: Annotation({ type: "string" }),
  currentQuery: Annotation({ type: "string", default: () => "" }),
  vectorStore: Annotation({ type: "object", default: () => null }),
  globalRetriever: Annotation({ type: "object", default: () => ({}) }),
  sessionId: Annotation({ type: "string", default: () => "" }),
  terminated: Annotation({ type: "boolean", default: () => false }),
});

const graphBuilder = new StateGraph(RootState)
  .addNode("loadChatHistory", loadChatHistory)
  .addNode("indexChats", indexChats)
  .addNode("queryOrRespond", queryOrRespond)
  .addNode("generate", generate);

graphBuilder.addEdge(START, "loadChatHistory");
graphBuilder.addEdge("loadChatHistory", "indexChats");
graphBuilder.addEdge("indexChats", "queryOrRespond");
graphBuilder.addEdge("queryOrRespond", "generate");
graphBuilder.addEdge("generate", END);

export const graph = graphBuilder.compile();
