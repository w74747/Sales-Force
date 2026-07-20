import streamlit as st
import pandas as pd
from database import get_orders, get_pending_orders, update_order_status
from email_service import send_orders_report
import io

st.set_page_config(page_title="الطلبات", page_icon="📦")

st.title("📦 إدارة الطلبات")

# Tabs
tab1, tab2, tab3 = st.tabs(["جميع الطلبات", "طلبات معلقة", "تصدير"])

with tab1:
    status_filter = st.selectbox(
        "تصفية حسب الحالة",
        ["الكل", "pending", "in_progress", "delivered", "completed", "cancelled"]
    )
    
    if status_filter == "الكل":
        orders = get_orders()
    else:
        orders = get_orders(status_filter)
    
    df = pd.DataFrame(orders)
    if not df.empty:
        st.dataframe(
            df[['id', 'customer_name', 'whatsapp_number', 'order_type', 'status', 'product_list', 'target_delivery_date']],
            column_config={
                "id": "رقم الطلب",
                "customer_name": "العميل",
                "whatsapp_number": "رقم الواتساب",
                "order_type": "النوع",
                "status": "الحالة",
                "product_list": "المنتجات",
                "target_delivery_date": "تاريخ التسليم"
            },
            use_container_width=True,
            hide_index=True
        )
    else:
        st.info("لا يوجد طلبات")

with tab2:
    st.subheader("📋 الطلبات المعلقة")
    pending = get_pending_orders()
    
    if pending:
        for order in pending:
            with st.expander(f"طلب #{order['id']} - {order['customer_name']}"):
                st.write(f"**العميل:** {order['customer_name']}")
                st.write(f"**النوع:** {order['order_type']}")
                st.write(f"**المنتجات:** {order.get('product_list', [])}")
                st.write(f"**الحالة:** {order['status']}")
                
                new_status = st.selectbox(
                    "تحديث الحالة",
                    ["pending", "in_progress", "delivered", "completed", "cancelled"],
                    key=f"status_{order['id']}"
                )
                notes = st.text_area("ملاحظات", key=f"notes_{order['id']}")
                
                if st.button("تحديث", key=f"update_{order['id']}"):
                    update_order_status(order['id'], new_status, notes)
                    st.success("تم التحديث!")
                    st.rerun()
    else:
        st.success("🎉 لا يوجد طلبات معلقة!")

with tab3:
    st.subheader("📧 تصدير الطلبات")
    
    if st.button("📤 إرسال تقرير للوجستيات"):
        try:
            send_orders_report()
            st.success("✅ تم إرسال التقرير بنجاح!")
        except Exception as e:
            st.error(f"❌ خطأ: {str(e)}")
    
    # CSV Export
    all_orders = get_orders()
    if all_orders:
        df_export = pd.DataFrame(all_orders)
        csv = df_export.to_csv(index=False).encode('utf-8-sig')
        st.download_button(
            label="⬇️ تحميل كملف CSV",
            data=csv,
            file_name=f"orders_{pd.Timestamp.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
