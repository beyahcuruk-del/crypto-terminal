/**
 * Streaming Routes — SSE endpoint for real-time progress.
 * Avoids Vercel timeout by sending events as they happen.
 */

const express = require('express');
const Orchestrator = require('../core/orchestrator');
const store = require('../memory/store');

function createStreamRoutes(mimoClient) {
  const router = express.Router();
  const orchestrator = new Orchestrator(mimoClient);

  /**
   * GET /run-task-stream?goal=...
   * Server-Sent Events — streams progress in real-time.
   */
  router.get('/run-task-stream', async (req, res) => {
    const goal = req.query.goal;
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return res.status(400).json({ error: 'Missing "goal" query parameter' });
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('connected', { goal: goal.trim() });

    const onLog = (event, data) => {
      send(event, data);
    };

    try {
      const result = await orchestrator.run(goal.trim(), { onLog });
      send('result', result);
    } catch (err) {
      send('fatal_error', { error: err.message });
    }

    send('done', {});
    res.end();
  });

  /**
   * POST /run-task — Original JSON endpoint (kept for API use)
   */
  router.post('/run-task', async (req, res) => {
    const { goal } = req.body;
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty "goal" field' });
    }

    const logs = [];
    const onLog = (event, data) => {
      logs.push({ event, data, timestamp: new Date().toISOString() });
    };

    try {
      const result = await orchestrator.run(goal.trim(), { onLog });
      return res.json({ ...result, logs });
    } catch (err) {
      return res.status(500).json({ status: 'error', error: err.message, logs });
    }
  });

  /**
   * GET /status
   */
  router.get('/status', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memory: store.stats(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * GET /results
   */
  router.get('/results', (req, res) => {
    res.json(store.getAllResults());
  });

  return router;
}

module.exports = createStreamRoutes;
