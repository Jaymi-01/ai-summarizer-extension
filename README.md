# Summaize: AI Page Summarizer (Manifest V3)

Summaize is a premium, high-performance Chrome extension that distills long web articles into clear, actionable intelligence using Google's Gemma-3 model.

---

## ⚡ Quick Start (Non-Technical Users)

If you just want to use the extension without touching any code, follow these steps:

### 1. Download the Extension
- Open the [**release**](./release) folder in this repository.
- Download the `summaize-extension.zip` file.
- Unzip (extract) the file to a folder on your computer.

### 2. Install in Chrome
1. Open Google Chrome and type `chrome://extensions/` in the address bar.
2. At the top right, turn on **Developer mode**.
3. At the top left, click **Load unpacked**.
4. Select the folder you unzipped in Step 1.
5. Click the **File icon** in your toolbar and **Pin** Summaize for easy access.

---

## 🚀 Setup Instructions (Developers)

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **pnpm** (preferred) or npm

### 2. Installation
1. Clone or download this repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```

### 3. Configuration
The extension reads your Gemini API key from a `.env` file at build time.
1. Create a `.env` file in the root directory.
2. Add your key:
   ```env
   VITE_GEMINI_API_KEY=your_actual_key_here
   ```
The build process will automatically inject this key into the extension's background script. The `.env` file is ignored by Git to keep your key private.

### 4. Building the Extension
Run the build command to generate the `dist` folder:
```bash
pnpm build
```

### 5. Loading into Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top right).
3. Click **Load unpacked**.
4. Select the **`dist`** folder within this project directory.
5. Pin the extension to your toolbar for easy access.

---

## 🏗️ Architecture

The extension follows a strictly decoupled, modular architecture to ensure performance and reliability:

- **Popup UI (`src/App.tsx`)**: A React + Tailwind CSS interface. It manages the user flow, handles the "hybrid" result capturing logic, and provides a polished "Monochrome Lab" aesthetic.
- **Content Script (`src/content.ts`)**: Injected into the active tab. It utilizes a highly optimized version of `@mozilla/readability` to extract article text from a lightweight virtual DOM, avoiding expensive full-page clones.
- **Background Service Worker (`src/background.ts`)**: The secure backend of the extension. It manages AI communication, local caching via `chrome.storage`, and error serialization.
- **Bundling Strategy**: Uses **Vite** for the React Popup and **esbuild** for the Content/Background scripts to ensure compatibility with Chrome's script injection constraints (IIFE vs ESM).

---

## 🤖 AI Integration

Summaize is powered by **Gemma-3 (27B Instruction-tuned)** via the Google Generative AI API.

- **Direct Fetch Implementation**: Instead of using the heavy SDK, we use a direct `fetch` implementation in the background worker. This ensures faster startup times and avoids authentication conflicts between the extension and your logged-in Google account.
- **Context Optimization**: To handle extremely long articles, the extension automatically truncates input text to ~25,000 characters (the most relevant part of an article), ensuring it stays within model limits while providing an accurate summary.
- **Structured Output**: The AI is prompted to return a raw JSON object, which is then parsed and rendered into the "Briefing" and "Key Findings" sections of the UI.

---

## 🛡️ Security Decisions

1.  **API Key Protection**: The API key is baked into the Background Script during the build process. It is **never** sent to the content script or the web page DOM, preventing malicious websites from stealing your key.
2.  **Minimal Permissions**: We only request `activeTab`, `storage`, and `scripting`. This ensures the extension can only read the pages you explicitly click on.
3.  **XSS Prevention**: By using React for the UI, all data extracted from the page or returned by the AI is treated as plain text strings. This prevents "Injection Attacks" where a summary might contain malicious script tags.
4.  **No External Trackers**: The extension communicates only with Google's official API and your local browser storage. No user data is sent to third-party analytics servers.

---

## ⚖️ Trade-offs

| Decision | Benefit | Trade-off |
| :--- | :--- | :--- |
| **Virtual DOM Extraction** | Near-instant extraction (milliseconds) even on heavy pages. | May miss some edge-case content that requires full rendering context. |
| **Hybrid Communication** | Ensures results are captured even if a site's security blocks direct script returns. | Slightly more complex code logic to manage dual-path results. |
| **Monochrome Lab UI** | High accessibility, professional feel, and zero distraction. | Less "vibrant" or branded than traditional consumer extensions. |
| **Baked-in API Key** | Seamless "instant-start" experience for the user. | The key is technically retrievable by a highly technical user inspecting the local files. |

---

## 🛠️ Tech Stack
- **UI**: React 19, Tailwind CSS 4.0
- **Icons**: Phosphor Icons
- **Parsing**: @mozilla/readability
- **Bundling**: Vite + esbuild
- **Language**: TypeScript
