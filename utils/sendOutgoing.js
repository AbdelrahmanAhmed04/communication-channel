const axios = require("axios");

async function sendOutgoingMessage(payload) {
  const webhookUrl = process.env.OUTGOING_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("⚠️ No webhook URL configured");
    return {
      skipped: true,
      reason: "OUTGOING_WEBHOOK_URL is not configured",
    };
  }

  try {
    console.log("📤 Sending to webhook:", webhookUrl);
    console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    console.log("✅ Webhook response status:", response.status);
    console.log("✅ Webhook response data:", response.data);

    return {
      skipped: false,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("❌ Webhook failed:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else if (error.request) {
      console.error("No response received:", error.request);
    } else {
      console.error("Error:", error.message);
    }

    return {
      skipped: false,
      error: true,
      message: error.message,
    };
  }
}

module.exports = { sendOutgoingMessage };
