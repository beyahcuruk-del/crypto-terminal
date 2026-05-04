/**
 * AI Chat — Single Agent
 * Direct chat powered by MiMo API.
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const MiMoClient = require('./services/mimoClient');
const createChatRoutes = require('./routes/chatRoutes');
const createAuthRoutes = require('./routes/auth');

// --- Validate Config ---
const apiKey = process.env.MIMO_API_KEY;
const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';
const port = parseInt(process.env.PORT || '3000', 10);

if (!apiKey) {
  console.error('\n❌ MIMO_API_KEY not set!');
  process.exit(1);
}

// --- Init ---
const mimoClient = new MiMoClient({ apiKey, baseUrl });
const app = express();

// --- Middleware ---
app.use(express.json({ limit: '2mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

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
app.use('/auth', createAuthRoutes());
app.use('/', createChatRoutes(mimoClient));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start ---
app.listen(port, () => {
  console.log(`\n  🤖 AI Chat — Port ${port}\n`);
});

module.exports = app;
