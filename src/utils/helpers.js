/**
 * Format phone number to standard format
 */
function formatPhoneNumber(number) {
  // Remove any non-digit characters
  let cleaned = number.replace(/\D/g, '');
  
  // Ensure it starts with country code (assuming Saudi Arabia +966)
  if (cleaned.startsWith('0')) {
    cleaned = '966' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('966')) {
    cleaned = '966' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format date for display
 */
function formatDate(date) {
  return new Date(date).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate a unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Safe JSON parse with fallback
 */
function safeJsonParse(str, fallback = {}) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

module.exports = {
  formatPhoneNumber,
  formatDate,
  truncateText,
  generateId,
  safeJsonParse
};
