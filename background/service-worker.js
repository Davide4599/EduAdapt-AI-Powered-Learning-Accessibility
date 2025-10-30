console.log('EduAdapt service worker loaded');

// AI Session cache with metadata
let aiSession = null;
let sessionLastUsed = null;
let sessionCreationTime = null;

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000, // 1 second
  MAX_RETRY_DELAY: 8000, // 8 seconds
  SESSION_TIMEOUT: 5 * 60 * 1000, // 5 minutes of inactivity
  SESSION_MAX_AGE: 30 * 60 * 1000, // 30 minutes total
};

const SUMMARIZER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const summarizerCache = new Map();

const ADAPTATION_CACHE_LIMIT = 40;
const adaptationCache = new Map();

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAI') {
    checkAIAvailability().then(sendResponse);
    return true; // Async response
  }
  
  if (request.action === 'adaptText') {
    adaptText(request.text, request.profile, request.options || {}).then(sendResponse);
    return true; // Async response
  }
  
  if (request.action === 'cleanupSession') {
    cleanupSession();
    sendResponse({ success: true });
    return true;
  }
});

// ==============================================================
// EXPONENTIAL BACKOFF RETRY MECHANISM
// ==============================================================

/**
 * Retries a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {string} operationName - Name for logging
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = CONFIG.MAX_RETRIES, operationName = 'operation') {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName}: Attempt ${attempt + 1}/${maxRetries + 1}`);
      
      // Try the operation
      const result = await fn();
      
      // Success!
      if (attempt > 0) {
        console.log(`${operationName}: Succeeded after ${attempt + 1} attempts`);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.error(`${operationName}: Attempt ${attempt + 1} failed:`, error.message);
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`${operationName}: All ${maxRetries + 1} attempts failed`);
        throw error;
      }
      
      // Calculate delay with exponential backoff
      // Formula: min(initialDelay * 2^attempt, maxDelay)
      const delay = Math.min(
        CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, attempt),
        CONFIG.MAX_RETRY_DELAY
      );
      
      // Add jitter (random variation) to prevent thundering herd
      // Jitter: ±20% of the delay
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const finalDelay = delay + jitter;
      
      console.log(`${operationName}: Waiting ${Math.round(finalDelay)}ms before retry...`);
      
      // Wait before retrying
      await sleep(finalDelay);
      
      // If the error suggests the session is corrupted, clean it up
      if (isSessionError(error)) {
        console.log(`${operationName}: Session error detected, cleaning up...`);
        await cleanupSession();
      }
    }
  }
  
  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Check if an error is related to session issues
 */
function isSessionError(error) {
  const sessionErrorPatterns = [
    'session',
    'destroyed',
    'invalid',
    'expired',
    'not initialized'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return sessionErrorPatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Sleep utility function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==============================================================
// SUMMARIZER SESSION CACHING
// ==============================================================

async function getSummarizerInstance(lengthSetting) {
  const now = Date.now();
  const cacheEntry = summarizerCache.get(lengthSetting);
  if (cacheEntry && now - cacheEntry.lastUsed <= SUMMARIZER_CACHE_TTL) {
    cacheEntry.lastUsed = now;
    return cacheEntry.instance;
  }

  if (cacheEntry) {
    try {
      cacheEntry.instance?.destroy?.();
    } catch (error) {
      console.warn('Error destroying cached summarizer:', error);
    }
    summarizerCache.delete(lengthSetting);
  }

  const instance = await self.ai.summarizer.create({
    type: 'key-points',
    length: lengthSetting
  });
  summarizerCache.set(lengthSetting, { instance, lastUsed: now });
  return instance;
}

function invalidateSummarizerInstance(lengthSetting) {
  if (!summarizerCache.has(lengthSetting)) {
    return;
  }
  const entry = summarizerCache.get(lengthSetting);
  summarizerCache.delete(lengthSetting);
  try {
    entry.instance?.destroy?.();
  } catch (error) {
    console.warn('Error destroying summarizer instance:', error);
  }
}

function clearSummarizerCache() {
  summarizerCache.forEach(entry => {
    try {
      entry.instance?.destroy?.();
    } catch (error) {
      console.warn('Error destroying summarizer during cleanup:', error);
    }
  });
  summarizerCache.clear();
}

// ==============================================================
// ADAPTATION CACHE
// ==============================================================

function hashTextForCache(text = '') {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function buildAdaptationCacheKey(text, profile, options = {}, mode = 'default') {
  const normalizedProfile = profile || 'default';
  const gradeLevel = options.gradeLevel || 'upper';
  if (normalizedProfile === 'dyslexia') {
    const dyslexiaLevel = options.dyslexiaLevel || 'medium';
    return `${normalizedProfile}|${gradeLevel}|${dyslexiaLevel}|${hashTextForCache(text)}`;
  }
  if (normalizedProfile === 'adhd') {
    const adhdSummaryLength = options.adhdSummaryLength || 'short';
    return `${normalizedProfile}|${gradeLevel}|${adhdSummaryLength}|${mode}|${hashTextForCache(text)}`;
  }
  return `${normalizedProfile}|${gradeLevel}|${mode}|${hashTextForCache(text)}`;
}

function getCachedAdaptation(key) {
  const entry = adaptationCache.get(key);
  if (!entry) {
    return null;
  }
  entry.lastUsed = Date.now();
  return { ...entry.payload };
}

function storeAdaptationInCache(key, payload) {
  adaptationCache.set(key, {
    payload: { ...payload },
    lastUsed: Date.now()
  });

  if (adaptationCache.size > ADAPTATION_CACHE_LIMIT) {
    let oldestKey = null;
    let oldestTime = Infinity;
    adaptationCache.forEach((value, cacheKey) => {
      if (value.lastUsed < oldestTime) {
        oldestTime = value.lastUsed;
        oldestKey = cacheKey;
      }
    });
    if (oldestKey) {
      adaptationCache.delete(oldestKey);
    }
  }
}

function clearAdaptationCache() {
  adaptationCache.clear();
}

// ==============================================================
// SESSION MANAGEMENT WITH AUTOMATIC CLEANUP
// ==============================================================

/**
 * Create or reuse AI session with proper lifecycle management
 */
async function createSession() {
  const now = Date.now();
  
  // Check if existing session is valid
  if (aiSession) {
    // Check if session is too old (max age exceeded)
    if (sessionCreationTime && (now - sessionCreationTime) > CONFIG.SESSION_MAX_AGE) {
      console.log('Session exceeded max age, creating new session...');
      await cleanupSession();
    }
    // Check if session has been inactive for too long
    else if (sessionLastUsed && (now - sessionLastUsed) > CONFIG.SESSION_TIMEOUT) {
      console.log('Session inactive timeout, creating new session...');
      await cleanupSession();
    }
    // Session is valid, reuse it
    else {
      console.log('Reusing existing AI session');
      sessionLastUsed = now;
      return aiSession;
    }
  }
  
  // Create new session
  console.log('Creating new AI session...');
  
  try {
    aiSession = await LanguageModel.create({
      language: "en",
      temperature: 0.7,
      topK: 40
    });
    
    sessionCreationTime = now;
    sessionLastUsed = now;
    
    console.log('AI session created successfully');
    
    // Schedule automatic cleanup
    scheduleSessionCleanup();
    
    return aiSession;
    
  } catch (error) {
    console.error('Error creating AI session:', error);
    aiSession = null;
    sessionCreationTime = null;
    sessionLastUsed = null;
    throw error;
  }
}

/**
 * Cleanup session and free resources
 */
async function cleanupSession() {
  if (aiSession) {
    try {
      console.log('Cleaning up AI session...');
      
      // Destroy the session to free memory
      if (typeof aiSession.destroy === 'function') {
        await aiSession.destroy();
      }
      
      aiSession = null;
      sessionCreationTime = null;
      sessionLastUsed = null;
      
      console.log('AI session cleaned up successfully');
      
    } catch (error) {
      console.error('Error during session cleanup:', error);
      // Force cleanup even if destroy fails
      aiSession = null;
      sessionCreationTime = null;
      sessionLastUsed = null;
    }
  }
}

// Timeout handle for scheduled cleanup
let cleanupTimeoutId = null;

/**
 * Schedule automatic session cleanup after inactivity
 */
function scheduleSessionCleanup() {
  // Clear existing timeout
  if (cleanupTimeoutId) {
    clearTimeout(cleanupTimeoutId);
  }
  
  // Schedule cleanup after timeout period
  cleanupTimeoutId = setTimeout(async () => {
    const now = Date.now();
    
    // Double-check if session is still inactive
    if (sessionLastUsed && (now - sessionLastUsed) >= CONFIG.SESSION_TIMEOUT) {
      console.log('Auto-cleanup: Session inactive, cleaning up...');
      await cleanupSession();
    }
  }, CONFIG.SESSION_TIMEOUT);
}

// ==============================================================
// IMPROVED AI AVAILABILITY CHECK
// ==============================================================

async function checkAIAvailability() {
  return retryWithBackoff(async () => {
    if (typeof LanguageModel === 'undefined') {
      throw new Error('LanguageModel API not found');
    }
    
    const availability = await LanguageModel.availability();
    console.log('AI Availability:', availability);
    
    if (availability === 'readily' || availability === 'available') {
      return { available: true, status: availability };
    } else if (availability === 'after-download') {
      return { 
        available: false, 
        reason: 'Model needs to be downloaded',
        status: availability
      };
    } else {
      return { 
        available: false, 
        reason: `Status: ${availability}`,
        status: availability
      };
    }
  }, 2, 'AI Availability Check'); // Only 2 retries for availability check
}

// ==============================================================
// IMPROVED TEXT ADAPTATION WITH RETRY
// ==============================================================

async function adaptWithSummarizer(text, summaryLength = 'short') {
  if (
    typeof self === 'undefined' ||
    !self.ai ||
    !self.ai.summarizer ||
    typeof self.ai.summarizer.create !== 'function'
  ) {
    return { success: false, reason: 'Summarizer API unavailable' };
  }

  const allowedLengths = ['short', 'medium', 'long'];
  const lengthSetting = allowedLengths.includes(summaryLength) ? summaryLength : 'short';

  try {
    const summaryText = await retryWithBackoff(async () => {
      const summarizer = await getSummarizerInstance(lengthSetting);
      const response = await summarizer.summarize(text);
      let output = '';
      if (typeof response === 'string') {
        output = response;
      } else if (response) {
        if (typeof response.summary === 'string') {
          output = response.summary;
        } else if (Array.isArray(response.highlights)) {
          output = response.highlights.join('\n');
        } else if (Array.isArray(response.summaries)) {
          output = response.summaries.join('\n');
        }
      }
      if (!output || output.trim().length === 0) {
        throw new Error('Summarizer returned empty output');
      }
      return output;
    }, Math.min(CONFIG.MAX_RETRIES, 2), 'Summarizer Adaptation');
    return { success: true, adaptedText: summaryText };
  } catch (error) {
    invalidateSummarizerInstance(lengthSetting);
    console.error('Summarizer adaptation failed:', error);
    return { success: false, reason: error.message };
  }
}
async function adaptText(text, profile, options = {}) {
  try {
    const trimmedText = (text || '').trim();
    if (trimmedText.length < 20) {
      return { 
        success: false, 
        reason: 'Text too short (minimum 20 characters)' 
      };
    }

    const maxLength = 3000;
    let workingText = trimmedText;
    if (workingText.length > maxLength) {
      workingText = truncateAtSentence(workingText, maxLength);
    }

    const cacheKeyPrompt = buildAdaptationCacheKey(workingText, profile, options, 'prompt');

    if (profile === 'adhd') {
      const cacheKeySummarizer = buildAdaptationCacheKey(workingText, profile, options, 'summarizer');
      const cachedSummary = getCachedAdaptation(cacheKeySummarizer);
      if (cachedSummary) {
        return cachedSummary;
      }

      const summarizerAttempt = await adaptWithSummarizer(
        workingText,
        options.adhdSummaryLength || 'short'
      );
      if (summarizerAttempt.success) {
        console.log('ADHD adaptation using Summarizer API');
        const adapted = summarizerAttempt.adaptedText;
        const summaryResult = {
          success: true,
          adaptedText: adapted,
          profile,
          originalLength: workingText.length,
          adaptedLength: adapted.length,
          method: 'summarizer'
        };
        storeAdaptationInCache(cacheKeySummarizer, summaryResult);
        return summaryResult;
      } else {
        console.warn('Summarizer unavailable or failed, falling back to prompt:', summarizerAttempt.reason);
      }

      const cachedFallback = getCachedAdaptation(cacheKeyPrompt);
      if (cachedFallback) {
        return cachedFallback;
      }
    } else {
      const cachedResult = getCachedAdaptation(cacheKeyPrompt);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // Adapt text with retry mechanism
    const result = await retryWithBackoff(async () => {
      const session = await createSession();
      
      const prompt = getPromptForProfile(profile, workingText, options);
      
      const completion = await session.prompt(prompt);
      
      if (!completion || typeof completion !== 'string' || completion.trim().length === 0) {
        throw new Error('AI returned empty response');
      }
      
      return completion.trim();
      
    }, CONFIG.MAX_RETRIES, 'Text Adaptation');
    
    const successPayload = {
      success: true,
      adaptedText: result,
      profile,
      originalLength: workingText.length,
      adaptedLength: result.length,
      method: 'prompt'
    };
    storeAdaptationInCache(cacheKeyPrompt, successPayload);
    return successPayload;
    
  } catch (error) {
    console.error('adaptText error:', error);
    const message = error?.message || 'Adaptation failed';
    let userMessage = 'Failed to adapt text';
    if (message.toLowerCase().includes('quota')) {
      userMessage = 'AI quota exceeded. Please try again later.';
    } else if (message.toLowerCase().includes('network')) {
      userMessage = 'Network error. Please check your connection.';
    } else if (message.toLowerCase().includes('session')) {
      userMessage = 'AI session issue. Please try again.';
    }
    return {
      success: false,
      reason: message,
      userMessage
    };
  }
}
/**
 * Truncate text at sentence boundary
 * This preserves grammar and readability
 */
function truncateAtSentence(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Truncate to max length
  let truncated = text.substring(0, maxLength);
  
  // Find the last sentence boundary (period, question mark, exclamation)
  const sentenceEnders = ['. ', '? ', '! '];
  let lastBoundary = -1;
  
  for (const ender of sentenceEnders) {
    const pos = truncated.lastIndexOf(ender);
    if (pos > lastBoundary) {
      lastBoundary = pos;
    }
  }
  
  // If we found a sentence boundary, use it
  if (lastBoundary > maxLength * 0.7) { // At least 70% of target length
    return truncated.substring(0, lastBoundary + 1);
  }
  
  // Otherwise, find last space to avoid cutting mid-word
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Last resort: hard truncate
  return truncated + '...';
}

// ==============================================================
// PROMPT GENERATION (unchanged, but documented)
// ==============================================================

function getPromptForProfile(profile, text, options = {}) {
  const dyslexiaLevel = (options.dyslexiaLevel || 'medium').toLowerCase();
  const simplificationGuidance = {
    low: 'Mild simplification. Keep most original meaning and vocabulary, but clarify tricky phrases.',
    medium: 'Balanced simplification. Use common words, keep key facts, and shorten sentences.',
    high: 'Maximum simplification. Use very common words, very short sentences, and remove non-essential detail.'
  };
  const dyslexiaInstruction = simplificationGuidance[dyslexiaLevel] || simplificationGuidance.medium;

  const adhdLength = (options.adhdSummaryLength || 'short').toLowerCase();
  const adhdGuidance = {
    short: 'Summaries must be brief (3-4 bullet points max). Focus only on essential facts.',
    medium: 'Provide a medium-length summary (up to 6 bullet points) with key supporting facts.',
    long: 'Provide a longer structured summary (up to 8 bullet points plus a short intro).'
  };
  const adhdInstruction = adhdGuidance[adhdLength] || adhdGuidance.short;
  const gradeLevel = (options.gradeLevel || 'upper').toLowerCase();
  const dyslexiaGradeGuidanceMap = {
    lower: 'Audience: 1st-3rd grade. Write in uppercase, keep sentences extremely short (6-8 words), omit comprehension questions, and provide a simple Glossary section (word - meaning) with up to 3 entries.',
    upper: 'Audience: 4th-6th grade. Keep sentences short (8-12 words), include one age-appropriate comprehension question after each paragraph, and provide a Glossary section with up to 4 entries (word - meaning).',
    middle: 'Audience: 7th-8th grade. Use clear sentences (12-16 words), provide a thoughtful comprehension question after each paragraph, Glossary optional (max 2 entries if essential).'
  };
  const adhdGradeGuidanceMap = {
    lower: 'Audience: 1st-3rd grade. Limit to 3 very short checklist steps in uppercase with concrete actions. Keep language simple and encouraging.',
    upper: 'Audience: 4th-6th grade. Provide 3-4 concise checklist steps with direct actions or reminders appropriate for this age.',
    middle: 'Audience: 7th-8th grade. Provide up to 5 focused checklist steps emphasising planning, organisation, and self-monitoring.'
  };
  const dyslexiaGradeGuidance = dyslexiaGradeGuidanceMap[gradeLevel] || dyslexiaGradeGuidanceMap.upper;
  const adhdGradeGuidance = adhdGradeGuidanceMap[gradeLevel] || adhdGradeGuidanceMap.upper;
  const includeDyslexiaQuestions = gradeLevel !== 'lower';

  const prompts = {
    dyslexia: `You are helping a student with dyslexia. Adapt this text based on scientific research on dyslexia and readability. You must rewrite the content so it follows every rule below.

CORE PRINCIPLES (Research-Based):
1. REDUCE VISUAL CROWDING: Break text into small, well-spaced chunks
2. SIMPLIFY VOCABULARY: Use high-frequency, concrete words (avoid abstract terms)
3. SHORTEN SENTENCES: Maximum 10-12 words per sentence
4. CLEAR STRUCTURE: Use consistent formatting and predictable patterns

SPECIFIC RULES:
- Replace complex or rare words with common alternatives (e.g., "utilize" -> "use")
- One idea per sentence
- Break paragraphs every 3-4 sentences maximum
- Use bullet points (•) for lists (not numbers)
- Add clear section breaks between different topics
- Remove redundant phrases and filler words
- Avoid metaphors, idioms, and ambiguous pronouns ("it", "this")
- Keep active voice (e.g., "The dog chased the ball" not "The ball was chased")
- Do not copy sentences or phrases verbatim from the original text
- Simplification intensity: ${dyslexiaInstruction}
- Grade guidance (instructions for you only, do NOT mention or reference this in the output): ${dyslexiaGradeGuidance}
${includeDyslexiaQuestions ? '- After each paragraph, append a short comprehension question on a new line that begins with "Question:".' : ''}
- Never include text such as "Grade guidance" or any sentence describing these instructions.

FORMATTING MARKERS (for CSS styling):
- Use **bold** for key terms (wrap in asterisks)
- Insert line breaks between distinct ideas
- Keep line length under 70 characters when possible
- Keep the output as plain text with line breaks (no markdown headings)

TEXT TO ADAPT:
${text}

ADAPTED TEXT:`,

    adhd: `You are helping a student with ADHD. Adapt the following text to help maintain focus:

RULES:
- Start with a brief summary (2-3 sentences maximum)
- Use clear headings and subheadings
- Break content into small, manageable chunks
- Highlight key points with bullet points
- Use bold for the most important information (use **text** format)
- Keep paragraphs very short (3-4 sentences max)
- Remove unnecessary details
- Formatting guidance: ${adhdInstruction}
- Present actionable steps as checklist items the student can tick off.
- Grade guidance (instructions for you only, do NOT mention or reference this in the output): ${adhdGradeGuidance}
- Do not add text like "Quick check" unless explicitly requested elsewhere.
- Never include text such as "Grade guidance" or any sentence describing these instructions.

TEXT TO ADAPT:
${text}

ADAPTED TEXT:`
  };
  
  return prompts[profile] || text;
}

// ==============================================================
// LIFECYCLE MANAGEMENT
// ==============================================================

// Clean up when extension is suspended
chrome.runtime.onSuspend.addListener(async () => {
  console.log('Extension suspending, cleaning up...');
  await cleanupSession();
  clearSummarizerCache();
  clearAdaptationCache();
  
  if (cleanupTimeoutId) {
    clearTimeout(cleanupTimeoutId);
  }
});

// Clean up when service worker is about to be terminated
self.addEventListener('beforeunload', async () => {
  console.log('Service worker terminating, cleaning up...');
  await cleanupSession();
  clearSummarizerCache();
  clearAdaptationCache();
});

// Periodic health check (every 10 minutes)
setInterval(async () => {
  const now = Date.now();
  
  // Check if session exists but is stale
  if (aiSession && sessionLastUsed) {
    const inactiveDuration = now - sessionLastUsed;
    
    if (inactiveDuration > CONFIG.SESSION_TIMEOUT) {
      console.log('Health check: Session inactive, cleaning up...');
      await cleanupSession();
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes

console.log('Service worker initialization complete');
