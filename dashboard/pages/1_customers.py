import streamlit as st
import pandas as pd
from database import get_customers, get_customer_by_id, get_customer_history

st.set_page_config(page_title="العملاء", page_icon="👥")

st.title("👥 إدارة العملاء")

# Search
search = st.text_input("🔍 البحث (اسم / رقم واتساب / براند)")

customers = get_customers()

if search:
    customers = [c for c in customers if 
        search.lower() in (c.get('name') or '').lower() or
        search in (c.get('whatsapp_number') or '') or
        search.lower() in (c.get('brand_name') or '').lower()
    ]

# Display as table
df = pd.DataFrame(customers)
if not df.empty:
    st.dataframe(
        df[['name', 'whatsapp_number', 'brand_name', 'branch_count', 'lifecycle_stage', 'preferred_language', 'total_orders', 'last_contact']],
        column_config={
            "name": "الاسم",
            "whatsapp_number": "رقم الواتساب",
            "brand_name": "البراند",
            "branch_count": "الفروع",
            "lifecycle_stage": "المرحلة",
            "preferred_language": "اللغة",
            "total_orders": "الطلبات",
            "last_contact": "آخر تواصل"
        },
        use_container_width=True,
        hide_index=True
    )
else:
    st.info("لا يوجد عملاء")

# Customer details
st.markdown("---")
st.subheader("📋 تفاصيل العميل")

customer_id = st.number_input("رقم العميل (ID)", min_value=1, step=1)

if st.button("عرض التفاصيل"):
    customer = get_customer_by_id(customer_id)
    if customer:
        col1, col2 = st.columns(2)
        with col1:
            st.write(f"**الاسم:** {customer.get('name', 'غير محدد')}")
            st.write(f"**رقم الواتساب:** {customer['whatsapp_number']}")
            st.write(f"**البراند:** {customer.get('brand_name', 'غير محدد')}")
        with col2:
            st.write(f"**الفروع:** {customer.get('branch_count', 0)}")
            st.write(f"**المرحلة:** {customer['lifecycle_stage']}")
            st.write(f"**اللغة:** {customer['preferred_language']}")
        
        # Chat history
        st.markdown("---")
        st.subheader("💬 سجل المحادثة")
        history = get_customer_history(customer_id)
        
        for msg in history:
            with st.container():
                if msg['sender_type'] == 'customer':
                    st.markdown(f"👤 **العميل** ({msg['created_at']})")
                elif msg['sender_type'] == 'ai':
                    st.markdown(f"🤖 **الذكاء الاصطناعي** ({msg['created_at']})")
                else:
                    st.markdown(f"👨‍💼 **مندوب** ({msg['created_at']})")
                st.info(msg['message'])
    else:
        st.error("العميل غير موجود")
