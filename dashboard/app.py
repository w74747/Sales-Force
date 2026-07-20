import streamlit as st
import psycopg2
import pandas as pd
from datetime import datetime
import os

# Page configuration
st.set_page_config(
    page_title="AI CRM Dashboard",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
    <style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        border-radius: 10px;
        padding: 1rem;
        text-align: center;
    }
    .stButton>button {
        width: 100%;
        border-radius: 5px;
    }
    </style>
""", unsafe_allow_html=True)

# Database connection
@st.cache_resource
def get_db_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def get_metrics():
    conn = get_db_connection()
    cur = conn.cursor()
    
    metrics = {}
    
    # Total customers
    cur.execute("SELECT COUNT(*) FROM customers")
    metrics['total_customers'] = cur.fetchone()[0]
    
    # Active today
    cur.execute("""
        SELECT COUNT(DISTINCT customer_id) 
        FROM communication_logs 
        WHERE DATE(created_at) = CURRENT_DATE
    """)
    metrics['active_today'] = cur.fetchone()[0]
    
    # Pending orders
    cur.execute("SELECT COUNT(*) FROM tasks_orders WHERE status IN ('pending', 'in_progress')")
    metrics['pending_orders'] = cur.fetchone()[0]
    
    # Paused bots
    cur.execute("SELECT COUNT(*) FROM bot_control WHERE is_paused = true")
    metrics['paused_bots'] = cur.fetchone()[0]
    
    cur.close()
    return metrics

def main():
    st.markdown('<h1 class="main-header">🤖 AI CRM Dashboard</h1>', unsafe_allow_html=True)
    
    # Sidebar
    st.sidebar.title("📊 القائمة")
    st.sidebar.markdown("---")
    
    # Metrics
    metrics = get_metrics()
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("👥 إجمالي العملاء", metrics['total_customers'])
    
    with col2:
        st.metric("💬 نشط اليوم", metrics['active_today'])
    
    with col3:
        st.metric("📦 طلبات معلقة", metrics['pending_orders'])
    
    with col4:
        st.metric("🛑 بوتات متوقفة", metrics['paused_bots'])
    
    st.markdown("---")
    
    # Recent activity
    st.subheader("🕐 آخر النشاطات")
    
    conn = get_db_connection()
    recent_activity = pd.read_sql_query("""
        SELECT 
            c.name as customer_name,
            c.whatsapp_number,
            l.message,
            l.sender_type,
            l.detected_language,
            l.created_at
        FROM communication_logs l
        JOIN customers c ON c.id = l.customer_id
        ORDER BY l.created_at DESC
        LIMIT 20
    """, conn)
    
    st.dataframe(
        recent_activity,
        column_config={
            "customer_name": "العميل",
            "whatsapp_number": "رقم الواتساب",
            "message": "الرسالة",
            "sender_type": "المرسل",
            "detected_language": "اللغة",
            "created_at": "الوقت"
        },
        use_container_width=True,
        hide_index=True
    )

if __name__ == "__main__":
    main()
