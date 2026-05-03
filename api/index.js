/**
 * Vercel Serverless Function Entry Point
 * Web UI + Auth + API + History
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const MiMoClient = require('../services/mimoClient');
const createStreamRoutes = require('../routes/streamRoutes');
const createAuthRoutes = require('../routes/auth');
const createHistoryRoutes = require('../routes/history');

const apiKey = process.env.MIMO_API_KEY;
const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';

const mimoClient = new MiMoClient({ apiKey, baseUrl });
const app = express();

app.use(express.json({ limit: '1mb' }));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/auth', createAuthRoutes());
app.use('/history', createHistoryRoutes());
app.use('/', createStreamRoutes(mimoClient));

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Unknown: ${req.method} ${req.path}` });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
