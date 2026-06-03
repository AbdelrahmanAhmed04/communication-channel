const axios = require('axios');
require('dotenv').config();

async function translateToKuwaitiArabic(text) {
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  };

  const body = {
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a professional translator. Translate all incoming Spanish text into fluent Kuwaiti Arabic, maintaining the original meaning and ensuring it sounds natural for native speakers.'
      },
      {
        role: 'user',
        content: text
      }
    ],
    temperature: 0.2
  };

  try {
    const response = await axios.post(endpoint, body, { headers });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error.response ? error.response.data : error.message);
    throw new Error('Failed to translate text');
  }
}

module.exports = { translateToKuwaitiArabic };
