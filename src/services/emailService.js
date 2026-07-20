const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendOrdersReport(orders, date) {
    const reportHtml = this.generateReportHtml(orders, date);
    const reportText = this.generateReportText(orders, date);

    const mailOptions = {
      from: `"AI CRM System" <${process.env.SMTP_USER}>`,
      to: process.env.LOGISTICS_EMAIL,
      subject: `📦 تقرير الطلبات المعلقة - ${date}`,
      text: reportText,
      html: reportHtml
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      throw error;
    }
  }

  generateReportHtml(orders, date) {
    let rows = orders.map(order => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${order.customer_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${order.whatsapp_number}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${order.order_type}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${JSON.stringify(order.product_list)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${order.target_delivery_date || 'غير محدد'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${order.status}</td>
      </tr>
    `).join('');

    return `
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #4CAF50; color: white; padding: 12px; }
        </style>
      </head>
      <body>
        <h2>📦 تقرير الطلبات المعلقة</h2>
        <p><strong>التاريخ:</strong> ${date}</p>
        <p><strong>إجمالي الطلبات:</strong> ${orders.length}</p>
        <table>
          <tr>
            <th>العميل</th>
            <th>رقم الواتساب</th>
            <th>نوع الطلب</th>
            <th>المنتجات</th>
            <th>تاريخ التسليم</th>
            <th>الحالة</th>
          </tr>
          ${rows}
        </table>
      </body>
      </html>
    `;
  }

  generateReportText(orders, date) {
    let text = `📦 تقرير الطلبات المعلقة - ${date}\n`;
    text += `إجمالي الطلبات: ${orders.length}\n`;
    text += '========================================\n\n';

    orders.forEach((order, index) => {
      text += `${index + 1}. ${order.customer_name}\n`;
      text += `   رقم الواتساب: ${order.whatsapp_number}\n`;
      text += `   نوع الطلب: ${order.order_type}\n`;
      text += `   المنتجات: ${JSON.stringify(order.product_list)}\n`;
      text += `   الحالة: ${order.status}\n`;
      text += '----------------------------------------\n';
    });

    return text;
  }
}

module.exports = new EmailService();
