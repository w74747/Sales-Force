const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const emailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');

// Get all orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, c.name as customer_name, c.whatsapp_number
      FROM tasks_orders t
      JOIN customers c ON c.id = t.customer_id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get orders by customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  const { customerId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM tasks_orders 
       WHERE customer_id = $1 
       ORDER BY created_at DESC`,
      [customerId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching customer orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create new order
router.post('/', authenticateToken, async (req, res) => {
  const { customer_id, order_type, product_list, quantities, target_delivery_date, notes } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tasks_orders 
       (customer_id, order_type, product_list, quantities, target_delivery_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [customer_id, order_type, JSON.stringify(product_list), JSON.stringify(quantities), target_delivery_date, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status
router.put('/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const completedAt = status === 'completed' ? 'NOW()' : null;
    
    const result = await pool.query(
      `UPDATE tasks_orders 
       SET status = $1,
           notes = COALESCE($2, notes),
           completed_at = ${completedAt},
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Export and email pending orders
router.post('/export', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, c.name as customer_name, c.whatsapp_number
      FROM tasks_orders t
      JOIN customers c ON c.id = t.customer_id
      WHERE t.status IN ('pending', 'in_progress')
      ORDER BY t.target_delivery_date ASC
    `);

    const orders = result.rows;
    const today = new Date().toLocaleDateString('ar-SA');

    await emailService.sendOrdersReport(orders, today);

    res.json({
      message: 'Report sent successfully',
      ordersCount: orders.length
    });
  } catch (error) {
    console.error('❌ Error exporting orders:', error);
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

module.exports = router;
