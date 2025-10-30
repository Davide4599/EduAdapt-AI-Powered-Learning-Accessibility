# 📁 EduAdapt Project Structure

```
eduadapt/
├── manifest.json                 # Chrome extension configuration
├── README.md                     # Main documentation
├── INSTALL.md                    # Installation guide
├── LICENSE.txt                   # MIT License
├── PROJECT_STRUCTURE.md          # This file
│
├── popup/                        # Extension popup UI
│   ├── popup.html               # Popup interface
│   ├── popup.css                # Popup styling
│   └── popup.js                 # Popup logic & user interactions
│
├── background/                   # Background scripts
│   └── service-worker.js        # AI backend (Gemini Nano integration)
│
├── content/                      # Content scripts (run on web pages)
│   ├── content.js               # Page modification logic
│   └── styles.css               # Injected styles for adapted pages
│
├── utils/                        # Utility functions (future)
│   ├── ai-helpers.js            # AI utility functions (TODO)
│   └── text-processor.js        # Text processing utils (TODO)
│
└── assets/                       # Static assets
    ├── icons/                    # Extension icons
    │   ├── icon16.png           # 16x16 toolbar icon
    │   ├── icon48.png           # 48x48 extension icon
    │   ├── icon128.png          # 128x128 store icon
    │   └── icon-generator.html  # Tool to generate icons
    │
    └── profiles/                 # Learning profile definitions (future)
        ├── dyslexia.json        # Dyslexia profile config (TODO)
        └── adhd.json            # ADHD profile config (TODO)
```

## 🔑 Key Files Explained

### Core Extension Files

**manifest.json**
- Chrome extension configuration
- Defines permissions, content scripts, background scripts
- Specifies icons and extension metadata

### User Interface

**popup/popup.html**
- Main UI when clicking extension icon
- Profile selection cards
- Adapt/Reset buttons
- Status indicator

**popup/popup.css**
- Beautiful gradient design (#667eea → #764ba2)
- Card-based profile selection
- Responsive and accessible

**popup/popup.js**
- Handles user interactions
- Communicates with background script
- Manages state and settings storage

### AI Backend

**background/service-worker.js**
- **Most important file for AI functionality**
- Creates LanguageModel sessions
- Defines profile-specific prompts
- Processes text through Gemini Nano
- Handles message passing between popup and content scripts

**Key functions:**
- `checkAIAvailability()` - Verifies Gemini Nano is ready
- `createSession()` - Creates AI session
- `adaptText()` - Adapts text for specific profile
- `getPromptForProfile()` - Returns profile-specific prompts

### Content Modification

**content/content.js**
- Runs on every web page
- Extracts main content
- Applies CSS styling for profiles
- Replaces text with AI-adapted versions
- Manages page state (original/adapted)

**Key functions:**
- `findMainContent()` - Identifies main article/content
- `extractParagraphs()` - Gets text to adapt
- `adaptPage()` - Main adaptation flow
- `applyCSSForProfile()` - Applies visual styling
- `resetPage()` - Restores original content

**content/styles.css**
- Base styles for adapted content
- Smooth transitions

## 🧠 Data Flow

```
User Action (popup) 
    ↓
popup.js sends message
    ↓
content.js receives message
    ↓
content.js extracts page text
    ↓
content.js → service-worker.js (request AI adaptation)
    ↓
service-worker.js → LanguageModel API (Gemini Nano)
    ↓
Gemini Nano processes with profile prompt
    ↓
service-worker.js ← AI-adapted text
    ↓
content.js receives adapted text
    ↓
content.js modifies page DOM
    ↓
User sees adapted content!
```

## 📊 File Sizes

Approximate sizes:
- `manifest.json`: 1 KB
- `popup/*`: ~10 KB total
- `background/service-worker.js`: 5 KB
- `content/content.js`: 12 KB
- `content/styles.css`: 1 KB
- `README.md`: 15 KB
- **Total extension**: ~45 KB (without icons)

## 🔧 Development Status

### ✅ Completed
- [x] Extension structure
- [x] Popup UI
- [x] AI integration (Gemini Nano)
- [x] Profiles (Dyslexia, ADHD)
- [x] Content modification
- [x] CSS styling per profile
- [x] State management
- [x] Documentation

### 🚧 TODO (Future Enhancements)
- [ ] Icon files (need to generate from icon-generator.html)
- [ ] More robust error handling
- [ ] Settings page
- [ ] Custom profile creator
- [ ] Export adapted content
- [ ] Statistics/analytics
- [ ] Multilingual support (ES, JA)
- [ ] Mobile support

## 🎯 For Hackathon Submission

### Required Files Checklist
- [x] `manifest.json` - ✅
- [x] Extension code (popup, background, content) - ✅
- [x] `README.md` with description - ✅
- [x] `LICENSE.txt` (MIT) - ✅
- [ ] Icons (use icon-generator.html to create) - ⏳
- [x] Documentation - ✅

### Next Steps
1. Generate icons using `assets/icons/icon-generator.html`
2. Test extension in Chrome
3. Create video demo (<3 minutes)
4. Submit to Devpost!

## 📦 Distribution

To package for distribution:
1. Generate icons
2. Zip entire folder
3. Upload to Chrome Web Store or GitHub

---

**Project Status**: Ready for testing & demo! 🚀
