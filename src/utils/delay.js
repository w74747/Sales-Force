/**
 * Generate a random delay between min and max milliseconds
 * to simulate human typing behavior
 */
function getRandomDelay(min = 3000, max = 7000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate typing time based on message length
 * Average human typing speed: ~200ms per character (including thinking time)
 */
function calculateTypingTime(message, speedPerChar = 50) {
  return message.length * speedPerChar;
}

/**
 * Sleep/pause execution for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Full human-like delay: random wait + typing simulation
 */
async function humanLikeDelay(message) {
  const initialDelay = getRandomDelay(2000, 5000);
  const typingTime = calculateTypingTime(message);
  
  console.log(`⏳ Initial delay: ${initialDelay}ms`);
  await sleep(initialDelay);
  
  console.log(`⌨️  Typing simulation: ${typingTime}ms for ${message.length} chars`);
  await sleep(typingTime);
}

module.exports = {
  getRandomDelay,
  calculateTypingTime,
  sleep,
  humanLikeDelay
};
