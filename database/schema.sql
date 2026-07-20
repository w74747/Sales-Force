-- ============================================================
-- AI CRM System - PostgreSQL Schema
-- ============================================================

-- Drop tables if they exist (for fresh setup)
DROP TABLE IF EXISTS communication_logs CASCADE;
DROP TABLE IF EXISTS tasks_orders CASCADE;
DROP TABLE IF EXISTS bot_control CASCADE;
DROP TABLE IF EXISTS whatsapp_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- ============================================================
-- 1. Users table (for dashboard authentication)
-- ============================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'manager')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. Customers table
-- ============================================================
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    brand_name VARCHAR(255),
    branch_count INTEGER DEFAULT 0,
    lifecycle_stage VARCHAR(50) DEFAULT 'new'
        CHECK (lifecycle_stage IN ('new', 'contacted', 'sample_sent', 'meeting_scheduled', 'active', 'inactive')),
    preferred_language VARCHAR(10) DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. Communication logs table
-- ============================================================
CREATE TABLE communication_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sender_type VARCHAR(20) NOT NULL
        CHECK (sender_type IN ('ai', 'human', 'customer')),
    detected_language VARCHAR(10),
    ai_model VARCHAR(50),
    tokens_used INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for communication_logs
CREATE INDEX idx_comm_logs_customer_id ON communication_logs(customer_id);
CREATE INDEX idx_comm_logs_created_at ON communication_logs(created_at);
CREATE INDEX idx_comm_logs_sender ON communication_logs(sender_type);

-- ============================================================
-- 4. Tasks & Orders table
-- ============================================================
CREATE TABLE tasks_orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_type VARCHAR(50) NOT NULL
        CHECK (order_type IN ('sample', 'meeting', 'order')),
    status VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'delivered', 'completed', 'cancelled')),
    product_list JSONB DEFAULT '[]',
    quantities JSONB DEFAULT '{}',
    target_delivery_date DATE,
    delivery_schedule JSONB DEFAULT '{}',
    notes TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for tasks_orders
CREATE INDEX idx_orders_customer ON tasks_orders(customer_id);
CREATE INDEX idx_orders_status ON tasks_orders(status);
CREATE INDEX idx_orders_type ON tasks_orders(order_type);
CREATE INDEX idx_orders_delivery_date ON tasks_orders(target_delivery_date);

-- ============================================================
-- 5. Bot control table
-- ============================================================
CREATE TABLE bot_control (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    is_paused BOOLEAN DEFAULT FALSE,
    paused_by VARCHAR(100),
    paused_at TIMESTAMP,
    reason TEXT,
    resumed_at TIMESTAMP,
    UNIQUE(customer_id)
);

CREATE INDEX idx_bot_control_paused ON bot_control(is_paused);

-- ============================================================
-- 6. WhatsApp sessions table
-- ============================================================
CREATE TABLE whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(100) UNIQUE NOT NULL,
    session_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. Triggers for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_orders_updated_at BEFORE UPDATE ON tasks_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. Insert default admin user
-- ============================================================
-- Password: admin123 (change in production!)
INSERT INTO users (email, password_hash, name, role) 
VALUES (
    'admin@aicrm.com', 
    '$2a$10$YourHashedPasswordHere', 
    'System Admin', 
    'admin'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. Views for reporting
-- ============================================================

-- View: Customer summary
CREATE OR REPLACE VIEW customer_summary AS
SELECT 
    c.id,
    c.whatsapp_number,
    c.name,
    c.brand_name,
    c.branch_count,
    c.lifecycle_stage,
    c.preferred_language,
    COUNT(DISTINCT t.id) as total_orders,
    COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_orders,
    MAX(l.created_at) as last_contact,
    c.created_at
FROM customers c
LEFT JOIN tasks_orders t ON t.customer_id = c.id
LEFT JOIN communication_logs l ON l.customer_id = c.id
GROUP BY c.id;

-- View: Daily activity
CREATE OR REPLACE VIEW daily_activity AS
SELECT 
    DATE(created_at) as date,
    sender_type,
    detected_language,
    COUNT(*) as message_count
FROM communication_logs
GROUP BY DATE(created_at), sender_type, detected_language
ORDER BY date DESC;
