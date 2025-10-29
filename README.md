# EduAdapt - AI-Powered Learning Accessibility

**Make the web accessible for students with learning differences using Chrome's built-in AI.**

[![Chrome Built-in AI Challenge 2025](https://img.shields.io/badge/Chrome%20AI-Challenge%202025-blue)](https://googlechromeai2025.devpost.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is EduAdapt?

EduAdapt is a Chrome extension that adapts web content in real-time for students with learning differences such as **dyslexia**, **ADHD**, and **autism spectrum disorder**. 

Unlike existing accessibility tools that only modify fonts and colors, **EduAdapt uses Chrome's built-in AI (Gemini Nano)** to intelligently rewrite and restructure content, making it easier to understand while preserving the original meaning.
**Please note:** This extension is a demonstration project. The learning profile adaptations are based on strategies identified through AI-assisted research of scientific literature and are intended for illustrative purposes only. A production-ready version would require collaboration with education specialists, accessibility experts, and individuals from the neurodivergent community to ensure accuracy and effectiveness.

### ✨ Key Features

- **On-Device AI**: Powered by Gemini Nano (Chrome Built-in AI)
- **100% Private**: All processing happens locally on your device
- **Works Offline**: No internet required after initial setup
- **Completely Free**: No API costs, no subscriptions
- **Fast**: Instant adaptations with local AI
- **Multiple Profiles**: Dyslexia, ADHD, Autism support

---

## 🎯 Learning Profiles

### 👁️ **Dyslexia Mode**

**Visual & Content Adaptations:**
- ✅ Dyslexia-friendly font (Comic Sans / OpenDyslexic)
- ✅ Increased letter spacing & line height
- ✅ Simple vocabulary (replaces complex words)
- ✅ Short sentences (max 10-12 words)
- ✅ Clear paragraph structure
- ✅ Beige background (#faf8f3) with dark gray text

**Example:**
```
Before: "The implementation of photosynthesis involves the 
transformation of light energy into chemical energy through 
a series of complex biochemical reactions."

After: "Plants make food using sunlight.

Here's how:
• Light hits the plant
• Plant changes light into energy  
• Plant uses energy to grow"
```

### 🎯 **ADHD Mode**

**Content & Visual Adaptations:**
- ✅ TL;DR summaries at the top
- ✅ Bold key points (**important** text)
- ✅ Short paragraphs (3-4 sentences max)
- ✅ Bullet points for lists
- ✅ Highlighted headings (yellow background)
- ✅ Removed distractions & simplified layout

**Example:**
```
⚡ QUICK SUMMARY (30 sec):
Climate change is warming Earth. Ice melts, seas rise. 
We must act now.

📊 KEY POINTS:
• **Temperature rising** globally
• **Ice caps melting** faster
• **Action needed** immediately

[Full article continues...]
```

### 🧩 **Autism Spectrum Mode**

**Language & Structure Adaptations:**
- ✅ Literal language (no metaphors/idioms)
- ✅ Explicit explanations of figurative speech
- ✅ Step-by-step numbered instructions
- ✅ Consistent terminology
- ✅ No animations or sudden changes
- ✅ Clear, predictable structure

**Example:**
```
Before: "It's raining cats and dogs! Better grab an umbrella 
or you'll be soaked."

After: "It is raining very heavily.
This means a lot of water is falling from the sky.

What to do:
1. Take an umbrella
2. Wear a raincoat  
3. This will keep you dry

Why? Heavy rain makes you wet if you don't protect yourself."
```

---

## 🚀 Installation

### Prerequisites

**Chrome Version:** 138+ (Dev, Canary, or Stable)

**Enable Chrome AI:**

1. Go to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to: **Enabled**

2. Go to `chrome://flags/#optimization-guide-on-device-model`
   - Set to: **Enabled BypassPerfRequirement**

3. **Restart Chrome**

4. Go to `chrome://components/`
   - Find "Optimization Guide On Device Model"
   - Click "Check for update"
   - Wait for Gemini Nano to download (~1.5 GB, one-time)

5. Verify in Console (F12):
   ```javascript
   await LanguageModel.availability()
   // Should return: "readily"
   ```

### Install Extension

**Option 1: From Chrome Web Store** (Coming Soon)

**Option 2: Load Unpacked (Development)**

1. Download/Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `eduadapt` folder
6. The extension icon should appear in your toolbar!

---

## 📖 How to Use

### Quick Start

1. **Click the EduAdapt icon** in your Chrome toolbar
2. **Select a learning profile** (Dyslexia, ADHD, or Autism)
3. **Click "Adapt Current Page"**
4. Wait 5-10 seconds for AI to process
5. **Page is now adapted!**

### Auto-Adapt Mode

Enable "Auto-adapt all pages" in the popup to automatically adapt every page you visit.

### Reset a Page

Click "Reset Page" to restore original content.

---

## 🛠️ Technical Architecture

```
┌─────────────────────────────────────────────┐
│           Chrome Extension UI                │
│         (popup/popup.html)                   │
└────────────────┬────────────────────────────┘
                 │
                 │ User selects profile
                 ├─────────────────────────────┐
                 │                             │
        ┌────────▼────────┐          ┌────────▼────────┐
        │  Content Script │          │ Service Worker  │
        │  (content.js)   │◄─────────┤  (AI Backend)   │
        └────────┬────────┘          └────────┬────────┘
                 │                             │
                 │ Extract text                │ AI Processing
                 │                             │
                 ├─────────────────────────────┤
                 │                             │
                 │          Gemini Nano        │
                 │       (LanguageModel API)   │
                 │                             │
                 └─────────────┬───────────────┘
                               │
                               │ Adapted text
                               │
                      ┌────────▼────────┐
                      │   Web Page DOM  │
                      │   (Modified)    │
                      └─────────────────┘
```

### Key Components

- **popup/**: User interface (HTML/CSS/JS)
- **background/**: Service worker with AI logic
- **content/**: Page modification scripts
- **utils/**: Helper functions & profiles

### AI Processing Flow

1. User clicks "Adapt Page"
2. Content script extracts text from main content
3. Text sent to service worker
4. Service worker uses LanguageModel.create() with profile-specific prompts
5. Gemini Nano processes text locally
6. Adapted text returned to content script
7. DOM updated with new content + CSS styling

---

## 🎨 Profile Prompts

Each profile uses carefully crafted prompts to guide Gemini Nano:

### Dyslexia Prompt
```javascript
"You are helping a student with dyslexia. Adapt the text:
- Use simple, common words
- Write short sentences (max 10-12 words)
- Break long paragraphs into smaller ones
- Use bullet points for lists
- Keep the same meaning"
```

### ADHD Prompt
```javascript
"You are helping a student with ADHD. Adapt the text:
- Start with a brief summary
- Use clear headings
- Break into small chunks
- Highlight key points
- Keep paragraphs very short (3-4 sentences)"
```

### Autism Prompt
```javascript
"You are helping a student on the autism spectrum:
- Use literal language (no metaphors/idioms)
- Explain figurative expressions literally
- Provide step-by-step instructions
- Avoid ambiguous language
- Be consistent in terminology"
```

---

## 🤝 Contributing

We welcome contributions! This project was created for the **Chrome Built-in AI Challenge 2025**.

### Ideas for Contributions

- [ ] Add more learning profiles (e.g., visual impairment, dysgraphia)
- [ ] Multilingual support (ES, JA)
- [ ] Custom profile creator
- [ ] Browser extension for Firefox/Edge
- [ ] Export adapted content to PDF/DOCX
- [ ] Teacher collaboration features
- [ ] Content templates library

### Development Setup

```bash
git clone https://github.com/your-username/eduadapt.git
cd eduadapt
# Load unpacked in chrome://extensions
```

---

## 🐛 Known Limitations

- **Processing Time**: Complex pages take 5-10 seconds
- **Model Size**: Gemini Nano is small (~1.5 GB), not as powerful as GPT-4
- **Context Limit**: Max ~3000 words per adaptation
- **Languages**: Best results with English (ES, JA supported but limited)
- **Browser**: Chrome 138+ only (Dev/Canary/Stable)
- **Platform**: Desktop only (no mobile support yet)

---

## 📚 Research & Resources

### Learning Differences
- [International Dyslexia Association](https://dyslexiaida.org/)
- [CHADD - ADHD Resources](https://chadd.org/)
- [Autism Society](https://autismsociety.org/)

### Chrome Built-in AI
- [Chrome AI Documentation](https://developer.chrome.com/docs/ai)
- [Gemini Nano Overview](https://deepmind.google/technologies/gemini/nano/)
- [Early Preview Program](https://developer.chrome.com/docs/ai/built-in)

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file.

---

## 👥 Authors

- **Your Name** - *Initial work* - [@yourhandle](https://github.com/yourhandle)

Created for the **Chrome Built-in AI Challenge 2025** 🏆

---

## 🙏 Acknowledgments

- Google Chrome team for Built-in AI APIs
- Gemini Nano for on-device AI
- Educators and students who inspired this project
- Accessibility advocates worldwide

---

## 📞 Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/your-username/eduadapt/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-username/eduadapt/discussions)
- 📧 **Email**: your-email@example.com

---

**Made with ❤️ for accessible education**

*"Education is the most powerful weapon which you can use to change the world." - Nelson Mandela*
