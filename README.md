<div align="center">
  <h1>💬 Live Dual Subtitle Translator</h1>
  <p><b>Real-time dual subtitle translation for streaming platforms and online video.</b></p>

  <p>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/stargazers"><img src="https://img.shields.io/github/stars/yashchowdhary14/live-dual-subtitle-translator?style=flat-square&color=blue" alt="Stars"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/network/members"><img src="https://img.shields.io/github/forks/yashchowdhary14/live-dual-subtitle-translator?style=flat-square&color=blue" alt="Forks"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/issues"><img src="https://img.shields.io/github/issues/yashchowdhary14/live-dual-subtitle-translator?style=flat-square&color=blue" alt="Issues"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/blob/main/LICENSE"><img src="https://img.shields.io/github/license/yashchowdhary14/live-dual-subtitle-translator?style=flat-square&color=blue" alt="License"></a>
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/actions/workflows/build.yml"><img src="https://img.shields.io/github/actions/workflow/status/yashchowdhary14/live-dual-subtitle-translator/build.yml?branch=main&style=flat-square" alt="Build Status"></a>
  </p>

  <p>
    <a href="#installation"><strong>Install Extension</strong></a> ·
    <a href="#configuration--usage"><strong>Documentation</strong></a> ·
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/issues"><strong>Report Issue</strong></a> ·
    <a href="https://github.com/yashchowdhary14/live-dual-subtitle-translator/stargazers"><strong>Star Repository</strong></a>
  </p>
</div>

---

## 📖 Overview

This project was created to make multilingual video watching easier by displaying translated subtitles alongside original captions in real time. It is designed for language learners, international audiences, and anyone who wants to enjoy content in their native language while still referencing the original audio context.

---

## ✨ Features

- **Real-Time Translation**: Translates incoming subtitle streams dynamically without noticeable delay.
- **Dual Display**: Shows both the original and translated subtitles side-by-side or stacked.
- **Bring Your Own Key (BYOK)**: Connect your preferred translation provider API to ensure privacy and control over your own usage limits.
- **Lightweight & Fast**: Built with standard web technologies and optimized for streaming.
- **Multi-Language Support**: Supports a wide array of source and target languages based on the translation provider used.
- **Privacy First**: No tracking or data harvesting. All processing happens between your browser and your API provider.

---

## 👨‍💻 Maintainer

**Designed, built, and maintained as an independent open-source project.**

- **Name**: Yash Chowdhary
- **GitHub**: [@yashchowdhary14](https://github.com/yashchowdhary14)

---

## 📸 Demo

*(Add a GIF or screenshot of the extension in action here)*

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
2. Select your `Translation Provider`.
3. Input your `API Key`.
4. Choose your `Target Language`.

Example `.env` equivalent configuration:
```env
TRANSLATION_PROVIDER=your_provider
TRANSLATION_API_KEY=your_secure_api_key_here
TARGET_LANGUAGE=en
```

> **Note:** Never share your API keys or expose them in public repositories.

---

## 🌐 Browser Support

- Google Chrome (Manifest V3)
- Mozilla Firefox
- Microsoft Edge
- Brave Browser

---

## 🏗️ Architecture

The project is built as a Manifest V3 web extension consisting of:
- **Background Service Worker**: Handles message passing, state management, and API request proxying.
- **Content Scripts**: Intercepts subtitle DOM updates on the host video page, injects translated nodes, and manages the dual-display UI.
- **Popup/Options UI**: Built with React and Vite for a smooth user experience when configuring API keys and language preferences.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🛣️ Roadmap

- [x] Initial release of Chrome Extension MVP
- [ ] Implement Firefox Add-on support natively
- [ ] Add caching to reduce translation API costs
- [ ] Configurable hotkeys for toggling translations
- [ ] Improved UI/UX for the extension popup
- [ ] Custom styling options for subtitles (font, color, background)

---

## ❓ FAQ

**Does this extension work on Netflix/YouTube/Hulu?**  
It works on video players that use standard WebVTT or DOM-based subtitle rendering. Compatibility varies by site architecture.

**Why do I need to supply my own API key?**  
To keep the extension free and open-source, we cannot cover the API costs for all users. Using your own key means you only pay for what you use (or stay within free tiers).

**Is my data safe?**  
Yes. All subtitle text is sent directly from your browser to your configured API provider. No middleman servers are used, and no data is collected by the extension developers.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
