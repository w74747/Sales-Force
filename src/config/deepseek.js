require('dotenv').config();

const DEEPSEEK_CONFIG = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  maxTokens: 2000,
  temperature: 0.7,
};

module.exports = DEEPSEEK_CONFIG;
