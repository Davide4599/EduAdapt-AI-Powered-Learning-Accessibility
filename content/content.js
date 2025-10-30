// Content Script - EduAdapt Page Modifier
console.log('EduAdapt content script loaded');

// Store original content
let originalContent = null;
let currentProfile = null;
const MIN_TEXT_LENGTH = 60;
const MIN_WORD_COUNT = 10;
const MIN_ELEMENT_WIDTH = 360;
const DEFAULT_OPTIONS = {
  dyslexiaLevel: 'medium',
  adhdSummaryLength: 'short',
  gradeLevel: 'upper' // lower (1-3), upper (4-6), middle (7-8)
};
let currentOptions = { ...DEFAULT_OPTIONS };
const DYSLEXIA_PREFETCH_CHAR_LIMIT = 1200;
const DYSLEXIA_MANUAL_CHUNK_SIZE = 900;
const dyslexiaPrefetchState = {
  queue: [],
  active: 0,
  maxConcurrent: 2,
  maxPrefetchItems: 8,
  version: 0
};

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanGlossaryText(str = '') {
  return escapeHtml(
    str
      .replace(/<[^>]*>/g, '')
      .replace(/\*\*|__|`/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function splitTextIntoChunks(text = '', maxSize = DYSLEXIA_MANUAL_CHUNK_SIZE) {
  if (text.length <= maxSize) {
    return [text.trim()];
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let buffer = '';

  sentences.forEach(sentence => {
    if (!sentence) {
      return;
    }
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length > maxSize && buffer) {
      chunks.push(buffer.trim());
      buffer = sentence;
    } else if (candidate.length > maxSize) {
      chunks.push(sentence.trim());
      buffer = '';
    } else {
      buffer = candidate;
    }
  });

  if (buffer) {
    chunks.push(buffer.trim());
  }

  return chunks.filter(Boolean);
}

function resetDyslexiaPrefetch() {
  dyslexiaPrefetchState.queue = [];
  dyslexiaPrefetchState.active = 0;
  dyslexiaPrefetchState.version += 1;
}

function removeDyslexiaJobFromQueue(job) {
  const index = dyslexiaPrefetchState.queue.indexOf(job);
  if (index !== -1) {
    dyslexiaPrefetchState.queue.splice(index, 1);
  }
}

function enqueueDyslexiaJob(job) {
  job.state = 'queued';
  job.version = dyslexiaPrefetchState.version;
  job.status.textContent = 'Preparing supported reading...';
  dyslexiaPrefetchState.queue.push(job);
  processDyslexiaQueue();
}

function processDyslexiaQueue() {
  while (
    dyslexiaPrefetchState.active < dyslexiaPrefetchState.maxConcurrent &&
    dyslexiaPrefetchState.queue.length > 0
  ) {
    const job = dyslexiaPrefetchState.queue.shift();
    if (!job || job.version !== dyslexiaPrefetchState.version) {
      continue;
    }
    startDyslexiaJob(job);
  }
}

function applyGradeStyles(grade) {
  const body = document.body;
  const classes = ['eduadapt-grade-lower', 'eduadapt-grade-upper', 'eduadapt-grade-middle'];
  classes.forEach(cls => body.classList.remove(cls));
  const map = {
    lower: 'eduadapt-grade-lower',
    upper: 'eduadapt-grade-upper',
    middle: 'eduadapt-grade-middle'
  };
  if (map[grade]) {
    body.classList.add(map[grade]);
  }
}

async function startDyslexiaJob(job, options = {}) {
  if (!job || job.version !== dyslexiaPrefetchState.version) {
    return;
  }
  
  const { fromUser = false } = options;
  const shouldPrefetch = job.text.length <= DYSLEXIA_PREFETCH_CHAR_LIMIT;
  if (!shouldPrefetch && !fromUser) {
    job.status.textContent = 'Large section – open to simplify';
    return;
  }

  if (job.state === 'running') {
    if (fromUser) {
      job.pendingUserReveal = true;
      job.button.disabled = true;
      job.button.textContent = 'Generating...';
      job.status.textContent = 'Creating supported reading...';
    }
    return;
  }
  
  if (job.state === 'completed') {
    if (fromUser && job.support.dataset.loaded === 'true') {
      job.support.classList.add('eduadapt-visible');
      job.button.textContent = 'Hide supported reading';
      job.status.textContent = '';
    }
    return;
  }
  
  removeDyslexiaJobFromQueue(job);
  job.state = 'running';
  job.pendingUserReveal = fromUser;
  job.support.dataset.prefetching = 'true';
  if (fromUser) {
    job.button.disabled = true;
    job.button.textContent = 'Generating...';
    job.status.textContent = 'Creating supported reading...';
  } else {
    job.status.textContent = 'Preparing supported reading...';
  }
  
  dyslexiaPrefetchState.active += 1;
  
  try {
    const chunks = splitTextIntoChunks(job.text);
    let combinedText = '';

    for (let i = 0; i < chunks.length; i++) {
      if (fromUser && chunks.length > 1) {
        job.status.textContent = `Creating supported reading (${i + 1}/${chunks.length})...`;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'adaptText',
        text: chunks[i],
        profile: job.profile,
        options: job.options
      });
      
      if (job.version !== dyslexiaPrefetchState.version) {
        return;
      }
      
      if (!response || !response.success) {
        throw new Error(response?.userMessage || 'Adaptation failed');
      }

      combinedText += `${response.adaptedText.trim()}\n\n`;
    }

    job.support.innerHTML = formatAdaptedText(combinedText.trim(), job.profile, job.tagName);
    enhanceGlossaryContent(job.support);
    job.support.dataset.loaded = 'true';
    job.support.dataset.prefetching = 'false';
    
    if (job.pendingUserReveal) {
      job.support.classList.add('eduadapt-visible');
      job.button.textContent = 'Hide supported reading';
      job.status.textContent = '';
    } else {
      job.button.textContent = 'Show supported reading';
      job.status.textContent = 'Ready to view';
    }
    
    job.button.disabled = false;
    job.state = 'completed';
    job.pendingUserReveal = false;
    
  } catch (error) {
    if (job.version !== dyslexiaPrefetchState.version) {
      return;
    }
    console.error('Support section error:', error);
    job.state = 'failed';
    job.support.dataset.prefetching = 'false';
    job.button.disabled = false;
    job.button.textContent = 'Try again';
    job.status.textContent = error.message || 'Could not create supported reading.';
    
  } finally {
    if (job.version === dyslexiaPrefetchState.version) {
      dyslexiaPrefetchState.active = Math.max(0, dyslexiaPrefetchState.active - 1);
      processDyslexiaQueue();
    }
  }
}

function buildADHDSummarySource(paragraphs, limitChars = 1200, maxParagraphs = 2) {
  const chunks = [];
  let total = 0;
  for (const para of paragraphs) {
    if (!para || !para.originalText) {
      continue;
    }
    const text = para.originalText.trim();
    if (!text) {
      continue;
    }
    const newTotal = total + text.length;
    chunks.push(text);
    total = newTotal;
    if (chunks.length >= maxParagraphs || total >= limitChars) {
      break;
    }
  }
  return chunks.join('\n\n');
}

function extractFirstSentence(text = '') {
  const match = text.match(/[^.!?\n]+[.!?]?/);
  return match ? match[0].trim() : text.trim();
}

function createADHDQuickSummary(paragraphs, mainElement, options) {
  const summarySource = buildADHDSummarySource(paragraphs);
  if (!summarySource) {
    return;
  }

  const queuedSections = Math.max(1, paragraphs.length);
  const totalWords = paragraphs.reduce((count, para) => {
    const text = (para && para.originalText) || '';
    if (!text.trim()) {
      return count;
    }
    return count + text.trim().split(/\s+/).length;
  }, 0);
  const estimatedMinutes = totalWords / 160;
  let estimatedLabel = 'under a minute';
  if (estimatedMinutes >= 1) {
    estimatedLabel = `~${Math.max(1, Math.round(estimatedMinutes))} min`;
  } else if (totalWords > 0) {
    const seconds = Math.max(20, Math.round(estimatedMinutes * 60));
    estimatedLabel = `~${seconds} sec`;
  }

  const headingCandidate =
    (document.querySelector('main h1, article h1, header h1, h1') || document.querySelector('title'))?.textContent ||
    document.title ||
    'Current page';
  const trimmedHeading = headingCandidate.trim().slice(0, 60);
  const focusTopic = escapeHtml(trimmedHeading.length >= headingCandidate.trim().length ? trimmedHeading : `${trimmedHeading}…`);

  const summaryContainer = document.createElement('div');
  summaryContainer.className = 'eduadapt-adhd-summary';
  const previewParagraphs = paragraphs.slice(0, Math.min(3, paragraphs.length));
  const initialBullets = previewParagraphs
    .map((para, index) => {
      const sentence = extractFirstSentence(para.originalText || '');
      const safeSentence = escapeHtml(sentence || 'Gathering the first key idea…');
      return `
        <li>
          <span class="eduadapt-placeholder-label">Focus point ${index + 1}</span>
          <span class="eduadapt-placeholder-text">${safeSentence}</span>
        </li>
      `;
    })
    .join('');
  summaryContainer.innerHTML = `
    <div class="eduadapt-summary-heading">
      <div class="eduadapt-summary-heading-label">
        <span class="eduadapt-heading-pulse" aria-hidden="true"></span>
        Quick focus scan
      </div>
      <span class="eduadapt-summary-tag">ADHD boost</span>
    </div>
    <div class="eduadapt-summary-meta" role="status">
      <div class="eduadapt-meta-block">
        <span class="eduadapt-meta-label">Focus topic</span>
        <span class="eduadapt-meta-value">${focusTopic}</span>
      </div>
      <div class="eduadapt-meta-block">
        <span class="eduadapt-meta-label">Sections queued</span>
        <span class="eduadapt-meta-value">${queuedSections}</span>
      </div>
      <div class="eduadapt-meta-block">
        <span class="eduadapt-meta-label">Approx read</span>
        <span class="eduadapt-meta-value">${estimatedLabel}</span>
      </div>
    </div>
    <div class="eduadapt-summary-body" aria-live="polite" aria-label="Quick focus overview content">
      <ul class="eduadapt-summary-placeholder">
        ${
          initialBullets ||
          `<li><span class="eduadapt-placeholder-label">Heads up</span><span class="eduadapt-placeholder-text">Scanning the first section so you can jump in faster…</span></li>`
        }
      </ul>
    </div>
    <div class="eduadapt-summary-status">
      <div class="eduadapt-loading-track" role="progressbar" aria-busy="true" aria-label="Creating ADHD focus overview">
        <span class="eduadapt-loading-bar"></span>
      </div>
      <span class="eduadapt-status-text">Hang tight—your focus overview unlocks in a few seconds.</span>
    </div>
  `;
  const body = summaryContainer.querySelector('.eduadapt-summary-body');
  const statusText = summaryContainer.querySelector('.eduadapt-status-text');
  const loadingTrack = summaryContainer.querySelector('.eduadapt-loading-track');
  
  const target = mainElement || findMainContent();
  if (target) {
    const existing = target.querySelector('.eduadapt-adhd-summary');
    if (existing) {
      existing.remove();
    }
  }
  
  if (target && target.firstChild) {
    target.insertBefore(summaryContainer, target.firstChild);
  } else if (target) {
    target.appendChild(summaryContainer);
  }
  
  chrome.runtime.sendMessage({
    action: 'adaptText',
    text: summarySource,
    profile: 'adhd',
    options: options
  }).then(response => {
    if (response && response.success) {
      summaryContainer.classList.add('eduadapt-summary-ready');
      if (loadingTrack) {
        loadingTrack.setAttribute('aria-busy', 'false');
      }
      body.innerHTML = `<div class="eduadapt-summary-result">${formatAdaptedText(response.adaptedText, 'adhd', 'div')}</div>`;
      if (statusText) {
        statusText.textContent = 'Focus overview ready — use these highlights as your checklist.';
      }
      enhanceGlossaryContent(summaryContainer);
    } else {
      summaryContainer.classList.add('eduadapt-summary-error');
      if (loadingTrack) {
        loadingTrack.setAttribute('aria-busy', 'false');
      }
      body.textContent = response?.userMessage || 'Could not generate summary.';
      if (statusText) {
        statusText.textContent = 'We hit a snag generating the focus overview.';
      }
    }
  }).catch(error => {
    console.error('Quick summary error:', error);
    summaryContainer.classList.add('eduadapt-summary-error');
    if (loadingTrack) {
      loadingTrack.setAttribute('aria-busy', 'false');
    }
    body.textContent = 'Error generating summary.';
    if (statusText) {
      statusText.textContent = 'Something went wrong while creating the overview.';
    }
  });
}

function prioritizeADHDParagraphs(paragraphs, maxItems = 10) {
  const viewportHeight = window.innerHeight || 800;
  const threshold = viewportHeight * 1.2;
  const prioritized = [];
  const remaining = [];
  
  paragraphs.forEach(para => {
    if (!para || !para.element) {
      return;
    }
    try {
      const rect = para.element.getBoundingClientRect();
      if (rect.top < threshold) {
        prioritized.push({ para, score: rect.top });
      } else {
        remaining.push({ para, score: rect.top });
      }
    } catch (error) {
      remaining.push({ para, score: Number.MAX_SAFE_INTEGER });
    }
  });
  
  prioritized.sort((a, b) => a.score - b.score);
  remaining.sort((a, b) => a.score - b.score);
  
  const ordered = prioritized.concat(remaining).map(item => item.para);
  return ordered.slice(0, Math.min(maxItems, ordered.length));
}

function ensureADHDPlaceholder(para, index) {
  if (!para || !para.element) {
    return;
  }
  if (para.element.dataset.eduadaptAdhdPlaceholder === 'true') {
    return;
  }
  para.element.dataset.eduadaptAdhdPlaceholder = 'true';
  para.element.classList.add('eduadapt-adhd-original');
  para.element.innerHTML = `
    <div class="eduadapt-adhd-section">
      <div class="eduadapt-adhd-placeholder">
        <div class="eduadapt-adhd-placeholder-title">Preparing summary ${index + 1}</div>
        <div class="eduadapt-adhd-placeholder-body">This section is being simplified…</div>
      </div>
    </div>
  `;
}

function enhanceGlossaryContent(root) {
  // No-op: glossary entries now render as plain text.
}

async function adaptParagraphContent(para, profile, options, index) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'adaptText',
      text: para.originalText,
      profile,
      options
    });
    
    if (!response || !response.success) {
      throw new Error(response?.userMessage || 'Adaptation failed');
    }
    
    const formatted = formatAdaptedText(
      response.adaptedText,
      profile,
      para.tagName
    );
    
    if (profile === 'adhd') {
      para.element.innerHTML = `
        <div class="eduadapt-adhd-section eduadapt-adhd-section-ready">
          ${formatted}
        </div>
      `;
      para.element.dataset.eduadaptAdhdPlaceholder = 'done';
    } else {
      para.element.innerHTML = formatted;
    }
    enhanceGlossaryContent(para.element);
  } catch (error) {
    console.error('Error adapting paragraph:', error);
    if (profile === 'adhd') {
      para.element.innerHTML = `
        <div class="eduadapt-adhd-section eduadapt-adhd-section-error">
          <p>We could not simplify this section right now.</p>
        </div>
      `;
      para.element.dataset.eduadaptAdhdPlaceholder = 'error';
    }
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'adaptPage') {
    adaptPage(request.profile, request.options || {});
    sendResponse({ success: true });
  }
  
  if (request.action === 'resetPage') {
    resetPage();
    sendResponse({ success: true });
  }
});

// Find main content area
function findMainContent() {
  // Try to find main content using common selectors
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.article-content',
    '#content',
    '.entry-content',
    'body'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.innerText.length > 100) {
      return element;
    }
  }
  
  return document.body;
}

// Extract paragraphs from element
function extractParagraphs(element) {
  const paragraphs = [];
  const firstHeading = document.querySelector('#firstHeading') || document.querySelector('main h1, h1');

  // Find all text-containing elements
  const textElements = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div');
  const excludedAncestors = [
    'nav',
    'header',
    'footer',
    'aside',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]',
    '.sidebar',
    '.widget',
    '.advert',
    '.advertisement',
    '.ads',
    '.adunit',
    '.sponsored',
    '.promo',
    '.newsletter',
    '.subscription',
    '.cookie',
    '.modal',
    '.popup',
    '.eduadapt-support-tools',
    '.infobox',
    '.thumb',
    '.thumbcaption',
    '.navbox',
    '.vertical-navbox',
    '.metadata',
    '#toc',
    '#siteSub',
    '#contentSub'
  ];
  const keywordPatterns = [
    'appearance',
    'setting',
    'control',
    'option',
    'toggle',
    'preference',
    'sidebar',
    'toolbar',
    'menu',
    'breadcrumb',
    'infobox',
    'metadata',
    'infobox',
    'thumb',
    'gallery',
    'caption'
  ];
  const excludedTextPatterns = [
    /from wikipedia/i,
    /this article/i,
    /learn how and when to/i,
    /this section/i,
    /talk:/i,
    /view history/i,
    /navigation menu/i,
    /jump to/i,
    /display settings/i
  ];
  const noisyPrefixPatterns = [
    /^commenti/i,
    /^tag/i,
    /^condividi/i,
    /^facebook/i,
    /^twitter/i,
    /^whatsapp/i,
    /^linkedin/i,
    /^pinterest/i,
    /^telegram/i,
    /^ultim[oa]? aggiornamento/i,
    /^pubblicato/i
  ];
  const noisyContainsPatterns = [
    /cookie/i,
    /newsletter/i,
    /advertising/i,
    /banner/i,
    /social/i
  ];

  const hasKeywordAncestor = (node) => {
    let current = node;
    while (current && current !== element) {
      if (current.classList && Array.from(current.classList).some(cls => {
        const lower = cls.toLowerCase();
        return keywordPatterns.some(keyword => lower.includes(keyword));
      })) {
        return true;
      }
      if (current.id) {
        const lowerId = current.id.toLowerCase();
        if (keywordPatterns.some(keyword => lowerId.includes(keyword))) {
          return true;
        }
      }
      current = current.parentElement;
    }
    return false;
  };
  
  textElements.forEach(el => {
    if (!el.isConnected) {
      return;
    }
    
    if (excludedAncestors.some(selector => el.closest(selector))) {
      return;
    }
    
    if (firstHeading && (firstHeading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) {
      return;
    }
    
    if (el.offsetParent === null && window.getComputedStyle(el).position !== 'fixed') {
      return; // skip hidden elements
    }
    
    if (hasKeywordAncestor(el)) {
      return;
    }
    
    const text = el.innerText.trim();
    const wordCount = text.split(/\s+/).length;
    
    if (excludedTextPatterns.some(pattern => pattern.test(text))) {
      return;
    }
    if (noisyPrefixPatterns.some(pattern => pattern.test(text))) {
      return;
    }
    if (noisyContainsPatterns.some(pattern => pattern.test(text))) {
      return;
    }

    try {
      const rect = el.getBoundingClientRect();
      if (rect && rect.width && rect.width < MIN_ELEMENT_WIDTH) {
        return;
      }
    } catch (e) {
      // Ignore measurement errors
    }
    
    // Only process elements with substantial text
    if (text.length >= MIN_TEXT_LENGTH && wordCount >= MIN_WORD_COUNT && !el.querySelector('p, h1, h2, h3')) {
      paragraphs.push({
        element: el,
        originalText: text,
        tagName: el.tagName.toLowerCase()
      });
    }
  });
  
  return paragraphs;
}

// Adapt page
async function adaptPage(profile, options = {}) {
  try {
    console.log('Adapting page for profile:', profile);
    currentOptions = { ...DEFAULT_OPTIONS, ...options };
    resetDyslexiaPrefetch();
    
    // Show loading indicator
    showLoadingIndicator();
    
    // Find main content
    const mainContent = findMainContent();
    
    // Store original if not already stored
    if (!originalContent) {
      originalContent = mainContent.innerHTML;
    }
    
    // Extract paragraphs
    const paragraphs = extractParagraphs(mainContent);
    
    if (paragraphs.length === 0) {
      hideLoadingIndicator();
      showNotification('No content found to adapt', 'warning');
      return;
    }
    
    // Apply CSS for profile
    applyCSSForProfile(profile);
    applyGradeStyles(currentOptions.gradeLevel);

    if (profile === 'dyslexia') {
      paragraphs.forEach((para, index) => setupSupportSection(para, profile, currentOptions, index));
      currentProfile = profile;
      hideLoadingIndicator();
      showNotification('Support added. Expand sections for easier text.', 'success');
      return;
    }

    const isADHD = profile === 'adhd';
    const targetParagraphs = isADHD
      ? prioritizeADHDParagraphs(paragraphs, 8)
      : paragraphs.slice(0, 10);

    if (isADHD) {
      targetParagraphs.forEach((para, idx) => ensureADHDPlaceholder(para, idx));
      createADHDQuickSummary(targetParagraphs, mainContent, currentOptions);
    }

    if (targetParagraphs.length === 0) {
      hideLoadingIndicator();
      showNotification('No content found to adapt', 'warning');
      return;
    }
    
    // Adapt each paragraph with AI
    let adapted = 0;
    const total = targetParagraphs.length;
    updateLoadingIndicator(adapted, total);
    
    if (profile === 'adhd') {
      const firstBatchCount = Math.min(3, targetParagraphs.length);
      for (let i = 0; i < firstBatchCount; i++) {
        await adaptParagraphContent(targetParagraphs[i], profile, currentOptions, i);
        adapted++;
        updateLoadingIndicator(adapted, total);
      }
      
      const remaining = targetParagraphs.slice(firstBatchCount);
      const concurrency = Math.min(3, Math.max(1, remaining.length));
      let nextIndex = 0;
      
      async function runRemainingWorker() {
        while (true) {
          const currentIndex = nextIndex;
          if (currentIndex >= remaining.length) {
            break;
          }
          nextIndex++;
          const para = remaining[currentIndex];
          await adaptParagraphContent(para, profile, currentOptions, currentIndex + firstBatchCount);
          adapted++;
          updateLoadingIndicator(adapted, total);
        }
      }
      
      const workers = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push(runRemainingWorker());
      }
      await Promise.all(workers);
    } else {
      for (const para of targetParagraphs) {
        await adaptParagraphContent(para, profile, currentOptions);
        adapted++;
        updateLoadingIndicator(adapted, total);
      }
    }
    
    currentProfile = profile;
    
    // Hide loading
    hideLoadingIndicator();
    
    // Show success
    showNotification(`✓ Adapted ${adapted} sections for ${profile}`, 'success');
    
  } catch (error) {
    console.error('Error in adaptPage:', error);
    hideLoadingIndicator();
    showNotification('Error adapting page', 'error');
  }
}

// Format adapted text based on profile
function formatAdaptedText(text, profile, tagName) {
  // Convert markdown-style bold to HTML
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  if (tagName && tagName.startsWith('h')) {
    return text.split('\n')[0].replace(/^#+\s*/, '');
  }

  const gradeLevel = currentOptions.gradeLevel || 'upper';
  const isLowerGrade = gradeLevel === 'lower';
  const isMiddleGrade = gradeLevel === 'middle';

  const lines = text.split(/\r?\n/);
  let html = '';
  let inList = false;
  let listClass = 'eduadapt-list';
  let inGlossary = false;
  let skippingMeta = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
      listClass = 'eduadapt-list';
    }
  };

  const closeGlossary = () => {
    if (inGlossary) {
      inGlossary = false;
    }
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      if (inGlossary) {
        return;
      }
      if (skippingMeta) {
        skippingMeta = false;
      }
      closeList();
      return;
    }

    if (/^grade guidance/i.test(line)) {
      skippingMeta = true;
      return;
    }
    if (skippingMeta && (/^this adaptation/i.test(line) || /^audience:/i.test(line) || /^language:/i.test(line))) {
      return;
    }
    if (skippingMeta) {
      return;
    }

    const headingMatch = line.match(/^(#{2,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      closeGlossary();
      const level = Math.min(headingMatch[1].length, 6);
      const content = headingMatch[2].trim();
      html += `<h${level}>${content}</h${level}>`;
      return;
    }

    if (/^glossary[:]?$/i.test(line)) {
      closeList();
      closeGlossary();
      html += `<p><strong>Glossary</strong></p>`;
      inGlossary = true;
      return;
    }

    if (inGlossary) {
      const glossaryMatch = line.match(/^-?\s*([^:-]+?)\s*[-:]\s*(.+)$/);
      if (glossaryMatch) {
        const term = cleanGlossaryText(glossaryMatch[1]);
        const definition = cleanGlossaryText(glossaryMatch[2]);
        html += `<p>${term} - ${definition}</p>`;
        return;
      }
      closeGlossary();
      // Fall through to process line normally
    }

    const questionMatch = line.match(/^question:\s*(.*)$/i);
    if (questionMatch) {
      if (!isLowerGrade) {
        closeList();
        const content = questionMatch[1] || '';
        const extraClass = isMiddleGrade ? ' eduadapt-question-advanced' : '';
        html += `<p class="eduadapt-question${extraClass}">Question: ${content}</p>`;
      }
      return;
    }

    if (/^[•*-]\s+/.test(line)) {
      if (!inList) {
        if (profile === 'adhd') {
          listClass = 'eduadapt-checklist';
        } else {
          listClass = 'eduadapt-list';
        }
        html += `<ul class="${listClass}">`;
        inList = true;
      }
      const bulletText = line.replace(/^[•*-]\s+/, '').trim();
      if (profile === 'adhd') {
        html += `
          <li class="eduadapt-checklist-item">
            <label>
              <input type="checkbox" class="eduadapt-checklist-checkbox">
              <span>${bulletText}</span>
            </label>
          </li>
        `;
      } else {
        html += `<li>${bulletText}</li>`;
      }
      return;
    }

    closeList();
    html += `<p>${line}</p>`;
  });

  closeList();
  closeGlossary();

  if (!html) {
    html = `<p>${escapeHtml(text)}</p>`;
  }

  return html;
}

function setupSupportSection(para, profile, options, index = 0) {
  const { element, originalText, tagName } = para;

  if (!element || element.dataset.eduadaptSupport === 'true') {
    return;
  }

  element.dataset.eduadaptSupport = 'true';

  // Only attach to paragraphs, divs, and list items for now
  const supportedTags = ['p', 'div', 'li'];
  if (!supportedTags.includes(tagName)) {
    return;
  }

  const tools = document.createElement('div');
  tools.className = 'eduadapt-support-tools';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'eduadapt-support-button';
  button.textContent = 'Show supported reading';

  const status = document.createElement('div');
  status.className = 'eduadapt-support-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const support = document.createElement('div');
  support.className = 'eduadapt-support-content';

  tools.appendChild(button);
  tools.appendChild(status);
  tools.appendChild(support);

  if (tagName !== 'li' && !element.parentElement) {
    return;
  }

  if (tagName === 'li') {
    element.appendChild(tools);
  } else {
    element.insertAdjacentElement('afterend', tools);
  }

  const effectiveOptions = { ...DEFAULT_OPTIONS, ...options };
  const job = {
    text: originalText,
    profile,
    options: effectiveOptions,
    support,
    status,
    button,
    tagName,
    state: 'idle',
    version: dyslexiaPrefetchState.version
  };
  support.__eduadaptJob = job;
  support.dataset.loaded = support.dataset.loaded || 'false';
  support.dataset.prefetching = 'false';
  if (originalText.length > DYSLEXIA_PREFETCH_CHAR_LIMIT) {
    status.textContent = 'Large section – open to simplify';
  }

  button.addEventListener('click', async () => {
    if (support.dataset.loaded === 'true') {
      const isVisible = support.classList.toggle('eduadapt-visible');
      button.textContent = isVisible ? 'Hide supported reading' : 'Show supported reading';
      if (!isVisible) {
        status.textContent = 'Ready to view';
      }
      return;
    }

    startDyslexiaJob(job, { fromUser: true });
  });

  if (index < dyslexiaPrefetchState.maxPrefetchItems && originalText.length <= DYSLEXIA_PREFETCH_CHAR_LIMIT) {
    enqueueDyslexiaJob(job);
  } else if (originalText.length > DYSLEXIA_PREFETCH_CHAR_LIMIT) {
    status.textContent = 'Large section – open to simplify';
  }
}

// Apply CSS styling for profile
function applyCSSForProfile(profile) {
  // Remove existing style
  const existing = document.getElementById('eduadapt-styles');
  if (existing) {
    existing.remove();
  }
  
  const styles = {
    dyslexia: `
      .eduadapt-adapted {
        font-family: Arial, Verdana, 'Helvetica Neue', sans-serif !important;
        font-size: 17px !important;
        letter-spacing: 0.20em !important;
        line-height: 2.0 !important;
        word-spacing: 0.18em !important;
        text-align: left !important;
        hyphens: none !important;
        -webkit-hyphens: none !important;
      }
      body.eduadapt-active {
        background: #faf8f3 !important;
        color: #333 !important;
      }
      .eduadapt-adapted p {
        max-width: 65ch !important;
        margin-bottom: 2.0em !important;
        orphans: 3;
        widows: 3;
      }
      .eduadapt-adapted h1,
      .eduadapt-adapted h2,
      .eduadapt-adapted h3 {
        margin-top: 2.0em !important;
        margin-bottom: 1.0em !important;
        line-height: 1.4 !important;
      }
      .eduadapt-adapted ul,
      .eduadapt-adapted ol {
        margin: 1.5em 0 !important;
        padding-left: 2.5em !important;
      }
      .eduadapt-adapted li {
        margin-bottom: 0.75em !important;
      }
      .eduadapt-adapted .eduadapt-support-tools {
        margin: 0.75em 0 2em !important;
        padding: 0.75em 1em !important;
        background: rgba(250, 248, 243, 0.85) !important;
        border-left: 4px solid #d8cbb3 !important;
        border-radius: 6px !important;
      }
      .eduadapt-adapted .eduadapt-support-button {
        background: #4a67c0 !important;
        color: #fff !important;
        border: none !important;
        padding: 0.45em 1em !important;
        border-radius: 4px !important;
        font-size: 0.95em !important;
        cursor: pointer !important;
      }
      .eduadapt-adapted .eduadapt-support-button[disabled] {
        opacity: 0.6 !important;
        cursor: default !important;
      }
      .eduadapt-adapted .eduadapt-support-status {
        margin-top: 0.5em !important;
        font-size: 0.9em !important;
        color: #555 !important;
      }
      .eduadapt-adapted .eduadapt-support-content {
        display: none !important;
        margin-top: 1em !important;
      }
      .eduadapt-adapted .eduadapt-support-content.eduadapt-visible {
        display: block !important;
      }
      .eduadapt-adapted .eduadapt-question {
        margin-top: 0.6em !important;
        font-weight: 600 !important;
        color: #2d3a4a !important;
      }
    `,
    
    adhd: `
      .eduadapt-adapted {
        font-size: 16px !important;
      }
      body.eduadapt-active {
        background: #f5f5f5 !important;
      }
      .eduadapt-adapted h1, 
      .eduadapt-adapted h2, 
      .eduadapt-adapted h3 {
        background: #ffeb3b;
        padding: 0.5em;
        border-left: 4px solid #fbc02d;
        margin: 1em 0;
      }
      .eduadapt-adapted strong {
        background: #fff9c4;
        padding: 2px 4px;
        font-weight: 700;
      }
      .eduadapt-adapted p {
        max-width: 60ch;
        margin-bottom: 1em;
      }
      .eduadapt-adapted .eduadapt-adhd-summary {
        margin: 1em 0 2em;
        padding: 1.2em 1.4em;
        background: linear-gradient(135deg, #fff9c4 0%, #fff3a0 100%);
        border-left: 5px solid #f59e0b;
        border-radius: 8px;
        box-shadow: 0 8px 18px rgba(247, 181, 0, 0.18);
        position: relative;
        overflow: hidden;
      }
      .eduadapt-adapted .eduadapt-adhd-summary::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(140deg, rgba(255, 255, 255, 0.35), rgba(255, 243, 160, 0));
        pointer-events: none;
      }
      .eduadapt-adapted .eduadapt-adhd-section {
        margin: 0 0 1.5em;
        padding: 0.85em 1em;
        background: #fdfae7;
        border-radius: 8px;
        border-left: 4px solid #fbc02d;
      }
      .eduadapt-adapted .eduadapt-summary-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8em;
        font-weight: 700;
        margin-bottom: 0.75em;
        color: #1f2933;
        text-transform: uppercase;
        letter-spacing: 0.02em;
      }
      .eduadapt-adapted .eduadapt-summary-body {
        font-size: 0.95em;
        color: #444;
      }
      .eduadapt-adapted .eduadapt-summary-heading-label {
        display: inline-flex;
        align-items: center;
        gap: 0.6em;
        font-size: 0.95rem;
      }
      .eduadapt-adapted .eduadapt-heading-pulse {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #f97316;
        box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.6);
        animation: eduadapt-pulse 1.6s ease-in-out infinite;
      }
      .eduadapt-adapted .eduadapt-summary-tag {
        display: inline-flex;
        align-items: center;
        padding: 0.25em 0.6em;
        background: #1d4ed8;
        color: #ffffff;
        border-radius: 999px;
        font-size: 0.75rem;
        letter-spacing: 0.04em;
      }
      .eduadapt-adapted .eduadapt-summary-meta {
        display: grid;
        gap: 0.8em;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        margin-bottom: 0.9em;
        padding: 0.65em;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 6px;
      }
      .eduadapt-adapted .eduadapt-meta-block {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
      }
      .eduadapt-adapted .eduadapt-meta-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .eduadapt-adapted .eduadapt-meta-value {
        font-size: 0.95rem;
        font-weight: 600;
        color: #1f2933;
      }
      .eduadapt-adapted .eduadapt-summary-placeholder {
        margin: 0 0 0.5em 0;
        padding-left: 0;
        color: #1f2933;
        list-style: none;
      }
      .eduadapt-adapted .eduadapt-summary-placeholder li {
        display: flex;
        flex-direction: column;
        gap: 0.15em;
        padding: 0.65em 0.7em;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.78);
        margin-bottom: 0.4em;
      }
      .eduadapt-adapted .eduadapt-placeholder-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #f97316;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .eduadapt-adapted .eduadapt-placeholder-text {
        font-size: 0.95rem;
        color: #1f2933;
        line-height: 1.4;
      }
      .eduadapt-adapted .eduadapt-summary-status {
        display: flex;
        flex-direction: column;
        gap: 0.35em;
        margin-top: 0.6em;
        padding-top: 0.65em;
        border-top: 1px dashed rgba(249, 115, 22, 0.45);
      }
      .eduadapt-adapted .eduadapt-loading-track {
        position: relative;
        width: 100%;
        height: 6px;
        background: rgba(249, 115, 22, 0.25);
        border-radius: 999px;
        overflow: hidden;
      }
      .eduadapt-adapted .eduadapt-loading-bar {
        position: absolute;
        inset: 0;
        width: 40%;
        background: linear-gradient(90deg, rgba(249, 115, 22, 0.5), rgba(249, 115, 22, 0.95));
        border-radius: 999px;
        animation: eduadapt-loading 1.2s ease-in-out infinite;
      }
      .eduadapt-adapted .eduadapt-status-text {
        font-size: 0.85rem;
        font-weight: 500;
        color: #b45309;
      }
      .eduadapt-adapted .eduadapt-summary-ready .eduadapt-summary-status {
        border-top-color: rgba(22, 101, 52, 0.45);
      }
      .eduadapt-adapted .eduadapt-summary-ready .eduadapt-status-text {
        color: #166534;
      }
      .eduadapt-adapted .eduadapt-summary-ready .eduadapt-loading-bar {
        background: linear-gradient(90deg, rgba(22, 101, 52, 0.4), rgba(21, 128, 61, 0.9));
        animation: none;
        width: 100%;
      }
      .eduadapt-adapted .eduadapt-summary-ready .eduadapt-loading-track {
        background: rgba(21, 128, 61, 0.18);
      }
      .eduadapt-adapted .eduadapt-summary-result {
        display: grid;
        gap: 0.5em;
      }
      .eduadapt-adapted .eduadapt-summary-error {
        border-left-color: #dc2626;
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        box-shadow: 0 10px 22px rgba(220, 38, 38, 0.15);
      }
      .eduadapt-adapted .eduadapt-summary-error .eduadapt-status-text {
        color: #b91c1c;
      }
      .eduadapt-adapted .eduadapt-summary-error .eduadapt-loading-track {
        background: rgba(220, 38, 38, 0.2);
      }
      .eduadapt-adapted .eduadapt-summary-error .eduadapt-loading-bar {
        background: rgba(220, 38, 38, 0.45);
        animation: none;
        width: 100%;
      }
      @keyframes eduadapt-pulse {
        0% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.6);
        }
        70% {
          transform: scale(1.25);
          box-shadow: 0 0 0 8px rgba(249, 115, 22, 0);
        }
        100% {
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
        }
      }
      @keyframes eduadapt-loading {
        0% {
          transform: translateX(-60%);
        }
        50% {
          transform: translateX(20%);
        }
        100% {
          transform: translateX(120%);
        }
      }
      .eduadapt-adapted .eduadapt-adhd-placeholder-title {
        font-weight: 600;
        color: #1f2933;
        margin-bottom: 0.25em;
      }
      .eduadapt-adapted .eduadapt-adhd-placeholder-body {
        font-size: 0.9em;
        color: #4b5563;
      }
      .eduadapt-adapted .eduadapt-adhd-section-error {
        background: #fef2f2;
        border-left-color: #dc2626;
        color: #991b1b;
      }
      .eduadapt-adapted .eduadapt-checklist {
        list-style: none;
        padding-left: 0 !important;
        margin: 0 !important;
      }
      .eduadapt-adapted .eduadapt-checklist-item {
        margin-bottom: 1em;
        padding: 0.75em 0.9em;
        background: #f7f8ff;
        border-radius: 8px;
        border-left: 4px solid #6366f1;
      }
      .eduadapt-adapted .eduadapt-checklist-item label {
        display: flex;
        align-items: flex-start;
        gap: 0.6em;
        font-weight: 600;
        color: #1f2933;
      }
      .eduadapt-adapted .eduadapt-checklist-checkbox {
        margin-top: 0.2em;
      }
    `,
  };
  const gradeAndGlossaryCSS = `
      body.eduadapt-grade-lower .eduadapt-adapted {
        text-transform: uppercase !important;
        letter-spacing: 0.18em !important;
      }
      body.eduadapt-grade-lower .eduadapt-question {
        display: none !important;
      }
      .eduadapt-adapted .eduadapt-question-advanced {
        color: #1f3a8a !important;
        font-weight: 700 !important;
      }
  `;
  
  if (styles[profile]) {
    const styleEl = document.createElement('style');
    styleEl.id = 'eduadapt-styles';
    styleEl.textContent = styles[profile] + gradeAndGlossaryCSS;
    document.head.appendChild(styleEl);
    
    document.body.classList.add('eduadapt-active');
    findMainContent().classList.add('eduadapt-adapted');
  }
}

// Reset page to original
function resetPage() {
  if (originalContent) {
    const mainContent = findMainContent();
    mainContent.innerHTML = originalContent;
    originalContent = null;
  }
  
  // Remove styles
  const styleEl = document.getElementById('eduadapt-styles');
  if (styleEl) {
    styleEl.remove();
  }
  
  document.body.classList.remove('eduadapt-active');
  
  // Remove notification
  const notification = document.getElementById('eduadapt-notification');
  if (notification) {
    notification.remove();
  }
  
  currentProfile = null;
  currentOptions = { ...DEFAULT_OPTIONS };
  resetDyslexiaPrefetch();
  applyGradeStyles(null);
  
  console.log('Page reset to original');
}

// Loading indicator
function showLoadingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'eduadapt-loading';
  indicator.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 20px 30px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, sans-serif;
    ">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="
          width: 30px;
          height: 30px;
          border: 3px solid #667eea;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <div>
          <div style="font-weight: 600; color: #333;">EduAdapt</div>
          <div style="font-size: 12px; color: #666;" id="eduadapt-progress">
            Adapting content...
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
  document.body.appendChild(indicator);
}

function updateLoadingIndicator(current, total) {
  const progress = document.getElementById('eduadapt-progress');
  if (progress) {
    progress.textContent = `Adapted ${current}/${total} sections...`;
  }
}

function hideLoadingIndicator() {
  const indicator = document.getElementById('eduadapt-loading');
  if (indicator) {
    indicator.remove();
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove existing
  const existing = document.getElementById('eduadapt-notification');
  if (existing) {
    existing.remove();
  }
  
  const colors = {
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#667eea'
  };
  
  const notification = document.createElement('div');
  notification.id = 'eduadapt-notification';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease;
    ">
      ${message}
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;
  document.body.appendChild(notification);
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// Check for auto-adapt on page load
chrome.storage.sync.get(['autoAdapt', 'profile', 'dyslexiaLevel', 'adhdSummaryLength', 'gradeLevel'], (data) => {
  if (data.autoAdapt && data.profile && data.profile !== 'none') {
    console.log('Auto-adapting page for:', data.profile);
    setTimeout(() => {
      const options = {
        dyslexiaLevel: data.dyslexiaLevel || DEFAULT_OPTIONS.dyslexiaLevel,
        adhdSummaryLength: data.adhdSummaryLength || DEFAULT_OPTIONS.adhdSummaryLength,
        gradeLevel: data.gradeLevel || DEFAULT_OPTIONS.gradeLevel
      };
      adaptPage(data.profile, options);
    }, 1000);
  }
});
