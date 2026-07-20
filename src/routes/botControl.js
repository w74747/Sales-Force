const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get bot status for a customer
router.get('/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM bot_control WHERE customer_id = $1`,
      [customerId]
    );

    res.json(result.rows[0] || { is_paused: false });
  } catch (error) {
    console.error('❌ Error fetching bot status:', error);
    res.status(500).json({ error: 'Failed to fetch bot status' });
  }
});

// Pause bot for a customer
router.post('/pause', authenticateToken, async (req, res) => {
  const { customerId, reason } = req.body;
  const agentName = req.user.email || 'Unknown Agent';

  try {
    const result = await pool.query(
      `INSERT INTO bot_control (customer_id, is_paused, paused_by, paused_at, reason)
       VALUES ($1, true, $2, NOW(), $3)
       ON CONFLICT (customer_id) 
       DO UPDATE SET 
         is_paused = true, 
         paused_by = $2, 
         paused_at = NOW(), 
         reason = $3,
         resumed_at = NULL
       RETURNING *`,
      [customerId, agentName, reason]
    );

    res.json({
      message: 'Bot paused successfully',
      status: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error pausing bot:', error);
    res.status(500).json({ error: 'Failed to pause bot' });
  }
});

// Resume bot for a customer
router.post('/resume', authenticateToken, async (req, res) => {
  const { customerId } = req.body;

  try {
    const result = await pool.query(
      `UPDATE bot_control 
       SET is_paused = false, 
           resumed_at = NOW() 
       WHERE customer_id = $1
       RETURNING *`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No bot control record found' });
    }

    res.json({
      message: 'Bot resumed successfully',
      status: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error resuming bot:', error);
    res.status(500).json({ error: 'Failed to resume bot' });
  }
});

// Get all paused customers
router.get('/status/paused', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT bc.*, c.name, c.whatsapp_number
      FROM bot_control bc
      JOIN customers c ON c.id = bc.customer_id
      WHERE bc.is_paused = true
      ORDER BY bc.paused_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching paused bots:', error);
    res.status(500).json({ error: 'Failed to fetch paused bots' });
  }
});

module.exports = router;
