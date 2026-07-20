import psycopg2
import os
from contextlib import contextmanager

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/ai_crm')

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_db_cursor(commit=False):
    """Context manager for database cursors"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            yield cursor
            if commit:
                conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()

def execute_query(query, params=None, fetch=True):
    """Execute a query and return results"""
    with get_db_cursor(commit=not fetch) as cursor:
        cursor.execute(query, params or ())
        if fetch:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        return None

def get_customers():
    """Get all customers"""
    return execute_query("""
        SELECT c.*, 
            COUNT(DISTINCT t.id) as total_orders,
            MAX(l.created_at) as last_contact
        FROM customers c
        LEFT JOIN tasks_orders t ON t.customer_id = c.id
        LEFT JOIN communication_logs l ON l.customer_id = c.id
        GROUP BY c.id
        ORDER BY c.updated_at DESC
    """)

def get_customer_by_id(customer_id):
    """Get customer by ID"""
    customers = execute_query(
        "SELECT * FROM customers WHERE id = %s",
        (customer_id,)
    )
    return customers[0] if customers else None

def get_customer_history(customer_id, limit=50):
    """Get chat history for a customer"""
    return execute_query("""
        SELECT * FROM communication_logs 
        WHERE customer_id = %s 
        ORDER BY created_at DESC 
        LIMIT %s
    """, (customer_id, limit))

def get_orders(status=None):
    """Get orders, optionally filtered by status"""
    if status:
        return execute_query("""
            SELECT t.*, c.name as customer_name, c.whatsapp_number
            FROM tasks_orders t
            JOIN customers c ON c.id = t.customer_id
            WHERE t.status = %s
            ORDER BY t.created_at DESC
        """, (status,))
    return execute_query("""
        SELECT t.*, c.name as customer_name, c.whatsapp_number
        FROM tasks_orders t
        JOIN customers c ON c.id = t.customer_id
        ORDER BY t.created_at DESC
    """)

def get_pending_orders():
    """Get pending orders for export"""
    return execute_query("""
        SELECT t.*, c.name as customer_name, c.whatsapp_number
        FROM tasks_orders t
        JOIN customers c ON c.id = t.customer_id
        WHERE t.status IN ('pending', 'in_progress')
        ORDER BY t.target_delivery_date ASC
    """)

def update_order_status(order_id, status, notes=None):
    """Update order status"""
    with get_db_cursor(commit=True) as cursor:
        if status == 'completed':
            cursor.execute("""
                UPDATE tasks_orders 
                SET status = %s, notes = COALESCE(%s, notes), 
                    completed_at = NOW(), updated_at = NOW()
                WHERE id = %s
            """, (status, notes, order_id))
        else:
            cursor.execute("""
                UPDATE tasks_orders 
                SET status = %s, notes = COALESCE(%s, notes), updated_at = NOW()
                WHERE id = %s
            """, (status, notes, order_id))

def get_paused_bots():
    """Get all paused bots"""
    return execute_query("""
        SELECT bc.*, c.name, c.whatsapp_number
        FROM bot_control bc
        JOIN customers c ON c.id = bc.customer_id
        WHERE bc.is_paused = true
        ORDER BY bc.paused_at DESC
    """)

def pause_bot(customer_id, agent_name, reason=None):
    """Pause bot for a customer"""
    with get_db_cursor(commit=True) as cursor:
        cursor.execute("""
            INSERT INTO bot_control (customer_id, is_paused, paused_by, paused_at, reason)
            VALUES (%s, true, %s, NOW(), %s)
            ON CONFLICT (customer_id) 
            DO UPDATE SET 
                is_paused = true, 
                paused_by = %s, 
                paused_at = NOW(), 
                reason = %s,
                resumed_at = NULL
        """, (customer_id, agent_name, reason, agent_name, reason))

def resume_bot(customer_id):
    """Resume bot for a customer"""
    with get_db_cursor(commit=True) as cursor:
        cursor.execute("""
            UPDATE bot_control 
            SET is_paused = false, resumed_at = NOW() 
            WHERE customer_id = %s
        """, (customer_id,))
