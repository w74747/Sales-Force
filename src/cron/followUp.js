const cron = require('node-cron');
const pool = require('../config/database');
const whatsappService = require('../services/whatsappService');
const deepseekService = require('../services/deepseekService');

const FOLLOW_UP_DAYS = parseInt(process.env.FOLLOW_UP_DAYS) || 3;
const FOLLOW_UP_HOUR = parseInt(process.env.FOLLOW_UP_HOUR) || 9;
const FOLLOW_UP_MINUTE = parseInt(process.env.FOLLOW_UP_MINUTE) || 0;

class FollowUpService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    // Run daily at specified time
    const cronExpression = `${FOLLOW_UP_MINUTE} ${FOLLOW_UP_HOUR} * * *`;
    
    console.log(`⏰ Follow-up cron scheduled for ${FOLLOW_UP_HOUR}:${FOLLOW_UP_MINUTE} daily`);
    
    cron.schedule(cronExpression, () => {
      this.runFollowUps();
    });
  }

  async runFollowUps() {
    if (this.isRunning) {
      console.log('⚠️ Follow-up job already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔍 Starting follow-up check...');

    try {
      const customersToFollowUp = await this.getCustomersForFollowUp();
      console.log(`📋 Found ${customersToFollowUp.length} customers for follow-up`);

      for (const customer of customersToFollowUp) {
        await this.sendFollowUp(customer);
        // Wait 10 seconds between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      console.log('✅ Follow-up job completed');
    } catch (error) {
      console.error('❌ Follow-up job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async getCustomersForFollowUp() {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.whatsapp_number,
        c.name,
        c.preferred_language,
        t.id as task_id,
        t.product_list,
        t.delivered_at,
        t.updated_at
      FROM customers c
      JOIN tasks_orders t ON t.customer_id = c.id
      LEFT JOIN bot_control bc ON bc.customer_id = c.id
      WHERE t.order_type = 'sample'
        AND t.status = 'delivered'
        AND t.delivered_at <= NOW() - INTERVAL '${FOLLOW_UP_DAYS} days'
        AND t.delivered_at > NOW() - INTERVAL '${FOLLOW_UP_DAYS + 1} days'
        AND (bc.is_paused IS NULL OR bc.is_paused = false)
        AND NOT EXISTS (
          SELECT 1 FROM communication_logs l
          WHERE l.customer_id = c.id
            AND l.sender_type = 'ai'
            AND l.created_at > t.delivered_at
            AND (l.message ILIKE '%feedback%' OR l.message ILIKE '%رأيك%' OR l.message ILIKE '%تجربتك%')
        )
    `);

    return result.rows;
  }

  async sendFollowUp(customer) {
    try {
      const daysSinceDelivery = FOLLOW_UP_DAYS;
      const message = await deepseekService.generateFollowUp(customer, daysSinceDelivery);

      await whatsappService.sendMessage(customer.whatsapp_number, message);

      // Log the follow-up message
      await pool.query(
        `INSERT INTO communication_logs (customer_id, message, sender_type, detected_language)
         VALUES ($1, $2, 'ai', $3)`,
        [customer.id, message, customer.preferred_language || 'ar']
      );

      console.log(`✅ Follow-up sent to ${customer.whatsapp_number}`);
    } catch (error) {
      console.error(`❌ Failed to send follow-up to ${customer.whatsapp_number}:`, error);
    }
  }
}

module.exports = new FollowUpService();
