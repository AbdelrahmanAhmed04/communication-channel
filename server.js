const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Pusher = require("pusher");
const pool = require("./utils/db");
const { translateToKuwaitiArabic } = require("./utils/translate");
const verifyToken = require("./middleware/verifyToken");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Pusher setup
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

app.get("/", (req, res) => {
  res.send("The server is running");
});

// Incoming message handler (already translated, no DB save needed)
app.post("/incoming", async (req, res) => {
  const { contact_id, full_name, message } = req.body;
  /*
  if (!contact_id || !message?.body) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
*/
  await pusher.trigger(`${contact_id.replace("#", "")}`, "new-message", {
    contactId: contact_id,
    name: full_name || "Customer",
    direction: "Inbound",
    originalText: "",
    translatedText: message.body,
    languageFrom: "Arabic",
    languageTo: "Spanish",
    timestamp: new Date().toISOString(),
    status: "Received",
  });

  delete messageCache[contact_id];
  delete lastCacheTime[contact_id];

  res.status(200).json({ success: true });
});

// Outgoing agent message handler (Spanish text translated to Arabic and saved)
app.post("/outgoing", async (req, res) => {
  const { chatId, contractId, spanishText, from } = req.body;
  try {
    console.log("Outgoing message:", { chatId, contractId, spanishText, from });
    const translatedArabic = await translateToKuwaitiArabic(spanishText);

    await pool.execute(
      `INSERT INTO messages (contact_id, name, phone_number, direction, original_text, translated_text, language_from, language_to, timestamp, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        contractId,
        "Agent", // Static agent name
        "", // No phone number needed for agent
        "Outbound", // Direction
        spanishText,
        translatedArabic,
        "Spanish",
        "Arabic",
        "Sent",
      ],
    );

    await pusher.trigger(`${chatId.replace("#", "")}`, "new-message", {
      contactId: chatId,
      name: "Agent",
      direction: "Outbound",
      originalText: spanishText,
      translatedText: translatedArabic,
      languageFrom: "Spanish",
      languageTo: "Arabic",
      timestamp: new Date().toISOString(),
      status: "Sent",
    });

    delete messageCache[chatId];
    delete lastCacheTime[chatId];
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Outgoing message error:", error);
    res.status(500).json({ message: "Failed to process outgoing message." });
  }
});

// In-memory cache for messages per chatId
let messageCache = {};
let lastCacheTime = {};

// Get all messages for a chatId (Protected, with per-chat cache)
app.get("/messages", verifyToken, async (req, res) => {
  const { chatId } = req.query;
  if (!chatId) {
    return res.status(400).json({ message: "chatId is required" });
  }

  const now = Date.now();

  if (messageCache[chatId] && now - lastCacheTime[chatId] < 30000) {
    return res.status(200).json({ messages: messageCache[chatId] });
  }

  const [rows] = await pool.execute(
    `SELECT contact_id, name, direction,phone_number, original_text, translated_text, language_from, language_to, timestamp, status 
     FROM messages 
     WHERE contact_id = ? 
     ORDER BY timestamp DESC 
     LIMIT 100`,
    [chatId],
  );

  const formattedMessages = rows.map((msg) => ({
    contactId: msg.contact_id,
    name: msg.name,
    direction: msg.direction,
    originalText: msg.original_text,
    phoneNumber: msg.phone_number,
    translatedText: msg.translated_text,
    languageFrom: msg.language_from,
    languageTo: msg.language_to,
    timestamp: msg.timestamp,
    status: msg.status,
  }));

  messageCache[chatId] = formattedMessages;
  lastCacheTime[chatId] = now;

  res.status(200).json({ messages: formattedMessages });
});

// Get all messages across all chats (Protected, with cache)
app.get("/messages/all", verifyToken, async (req, res) => {
  const now = Date.now();

  if (messageCache["all"] && now - lastCacheTime["all"] < 30000) {
    return res.status(200).json({ messages: messageCache["all"] });
  }

  const [rows] = await pool.execute(
    `SELECT contact_id,phone_number, name, direction, original_text, translated_text, language_from, language_to, timestamp, status 
     FROM messages 
     ORDER BY timestamp DESC 
     LIMIT 500`,
  );

  const formattedMessages = rows.map((msg) => ({
    contactId: msg.contact_id,
    name: msg.name,
    direction: msg.direction,
    originalText: msg.original_text,
    translatedText: msg.translated_text,
    phoneNumber: msg.phone_number,
    languageFrom: msg.language_from,
    languageTo: msg.language_to,
    timestamp: msg.timestamp,
    status: msg.status,
  }));

  messageCache["all"] = formattedMessages;
  lastCacheTime["all"] = now;

  res.status(200).json({ messages: formattedMessages });
});

// Search chats by contractId (Protected)
app.get("/search", verifyToken, async (req, res) => {
  const { contractId } = req.query;

  const [rows] = await pool.execute(
    `SELECT DISTINCT chat_id, contract_id FROM messages WHERE contract_id LIKE ?`,
    [`%${contractId}%`],
  );

  res.status(200).json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;
