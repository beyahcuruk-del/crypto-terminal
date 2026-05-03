/**
 * Multi-Agent System — Entry Point
 * Autonomous multi-agent assistant powered by MiMo API.
 */

require('dotenv').config();

const express = require('express');
const MiMoClient = require('./services/mimoClient');
const createRoutes = require('./routes/taskRoutes');

// --- Validate Config ---
const apiKey = process.env.MIMO_API_KEY;
const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
const port = parseInt(process.env.PORT || '3000', 10);

if (!apiKey) {
  console.error('\n❌ MIMO_API_KEY not set!');
  console.error('   Copy .env.example to .env and add your API key.\n');
  process.exit(1);
}

// --- Init ---
const mimoClient = new MiMoClient({ apiKey, baseUrl });
const app = express();

// --- Middleware ---
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// --- Routes ---
app.use('/', createRoutes(mimoClient));

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Unknown route: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start ---
app.listen(port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🧠 Multi-Agent System — Running           ║
║                                              ║
║   Port:  ${String(port).padEnd(36)}║
║   Model: MiMo-V2.5-Pro / MiMo-V2.5          ║
║   API:   ${baseUrl.substring(0, 36).padEnd(36)}║
║                                              ║
║   POST /run-task  { "goal": "..." }          ║
║   GET  /status    Health check               ║
║   GET  /results   All task results           ║
╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
