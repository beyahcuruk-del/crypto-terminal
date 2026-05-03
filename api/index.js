/**
 * Vercel Serverless Function Entry Point
 * Serves both the web UI and API endpoints.
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const MiMoClient = require('../services/mimoClient');
const createRoutes = require('../routes/taskRoutes');

const apiKey = process.env.MIMO_API_KEY;
const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1';

const mimoClient = new MiMoClient({ apiKey, baseUrl });
const app = express();

app.use(express.json({ limit: '1mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/', createRoutes(mimoClient));

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
