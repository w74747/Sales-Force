require('dotenv').config();

const WHATSAPP_CONFIG = {
  sessionPath: process.env.SESSION_PATH || './sessions',
  clientId: process.env.WHATSAPP_CLIENT_ID || 'main-session',
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  }
};

module.exports = WHATSAPP_CONFIG;
