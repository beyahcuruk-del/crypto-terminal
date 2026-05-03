/**
 * Auth Routes — Signup, Login, Me + History sync
 */

const express = require('express');
const db = require('../data/store');

function createAuthRoutes() {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return res.status(400).json({ error: 'Username: letters, numbers, _ - only' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

    try {
      const user = await db.createUser(username, password);
      res.json({ ok: true, username: user.username, token: user.token });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
      const user = await db.loginUser(username, password);
      res.json({ ok: true, username: user.username, token: user.token });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  router.get('/me', (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = db.getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ ok: true, username: user.username });
  });

  /**
   * POST /auth/sync-history
   * Client sends localStorage history to restore server state after cold start.
   */
  router.post('/sync-history', (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = db.getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const { sessions } = req.body;
    db.restoreHistory(user.username, sessions);
    res.json({ ok: true, count: (sessions || []).length });
  });

  return router;
}

module.exports = createAuthRoutes;
