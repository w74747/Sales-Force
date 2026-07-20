const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        COUNT(DISTINCT t.id) as total_orders,
        MAX(l.created_at) as last_contact
      FROM customers c
      LEFT JOIN tasks_orders t ON t.customer_id = c.id
      LEFT JOIN communication_logs l ON l.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get single customer with history
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    const customerResult = await pool.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const historyResult = await pool.query(
      `SELECT * FROM communication_logs 
       WHERE customer_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [id]
    );

    const ordersResult = await pool.query(
      `SELECT * FROM tasks_orders 
       WHERE customer_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      customer: customerResult.rows[0],
      history: historyResult.rows,
      orders: ordersResult.rows
    });
  } catch (error) {
    console.error('❌ Error fetching customer:', error);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// Update customer
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, brand_name, branch_count, lifecycle_stage, preferred_language } = req.body;

  try {
    const result = await pool.query(
      `UPDATE customers 
       SET name = COALESCE($1, name),
           brand_name = COALESCE($2, brand_name),
           branch_count = COALESCE($3, branch_count),
           lifecycle_stage = COALESCE($4, lifecycle_stage),
           preferred_language = COALESCE($5, preferred_language),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, brand_name, branch_count, lifecycle_stage, preferred_language, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
