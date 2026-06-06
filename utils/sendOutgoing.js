const axios = require("axios");

async function sendOutgoingMessage(payload) {
  const webhookUrl = process.env.OUTGOING_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      skipped: true,
      reason: "OUTGOING_WEBHOOK_URL is not configured",
    };
  }

  const response = await axios.post(webhookUrl, payload, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });

  return {
    skipped: false,
    status: response.status,
    data: response.data,
  };
}

module.exports = { sendOutgoingMessage };
