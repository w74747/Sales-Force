const axios = require('axios');
const DEEPSEEK_CONFIG = require('../config/deepseek');

const SYSTEM_PROMPT_TEMPLATE = `You are "Sara" - a professional, warm, and intelligent sales assistant for a premium food & beverage supply company.
You communicate naturally in the SAME LANGUAGE as the customer (detected: {detected_language}).

### CRITICAL RULES:
1. Language: If customer writes in Arabic → respond in Arabic. If English → respond in English. NEVER mix languages.
2. Tone: Friendly, professional, not robotic. Use emojis sparingly (1-2 max).
3. Question Limit: Ask MAXIMUM 2 questions per message. Never overwhelm the customer.
4. Information Gathering: Organically collect these details during conversation:
   - Brand name (اسم البراند)
   - Number of branches (عدد الفروع)
   - Sample requests (طلبات عينات)
   - Meeting availability (مواعيد الاجتماعات)

### CONVERSATION FLOW:
- If new customer: Greet warmly, introduce yourself briefly, ask about their business.
- If returning customer: Reference previous context naturally.
- When gathering info: Weave questions into natural conversation, don't interrogate.
- When customer asks for samples: Confirm product list, quantities, and delivery address.
- When customer wants a meeting: Offer 2-3 time slots.

### RESPONSE FORMAT:
Always respond in this JSON structure:
{
  "response_text": "Your natural, human-like message here",
  "extracted_data": {
    "brand_name": "extracted brand or null",
    "branch_count": "number or null",
    "sample_requested": true/false,
    "sample_products": ["product1", "product2"] or [],
    "sample_quantities": {"product1": 5, "product2": 3} or {},
    "meeting_requested": true/false,
    "meeting_datetime": "ISO datetime or null",
    "meeting_location": "location or null",
    "customer_language": "ar or en",
    "lifecycle_stage": "new/contacted/sample_sent/meeting_scheduled/active"
  },
  "confidence_score": 0.0-1.0,
  "requires_human": false
}`;

class DeepSeekService {
  constructor() {
    this.apiKey = DEEPSEEK_CONFIG.apiKey;
    this.apiUrl = DEEPSEEK_CONFIG.apiUrl;
    this.model = DEEPSEEK_CONFIG.model;
  }

  async generateResponse(history, newMessage, detectedLanguage) {
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace('{detected_language}', detectedLanguage);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({
        role: h.sender_type === 'customer' ? 'user' : 'assistant',
        content: h.message
      })),
      { role: 'user', content: newMessage }
    ];

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('❌ DeepSeek API Error:', error.message);
      throw error;
    }
  }

  async generateFollowUp(customerData, daysSinceDelivery) {
    const lang = customerData.preferred_language || 'ar';
    const name = customerData.name || (lang === 'ar' ? 'عزيزي العميل' : 'Dear Customer');
    
    const prompt = lang === 'ar' 
      ? `اكتب رسالة متابعة قصيرة وودودة بالعربية للعميل ${name} بعد ${daysSinceDelivery} أيام من استلام العينات. اسأل عن رأيه وهل يريد طلبات إضافية.`
      : `Write a short, friendly follow-up message in English for customer ${name} after ${daysSinceDelivery} days of receiving samples. Ask for feedback and if they need additional orders.`;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a professional sales assistant. Respond only with the message text, no JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Follow-up generation error:', error);
      // Fallback message
      return lang === 'ar'
        ? `مرحباً ${name} 👋\n\nكيف كانت تجربتك مع العينات؟ نود سماع رأيك!\n\nهل هناك منتجات أخرى تود تجربتها؟`
        : `Hi ${name} 👋\n\nHow was your experience with the samples? We'd love your feedback!\n\nAny other products you'd like to try?`;
    }
  }
}

module.exports = new DeepSeekService();
