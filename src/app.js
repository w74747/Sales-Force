require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const pool = require('./config/database');
const whatsappService = require('./services/whatsappService');
const deepseekService = require('./services/deepseekService');
const followUpService = require('./cron/followUp');
const { detectLanguage } = require('./services/languageDetector');
const { humanLikeDelay, sleep } = require('./utils/delay');

// Routes
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const botControlRouter = require('./routes/botControl');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// API Routes
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/bot', botControlRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: whatsappService.isClientReady(),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// WhatsApp Message Handler
// ============================================

async function handleIncomingMessage(msg) {
  // Ignore messages from self
  if (msg.fromMe) return;

  const phoneNumber = msg.from.replace('@c.us', '');
  const messageText = msg.body;

  console.log(`📩 New message from ${phoneNumber}: ${messageText.substring(0, 50)}...`);

  try {
    // 1. Check if bot is paused for this customer
    const botStatus = await checkBotStatus(phoneNumber);
    if (botStatus.isPaused) {
      console.log(`🛑 Bot paused for ${phoneNumber} by ${botStatus.pausedBy}`);
      return;
    }

    // 2. Get or create customer
    const customer = await getOrCreateCustomer(phoneNumber);

    // 3. Detect language
    const detectedLang = await detectLanguage(messageText);

    // 4. Get chat history
    const history = await getChatHistory(customer.id);

    // 5. Call DeepSeek AI
    const aiResponse = await deepseekService.generateResponse(
      history,
      messageText,
      detectedLang
    );

    // 6. Process extracted data
    await processExtractedData(customer.id, aiResponse.extracted_data);

    // 7. Send response with human-like delay
    await whatsappService.sendMessage(phoneNumber, aiResponse.response_text);

    // 8. Log messages
    await logMessage(customer.id, messageText, 'customer', detectedLang);
    await logMessage(customer.id, aiResponse.response_text, 'ai', detectedLang);

    console.log(`✅ Response sent to ${phoneNumber}`);

  } catch (error) {
    console.error('❌ Error processing message:', error);
    
    // Send fallback error message
    try {
      const errorMsg = 'عذراً، حدث خطأ تقني. سيتواصل معك أحد ممثلينا قريباً.';
      await whatsappService.sendMessage(phoneNumber, errorMsg);
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }
  }
}

// ============================================
// Helper Functions
// ============================================

async function checkBotStatus(phoneNumber) {
  const result = await pool.query(
    `SELECT bc.is_paused, bc.paused_by 
     FROM customers c
     LEFT JOIN bot_control bc ON bc.customer_id = c.id
     WHERE c.whatsapp_number = $1`,
    [phoneNumber]
  );

  if (result.rows.length === 0) {
    return { isPaused: false };
  }

  return {
    isPaused: result.rows[0].is_paused || false,
    pausedBy: result.rows[0].paused_by
  };
}

async function getOrCreateCustomer(phoneNumber) {
  const result = await pool.query(
    'SELECT * FROM customers WHERE whatsapp_number = $1',
    [phoneNumber]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }

  // Create new customer
  const newCustomer = await pool.query(
    `INSERT INTO customers (whatsapp_number, lifecycle_stage, created_at, updated_at) 
     VALUES ($1, 'new', NOW(), NOW()) 
     RETURNING *`,
    [phoneNumber]
  );

  console.log(`👤 New customer created: ${phoneNumber}`);
  return newCustomer.rows[0];
}

async function getChatHistory(customerId) {
  const result = await pool.query(
    `SELECT message, sender_type, detected_language 
     FROM communication_logs 
     WHERE customer_id = $1 
     ORDER BY created_at DESC 
     LIMIT 10`,
    [customerId]
  );
  return result.rows.reverse();
}

async function processExtractedData(customerId, extractedData) {
  if (!extractedData) return;

  const updates = [];
  const values = [];
  let paramIndex = 1;

  if (extractedData.brand_name) {
    updates.push(`brand_name = $${paramIndex++}`);
    values.push(extractedData.brand_name);
  }
  if (extractedData.branch_count) {
    updates.push(`branch_count = $${paramIndex++}`);
    values.push(extractedData.branch_count);
  }
  if (extractedData.customer_language) {
    updates.push(`preferred_language = $${paramIndex++}`);
    values.push(extractedData.customer_language);
  }
  if (extractedData.lifecycle_stage) {
    updates.push(`lifecycle_stage = $${paramIndex++}`);
    values.push(extractedData.lifecycle_stage);
  }

  if (updates.length > 0) {
    values.push(customerId);
    await pool.query(
      `UPDATE customers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
      values
    );
  }

  // Create sample order if requested
  if (extractedData.sample_requested && extractedData.sample_products?.length > 0) {
    await pool.query(
      `INSERT INTO tasks_orders (customer_id, order_type, product_list, quantities, status, created_at)
       VALUES ($1, 'sample', $2, $3, 'pending', NOW())
       ON CONFLICT DO NOTHING`,
      [
        customerId,
        JSON.stringify(extractedData.sample_products),
        JSON.stringify(extractedData.sample_quantities || {})
      ]
    );
  }

  // Create meeting order if requested
  if (extractedData.meeting_requested && extractedData.meeting_datetime) {
    await pool.query(
      `INSERT INTO tasks_orders (customer_id, order_type, delivery_schedule, status, created_at)
       VALUES ($1, 'meeting', $2, 'pending', NOW())
       ON CONFLICT DO NOTHING`,
      [
        customerId,
        JSON.stringify({ proposed_time: extractedData.meeting_datetime, location: extractedData.meeting_location })
      ]
    );
  }
}

async function logMessage(customerId, message, senderType, language) {
  await pool.query(
    `INSERT INTO communication_logs (customer_id, message, sender_type, detected_language, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [customerId, message, senderType, language]
  );
}

// ============================================
// Server Startup
// ============================================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize WhatsApp
    console.log('📱 Initializing WhatsApp...');
    await whatsappService.initialize();

    // Set up message handler
    whatsappService.getClient().on('message_create', handleIncomingMessage);

    // Start follow-up cron job
    followUpService.start();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 API Documentation: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

startServer();
