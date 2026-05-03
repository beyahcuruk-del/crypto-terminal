/**
 * History Routes — Save and retrieve session history
 */

const express = require('express');
const db = require('../data/store');

function createHistoryRoutes() {
  const router = express.Router();

  // Auth middleware
  const requireAuth = (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const user = db.getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    req.user = user;
    next();
  };

  /**
   * POST /history/save
   * Body: { goal, status, totalTasks, completed, failed, elapsed, steps }
   */
  router.post('/save', requireAuth, (req, res) => {
    const { goal, status, totalTasks, completed, failed, elapsed, steps } = req.body;

    if (!goal) return res.status(400).json({ error: 'Missing goal' });

    const session = db.saveSession(req.user.username, {
      goal, status, totalTasks, completed, failed, elapsed, steps
    });

    res.json({ ok: true, session });
  });

  /**
   * GET /history
   * Returns all sessions for the authenticated user
   */
  router.get('/', requireAuth, (req, res) => {
    const sessions = db.getSessions(req.user.username);
    res.json({ sessions });
  });

  /**
   * GET /history/:id
   * Returns a specific session
   */
  router.get('/:id', requireAuth, (req, res) => {
    const session = db.getSession(req.user.username, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  });

  /**
   * DELETE /history/:id
   */
  router.delete('/:id', requireAuth, (req, res) => {
    const deleted = db.deleteSession(req.user.username, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  });

  return router;
}

module.exports = createHistoryRoutes;
