# EduAdapt – Chrome AI Accessibility Companion

**Demo extension that explores how Chrome’s on-device Gemini Nano model can reshape web pages for students with diverse learning needs.**

[![Chrome Built-in AI Challenge 2025](https://img.shields.io/badge/Chrome%20AI-Challenge%202025-blue)](https://googlechromeai2025.devpost.com/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.txt)

> ⚠️ **Important:** EduAdapt is a prototype. The learning strategies have been compiled through AI-assisted research and iterative feedback from a doctoral researcher in special education. They illustrate an approach and are **not** a substitute for professional recommendations, classroom accommodations, or clinical interventions. Any real-world deployment must be co-designed with teachers, caregivers, and neurodivergent learners.

---

## Why EduAdapt?

Most accessibility extensions tweak fonts and colors. EduAdapt goes further by:

- Using **Chrome’s built-in Gemini Nano** to rewrite content locally (no external API calls, no data leaves the device).
- Generating **dynamic, research-inspired teaching supports**: simplified rewrites, checklists, comprehension prompts, literal explanations.
- Allowing teachers to **dial in grade bands** (1–3, 4–6, 7–8) so language difficulty, follow-up questions, and vocabulary supports match age expectations.
- Keeping the original article visible so students and educators can compare source vs. adapted text.

---

## Core Features

| Capability | How it Helps | Notes |
|------------|--------------|-------|
| **Profile-aware rewrites** | Tailors text for Dyslexia, ADHD, or Autism Spectrum learners. | All logic runs in `background/service-worker.js` with Gemini Nano. |
| **Grade bands** (1–3, 4–6, 7–8) | Adjusts tone, question complexity, typography, and glossary use. | Selectable in the popup; stored with `chrome.storage.sync`. |
| **Teacher-oriented UI** | Clean dashboard with embedded profile settings + grade selector. | `popup/popup.html`, `popup/popup.js` |
| **Dynamic support sections** | Dyslexia mode adds expandable panels with simplified paragraphs + comprehension question. | Prefetch queue avoids blocking on huge sections. |
| **Quick overview for focus** | ADHD mode creates an instant “Quick Overview” banner and bullet checklist with checkboxes. | Summary uses the Summarizer API when available, with fast placeholders. |
| **Literal rewrites + page map** | Autism mode outputs literal paragraphs plus a bullet overview of page sections. | First paragraphs appear quickly; remaining sections stream in batches. |
| **Interactive glossary** | Middle/upper grades see hoverable word definitions that come directly from the AI rewrite. | Glossary tooltips trigger on keyboard focus too. |

---

## Learning Profiles Explained (with research rationale)

The extension encodes strategies relayed by a PhD researcher who studies neurodivergent literacy. Each feature exists to demonstrate the approach.

### Dyslexia Support

- **Typography tuned to research:** 0.20em letter spacing, 2.0 line height, sans-serif font stack (Arial/Verdana/Helvetica Neue), warm background (#faf8f3).
- **Simplified companion text:** Every paragraph can expand into a rewritten version with short sentences, concrete vocabulary, and bolded focus terms.
- **Comprehension prompts:** After each simplified paragraph a “Question:” line probes understanding (grades 4–8). Grade 1–3 suppresses questions and converts text to uppercase.
- **Glossary pop-ups:** Grades 1–6 receive a word bank with hover/click definitions. Grade 1–3 keeps lower-case definitions while the paragraph text is uppercase.
- **Prefetch queue with safeguards:** Short sections preload so buttons feel instant; longer articles ( >1200 chars) are deferred until clicked to prevent long waits.

### ADHD Support

- **Quick Overview banner:** A lightweight first-sentence placeholder appears immediately while the Summarizer API processes a richer summary.
- **Checklist workflow:** The main content is converted into checkable tasks, encouraging active reading and self-monitoring.
- **Grade-aware tone:** Lower grades use uppercase action steps; middle schoolers see planning-oriented statements with stronger metacognitive wording.
- **Distraction trims:** Headings retain high contrast, paragraphs are chunked, and only the first screenful of sections loads synchronously.

### Autism Spectrum Support (low functioning)

- **Literal-only language:** Figurative speech is rewritten or explained explicitly; pronouns are resolved to concrete nouns.
- **Structured delivery:** Large pages convert into small batches so readers get content right away, with placeholders indicating what’s loading.
- **Page map:** A bullet list outlines main sections (useful for previewing or recapping).
- **Consistent pace:** Animations and transitions are removed, and typography stays stable to reduce sensory load.

---

## Grade Bands & Tuning Controls

| Grade Band | Popup label | Dyslexia behaviour | ADHD behaviour | Autism behaviour |
|------------|-------------|--------------------|----------------|------------------|
| **1st – 3rd** | “1st – 3rd grade” | Entire adaptation in uppercase, no questions, glossary limited to three core words. | 2–3 uppercase checklist items, very short sentences. | Literal rewrite still lowercase to maximise legibility. |
| **4th – 6th** | “4th – 6th grade” | Comprehension question after each paragraph, glossary with up to four entries. | 3–4 checklist items with brief encouragement. | Literal rewrite + page overview, standard casing. |
| **7th – 8th** | “7th – 8th grade” | More reflective questions (styled differently), glossary optional (max two entries). | Up to 5 checklist items focused on planning, future steps. | Same as above, but sentences can be slightly longer. |

All selections (profile, grade band, dyslexia simplification level, ADHD summary length, auto-adapt toggle) persist across browsing sessions.

---

## Installation & Setup

### Prerequisites

1. **Chrome 138+** (Dev, Canary, or Stable once Gemini Nano GA).  
2. Enable flags:  
   - `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**  
   - `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**  
3. Restart Chrome, visit `chrome://components/`, locate **Optimization Guide On Device Model** and “Check for update”. Wait for the on-device Gemini download (~1.5 GB).  
4. Verify availability in DevTools console:
   ```js
   await LanguageModel.availability(); // "readily" or "available"
   ```

### Load the Extension

```bash
git clone https://github.com/your-account/eduadapt.git
cd eduadapt
```

1. Visit `chrome://extensions/`  
2. Enable **Developer mode**  
3. Click **Load unpacked** → choose the `eduadapt` folder  
4. Pin the EduAdapt icon for quick access

---

## Using EduAdapt

1. Click the toolbar icon.  
2. Choose a grade band (defaults to 4th–6th).  
3. Select Dyslexia / ADHD / Autism (or “No adjustments”).  
4. Tailor profile options (e.g., dyslexia simplification level).  
5. Hit **Apply adaptations**. The content script (`content/content.js`) extracts paragraph blocks, calls the background service worker for AI rewrites, and streams results onto the page.  
6. Use **Restore original page** to revert.

Tip: Enable **Auto-adapt all pages** for continuous support (stored with `chrome.storage.sync`).

---

## Architecture Snapshot

```
popup (UI) ─┬─> content script (page extraction + rendering)
            │
            └─> service worker (background AI orchestration)
                  ├─ Gemini Nano Prompt API (general rewrites)
                  ├─ Summarizer API (ADHD quick overview)
                  └─ Per-profile prompt templates + retry logic
```

- **Prefetch queue** in `content/content.js` handles dyslexia sections (parallel limit + size guard).  
- **Glossary + grade styling** is injected as CSS in `applyCSSForProfile`.  
- **Retry + session caching** lives in the service worker to manage Gemini sessions efficiently.

---

## Roadmap & Next Steps

- Grade-aware controls (1–3, 4–6, 7–8). (done)
- Placeholder-first loading for ADHD/autism to improve perceived speed.  (done)
- Speed up the process to mrpove the user experience for student (to do)
- Integrate Rewriter API for dyslexia once origin trial token is available. (to do)
- Gather qualitative feedback from educators and students. (to do)
- Package for Chrome Web Store with permissions review. (to do)

---

## Acknowledgements

- Guidance on literacy strategies from a doctoral researcher specialising in dyslexia, ADHD, and autism support.  
- Chrome Built-in AI team for shipping on-device Gemini Nano tooling.  
- Community resources from the British Dyslexia Association, CAST UDL, and W3C Accessibility guidelines that informed the baseline typography and spacing choices.

---

## License

MIT © 2025 EduAdapt contributors. See [LICENSE.txt](LICENSE.txt) for details.
