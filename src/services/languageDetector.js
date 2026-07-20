const axios = require('axios');

/**
 * Detect language of a text using a simple heuristic approach
 * Falls back to DeepSeek if needed
 */
async function detectLanguage(text) {
  // Simple heuristic: check for Arabic characters
  const arabicPattern = /[\u0600-\u06FF]/;
  const englishPattern = /[a-zA-Z]/;
  
  const hasArabic = arabicPattern.test(text);
  const hasEnglish = englishPattern.test(text);
  
  if (hasArabic && !hasEnglish) return 'ar';
  if (hasEnglish && !hasArabic) return 'en';
  if (hasArabic && hasEnglish) {
    // Mixed - count which is more
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    return arabicCount > englishCount ? 'ar' : 'en';
  }
  
  return 'ar'; // Default to Arabic
}

/**
 * Get greeting based on language
 */
function getGreeting(language) {
  const greetings = {
    ar: 'مرحباً',
    en: 'Hello'
  };
  return greetings[language] || greetings.ar;
}

module.exports = {
  detectLanguage,
  getGreeting
};
