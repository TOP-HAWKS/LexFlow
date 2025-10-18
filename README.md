# ⚖️ LexFlow — Legal AI Assistant with Chrome Built-in AI

## 🌍 Overview

LexFlow is a **web application** that enables lawyers and legal professionals worldwide to **analyze, summarize, and draft legal texts** directly in their browser using **Chrome built-in AI (Gemini Nano, Prompt API, Summarizer API)**.

The application connects to a **public repository of laws in Markdown** (federal, state, municipal laws, codes, constitutions).
Users can select their **jurisdiction and language** (e.g., *Porto Alegre, RS, Brazil*) and instantly access relevant laws (Constitution, Civil Code, Municipal Organic Law, etc.).

Lawyers then **select articles/sections**, define **prompt presets or custom instructions**, and get AI-assisted summaries, analyses, or draft clauses — always grounded in the provided legal text.

---

## ✨ Key Features

* **Jurisdiction selector** → country, state, city
* **Public repository** of laws in Markdown, organized by jurisdiction
* **Search & navigation** to find and select relevant legal articles
* **Context panel**: compile selected excerpts into an analysis set
* **Prompt presets**:
  1. Executive summary
  2. Detailed legal analysis
  3. Legal comparison
  4. Contract clause generation
* **Custom prompts**: extend or override instructions
* **On-device AI execution**: Chrome built-in AI (Gemini Nano) for private, fast processing
* **Local history**: recent analyses saved with localStorage
* **Content curation**: capture and organize legal content from the web via context menu
* **Chrome extension integration**: toolbar icon and right-click context menus for seamless content capture

---

## 🧑💻 Tech Stack

* **Modern Web Application** (HTML5, CSS3, JavaScript ES6+)
* **Chrome built-in AI APIs** (Prompt API, Summarizer API)
* **LocalStorage** for local persistence (history & settings)
* **Static Markdown files** for legal corpus (hosted on GitHub or any public URL)
* **UI**: HTML, CSS, Vanilla JS (lightweight and hackathon-friendly)

---

## ⚙️ Development Setup

### **Chrome Extension Installation**

1. Install **[Chrome Canary](https://www.google.com/chrome/canary/)** (latest build).
2. Enable experimental flags for built-in AI APIs:
   * Go to `chrome://flags` and search for **Prompt API**, **Summarization**, **Built-in AI**
   * Enable and restart Canary
3. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_ORG/lexflow-web-app.git
   cd lexflow-web-app
   ```
4. Load the extension:
   * Open `chrome://extensions`
   * Enable **Developer Mode**
   * Click **Load unpacked** and select the project folder
5. Use the extension:
   * **Click the LexFlow icon** in the Chrome toolbar → **Opens in new tab**
   * **Right-click on any webpage** to capture content via context menu
   * Captured content appears in the Collector & Curation section

### **Fixed Issues**
- ✅ **JavaScript Syntax Error**: Fixed template literal syntax in `app.js`
- ✅ **CSP Compliance**: Removed all inline event handlers
- ✅ **New Tab Opening**: Extension icon opens app in new tab instead of popup
- ✅ **Message Port Errors**: Fixed async communication between components
- ✅ **Event Listeners**: All interactions use proper event delegation
- ✅ **HTML Escaping**: Proper escaping of special characters in dynamic content

### **Standalone Web App (Optional)**

You can also run LexFlow as a standalone web application:
```bash
npm run dev
# Open http://localhost:8080 in Chrome Canary
```

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
│        └─ RS/
│           └─ city/
│              └─ porto-alegre/
│                 └─ lei-organica-porto-alegre.md
```

* Each file includes **YAML front-matter** (title, jurisdiction, source URL, version, language, license)
* Articles/sections are marked with `## Art. X` headings for TOC navigation

---

## � How mto Use

1. **Access the application** in your Chrome Canary
2. **Configure your jurisdiction** (country, state, city)
3. **Select legal documents** relevant to your case
4. **Choose specific articles** for analysis
5. **Define your prompt** (use presets or create custom)
6. **Execute AI** and get grounded analyses
7. **Copy results** or save to history

---

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run serve        # Start local server
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm start            # Start application
```

---

## 🔒 Privacy & Data

* All AI processing is performed **on-device** using Chrome built-in AI
* **No external servers**. No data leaves the user's machine
* Corpus Markdown files are **public laws** (public domain)
* History stored locally in browser (can be cleared anytime)
* **Disclaimer**: AI output is **supportive only**; final legal review always required

---

## 🎯 Use Cases

* **Fast doctrinal research** with grounded analysis
* **Comparative analysis** of legal norms
* **Contract clause generation** based on legislation
* **Executive summaries** for client presentations
* **Legal content curation** for knowledge bases

---

## 🤖 Chrome AI Integration

### Required Setup:
1. **Chrome Canary** with experimental flags enabled
2. **Flags to enable:**
   - `chrome://flags/#prompt-api-for-gemini-nano`
   - `chrome://flags/#summarization-api-for-gemini-nano`
   - `chrome://flags/#built-in-ai-api`

### APIs Used:
- **Prompt API**: For custom legal analysis and text generation
- **Summarizer API**: For automatic text summarization
- **Local Processing**: All AI runs on-device for privacy

---

## 🤝 Contributing

Contributions are welcome via Pull Requests and Issues.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

MIT License — free to use and adapt.

---

💡 **Vision**:
LexFlow empowers lawyers everywhere to work **faster, safer, and with more clarity**, by bringing **law + AI directly into Chrome**.