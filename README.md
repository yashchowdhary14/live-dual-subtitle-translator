<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5c420533-49fd-4e52-b20a-7803980d4905

## 🔐 API Keys & Security

This project does NOT ship with production API keys.

To protect the project and prevent abuse:

* Never commit API keys.
* Never expose secrets in:

  * manifest.json
  * frontend code
  * popup scripts
  * Git history
  * screenshots
  * examples
  * public repos

Repository maintainers are not responsible for user API usage.

Users should configure their own API credentials.

---

## 🚫 Important: Remove Existing Secrets Before Publishing

Before pushing code:

Create:

```text
.env
.env.local
.env.production
```

Add to:

```gitignore
.env
.env.local
.env.production
.env.*
```

Remove:

```bash
git rm --cached .env
git rm --cached .env.local
```

Rotate any exposed keys before release.

---

## 🔧 Configure Your Own API Key

Step 1 — Copy environment file

```bash
cp .env.example .env
```

Step 2 — Open:

```text
.env
```

Step 3 — Add your own credentials

Example:

```env
TRANSLATION_API_KEY=your_key_here
TRANSLATION_PROVIDER=your_provider
```

Never share these values.

---

## 🏠 Run Locally

Install:

```bash
npm install
```

Build:

```bash
npm run build
```

Start:

```bash
npm run dev
```

---

## 🧩 Load Extension

Open:

```text
chrome://extensions
```

Enable:

Developer Mode

Click:

Load unpacked

Select:

```text
dist/
```

---

## 👤 Using Your Own Translation Provider

Users must provide their own API credentials.

Supported pattern:

```env
TRANSLATION_PROVIDER=
TRANSLATION_API_KEY=
```

Examples:

* Provider A
* Provider B
* Provider C

(Do not ship actual keys.)

---

## 🛡 Rate Limits & Cost Protection

To prevent token exhaustion:

Implement:

* translation caching
* request deduplication
* debounce requests
* daily request limits
* optional local translation mode
* disable auto-start
* explicit user consent

Recommended:

```env
MAX_TRANSLATIONS_PER_MINUTE=60
CACHE_ENABLED=true
```

---

## 🚨 If You Accidentally Leak Keys

Immediately:

1. Revoke key
2. Generate new key
3. Update .env
4. Remove secrets from git history
5. Push clean commit

Commands:

```bash
git filter-branch
git push --force
```

(or use preferred secret-removal workflow)

---

## 📄 Example Configuration

Provide:

```text
.env.example
```

Example:

```env
TRANSLATION_PROVIDER=
TRANSLATION_API_KEY=
TARGET_LANGUAGE=en
AUTO_START=false
```

Do NOT include real values.
