# ============================================
# Orders Management Page - صفحة إدارة الطلبات
# ============================================
import streamlit as st
import pandas as pd
from database import get_orders, get_connection

st.set_page_config(page_title="الطلبات", page_icon="📦")

st.title("📦 إدارة الطلبات")

# Filters
col1, col2, col3 = st.columns(3)

with col1:
    status_filter = st.selectbox(
        "الحالة",
        ["الكل", "pending", "in_progress", "delivered", "completed", "cancelled"]
    )

with col2:
    type_filter = st.selectbox(
        "النوع",
        ["الكل", "sample", "meeting", "order"]
    )

with col3:
    if st.button("📧 تصدير وإرسال بالبريد", type="primary"):
        conn = get_connection()
        cur = conn.cursor()
        
        # جلب الطلبات المعلقة
        cur.execute("""
            SELECT t.*, c.name as customer_name, c.whatsapp_number
            FROM tasks_orders t
            JOIN customers c ON c.id = t.customer_id
            WHERE t.status = 'pending'
            ORDER BY t.created_at DESC
        """)
        
        orders = cur.fetchall()
        cur.close()
        conn.close()
        
        if orders:
            # إنشاء تقرير CSV
            df = pd.DataFrame(orders, columns=[
                'id', 'customer_id', 'order_type', 'status', 'product_list',
                'quantities', 'target_delivery_date', 'delivery_schedule',
                'notes', 'created_at', 'updated_at', 'completed_at',
                'customer_name', 'whatsapp_number'
            ])
            
            csv = df.to_csv(index=False).encode('utf-8-sig')
            
            st.download_button(
                label="⬇️ تحميل ملف CSV",
                data=csv,
                file_name=f"orders_{pd.Timestamp.now().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )
            
            st.success(f"✅ تم إعداد {len(orders)} طلب للتصدير")
        else:
            st.info("لا توجد طلبات معلقة للتصدير")

# Fetch and display orders
status = None if status_filter == "الكل" else status_filter
order_type = None if type_filter == "الكل" else type_filter

orders = get_orders(status=status, order_type=order_type)

if orders:
    df = pd.DataFrame(orders)
    
    # تنسيق الأعمدة
    df['created_at'] = pd.to_datetime(df['created_at']).dt.strftime('%Y-%m-%d')
    
    status_colors = {
        'pending': '🔴',
        'in_progress': '🟡',
        'delivered': '🟢',
        'completed': '✅',
        'cancelled': '❌'
    }
    
    type_names = {
        'sample': '🎁 عينة',
        'meeting': '📅 اجتماع',
        'order': '📦 طلب'
    }
    
    df['status'] = df['status'].map(lambda x: f"{status_colors.get(x, '⚪')} {x}")
    df['order_type'] = df['order_type'].map(lambda x: type_names.get(x, x))
    
    st.dataframe(
        df[['customer_name', 'whatsapp_number', 'order_type', 'status', 'product_list', 'created_at']],
        use_container_width=True,
        hide_index=True
    )
else:
    st.info("لا توجد طلبات مطابقة للفلاتر")
