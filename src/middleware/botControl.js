const pool = require('../config/database');

/**
 * Check if bot is paused for a specific customer
 */
async function checkBotStatus(req, res, next) {
  const { customerId } = req.params || req.body;
  
  if (!customerId) {
    return next();
  }

  try {
    const result = await pool.query(
      `SELECT is_paused, paused_by, paused_at, reason 
       FROM bot_control 
       WHERE customer_id = $1`,
      [customerId]
    );

    req.botStatus = {
      isPaused: result.rows.length > 0 && result.rows[0].is_paused,
      pausedBy: result.rows[0]?.paused_by || null,
      pausedAt: result.rows[0]?.paused_at || null,
      reason: result.rows[0]?.reason || null
    };

    next();
  } catch (error) {
    console.error('❌ Error checking bot status:', error);
    next();
  }
}

/**
 * Middleware to block AI responses if bot is paused
 */
async function blockIfPaused(req, res, next) {
  const { customerId } = req.body;
  
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT is_paused, paused_by 
       FROM bot_control 
       WHERE customer_id = $1`,
      [customerId]
    );

    if (result.rows.length > 0 && result.rows[0].is_paused) {
      return res.status(403).json({
        error: 'Bot is paused for this customer',
        pausedBy: result.rows[0].paused_by
      });
    }

    next();
  } catch (error) {
    console.error('❌ Error in blockIfPaused:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  checkBotStatus,
  blockIfPaused
};
