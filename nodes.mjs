// nodes.mjs
import { HumanMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { parseChatLine, trimMessages } from "./utils.mjs";
import pLimit from "p-limit";
import pRetry from "p-retry";

// ==========================
// loadChatHistory
// ==========================
export async function loadChatHistory(state) {
  console.log("Node loadChatHistory: Entered node.");
  if (state.messages && state.messages.length > 0) {
    console.log("Node loadChatHistory: Chat history already loaded. Skipping.");
    return { currentQuery: state.currentQuery, messages: state.messages };
  }
  console.log(
    "Node loadChatHistory: Processing chat data from provided txtContent.",
  );
  if (state.txtContent) {
    console.log(
      "Node loadChatHistory: txtContent length:",
      state.txtContent.length,
    );
    const lines = state.txtContent
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");
    console.log("Node loadChatHistory: Total lines extracted:", lines.length);
    const parsedChats = lines
      .map(parseChatLine)
      .filter((item) => item !== null);
    console.log("Node loadChatHistory: Parsed chat lines:", parsedChats.length);
    const targetSender = state.senderName || "Anju";
    const filteredChats = parsedChats.filter(
      (chat) => chat.sender === targetSender,
    );
    console.log(
      `Node loadChatHistory: Filtered chat history: ${filteredChats.length} messages from ${targetSender}.`,
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
  } else {
    console.log(
      "Node loadChatHistory: No txtContent provided; returning empty messages.",
    );
    return { messages: [], currentQuery: state.currentQuery };
  }
}

// Node: indexChats
export async function indexChats(state) {
  if (state.vectorStore) {
    console.log(
      "Node indexChats: Vector store already exists. Skipping indexing.",
    );
    return {
      currentQuery: state.currentQuery,
      vectorStore: state.vectorStore,
      globalRetriever: state.globalRetriever,
      sessionId: state.sessionId,
    };
  }
  console.log("Node indexChats: Indexing chat messages...");
  const docs = state.messages.map((msg) => msg.content);
  if (docs.length === 0) {
    console.log("Node indexChats: No documents to index.");
    return { currentQuery: state.currentQuery, sessionId: state.sessionId };
  }
  const { MemoryVectorStore } = await import("langchain/vectorstores/memory");
  const { MistralAIEmbeddings } = await import("@langchain/mistralai");
  console.log("Node indexChats: Creating embeddings with mistral-embed...");
  const embeddings = new MistralAIEmbeddings({
    mistralApiKey: process.env.MISTRAL_API_KEY,
    model: "mistral-embed",
  });
  state.vectorStore = new MemoryVectorStore(embeddings);

  // Increase batch size to 10 to reduce number of calls
  const batchSize = 10;
  const totalBatches = Math.ceil(docs.length / batchSize);
  let completedBatches = 0;

  // Process batches sequentially
  const concurrencyLimit = 1;
  const limit = pLimit(concurrencyLimit);
  const tasks = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    console.log(
      `Node indexChats: Indexing batch ${i} to ${i + batch.length}...`,
    );
    const addBatch = async () => {
      if (state.terminated) {
        console.log("Node indexChats: Session terminated. Aborting indexing.");
        throw new Error("Session terminated");
      }
      await state.vectorStore.addDocuments(
        batch.map((doc) => ({ pageContent: doc, metadata: {} })),
      );
      completedBatches++;
      const progress = Math.round((completedBatches / totalBatches) * 100);
      console.log(
        `Node indexChats: Batch ${i} added successfully. Progress: ${progress}%`,
      );
      if (state.sessionId && global.io) {
        global.io.to(state.sessionId).emit("indexProgress", { progress });
      }
      // Delay 2 seconds between batches to help with rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    };
    tasks.push(
      limit(() =>
        pRetry(addBatch, {
          retries: 7,
          factor: 2,
          minTimeout: 5000,
          onFailedAttempt: (err) => {
            console.warn(
              `Node indexChats: Batch starting at ${i} attempt ${err.attemptNumber} failed. ${err.retriesLeft} retries left. Error: ${err.message}`,
            );
          },
        }),
      ),
    );
  }
  try {
    await Promise.all(tasks);
    console.log("Node indexChats: Finished indexing all docs.");
  } catch (e) {
    console.error("Node indexChats: Indexing error:", e);
    throw e;
  }
  state.globalRetriever = {
    similaritySearch: async (query, k) => {
      const results = await state.vectorStore.similaritySearch(query, k);
      if (!results || results.length === 0) {
        console.log(
          "Node indexChats: No similar documents found for query:",
          query,
        );
        return [];
      }
      return results;
    },
  };
  return {
    docs,
    currentQuery: state.currentQuery,
    vectorStore: state.vectorStore,
    globalRetriever: state.globalRetriever,
    sessionId: state.sessionId,
  };
}

// ==========================
// queryOrRespond
// ==========================
export async function queryOrRespond(state) {
  console.log("Node queryOrRespond: Generating agent response...");
  const instruction = new HumanMessage({
    content:
      "Instruction: Resond in our chat style. I want you to be accurate and not reply with something that is irrevalent or doesnt makes sence for the question. it should be a proper reply and If extra context is needed to answer accurately, include a tool_call using 'retrieve_chat_history' with a valid query in JSON format.",
  });
  const trimmed = trimMessages(state.messages, 30);
  const inputMessages = [instruction, ...trimmed];
  const llmWithTools = new ChatGroq({
    groqApiKey: process.env.GROQ_API_KEY,
    model: "deepseek-r1-distill-llama-70b",
    temperature: 0.4,
  }).bindTools([
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
        return await state.globalRetriever.similaritySearch(query, 30);
      },
    },
  ]);
  const response = await llmWithTools.invoke(inputMessages);
  console.log("Node queryOrRespond: Agent response generated.");
  return {
    messages: [response],
    currentQuery: state.currentQuery,
    vectorStore: state.vectorStore,
    globalRetriever: state.globalRetriever,
  };
}

// ==========================
// generate
// ==========================
export async function generate(state) {
  let question = state.currentQuery;
  if (!question) {
    console.log("Node generate: No current query provided.");
    return {
      currentQuery: "",
      vectorStore: state.vectorStore,
      globalRetriever: state.globalRetriever,
      sessionId: state.sessionId,
    };
  }
  console.log("Node generate: Using question:", question);
  const results = await state.globalRetriever.similaritySearch(question, 30);
  const combinedContext = results.map((r) => r.pageContent).join("\n");
  const senderName = state.senderName || "";
  const customPrompt = ChatPromptTemplate.fromTemplate(`
You are {senderName}, who communicates exactly in the distinctive style found in our chats. Dont be dumb if you dont have enough context. understand the tone and give a proper reply if there is less context. Dont be irrevalent. 


Using the following retrieved context from our past chats, answer the user's question accurately and consistently with that style. if there is not much context u can make something up which is revalent but use the same tone and language and be creative when you do that.  
Keep your answer concise. Use the same tone, same language.

Retrieved context:
{context}

User question:
{question}

Answer:
`);
  const llm = new ChatGroq({
    groqApiKey: process.env.GROQ_API_KEY,
    model: "deepseek-r1-distill-llama-70b",
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

  // Use regex to remove any <think>...</think> content from the response.
  const cleanedContent = response.content.replace(
    /<think>[\s\S]*?<\/think>/gi,
    "",
  );
  response.content = cleanedContent;

  return {
    messages: [response],
    currentQuery: "",
    vectorStore: state.vectorStore,
    globalRetriever: state.globalRetriever,
    sessionId: state.sessionId,
  };
}
