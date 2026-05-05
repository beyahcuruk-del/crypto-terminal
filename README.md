# 🚀 CryptoTerminal AI

All-in-one crypto trading terminal with AI-powered analysis, real-time market data, and portfolio tracking.

**Live:** https://crypto-terminal-beryl.vercel.app/

## Features

- **📊 Markets** — Real-time prices, 24h change, market cap, volume for 250+ coins via CoinGecko
- **🔍 Search** — Instant search across all crypto assets
- **🤖 AI Chat** — Ask anything about crypto, get AI-powered analysis with market context
- **📡 Signals** — AI-powered memecoin scanner using DexScreener (Solana chain), hybrid rule-based + LLM scoring
- **💼 Portfolio** — Track holdings, P&L, allocation breakdown
- **📝 History** — Full chat and signal history with expand/collapse, delete, retry

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (single file, ~1150 lines)
- **Backend:** Node.js + Express (Vercel serverless)
- **APIs:** CoinGecko, DexScreener, MiMo LLM (Xiaomi)
- **Deploy:** Vercel (auto-deploy from GitHub)

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your MIMO_API_KEY

# 3. Run
npm start
# Open http://localhost:3000
```

## API Endpoints

| Method | Path             | Description                          |
|--------|------------------|--------------------------------------|
| GET    | /api/coins       | Top coins (CoinGecko)               |
| GET    | /api/global      | Global market stats                  |
| GET    | /api/search?q=   | Search coins by name/symbol          |
| GET    | /api/coins/:id   | Single coin details                  |
| POST   | /api/analyze     | AI analysis for a coin               |
| POST   | /api/chat        | AI chat with market context          |
| POST   | /api/signals     | Generate trading signals             |
| POST   | /api/meme-signals| Meme coin scanner (DexScreener+AI)  |

## Environment Variables

| Variable      | Default                                    | Description      |
|---------------|--------------------------------------------|------------------|
| MIMO_API_KEY  | (required)                                 | MiMo API key     |
| MIMO_BASE_URL | https://token-plan-sgp.xiaomimimo.com/v1   | API base URL     |
| PORT          | 3000                                       | Server port      |

## Project Structure

```
├── index.js            # Express server + API routes
├── public/
│   └── index.html      # Full SPA (HTML + CSS + JS)
├── vercel.json         # Vercel config
├── package.json
├── .env                # Environment variables
└── .gitignore
```

## License

Private — Internal use only.
