"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import io, { Socket } from "socket.io-client";
import { FaRocket, FaComments } from "react-icons/fa";

type Message = {
  id: number;
  sender: "user" | "contact";
  text: string;
  time: string;
};

let socket: Socket | null = null;

export default function ChatsPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const senderName = searchParams.get("senderName") || "Unknown Sender";
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [processing, setProcessing] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!socket) {
      socket = io("https://13.233.105.76/");
      socket.on("connect", () => {
        console.log("Socket connected:", socket?.id);
        socket?.emit("joinSession", { sessionId });
      });

      socket.on("processingDone", (data) => {
        console.log("Processing done event received:", data);
        setProcessing(false);
      });

      socket.on("response", (text: string) => {
        console.log("Response received:", text);
        setIsTyping(false);
        const now = new Date();
        const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
        setMessages((prev) => [
          ...prev,
          { id: prev.length + 1, sender: "contact", text, time: timeStr },
        ]);
      });

      return () => {
        socket?.disconnect();
        socket = null;
      };
    }
  }, [sessionId]);

  const handleSend = () => {
    if (!newMessage.trim() || processing) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    const userMsg = {
      id: messages.length + 1,
      sender: "user" as const,
      text: newMessage,
      time: timeStr,
    };
    setMessages((prev) => [...prev, userMsg]);
    setNewMessage("");
    setIsTyping(true);
    socket?.emit("message", { sessionId, text: newMessage });
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white flex flex-col">
      {/* Top Bar */}
      <header className="bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <FaRocket className="w-8 h-8 text-green-500" />
          <span className="text-2xl font-bold">Exai</span>
        </div>
        <div className="flex items-center space-x-2">
          <FaComments className="w-6 h-6" />
          <span className="text-lg">{senderName}</span>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 relative p-4 overflow-y-auto">
        {processing && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-80 z-10 flex items-center justify-center">
            <p className="text-xl font-semibold">
              Indexing chat data… please wait.
            </p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-xl text-sm shadow ${
                  msg.sender === "user" ? "bg-green-800" : "bg-gray-700"
                }`}
              >
                <p>{msg.text}</p>
                <div className="text-gray-300 text-xs text-right mt-1">
                  {msg.time}
                </div>
              </div>
            </div>
          ))}
          {isTyping && !processing && (
            <div className="flex justify-start">
              <div className="max-w-[70%] p-3 rounded-xl text-sm shadow bg-gray-700 italic animate-pulse">
                Typing…
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Input Box */}
      <footer className="bg-gray-800 p-4 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 border border-gray-600 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700"
            disabled={processing}
          />
          <button
            onClick={handleSend}
            disabled={processing}
            className="bg-green-800 text-white py-3 px-6 rounded-lg hover:bg-green-900 disabled:opacity-50 transition"
          >
            Send
          </button>
        </div>
        <div className="mt-4 text-center text-xs text-gray-500">
          developed by <span className="font-semibold">@rishivhavle</span> |{" "}
          <a
            href="https://syncline.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-300"
          >
            syncline.tech
          </a>
        </div>
      </footer>
    </div>
  );
}
