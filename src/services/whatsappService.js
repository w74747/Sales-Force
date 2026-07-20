const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const WHATSAPP_CONFIG = require('../config/whatsapp');
const { humanLikeDelay, sleep } = require('../utils/delay');

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.messageQueue = [];
    this.processingQueue = false;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: WHATSAPP_CONFIG.sessionPath,
          clientId: WHATSAPP_CONFIG.clientId
        }),
        puppeteer: WHATSAPP_CONFIG.puppeteer
      });

      this.client.on('qr', (qr) => {
        console.log('📱 Scan this QR code with your phone:');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready!');
        this.isReady = true;
        resolve();
      });

      this.client.on('authenticated', () => {
        console.log('🔐 Authenticated successfully');
      });

      this.client.on('auth_failure', (msg) => {
        console.error('❌ Authentication failure:', msg);
        reject(new Error(msg));
      });

      this.client.on('disconnected', (reason) => {
        console.log('⚠️ Client disconnected:', reason);
        this.isReady = false;
        // Auto-reconnect after 5 seconds
        setTimeout(() => this.initialize(), 5000);
      });

      this.client.initialize().catch(reject);
    });
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    const chatId = `${formattedNumber}@c.us`;

    try {
      // Human-like delay
      await humanLikeDelay(message);

      // Show typing indicator
      const chat = await this.client.getChatById(chatId);
      await chat.sendStateTyping();
      
      // Additional delay based on message length
      await sleep(message.length * 50);
      
      // Clear typing state and send
      await chat.clearState();
      const sent = await this.client.sendMessage(chatId, message);
      
      console.log(`✅ Message sent to ${phoneNumber}`);
      return sent;
    } catch (error) {
      console.error(`❌ Failed to send message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  formatPhoneNumber(number) {
    let cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '966' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('966')) {
      cleaned = '966' + cleaned;
    }
    return cleaned;
  }

  getClient() {
    return this.client;
  }

  isClientReady() {
    return this.isReady;
  }
}

module.exports = new WhatsAppService();
