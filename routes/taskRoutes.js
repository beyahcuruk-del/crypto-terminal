/**
 * Task Routes
 * POST /run-task — Main endpoint to run a goal through the agent pipeline.
 */

const express = require('express');
const Orchestrator = require('../core/orchestrator');
const store = require('../memory/store');

function createRoutes(mimoClient) {
  const router = express.Router();
  const orchestrator = new Orchestrator(mimoClient);

  /**
   * POST /run-task
   * Body: { "goal": "Build a crypto dashboard website" }
   */
  router.post('/run-task', async (req, res) => {
    const { goal } = req.body;

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return res.status(400).json({
        error: 'Missing or empty "goal" field in request body'
      });
    }

    // Collect logs for response
    const logs = [];
    const onLog = (event, data) => {
      const entry = { event, data, timestamp: new Date().toISOString() };
      logs.push(entry);
      console.log(`[${event}]`, JSON.stringify(data).substring(0, 200));
    };

    try {
      onLog('request', { goal: goal.trim() });

      const result = await orchestrator.run(goal.trim(), { onLog });

      return res.json({
        ...result,
        logs
      });
    } catch (err) {
      onLog('fatal_error', { error: err.message });
      return res.status(500).json({
        status: 'error',
        error: err.message,
        logs
      });
    }
  });

  /**
   * GET /status — System health check
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
   * GET /results — Get all stored results
   */
  router.get('/results', (req, res) => {
    res.json(store.getAllResults());
  });

  /**
   * GET /results/:taskId — Get specific task result
   */
  router.get('/results/:taskId', (req, res) => {
    const result = store.getResult(req.params.taskId);
    if (!result) return res.status(404).json({ error: 'Task not found' });
    res.json(result);
  });

  return router;
}

module.exports = createRoutes;
