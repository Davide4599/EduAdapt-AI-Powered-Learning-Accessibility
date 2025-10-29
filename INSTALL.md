# 📦 Installation Guide - EduAdapt

Complete step-by-step guide to install and use EduAdapt.

---

## ⚠️ Prerequisites

### 1. Chrome Version

You need **Chrome 138+** (any channel):
- ✅ Chrome Stable 138+
- ✅ Chrome Dev
- ✅ Chrome Canary

**Check your version:**
```
chrome://settings/help
```

**Download if needed:**
- [Chrome Stable](https://www.google.com/chrome/)
- [Chrome Dev](https://www.google.com/chrome/dev/)
- [Chrome Canary](https://www.google.com/chrome/canary/)

### 2. System Requirements

- **OS**: Windows 10/11, macOS 13+, or Linux
- **RAM**: 4 GB minimum (16 GB recommended)
- **Storage**: 22 GB free space (for Gemini Nano model)
- **GPU**: 4+ GB VRAM recommended (CPU also works)

---

## 🤖 STEP 1: Enable Chrome Built-in AI

### A. Enable Prompt API Flag

1. Open Chrome
2. Go to: `chrome://flags/#prompt-api-for-gemini-nano`
3. Select: **Enabled**
4. **Don't restart yet!**

### B. Enable Optimization Guide Flag

1. Go to: `chrome://flags/#optimization-guide-on-device-model`
2. Select: **Enabled BypassPerfRequirement**
3. **Now click "Relaunch"** button

### C. Download Gemini Nano Model

1. After restart, go to: `chrome://components/`
2. Find: **"Optimization Guide On Device Model"**
3. Click: **"Check for update"**
4. Wait for download (~1.5 GB, takes 5-15 minutes)
5. Version should change from "0.0.0.0" to something like "2025.XX.XX.XXXX"

### D. Verify AI is Ready

1. Open DevTools: Press **F12**
2. Go to **Console** tab
3. Type and run:
   ```javascript
   await LanguageModel.availability()
   ```
4. Should return: **"readily"** ✅

If it returns something else:
- `"no"` - Flags not enabled correctly
- `"after-download"` - Model still downloading
- Error - Check flags again

---

## 📥 STEP 2: Install EduAdapt Extension

### Option A: From Source (Recommended for Hackathon)

1. **Download the code:**
   ```bash
   git clone https://github.com/your-username/eduadapt.git
   cd eduadapt
   ```
   
   Or download ZIP and extract it.

2. **Create Icons** (temporary step):
   - Open `assets/icons/icon-generator.html` in Chrome
   - Download the 3 generated PNG files
   - Save them in `assets/icons/` folder

3. **Load in Chrome:**
   - Open Chrome
   - Go to: `chrome://extensions/`
   - Enable: **"Developer mode"** (toggle in top-right)
   - Click: **"Load unpacked"**
   - Select the `eduadapt` folder
   - Extension should appear! 🎉

### Option B: From Chrome Web Store

*(Coming soon after hackathon)*

---

## ✅ STEP 3: Verify Installation

1. **Check extension icon:**
   - You should see EduAdapt icon in Chrome toolbar
   - If not visible, click puzzle icon → Pin EduAdapt

2. **Test the extension:**
   - Click the EduAdapt icon
   - You should see:
     - "✓ AI Ready (Gemini Nano)" in green
     - Profile selection cards
     - "Adapt Current Page" button (enabled)

3. **Try it out:**
   - Open any article/blog (e.g., Wikipedia)
   - Click EduAdapt icon
   - Select "Dyslexia" profile
   - Click "Adapt Current Page"
   - Wait 5-10 seconds
   - Page should be adapted! ✨

---

## 🐛 Troubleshooting

### Problem: "AI Not Available" (Red X)

**Solution:**
1. Check flags are enabled:
   - `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
   - `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement

2. Check model downloaded:
   - Go to `chrome://components/`
   - Find "Optimization Guide On Device Model"
   - Version should NOT be "0.0.0.0"

3. Check in Console:
   ```javascript
   typeof LanguageModel
   // Should return: "function"
   
   await LanguageModel.availability()
   // Should return: "readily"
   ```

4. If still not working:
   - Disable both flags
   - Restart Chrome
   - Enable both flags again
   - Restart Chrome again
   - Try creating session in Console:
     ```javascript
     const session = await LanguageModel.create({ language: "en" });
     ```

### Problem: Extension not loading

**Solution:**
1. Check `manifest.json` exists
2. Check all files are present
3. Look for errors in `chrome://extensions/` 
4. Click "Errors" button if present
5. Check browser console (F12)

### Problem: Page not adapting

**Solution:**
1. Check browser console (F12) for errors
2. Make sure you're on a text-heavy page
3. Try refreshing the page
4. Try a different website (e.g., Wikipedia)
5. Check that AI is available (green checkmark)

### Problem: Model won't download

**Solution:**
1. Check free disk space (need 22+ GB)
2. Check internet connection
3. Wait longer (can take 15-30 min on slow connections)
4. Try: `chrome://on-device-internals` to see model status
5. Restart Chrome and check components again

---

## 📖 Usage Tips

### Best Practices

- **Start with longer articles** (300+ words) for best results
- **Wait for full adaptation** (5-10 seconds for most pages)
- **Use Reset button** to restore original content
- **Enable auto-adapt** for consistent experience

### Recommended Websites to Try

- 📰 News: CNN, BBC, The Guardian
- 📚 Wikipedia articles
- 🎓 Educational: Khan Academy, Coursera articles
- 📖 Medium blogs
- 🔬 Academic articles (non-paywalled)

### What Works Best

✅ **Good for:**
- Long-form articles
- Educational content
- Blog posts
- News articles
- Documentation

❌ **Not ideal for:**
- Social media (Twitter, Facebook)
- Short text snippets
- Heavily formatted pages
- Dynamic content (SPAs)
- Pages with lots of ads

---

## 🔄 Updating the Extension

### From Source

```bash
cd eduadapt
git pull origin main
```

Then go to `chrome://extensions/` and click reload icon on EduAdapt.

---

## 🗑️ Uninstalling

1. Go to: `chrome://extensions/`
2. Find: EduAdapt
3. Click: **"Remove"**
4. Confirm removal

**Note:** This doesn't remove the Gemini Nano model. To remove that:
- It will be automatically cleaned up by Chrome over time
- Or manually clear Chrome data

---

## 💡 Next Steps

- Read the [README.md](README.md) for full documentation
- Check out [CONTRIBUTING.md](CONTRIBUTING.md) to help improve EduAdapt
- Report issues on [GitHub](https://github.com/your-username/eduadapt/issues)

---

**Questions?** Open an issue or discussion on GitHub!

**Happy adapting! 🎓✨**
