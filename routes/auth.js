/**
 * Auth Routes — Signup, Login, Logout, Me
 */

const express = require('express');
const db = require('../data/store');

function createAuthRoutes() {
  const router = express.Router();

  /**
   * POST /auth/signup
   * Body: { username, password }
   */
  router.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Username: letters, numbers, _ - only' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    try {
      const user = await db.createUser(username, password);
      res.json({ ok: true, username: user.username, token: user.token });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * POST /auth/login
   * Body: { username, password }
   */
  router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    try {
      const user = await db.loginUser(username, password);
      res.json({ ok: true, username: user.username, token: user.token });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  /**
   * GET /auth/me
   * Header: Authorization: Bearer <token>
   */
  router.get('/me', (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = db.getUserByToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ ok: true, username: user.username });
  });

  return router;
}

module.exports = createAuthRoutes;
