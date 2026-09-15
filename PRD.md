# PRD: Verifie - Google Docs Analytics Extension

## 1. Product Overview

**Product Name:** Verifie  
**Tagline:** Analyze, Track, and Verify Google Docs Content  
**Platform:** Chrome Extension (Manifest V3) + Optional Web Dashboard  
**Target Users:** Writers, Editors, Content Teams, Students, Researchers  

### Core Value Proposition
Provide deep insights into Google Docs: edit history replay, AI content detection, real-time collaboration tracking, and document analytics - all in a privacy-first, cost-effective solution.

---

## 2. Feature Requirements

### 2.1 Document Tab
| Requirement | Priority | Description |
|-------------|----------|-------------|
| Load document metadata | P0 | Title, URL, last modified, owner |
| Fetch edit history | P0 | Retrieve revision history from Google Docs API |
| Display document stats summary | P1 | Word count, character count, reading time |

### 2.2 Replay Tab
| Requirement | Priority | Description |
|-------------|----------|-------------|
| Timeline scrubber | P0 | Visual timeline with draggable thumb |
| Play/Pause controls | P0 | Play, pause, previous, next edit |
| Speed control | P1 | 0.5x, 1x, 1.5x, 2x, 3x |
| Edit visualization | P1 | Highlight changes per revision |
| Keyboard shortcuts | P2 | Space=play/pause, ←/→=navigate |

### 2.3 Stats Tab
| Requirement | Priority | Description |
|-------------|----------|-------------|
| Word count | P0 | Total words, unique words |
| Character count | P0 | With/without spaces |
| Deletions tracking | P1 | Characters/words deleted |
| Time spent | P1 | Active editing time |
| Edit count | P0 | Total revisions |
| Export JSON/CSV | P1 | Download analytics report |

### 2.4 Breakdown Tab
| Requirement | Priority | Description |
|-------------|----------|-------------|
| Contributor breakdown | P1 | Edits per collaborator (IP/email) |
| Referrer tracking | P2 | Where edits originated |
| Session analysis | P2 | Editing sessions with duration |
| Visual charts | P1 | Pie/bar charts using Canvas |

### 2.5 AI Detection Tab
| Requirement | Priority | Description |
|-------------|----------|-------------|
| AI vs Human percentage | P0 | Overall score with confidence |
| Sentence-level analysis | P1 | Highlight AI-suspected sentences |
| Detection indicators | P1 | Vocabulary, structure, repetition, burstiness |
| Verdict classification | P0 | AI / Human / Mixed |
| Export report | P2 | PDF/JSON with detailed findings |

### 2.6 Real-time Tracking Tab
| Requirement | Priority | Description |
|-------------|----------|-------------|
| Live character counter | P0 | Characters typed in real-time |
| Active editing timer | P0 | Session duration HH:MM:SS |
| Typing velocity chart | P1 | Characters/minute over time |
| Session history | P1 | Past sessions with stats |
| Multi-user presence | P2 | Show other active editors |
| Export tracking data | P1 | JSON/CSV export |

---

## 3. Technical Architecture (Free Tier Optimized)

### 3.1 Chrome Extension (Manifest V3)
```
┌─────────────────────────────────────┐
│        Popup (React/Vanilla JS)     │
├─────────────────────────────────────┤
│      Content Script (Injected)      │
│  - DOM observation                  │
│  - MutationObserver for edits       │
│  - Character counting               │
├─────────────────────────────────────┤
│      Background Service Worker      │
│  - Chrome storage                   │
│  - Alarms for periodic sync         │
│  - Message routing                  │
├─────────────────────────────────────┤
│      Offscreen Document             │
│  - Heavy computation (AI analysis)  │
│  - Canvas chart rendering           │
└─────────────────────────────────────┘
```

### 3.2 Backend Services (All Free Tiers)

| Service | Free Tier | Use Case |
|---------|-----------|----------|
| **Supabase** | 500MB DB, 2GB bandwidth, Auth | PostgreSQL + Auth + Realtime |
| **Cloudflare Workers** | 100K req/day | Edge API, CORS proxy |
| **Cloudflare Pages** | Unlimited static sites | Web dashboard hosting |
| **Hugging Face Inference** | 30K chars/month | AI detection models |
| **Google Cloud** | $300 credit + Always Free | Docs API, OAuth |
| **GitHub Actions** | 2000 min/month | CI/CD |
| **Vercel** | 100GB bandwidth | Alternative hosting |

### 3.3 Data Flow

```
Google Docs → Content Script → Background SW → Supabase (Realtime)
                                    ↓
                            Cloudflare Worker
                                    ↓
                            Hugging Face API (AI Detection)
                                    ↓
                            Supabase (Storage)
                                    ↓
                            Popup / Dashboard (Consumption)
```

---

## 4. Free Technology Stack Details

### 4.1 Database: Supabase (PostgreSQL)
```sql
-- Tables needed
documents (id, user_id, google_doc_id, title, url, created_at)
revisions (id, document_id, revision_id, content_hash, author, timestamp, char_delta)
sessions (id, document_id, user_id, start_time, end_time, char_count, keystrokes)
ai_analysis (id, document_id, ai_percentage, human_percentage, details, created_at)
users (id, email, google_id, created_at)
```

**Why Supabase:**
- 500MB free PostgreSQL
- Built-in Auth (Google OAuth)
- Realtime subscriptions for live tracking
- Row Level Security (RLS)
- Auto-generated REST/GraphQL APIs

### 4.2 AI Detection: Hugging Face (Free Inference API)

**Models to use:**
- `Hello-SimpleAI/chatgpt-detector-roberta` - RoBERTa based
- `openai-community/roberta-base-openai-detector` - OpenAI detector
- `martin-ha/toxic-comment-model` - Additional signals

**Fallback:** Local heuristic analysis (already implemented) when API quota exceeded.

### 4.3 Real-time: Supabase Realtime + WebSocket
```javascript
// Subscribe to document changes
supabase
  .channel('document-changes')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'revisions',
    filter: `document_id=eq.${docId}`
  }, payload => {
    // Update UI in real-time
  })
  .subscribe()
```

### 4.4 Google Docs API Integration

**Required Scopes:**
- `https://www.googleapis.com/auth/documents.readonly`
- `https://www.googleapis.com/auth/drive.readonly`

**Endpoints:**
- `GET /v1/documents/{documentId}` - Get document content
- `GET /v1/documents/{documentId}/revisions` - Get revision history

**Rate Limits:** 60 requests/minute/user (free)

### 4.5 Authentication Flow
```
1. User clicks "Connect Google" in extension
2. Redirect to Google OAuth (via Supabase Auth)
3. Store refresh token in Supabase (encrypted)
4. Background worker uses refresh token for API calls
5. Token auto-refreshed by Supabase client
```

---

## 5. Implementation Phases

### Phase 1: Core Extension (Weeks 1-2) ✅ DONE
- [x] Popup UI with all 6 tabs
- [x] Content script injection
- [x] Basic character tracking
- [x] Local storage persistence
- [x] AI detection (heuristic)
- [x] Charts with Canvas

### Phase 2: Backend Integration (Weeks 3-4)
- [ ] Supabase project setup
- [ ] Google OAuth configuration
- [ ] Documents & revisions tables
- [ ] Sync edit history to Supabase
- [ ] User authentication in popup

### Phase 3: Real Features (Weeks 5-6)
- [ ] Google Docs API integration
- [ ] Real revision history fetch
- [ ] Hugging Face AI detection API
- [ ] Supabase Realtime for live tracking
- [ ] Multi-user session detection

### Phase 4: Web Dashboard (Weeks 7-8)
- [ ] Cloudflare Pages deployment
- [ ] React dashboard with charts
- [ ] Document management UI
- [ ] Team/workspace support
- [ ] Export reports (PDF)

### Phase 5: Polish & Launch (Weeks 9-10)
- [ ] Chrome Web Store submission
- [ ] Landing page
- [ ] Documentation
- [ ] Analytics (Plausible/Umami - free)
- [ ] Error monitoring (Sentry free tier)

---

## 6. Cost Analysis (Monthly Production)

| Component | Free Tier Limit | Estimated Usage | Cost |
|-----------|-----------------|-----------------|------|
| Supabase | 500MB DB, 2GB BW | ~50MB, 500MB | $0 |
| Cloudflare Workers | 100K req/day | ~10K req | $0 |
| Cloudflare Pages | Unlimited | Static site | $0 |
| Hugging Face | 30K chars/month | ~10K chars | $0 |
| Google Cloud | $300 credit + Free | Docs API | $0 |
| GitHub Actions | 2000 min | ~500 min | $0 |
| **Total** | | | **$0/month** |

**Break-even:** 10,000+ active users before any paid tier needed.

---

## 7. Privacy & Security

### Data Handling
- **No content stored** without explicit user consent
- **Local-first:** All tracking stays in chrome.storage until user syncs
- **Encryption:** Supabase RLS + TLS everywhere
- **Minimal scopes:** Only `documents.readonly` + `drive.readonly`

### Compliance
- GDPR: Right to delete (Supabase auth handles)
- CCPA: No sale of data
- Chrome Web Store: Single-purpose policy compliant

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google Docs API changes | High | Abstract API layer, monitor deprecations |
| Hugging Face rate limits | Medium | Local heuristic fallback, cache results |
| Supabase free tier limits | Low | Monitor usage, optimize queries |
| Chrome extension policy changes | Medium | Follow MV3 best practices, avoid remote code |
| User adoption | High | Free forever, privacy-first marketing |

---

## 9. Success Metrics

| Metric | Target (Month 3) | Target (Month 6) |
|--------|------------------|------------------|
| Active users | 500 | 5,000 |
| Documents analyzed | 1,000 | 20,000 |
| AI detection runs | 500 | 10,000 |
| Tracking sessions | 2,000 | 50,000 |
| Web dashboard users | 100 | 2,000 |
| Chrome Store rating | 4.5★ | 4.7★ |

---

## 10. Next Steps

1. **Immediate:** Set up Supabase project, enable Google OAuth
2. **This week:** Migrate local storage → Supabase
3. **Next week:** Integrate Google Docs API for real revision history
4. **Following:** Add Hugging Face AI detection API
5. **Then:** Build web dashboard on Cloudflare Pages

---

## Appendix: File Structure for Production

```
verifie/
├── extension/              # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── popup/          # React/Vanilla popup
│   │   ├── content/        # Content scripts
│   │   ├── background/     # Service worker
│   │   ├── offscreen/      # Offscreen document
│   │   └── shared/         # Shared utilities
│   ├── manifest.json
│   └── package.json
├── dashboard/              # Web Dashboard (React + Vite)
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                # Cloudflare Workers
│   ├── src/
│   ├── wrangler.toml
│   └── package.json
├── supabase/               # Database schema & migrations
│   ├── migrations/
│   └── seed.sql
└── .github/
    └── workflows/          # CI/CD
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-09-14  
**Author:** Verifie Team