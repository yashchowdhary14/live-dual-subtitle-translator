<div align="center">
  <img src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" alt="Live Dual Subtitle Translator Logo" width="100%">

  <h1>Live Dual Subtitle Translator</h1>
  <p><b>Real-time dual subtitle translation for any video using AI.</b></p>

  <p>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/releases"><img src="https://img.shields.io/github/v/release/yashchowdhary14/live-dual-subtitle-translator?style=flat-square" alt="Version"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/stargazers"><img src="https://img.shields.io/github/stars/yashchowdhary14/live-dual-subtitle-translator?style=flat-square" alt="Stars"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/network/members"><img src="https://img.shields.io/github/forks/yashchowdhary14/live-dual-subtitle-translator?style=flat-square" alt="Forks"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/blob/main/LICENSE"><img src="https://img.shields.io/github/license/yashchowdhary14/live-dual-subtitle-translator?style=flat-square" alt="License"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/issues"><img src="https://img.shields.io/github/issues/yashchowdhary14/live-dual-subtitle-translator?style=flat-square" alt="Issues"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/pulls"><img src="https://img.shields.io/github/issues-pr/yashchowdhary14/live-dual-subtitle-translator?style=flat-square" alt="PRs"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/actions/workflows/build.yml"><img src="https://img.shields.io/github/actions/workflow/status/yashchowdhary14/live-dual-subtitle-translator/build.yml?branch=main&style=flat-square" alt="Build Status"></a>
  </p>

  <p>
    <a href="#installation"><img src="https://img.shields.io/badge/Chrome-Web_Store-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Extension"></a>
    <a href="#installation"><img src="https://img.shields.io/badge/Firefox-Add_ons-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Firefox Add-on"></a>
  </p>
</div>

---

## 📖 Overview

**Live Dual Subtitle Translator** is a browser extension that translates video subtitles in real-time, displaying both the original and translated subtitles simultaneously. Perfect for language learners, international audiences, or anyone wanting to enjoy content in their native language while still referencing the original audio context.

![Demo GIF Placeholder](https://via.placeholder.com/800x450.png?text=Demo+GIF+Placeholder)

---

## ✨ Features

- 🚀 **Real-Time Translation**: Translates incoming subtitle streams dynamically using state-of-the-art AI.
- 📺 **Dual Display**: Shows both the original and translated subtitles side-by-side or stacked.
- ⚙️ **Bring Your Own Key (BYOK)**: Connect your preferred translation API to ensure privacy and control costs.
- ⚡ **Lightweight & Fast**: Built with standard web technologies and optimized for zero-lag streaming.
- 🌍 **Multi-Language Support**: Supports a wide array of source and target languages.
- 🛡️ **Privacy First**: No tracking, no data harvesting. All processing happens between your browser and your API provider.

---

## 📦 Installation

You have two options for installing the Live Dual Subtitle Translator.

### Option 1: Install from Browser Stores (Coming Soon)

<a href="#"><img src="https://img.shields.io/badge/Download_for-Chrome-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Install for Chrome"></a>
<a href="#"><img src="https://img.shields.io/badge/Download_for-Firefox-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Install for Firefox"></a>

### Option 2: Install from Source

If you prefer to run the extension from the source or want to contribute to the project:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yashchowdhary14/live-dual-subtitle-translator.git
   cd live-dual-subtitle-translator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

4. **Load into your browser:**
   - **Chrome**: Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `manifest.json` inside the `dist/` folder.

---

## 🔧 Configuration & Usage

Once installed, click the extension icon to open the configuration popup.

### Using Your Own Translation Provider

Users must provide their own API credentials. The repository maintainers do not ship API keys to prevent abuse.

1. Open the extension settings.
2. Select your `Translation Provider` (e.g., Gemini).
3. Input your `API Key`.
4. Choose your `Target Language`.

Example `.env` equivalent configuration:
```env
TRANSLATION_PROVIDER=gemini
TRANSLATION_API_KEY=your_secure_api_key_here
TARGET_LANGUAGE=en
```

> **Note:** Never share your API keys or expose them in public repositories.

---

## 🔐 Security & Rate Limits

This project does NOT ship with production API keys. Repository maintainers are not responsible for user API usage or token exhaustion.

### Rate Limits & Cost Protection
To prevent accidental token exhaustion, we recommend:
- Leveraging translation caching if available.
- Monitoring your daily request limits via your API provider's dashboard.
- Disabling auto-start on pages you don't actively need translated.

### Important: Remove Secrets Before Publishing
If you are developing locally:
1. Always create `.env`, `.env.local`, `.env.production` files and add them to your `.gitignore`.
2. Do **not** commit these files. Use `.env.example` to document expected variables.
3. If you accidentally leak keys, revoke them immediately. Use `git filter-branch` to remove secrets from your commit history.

Read our full [Security Policy](SECURITY.md) for more details.

---

## 🏗️ Architecture

The project is built as a Manifest V3 web extension consisting of:
- **Background Service Worker**: Handles message passing, state management, and API request proxying.
- **Content Scripts**: Intercepts subtitle DOM updates on the host video page, injects translated nodes, and manages dual-display UI.
- **Popup/Options UI**: Built with React and Vite for a smooth user experience when configuring API keys and language preferences.

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

### Good First Issues
Looking to get started? Check out our [Issues tab](https://github.com/yashchowdhary14/live-dual-subtitle-translator/issues) and filter by the `good first issue` or `help wanted` labels!

---

## 📈 Community & Growth

### Star History
[![Star History Chart](https://api.star-history.com/svg?repos=yashchowdhary14/live-dual-subtitle-translator&type=Date)](https://star-history.com/#yashchowdhary14/live-dual-subtitle-translator&Date)

### Contributors
<a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=yashchowdhary14/live-dual-subtitle-translator" />
</a>

---

## ❓ FAQ

**Q: Does this extension work on Netflix/YouTube/Hulu?**  
A: It works on video players that use standard WebVTT or DOM-based subtitle rendering. Compatibility varies by site architecture.

**Q: Why do I need to supply my own API key?**  
A: To keep the extension free and open-source, we cannot cover the API costs for all users. Using your own key means you only pay for what you use (or stay within free tiers).

**Q: Is my data safe?**  
A: Yes. All subtitle text is sent directly from your browser to your configured API provider. No middleman servers are used, and no data is collected by the extension developers.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
