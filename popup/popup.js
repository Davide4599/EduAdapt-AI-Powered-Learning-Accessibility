// Popup JavaScript - EduAdapt
console.log('EduAdapt popup loaded');

// DOM Elements
const profileCards = document.querySelectorAll('.profile-card');
const adaptBtn = document.getElementById('adaptBtn');
const resetBtn = document.getElementById('resetBtn');
const autoAdaptCheckbox = document.getElementById('autoAdapt');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// State
let selectedProfile = 'none';
let aiAvailable = false;

// Initialize
async function init() {
  // Load saved settings
  const settings = await chrome.storage.sync.get(['profile', 'autoAdapt']);
  selectedProfile = settings.profile || 'none';
  autoAdaptCheckbox.checked = settings.autoAdapt || false;
  
  // Update UI
  updateSelectedProfile(selectedProfile);
  
  // Check AI availability
  checkAIAvailability();
}

// Check if Chrome AI is available
async function checkAIAvailability() {
  try {
    statusText.textContent = 'Checking AI availability...';
    
    // Send message to background script to check AI
    const response = await chrome.runtime.sendMessage({ 
      action: 'checkAI' 
    });
    
    if (response && response.available) {
      aiAvailable = true;
      statusDot.classList.add('ready');
      statusText.textContent = '✓ AI Ready (Gemini Nano)';
      adaptBtn.disabled = false;
    } else {
      aiAvailable = false;
      statusDot.classList.add('error');
      statusText.textContent = '✗ AI Not Available';
      statusText.title = 'Please enable Chrome AI flags';
    }
  } catch (error) {
    console.error('Error checking AI:', error);
    aiAvailable = false;
    statusDot.classList.add('error');
    statusText.textContent = '✗ Error checking AI';
  }
}

// Update selected profile in UI
function updateSelectedProfile(profile) {
  profileCards.forEach(card => {
    if (card.dataset.profile === profile) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });
}

// Profile selection
profileCards.forEach(card => {
  card.addEventListener('click', async () => {
    selectedProfile = card.dataset.profile;
    updateSelectedProfile(selectedProfile);
    
    // Save to storage
    await chrome.storage.sync.set({ profile: selectedProfile });
    
    console.log('Profile selected:', selectedProfile);
  });
});

// Adapt button click
adaptBtn.addEventListener('click', async () => {
  if (!aiAvailable) {
    alert('AI is not available. Please enable Chrome AI flags.');
    return;
  }
  
  if (selectedProfile === 'none') {
    alert('Please select a learning profile first.');
    return;
  }
  
  // Show loading state
  adaptBtn.disabled = true;
  adaptBtn.innerHTML = '<span class="btn-icon">⏳</span> Adapting...';
  
  try {
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Better approach:
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'adaptPage',
      profile: selectedProfile
    });

    if (!result || !result.success) {
      throw new Error('Adaptation failed');
    }
    
    // Success
    adaptBtn.innerHTML = '<span class="btn-icon">✓</span> Adapted!';
    
    setTimeout(() => {
      adaptBtn.innerHTML = '<span class="btn-icon">✨</span> Adapt Current Page';
      adaptBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Error adapting page:', error);
    adaptBtn.innerHTML = '<span class="btn-icon">✗</span> Error';
    adaptBtn.disabled = false;
    alert('Error adapting page. Please refresh and try again.');
  }
});

// Reset button click
resetBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.tabs.sendMessage(tab.id, {
      action: 'resetPage'
    });
    
    console.log('Page reset');
  } catch (error) {
    console.error('Error resetting page:', error);
  }
});

// Auto-adapt toggle
autoAdaptCheckbox.addEventListener('change', async () => {
  await chrome.storage.sync.set({ autoAdapt: autoAdaptCheckbox.checked });
  console.log('Auto-adapt:', autoAdaptCheckbox.checked);
});

// Help link
document.getElementById('helpLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ 
    url: 'https://github.com/your-repo/eduadapt#readme' 
  });
});

// Initialize on load
init();
