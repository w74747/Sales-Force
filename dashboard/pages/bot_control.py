# ============================================
# Bot Control Page - صفحة التحكم في البوت
# ============================================
import streamlit as st
from database import get_customers, toggle_bot, get_connection

st.set_page_config(page_title="التحكم في البوت", page_icon="⚙️")

st.title("⚙️ التحكم في البوت")

# Tabs
tab1, tab2 = st.tabs(["🛑 إيقاف البوت", "▶️ تفعيل البوت"])

# ============================================
# Pause Bot Tab
# ============================================
with tab1:
    st.subheader("🛑 إيقاف البوت لعميل محدد")
    
    customers = get_customers(limit=100)
    
    if customers:
        customer_options =
