import "dotenv/config.js";
import readline from "readline";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph.mjs";

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
