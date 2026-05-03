/**
 * Streaming Routes — Per-task execution to avoid Vercel timeout.
 * Frontend orchestrates the loop, server runs one task at a time.
 */

const express = require('express');
const PlannerAgent = require('../agents/planner');
const ExecutorAgent = require('../agents/executor');
const CriticAgent = require('../agents/critic');
const store = require('../memory/store');

const MAX_RETRIES = 3;

function createStreamRoutes(mimoClient) {
  const router = express.Router();
  const planner = new PlannerAgent(mimoClient);
  const executor = new ExecutorAgent(mimoClient);
  const critic = new CriticAgent(mimoClient);

  /**
   * POST /plan — Break goal into task list (fast, ~5s)
   */
  router.post('/plan', async (req, res) => {
    const { goal } = req.body;
    if (!goal) return res.status(400).json({ error: 'Missing goal' });

    try {
      const result = await planner.plan(goal);
      res.json({ tasks: result.tasks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /execute-task — Execute ONE task
   * Body: { task, previousResults?, feedback?, fast? }
   */
  router.post('/execute-task', async (req, res) => {
    const { task, previousResults, feedback, fast } = req.body;
    if (!task) return res.status(400).json({ error: 'Missing task' });

    try {
      const execResult = await executor.execute(task, {
        previousResults: previousResults || [],
        feedback: feedback || null
      });

      let evaluation;
      if (fast) {
        // Fast mode: skip critic, auto-pass
        evaluation = { success: true, score: 90, feedback: 'Fast mode — auto-passed' };
      } else {
        try {
          evaluation = await critic.evaluate(task, execResult);
        } catch (err) {
          evaluation = { success: true, score: 50, feedback: 'Critic error, auto-passing' };
        }
      }

      res.json({
        taskId: task.id,
        output: execResult.output,
        artifacts: execResult.artifacts,
        evaluation,
        success: evaluation.success
      });
    } catch (err) {
      res.status(500).json({ error: err.message, taskId: task.id });
    }
  });

  /**
   * POST /run-task — Full run (kept for small goals, uses SSE)
   */
  router.get('/run-task-stream', async (req, res) => {
    const goal = req.query.goal;
    if (!goal) return res.status(400).json({ error: 'Missing goal' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('connected', { goal });

    try {
      // Plan
      send('planning', {});
      const planResult = await planner.plan(goal);
      send('planned', { taskCount: planResult.tasks.length });

      // Execute each task
      const stepResults = [];
      const completedOutputs = [];

      for (const task of planResult.tasks) {
        send('task_start', { taskId: task.id, task: task.task, type: task.type });

        let lastFeedback = null;
        let success = false;
        const attempts = [];

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          send('attempt', { taskId: task.id, attempt });

          try {
            const execResult = await executor.execute(task, {
              previousResults: completedOutputs,
              feedback: lastFeedback
            });

            let evaluation;
            try {
              evaluation = await critic.evaluate(task, execResult);
            } catch {
              evaluation = { success: true, score: 50 };
            }

            attempts.push({ attempt, output: execResult.output, evaluation, status: evaluation.success ? 'success' : 'retry' });
            send('attempt_result', { taskId: task.id, attempt, success: evaluation.success, score: evaluation.score });

            if (evaluation.success) {
              success = true;
              completedOutputs.push({ taskId: task.id, output: execResult.output, artifacts: execResult.artifacts });
              break;
            }

            lastFeedback = evaluation.retrySuggestion || evaluation.feedback;
          } catch (err) {
            send('attempt_result', { taskId: task.id, attempt, success: false, score: 0, error: err.message });
          }
        }

        const step = {
          taskId: task.id,
          task: task.task,
          type: task.type,
          status: success ? 'completed' : 'failed',
          attempts: attempts.length,
          result: attempts.length > 0 ? (attempts[attempts.length - 1].output || '').substring(0, 500) : 'no attempt'
        };

        stepResults.push(step);
        send('task_done', { taskId: task.id, status: step.status });
      }

      // Summary
      const failedCount = stepResults.filter(s => s.status === 'failed').length;
      const overallStatus = failedCount === 0 ? 'completed' : failedCount < stepResults.length ? 'partial' : 'failed';

      send('result', {
        status: overallStatus,
        totalTasks: stepResults.length,
        completed: stepResults.filter(s => s.status === 'completed').length,
        failed: failedCount,
        steps: stepResults
      });

    } catch (err) {
      send('fatal_error', { error: err.message });
    }

    send('done', {});
    res.end();
  });

  /**
   * GET /status
   */
  router.get('/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  return router;
}

module.exports = createStreamRoutes;
