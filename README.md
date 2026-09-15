# Verifie

> Analyze, track, and verify Google Docs content with AI detection and real-time analytics.

Chrome extension + web dashboard for deep insights into Google Docs: edit history replay, AI content detection, and real-time collaboration tracking — built entirely on free-tier infrastructure.

[![Deploy](https://github.com/hanezrafa/verifie/actions/workflows/deploy.yml/badge.svg)](https://github.com/hanezrafa/verifie/actions/workflows/deploy.yml)

## Features

| Tab | Description |
|-----|-------------|
| **Document** | Document metadata, edit history loading |
| **Replay** | Timeline scrubber, play/pause, speed control (0.5x–3x) |
| **Stats** | Word count, deletes, time spent, edit count + JSON export |
| **Breakdown** | Contributor charts (IPs, referrers, events) |
| **AI Detect** | AI vs Human percentage, verdict, detection indicators |
| **Tracking** | Real-time character count, editing duration, velocity chart, sessions |
| **Dashboard** | Full web analytics dashboard (new window) |

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Popup (Chrome) │◄──►│ Content Script   │◄──►│  Google Docs    │
│  React/Vanilla  │    │ EditingTracker   │    │  DOM observer   │
└────────┬────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ chrome.storage  │◄──►│  Supabase (opt)  │◄──►│  Cloud Sync     │
│  (local-first)  │    │  Postgres+Auth   │    │  REST API       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌──────────────────┐
│  Web Dashboard  │◄──►│  Hugging Face    │
│  GitHub Pages   │    │  AI Detection    │
└─────────────────┘    └──────────────────┘
```

## Installation

### Extension

1. Clone this repository:
   ```bash
   git clone https://github.com/hanezrafa/verifie.git
   ```
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the cloned folder
5. Open a Google Doc and click the Verifie icon

### Web Dashboard

Visit **https://hanezrafa.github.io/verifie/dashboard/** (or open via the extension's dashboard button).

## Configuration (Optional)

All features work **offline by default**. To unlock cloud features, configure in Settings:

### 1. Cloud Sync — Supabase (Free)
- Create project at [supabase.com](https://supabase.com)
- Run `supabase/schema.sql` in the SQL Editor
- Copy **Project URL** + **anon key** into Settings

### 2. AI Detection — Hugging Face (Free)
- Get token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- Model: `Hello-SimpleAI/chatgpt-detector-roberta`
- 30,000 chars/month free

### 3. Google Docs API (Free)
- Enable Docs + Drive API in [Google Cloud Console](https://console.cloud.google.com)
- Create OAuth 2.0 credentials
- Free tier: 60 requests/minute

## Free-Tier Stack

| Service | Free Limit | Purpose |
|---------|-----------|---------|
| Supabase | 500MB DB, 2GB BW | Database, Auth, Realtime |
| Hugging Face | 30K chars/month | AI detection models |
| Cloudflare Workers | 100K req/day | Edge API proxy |
| Google Docs API | 60 req/min | Revision history |
| GitHub Pages | Unlimited | Dashboard hosting |
| GitHub Actions | 2,000 min/month | CI/CD |

**Total cost at scale: $0/month** (up to ~10K users)

## Project Structure

```
verifie/
├── manifest.json              # MV3 extension manifest
├── index.html                 # Landing page (GitHub Pages)
├── dashboard/                 # Web dashboard (vanilla JS)
│   ├── index.html
│   ├── dashboard.css
│   └── dashboard.js
├── src/
│   ├── popup/                 # Extension popup UI
│   ├── content/               # Google Docs content script
│   ├── background/            # Service worker
│   └── shared/                # Shared services
│       ├── config.js          # Settings & storage
│       ├── ai-detection.js    # AI detection (HF + local)
│       ├── cloud-sync.js      # Supabase REST client
│       ├── google-docs-api.js # Google Docs API
│       └── editing-tracker.js # Advanced tracking
├── supabase/
│   └── schema.sql             # Database schema + RLS
└── PRD.md                     # Product requirements
```

## Development

```bash
# Syntax check all JS
node --check src/shared/config.js
node --check src/popup/popup.js

# No build step required - vanilla JS
```

## Privacy

- **Local-first:** All tracking stored in `chrome.storage` until you opt into sync
- **Minimal scopes:** Only `documents.readonly`, `drive.readonly`
- **No content stored** in cloud without explicit configuration
- **Open source:** Audit every line

## License

MIT

---

**Powered by ❤️**
