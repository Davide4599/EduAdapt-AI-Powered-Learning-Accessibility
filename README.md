# EduAdapt – Chrome AI Accessibility Companion

**Demo extension that explores how Chrome’s on-device Gemini Nano model can reshape web pages for students with diverse learning needs.**

[![Chrome Built-in AI Challenge 2025](https://img.shields.io/badge/Chrome%20AI-Challenge%202025-blue)](https://googlechromeai2025.devpost.com/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.txt)

> ⚠️ **Important:** EduAdapt is a prototype. The learning strategies have been compiled through AI-assisted research and iterative feedback from a doctoral researcher in special education. They illustrate an approach and are **not** a substitute for professional recommendations, classroom accommodations, or clinical interventions. Any real-world deployment must be co-designed with teachers, caregivers, and neurodivergent learners.

---

## Why EduAdapt?

Most accessibility extensions tweak fonts and colors. EduAdapt goes further by:

- Using **Chrome’s built-in Gemini Nano** to rewrite content locally (no external API calls, no data leaves the device).
- Generating **dynamic, research-inspired teaching supports**: simplified rewrites, checklists, and comprehension prompts.
- Allowing teachers to **dial in grade bands** (1–3, 4–6, 7–8) so language difficulty, follow-up questions, and vocabulary supports match age expectations.
- Keeping the original article visible so students and educators can compare source vs. adapted text.

---

## Core Features

| Capability | How it Helps | Notes |
|------------|--------------|-------|
| **Profile-aware rewrites** | Tailors text for Dyslexia or ADHD learners. | All logic runs in `background/service-worker.js` with Gemini Nano. |
| **Grade bands** (1–3, 4–6, 7–8) | Adjusts tone, question complexity, typography, and glossary use. | Selectable in the popup; stored with `chrome.storage.sync`. |
| **Teacher-oriented UI** | Clean dashboard with embedded profile settings + grade selector. | `popup/popup.html`, `popup/popup.js` |
| **Dynamic support sections** | Dyslexia mode adds expandable panels with simplified paragraphs + comprehension question. | Prefetch queue avoids blocking on huge sections. |
| **Quick overview for focus** | ADHD mode creates an instant “Quick Overview” banner and bullet checklist with checkboxes. | Summary uses the Summarizer API when available, with fast placeholders. |
| **Interactive glossary** | Middle/upper grades see hoverable word definitions that come directly from the AI rewrite. | Glossary tooltips trigger on keyboard focus too. |

---

## Learning Profiles Explained (with research rationale)

The extension encodes strategies relayed by a PhD researcher who studies neurodivergent literacy. Each feature exists to demonstrate the approach.

### Dyslexia Support

**Disclaimer:** I am not a specialist in learning disabilities or neurodevelopmental disorders. For any real-world application, collaboration with domain experts—educators, psychologists, and accessibility researchers—is essential. The features described here are informed by scientific papers and guidance from colleagues who have studied educational psychology and special needs pedagogy. Their insights shaped the following approach:

**Design philosophy:** Many dyslexic readers benefit primarily from typographic adjustments and do not require simplified text by default. Forcing simplified content immediately can be counterproductive. Instead, the interface respects the reader's autonomy by offering optional expansions on a per-paragraph basis.

- **Typography tuned to research:** 0.20em letter spacing, 2.0 line height, sans-serif font stack (Arial/Verdana/Helvetica Neue), warm background (#faf8f3).
- **Optional simplified companion text:** Every paragraph includes an expand button that reveals a rewritten version with short sentences, concrete vocabulary, and bolded focus terms. The original text remains visible and accessible at all times.
- **Comprehension prompts:** After each simplified paragraph, a "Question:" line probes understanding (grades 4–8). Grades 1–3 suppress questions and convert text to uppercase for improved readability.
- **Glossary pop-ups:** Grades 1–6 receive a word bank with hover/click definitions. Grades 1–3 keep lower-case definitions while the paragraph text is uppercase.
- **No preloading for simplified text:** Since users begin by reading the typographically enhanced original, simplified versions are generated only when requested. This avoids unnecessary API calls and latency, as the disorder profile benefits most from immediate access to the styled original content.

### ADHD Support

**Disclaimer:** I am not a specialist in attention-deficit disorders or cognitive-behavioral interventions. For production use, consultation with ADHD specialists, occupational therapists, and UX accessibility experts is strongly recommended. The strategies implemented here draw from academic literature and advice from peers with backgrounds in special education. Their recommendations informed the following structure:

**Design philosophy:** Learners with ADHD benefit from immediate feedback, progressive disclosure, and task-oriented interaction patterns that sustain attention and reduce cognitive overwhelm. The interface prioritizes quick wins, transparent progress tracking, and flexible depth control.

- **Estimated reading time:** Each article displays an approximate reading duration at the top, helping users assess commitment and plan their engagement.
- **Quick Overview banner:** A lightweight first-sentence summary appears immediately upon page load, providing instant context and reducing initial wait-related frustration. This placeholder is replaced seamlessly once the API-generated structured summary is ready.
- **Structured summary with topic preview:** The full summary breaks the content into digestible topics or key points, allowing users to grasp the article's scope before diving into the full text. Users can choose to engage only with this high-level view or proceed to detailed sections.
- **Checklist workflow:** Each paragraph or section is converted into an interactive task item with a checkbox. Users can mark sections as "completed," providing a sense of accomplishment and supporting self-monitoring and executive function.
- **Grade-aware tone:** Lower grade levels (1–3) use uppercase text and simple action-oriented language (e.g., "READ THIS PART"). Middle school levels (4–8) employ metacognitive prompts and planning-oriented statements (e.g., "Review this section and check it off when done") to encourage reflection and strategy use.
- **Progressive paragraph restructuring:** While the summary loads first, individual paragraphs are simultaneously reprocessed in the background using the same simplification methodology. Users can expand any paragraph for a more detailed, ADHD-friendly rewrite, ensuring flexible depth without upfront delay.
- **Distraction reduction:** Headings maintain high contrast for wayfinding, paragraphs are visually chunked, and only the first visible section loads synchronously. Subsequent content appears on demand to prevent information overload and scrolling fatigue.
- **Frequently Asked Questions (FAQ) section:** Common questions about the content are surfaced early, giving users quick access to anticipated queries and reducing the need to search through dense text.

## Grade Bands & Tuning Controls

| Grade Band | Dyslexia behaviour | ADHD behaviour |
|------------|--------------------|----------------|
| **1st – 3rd** | Entire adaptation in uppercase, no questions, glossary limited to three core words. | 2–3 uppercase checklist items, very short sentences. |
| **4th – 6th** | Comprehension question after each paragraph, glossary with up to four entries. | 3–4 checklist items with brief encouragement. |
| **7th – 8th** | More reflective questions (styled differently), glossary optional (max two entries). | Up to 5 checklist items focused on planning, future steps. |

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
git clone https://github.com/Davide4599/EduAdapt-AI-Powered-Learning-Accessibility.git
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
3. Select Dyslexia / ADHD (or “No adjustments”).  
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

### Completed Features
- **Grade-aware controls (1–3, 4–6, 7–8):** Adaptive content delivery and tone based on developmental stage.
- **Placeholder-first loading for ADHD profile:** Immediate visual feedback with progressive enhancement to reduce perceived latency and maintain engagement.

### In Progress
- **Performance optimization:** Reduce API response times and streamline content processing pipelines to enhance user experience, particularly for learners with attention or processing challenges.
- **Rewriter API integration for dyslexia support:** Awaiting origin trial token to leverage browser-native text simplification capabilities for improved speed and reliability.

### Planned Development
- **Personalized user profiles:** Enable educators to create, manage, and refine individualized accommodation settings for each student. Profiles will support granular feature control (typography, simplification thresholds, sensory adjustments, interaction modes), persist across sessions, and evolve as learners progress or preferences shift. This feature addresses the heterogeneity of neurodevelopmental profiles and aligns with IEP-driven support models.
- **Qualitative user research:** Conduct structured feedback sessions with educators, special education specialists, and students to validate design decisions, identify gaps, and iteratively improve accessibility features.




---

## Acknowledgements

- Guidance on literacy strategies from a doctoral researcher specialising in dyslexia and ADHD support.  
- Chrome Built-in AI team for shipping on-device Gemini Nano tooling.  
- Community resources from the British Dyslexia Association, CAST UDL, and W3C Accessibility guidelines that informed the baseline typography and spacing choices.
- My mother, who inspired the idea for this project with her stories about her work and who gave me practical advice.
- All my friends who specialized in university courses in this field, who proved to be an important source of information.

---

## License

MIT © 2025 EduAdapt contributors. See [LICENSE.txt](LICENSE.txt) for details.
