// server.mjs
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import { sessions } from "./sessions.js";
import { graph } from "./graph.mjs";
import { HumanMessage } from "@langchain/core/messages";

const app = express();
app.use(cors());

// Only use one JSON middleware with the increased limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Upload endpoint: expects { txtContent, senderName } in the body.
app.post("/upload", (req, res) => {
  const { txtContent, senderName } = req.body;
  console.log("Received upload:");
  console.log("Sender Name:", senderName);
  console.log(
    "txtContent length:",
    txtContent ? txtContent.length : "undefined",
  );
  if (!txtContent || !senderName) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const sessionId = uuidv4();
  sessions[sessionId] = {
    txtContent,
    senderName,
    processing: true,
    terminated: false, // Add this line
    sessionId,
    state: {
      messages: [],
      docs: [],
      currentQuery: "",
      txtContent,
      senderName,
      sessionId,
    },
  };
  console.log(`Created session ${sessionId} for sender ${senderName}`);

  // Simulate processing delay (e.g. indexing) of 3 seconds.
  setTimeout(() => {
    sessions[sessionId].processing = false;
    // Run the pipeline once to initialize the state.
    graph
      .invoke(sessions[sessionId].state)
      .then((updatedState) => {
        sessions[sessionId].state = updatedState;
        io.to(sessionId).emit("processingDone", { message: "Chats are ready" });
        console.log(`Processing complete for session ${sessionId}`);
      })
      .catch((err) => console.error("Error during initial pipeline run:", err));
  }, 3000);

  return res.status(200).json({ sessionId });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinSession", (data) => {
    const { sessionId } = data;
    if (!sessionId) {
      console.error("No sessionId provided by socket", socket.id);
      return;
    }
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
    const sessionData = sessions[sessionId];
    if (sessionData && !sessionData.processing) {
      socket.emit("processingDone", { message: "Chats are ready" });
    }
  });

  socket.on("message", async (payload) => {
    const { sessionId, text } = payload;
    console.log(`Message from session ${sessionId}:`, text);
    const sessionData = sessions[sessionId];
    if (!sessionData) {
      console.error("No session found for", sessionId);
      socket.emit("response", "[Error: session not found]");
      return;
    }
    if (sessionData.processing) {
      socket.emit("response", "[Please wait, chats are still processing...]");
      return;
    }
    let state = sessionData.state || {
      messages: [],
      docs: [],
      currentQuery: "",
      txtContent: sessionData.txtContent,
      senderName: sessionData.senderName,
      sessionId: sessionId,
    };
    state.messages.push(new HumanMessage({ content: text }));
    state.currentQuery = text;
    try {
      state = await graph.invoke(state);
      sessionData.state = state;
      const lastMessage = state.messages[state.messages.length - 1];
      io.to(sessionId).emit("response", lastMessage.content);
    } catch (err) {
      console.error("Error processing message with pipeline:", err);
      socket.emit("response", "[Error processing your message]");
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (!room || room.size === 0) {
          if (sessions[roomId]) {
            sessions[roomId].terminated = true;
            console.log(
              `Session ${roomId} terminated due to no active sockets.`,
            );
            // Delete the session to free up resources
            delete sessions[roomId];
          }
        }
      }
    });
  });
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server is listening on port ${PORT}`);
});
