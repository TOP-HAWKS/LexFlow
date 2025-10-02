# 📘 LexFlow — Chrome Extension for Legal Text Review & Drafting with Built-in AI

## 🌍 Overview

LexFlow is a **Chrome Extension** that enables lawyers and legal professionals worldwide to **review, summarize, and draft legal text** directly in their browser using **Chrome built-in AI (Gemini Nano, Prompt API, Summarizer API)**.

It connects to a **public repository of statutes in Markdown** (federal, state, municipal laws, codes, constitutions).
Users can select their **jurisdiction and language** (e.g., *Porto Alegre, RS, Brazil*) and instantly access the relevant laws (Constitution, Civil Code, Municipal Organic Law, etc.).

Lawyers then **select articles/sections**, define a **prompt preset or custom instructions**, and get AI-assisted summaries, reviews, or draft clauses — always grounded in the provided legal text.

---

## ✨ Key Features

* **Jurisdiction selector** → country, state, city.
* **Public Markdown repository** of laws, organized by jurisdiction.
* **Search & TOC navigation** to find and select relevant legal articles.
* **Context panel**: compile selected excerpts into an analysis set.
* **Prompt presets**:

  1. Summarize in 3 paragraphs
  2. Clarity & readability review
  3. Risk & inconsistency checklist
  4. Draft rental contract clauses (with parameters: parties, dates, values)
* **Custom prompts**: extend or override instructions.
* **On-device AI execution**: Chrome built-in AI (Gemini Nano) for private, fast processing.
* **Local history**: last analyses saved with IndexedDB.
* **Export results** as Markdown or text.

---

## 🧑💻 Tech Stack

* **Chrome Extensions (Manifest V3)**
* **Chrome built-in AI APIs** (Prompt API, Summarizer API)
* **IndexedDB** for local persistence (history & settings)
* **Static Markdown files** for legal corpus (hosted on GitHub or any public raw URL)
* **UI**: HTML, CSS, Vanilla JS (lightweight and hackathon-friendly)

---

## ⚙️ Development Setup

1. Install **[Chrome Canary](https://www.google.com/chrome/canary/)** (latest build).
2. Enable experimental flags for built-in AI APIs:

   * Go to `chrome://flags` and search for **Prompt API**, **Summarization**, **Built-in AI**.
   * Enable and restart Canary.
3. Clone this repository:

   ```bash
   git clone https://github.com/YOUR_ORG/lexflow-chrome-ai.git
   cd lexflow-chrome-ai
   ```
4. Open `chrome://extensions` → enable **Developer Mode** → **Load unpacked** → select the `lexflow/` folder.
5. In the extension popup:

   * Select jurisdiction and base URL for corpus.
   * Pick documents (Constitution, Civil Code, etc.).
   * Search & select relevant articles.
   * Define prompt (preset or custom).
   * Run **on-device AI** and get results.

---

## 📂 Legal Corpus Repository Structure

```
legal-corpus/
├─ country/
│  └─ br/
│     ├─ federal/
│     │  ├─ constituicao-federal-1988.md
│     │  ├─ codigo-civil-2002.md
│     │  └─ lei-inquilinato-8245-1991.md
│     └─ state/
│        └─ rs/
│           └─ city/
│              └─ porto-alegre/
│                 └─ lei-organica-porto-alegre.md
```

* Each file includes **YAML front-matter** (title, jurisdiction, source URL, version, language, license).
* Articles/sections are marked with `## Art. X` headings for TOC navigation.

---

## 📅 Roadmap (Hackathon — 30 days)

* **Week 1:** Scaffold repo + extension, jurisdiction UI, IndexedDB stub
* **Week 2:** AI integration (Prompt API / Summarizer API), basic summarization working
* **Week 3:** Add prompt presets, context selection, local history, draft clause generator
* **Week 4:** Final UX polish, error handling, export functions, prepare demo video

---

## 👥 Team Workflow

* **Small agile team (4 members)**
* Weekly sprints aligned with hackathon milestones
* Daily 15-minute sync + async GitHub PR reviews
* Issues tracked via GitHub Projects (Backlog → In Progress → Done)

---

## 🔒 Privacy & Data

* All AI processing is performed **on-device** using Chrome built-in AI.
* No external servers. No data leaves the user’s machine.
* Corpus Markdown files are **public laws** (domain-specific, public domain).
* History stored locally in IndexedDB (can be cleared anytime).
* Disclaimer: AI output is **supportive only**; final legal review is always required.

---

## 🎥 Demo (coming soon)

* Paste text or select legal articles → choose preset → AI summarization/review → output with citations.
* Export results to Markdown.
* Walkthrough video ≤ 3 minutes.

---

## 📜 License

MIT License — free to use and adapt.
Contributions welcome via Pull Requests and Issues.

---

💡 **Vision**:
LexFlow empowers lawyers everywhere to work **faster, safer, and with more clarity**, by bringing **law + AI directly into Chrome**.