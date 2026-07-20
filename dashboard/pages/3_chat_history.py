import streamlit as st
import pandas as pd
from database import execute_query

st.set_page_config(page_title="سجل المحادثات", page_icon="💬")

st.title("💬 سجل المحادثات")

# Filters
col1, col2, col3 = st.columns(3)

with col1:
    sender_filter = st.selectbox("المرسل", ["الكل", "customer", "ai", "human"])

with col2:
    lang_filter = st.selectbox("اللغة", ["الكل", "ar", "en"])

with col3:
    date_filter = st.date_input("التاريخ")

# Build query
query = """
    SELECT 
        c.name as customer_name,
        c.whatsapp_number,
        l.message,
        l.sender_type,
        l.detected_language,
        l.created_at
    FROM communication_logs l
    JOIN customers c ON c.id = l.customer_id
    WHERE 1=1
"""
params = []

if sender_filter != "الكل":
    query += " AND l.sender_type = %s"
    params.append(sender_filter)

if lang_filter != "الكل":
    query += " AND l.detected_language
