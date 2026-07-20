# ============================================
# Main Streamlit Dashboard - لوحة التحكم الرئيسية
# ============================================
import streamlit as st
import pandas as pd
from database import get_stats, get_customers, get_orders

st.set_page_config(
    page_title="AI CRM Dashboard",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# CSS للغة العربية والتنسيق
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    
    .stApp {
        font-family: 'Cairo', sans-serif;
    }
    
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px;
        border-radius: 10px;
        color: white;
        text-align: center;
    }
    
    .metric-value {
        font-size: 2.5rem;
        font-weight: bold;
    }
    
    .metric-label {
        font-size: 1rem;
        opacity: 0.9;
    }
</style>
""", unsafe_allow_html=True)

# Sidebar
st.sidebar.title("🤖 AI CRM System")
st.sidebar.markdown("---")

page = st.sidebar.radio(
    "القائمة",
    ["📊 لوحة المعلومات", "👥 العملاء", "📦 الطلبات", "💬 سجل المحادثات", "⚙️ التحكم في البوت"]
)

st.sidebar.markdown("---")
st.sidebar.info("نظام إدارة العملاء بالذكاء الاصطناعي")

# ============================================
# Dashboard Page
# ============================================
if page == "📊 لوحة المعلومات":
    st.title("📊 لوحة المعلومات")
    
    stats = get_stats()
    
    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("👥 إجمالي العملاء", stats['total_customers'])
    
    with col2:
        st.metric("📦 إجمالي الطلبات", stats['total_orders'])
    
    with col3:
        st.metric("⏳ طلبات معلقة", stats['pending_orders'])
    
    with col4:
        st.metric("🤖 رسائل AI (24س)", stats['ai_messages_24h'])
    
    st.markdown("---")
    
    # Customer Stages Chart
    st.subheader("📈 توزيع مراحل العملاء")
    
    if stats['stages']:
        stages_df = pd.DataFrame(stats['stages'])
        stages_df.columns = ['المرحلة', 'العدد']
        
        # ترجمة المراحل
        stage_names = {
            'new': '🆕 جديد',
            'contacted': '📞 تم التواصل',
            'sample_requested': '🎁 طلب عينة',
            'meeting_scheduled': '📅 مجدول اجتماع',
            'active': '✅ نشط',
            'inactive': '💤 غير نشط'
        }
        stages_df['المرحلة'] = stages_df['المرحلة'].map(stage_names)
        
        st.bar_chart(stages_df.set_index('المرحلة'))
    
    # Recent Activity
    st.markdown("---")
    st.subheader("🕐 آخر النشاطات")
    
    recent_orders = get_orders()[:5]
    if recent_orders:
        for order in recent_orders:
            with st.container():
                col1, col2, col3 = st.columns([2, 2, 1])
                with col1:
                    st.write(f"**{order['customer_name']}**")
                with col2:
                    status_colors = {
                        'pending': '🔴',
                        'in_progress': '🟡',
                        'delivered': '🟢',
                        'completed': '✅',
                        'cancelled': '❌'
                    }
                    st.write(f"{status_colors.get(order['status'], '⚪')} {order['order_type']}")
                with col3:
                    st.write(f"{order['created_at'].strftime('%Y-%m-%d')}")
                st.markdown("---")

# ============================================
# Customers Page
# ============================================
elif page == "👥 العملاء":
    st.title("👥 إدارة العملاء")
    
    # Search and Filter
    col1, col2 = st.columns([3, 1])
    
    with col1:
        search = st.text_input("🔍 البحث (اسم، رقم، براند)")
    
    with col2:
        stage_filter = st.selectbox(
            "المرحلة",
            ["الكل", "new", "contacted", "sample_requested", "meeting_scheduled", "active", "inactive"]
        )
    
    stage = None if stage_filter == "الكل" else stage_filter
    
    customers = get_customers(search=search if search else None, stage=stage)
    
    if customers:
        df = pd.DataFrame(customers)
        df['last_contact'] = pd.to_datetime(df['last_contact']).dt.strftime('%Y-%m-%d %H:%M')
        
        st.dataframe(
            df[['name', 'whatsapp_number', 'brand_name', 'branch_count', 'lifecycle_stage', 'preferred_language', 'last_contact']],
            use_container_width=True,
            hide_index=True
        )
    else:
        st.info("لا يوجد عملاء مطابقين للبحث")

# ============================================
# Orders Page
# ============================================
elif page == "📦 الطلبات":
    st.title("📦 إدارة الطلبات")
    
    st.switch_page("pages/orders.py")

# ============================================
# Chat History Page
# ============================================
elif page == "💬 سجل المحادثات":
    st.title("💬 سجل المحادثات")
    
    customer_id = st.number_input("رقم العميل", min_value=1, step=1)
    
    if st.button("عرض المحادثة"):
        from database import get_customer_details
        customer = get_customer_details(customer_id)
        
        if customer and customer.get('chat_history'):
            for msg in reversed(customer['chat_history']):
                sender = msg['sender_type']
                if sender == 'customer':
                    st.chat_message("user").write(msg['message'])
                elif sender == 'ai':
                    st.chat_message("assistant").write(msg['message'])
                else:
                    st.chat_message("human").write(f"👤 {msg['message']}")
        else:
            st.info("لا توجد محادثات لهذا العميل")

# ============================================
# Bot Control Page
# ============================================
elif page == "⚙️ التحكم في البوت":
    st.title("⚙️ التحكم في البوت")
    
    st.switch_page("pages/bot_control.py")
