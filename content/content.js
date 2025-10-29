// Content Script - EduAdapt Page Modifier
console.log('EduAdapt content script loaded');

// Store original content
let originalContent = null;
let currentProfile = null;
const MIN_TEXT_LENGTH = 60;
const MIN_WORD_COUNT = 10;
const MIN_ELEMENT_WIDTH = 360;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'adaptPage') {
    adaptPage(request.profile);
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
async function adaptPage(profile) {
  try {
    console.log('Adapting page for profile:', profile);
    
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

    if (profile === 'dyslexia') {
      paragraphs.forEach(para => setupSupportSection(para, profile));
      currentProfile = profile;
      hideLoadingIndicator();
      showNotification('Support added. Expand sections for easier text.', 'success');
      return;
    }

    const targetParagraphs = paragraphs.slice(0, 10);

    if (targetParagraphs.length === 0) {
      hideLoadingIndicator();
      showNotification('No content found to adapt', 'warning');
      return;
    }
    
    // Adapt each paragraph with AI
    let adapted = 0;
    
    for (const para of targetParagraphs) {
      try {
        // Send to background script for AI adaptation
        const response = await chrome.runtime.sendMessage({
          action: 'adaptText',
          text: para.originalText,
          profile: profile
        });
        
        if (response && response.success) {
          // Replace text
          para.element.innerHTML = formatAdaptedText(
            response.adaptedText, 
            profile,
            para.tagName
          );
          adapted++;
        }
        
        // Update progress
        updateLoadingIndicator(adapted, targetParagraphs.length);
        
      } catch (error) {
        console.error('Error adapting paragraph:', error);
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
  
  // Convert bullet points to HTML
  if (text.includes('•') || text.includes('-') || text.includes('* ')) {
    const lines = text.split('\n');
    let html = '';
    let inList = false;
    
    lines.forEach(line => {
      line = line.trim();
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        if (!inList) {
          html += '<ul class="eduadapt-list">';
          inList = true;
        }
        html += `<li>${line.substring(1).trim()}</li>`;
      } else if (line) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p>${line}</p>`;
      }
    });
    
    if (inList) {
      html += '</ul>';
    }
    
    return html;
  }
  
  // For headings, keep simple
  if (tagName.startsWith('h')) {
    return text.split('\n')[0]; // First line only
  }
  
  // Split into paragraphs
  return text.split('\n\n').map(p => `<p>${p}</p>`).join('');
}

function setupSupportSection(para, profile) {
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

  button.addEventListener('click', async () => {
    // Toggle visibility if already loaded
    if (support.dataset.loaded === 'true') {
      const isVisible = support.classList.toggle('eduadapt-visible');
      button.textContent = isVisible ? 'Hide supported reading' : 'Show supported reading';
      return;
    }

    button.disabled = true;
    button.textContent = 'Generating...';
    status.textContent = 'Creating supported reading...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'adaptText',
        text: originalText,
        profile
      });

      if (!response || !response.success) {
        throw new Error(response?.userMessage || 'Adaptation failed');
      }

      support.innerHTML = formatAdaptedText(response.adaptedText, profile, tagName);
      support.dataset.loaded = 'true';
      support.classList.add('eduadapt-visible');

      button.textContent = 'Hide supported reading';
      status.textContent = '';

    } catch (error) {
      console.error('Support section error:', error);
      status.textContent = error.message || 'Could not create supported reading.';
      button.textContent = 'Try again';

    } finally {
      button.disabled = false;
    }
  });
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
    `,
    
    autism: `
      .eduadapt-adapted {
        font-family: Arial, sans-serif !important;
        line-height: 1.8 !important;
      }
      body.eduadapt-active {
        background: #f0f4f8 !important;
        color: #2d3748 !important;
      }
      .eduadapt-adapted *, 
      .eduadapt-adapted *::before, 
      .eduadapt-adapted *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
      .eduadapt-adapted ol, 
      .eduadapt-adapted ul {
        margin: 1em 0;
        padding-left: 2em;
      }
    `
  };
  
  if (styles[profile]) {
    const styleEl = document.createElement('style');
    styleEl.id = 'eduadapt-styles';
    styleEl.textContent = styles[profile];
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
chrome.storage.sync.get(['autoAdapt', 'profile'], (data) => {
  if (data.autoAdapt && data.profile && data.profile !== 'none') {
    console.log('Auto-adapting page for:', data.profile);
    setTimeout(() => {
      adaptPage(data.profile);
    }, 1000);
  }
});
