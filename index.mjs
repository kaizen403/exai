import "dotenv/config.js"; // Loads environment variables from .env
import fs from "fs";
import readline from "readline";
import pLimit from "p-limit";
import pRetry from "p-retry";

import { END, START } from "@langchain/langgraph";
import { pull } from "langchain/hub";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";

import { Annotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

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
});

let vectorStore = null;
let globalRetriever = {
  similaritySearch: async (query, k) => {
    if (!vectorStore) {
      console.error("No vector store available for retrieval.");
      return [];
    }
    return vectorStore.similaritySearch(query, k);
  },
};

function parseChatLine(line) {
  const normalizedLine = line
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  const regex = /^\[([^\]]+)\]\s+([^:]+):\s+(.*)$/;
  const match = normalizedLine.match(regex);
  if (match) {
    const [, timestamp, sender, message] = match;
    return {
      timestamp: timestamp.trim(),
      sender: sender.trim(),
      message: message.trim(),
    };
  }
  return null;
}

function loadChatData() {
  const filePath = "_chat.txt";
  try {
    const rawText = fs.readFileSync(filePath, "utf8");
    const lines = rawText.split(/\r?\n/).filter((line) => line.trim() !== "");
    console.log(`Total lines in file: ${lines.length}`);
    const parsed = lines.map(parseChatLine).filter((item) => item !== null);
    console.log(`Parsed ${parsed.length} chat lines from ${filePath}.`);
    return parsed;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

function trimMessages(messages, maxMessages = 30) {
  if (messages.length > maxMessages) {
    console.log(`Trimming messages from ${messages.length} to ${maxMessages}.`);
    return messages.slice(-maxMessages);
  }
  return messages;
}

const tools = [
  {
    type: "function",
    function: {
      name: "retrieve_chat_history",
      description:
        "Searches through past chat history to find relevant information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up in chat history",
          },
        },
        required: ["query"],
      },
    },
    run: async (input) => {
      const { query } = input;
      return await globalRetriever.similaritySearch(query, 30);
    },
  },
];
const toolNode = new ToolNode(tools);

async function loadChatHistory(state) {
  if (state.messages && state.messages.length > 0) {
    console.log("Node loadChatHistory: Chat history already loaded. Skipping.");
    return { currentQuery: state.currentQuery };
  }
  console.log("Node loadChatHistory: Reading _chat.txt...");
  const parsedChats = loadChatData();
  const targetSender = "Anju";
  const filteredChats = parsedChats.filter(
    (chat) => chat.sender === targetSender,
  );
  console.log(
    `Filtered chat history: ${filteredChats.length} messages from ${targetSender}.`,
  );
  const messages = filteredChats.map(
    (chat) =>
      new HumanMessage({
        content: `[${chat.timestamp}] ${chat.sender}: ${chat.message}`,
      }),
  );
  console.log(
    `Node loadChatHistory: Created ${messages.length} HumanMessages from ${targetSender}.`,
  );
  return { messages, currentQuery: state.currentQuery };
}

async function indexChats(state) {
  if (vectorStore) {
    console.log(
      "Node indexChats: Vector store already exists. Skipping indexing.",
    );
    return { currentQuery: state.currentQuery };
  }
  console.log("Node indexChats: Indexing chat messages...");
  const docs = state.messages.map((msg) => msg.content);
  const { MemoryVectorStore } = await import("langchain/vectorstores/memory");
  const { MistralAIEmbeddings } = await import("@langchain/mistralai");
  console.log("Creating embeddings with mistral-embed...");
  const embeddings = new MistralAIEmbeddings({
    mistralApiKey: process.env.MISTRAL_API_KEY,
    model: "mistral-embed",
  });
  vectorStore = new MemoryVectorStore(embeddings);
  const batchSize = 5;
  const concurrencyLimit = 5;
  const limit = pLimit(concurrencyLimit);
  const tasks = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    console.log(
      `Node indexChats: Indexing batch ${i} to ${i + batch.length}...`,
    );
    const addBatch = () =>
      vectorStore.addDocuments(
        batch.map((doc) => ({ pageContent: doc, metadata: {} })),
      );
    tasks.push(
      limit(() =>
        pRetry(addBatch, {
          retries: 5,
          factor: 2,
          minTimeout: 1000,
          onFailedAttempt: (err) => {
            console.warn(
              `Batch starting at ${i} attempt ${err.attemptNumber} failed. ${err.retriesLeft} retries left.`,
            );
          },
        }),
      ),
    );
  }
  await Promise.all(tasks);
  console.log("Node indexChats: Finished indexing all docs.");
  globalRetriever = {
    similaritySearch: async (query, k) => {
      const results = await vectorStore.similaritySearch(query, k);
      if (!results || results.length === 0) {
        console.log("No similar documents found for query:", query);
        return [];
      }
      return results;
    },
  };
  return { docs, currentQuery: state.currentQuery };
}

async function queryOrRespond(state) {
  console.log("Node queryOrRespond: Generating agent response...");
  const instruction = new HumanMessage({
    content:
      "Instruction: Respond as a caring friend in our chat style. If extra context is needed to answer accurately, include a tool_call using 'retrieve_chat_history' with a valid query in JSON format.",
  });
  const trimmed = trimMessages(state.messages, 30);
  const inputMessages = [instruction, ...trimmed];
  const llmWithTools = new ChatGroq({
    groqApiKey: process.env.GROQ_API_KEY,
    model: "llama-3.2-3b-preview",
    temperature: 0.4,
  }).bindTools(tools);
  const response = await llmWithTools.invoke(inputMessages);
  console.log("Node queryOrRespond: Agent response generated.");
  return { messages: [response], currentQuery: state.currentQuery };
}

async function generate(state) {
  let question = state.currentQuery;
  if (!question) {
    const lastMsgContent =
      state.messages[state.messages.length - 1]?.content || "";
    const toolCallMatch = lastMsgContent.match(
      /<function=retrieve_chat_history>(.*)/,
    );
    if (toolCallMatch) {
      let jsonStr = toolCallMatch[1];
      jsonStr = jsonStr.replace(/<\/function>/, "").trim();
      try {
        const payload = JSON.parse(jsonStr);
        question =
          payload.query || (payload.properties && payload.properties.query);
        console.log("Node generate: Extracted tool call query:", question);
      } catch (e) {
        console.error("Error parsing tool call payload:", e);
      }
    }
  }
  if (!question) {
    console.log("Node generate: No current query provided.");
    return { currentQuery: "" };
  }
  console.log("Node generate: Using question:", question);
  const results = await globalRetriever.similaritySearch(question, 30);
  const combinedContext = results.map((r) => r.pageContent).join("\n");
  const senderName = "Anju";
  const customPrompt = ChatPromptTemplate.fromTemplate(`
You are {senderName}, who communicates exactly in the distinctive style found in our chats. and I am the other person from our chats who is texting you and expecting you to give accurate response by mimicking {senderName}.   
Using the following retrieved context from our past chats, answer the user's question accurately and consistently with the same way the chat is it. use the same tone and texting style. 
Keep your answer concise (up to 3 sentences).

Retrieved context:
{context}

User question:
{question}

Answer:
`);
  const llm = new ChatGroq({
    groqApiKey: process.env.GROQ_API_KEY,
    model: "llama-3.2-3b-preview",
    temperature: 0.2,
    streaming: true,
  });
  const ragChain = customPrompt.pipe(llm);
  const response = await ragChain.invoke({
    senderName,
    context: combinedContext,
    question,
  });
  console.log("Node generate: Final answer generated.");
  return { messages: [response], currentQuery: "" };
}

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

const graph = graphBuilder.compile();

async function main() {
  let state = { messages: [], docs: [], currentQuery: "" };

  state = await graph.invoke(state);
  console.log("Initial flow complete. Current state:", state);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("\nYou can now enter your queries (type 'exit' to quit):");

  rl.on("line", async (line) => {
    if (line.trim().toLowerCase() === "exit") {
      console.log("Exiting chat. Goodbye!");
      rl.close();
      process.exit(0);
    }
    state.currentQuery = line;
    state.messages.push(new HumanMessage({ content: line }));

    state = await graph.invoke(state);

    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage) {
      console.log("\nAgent:", lastMessage.content);
    } else {
      console.log("\nAgent: [No response generated]");
    }
    console.log("\nEnter your next query (or type 'exit' to quit):");
  });
}

main().catch((error) => {
  console.error("Error in main execution:", error);
});
