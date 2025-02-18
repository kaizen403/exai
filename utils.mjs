import fs from "fs";

export function parseChatLine(line) {
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

export function trimMessages(messages, maxMessages = 30) {
  if (messages.length > maxMessages) {
    console.log(`Trimming messages from ${messages.length} to ${maxMessages}.`);
    return messages.slice(-maxMessages);
  }
  return messages;
}
