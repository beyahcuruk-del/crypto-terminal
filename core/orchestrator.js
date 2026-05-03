/**
 * Orchestrator — Core Engine
 * Controls the full workflow: plan → execute → evaluate → retry/next.
 */

const { v4: uuidv4 } = require('uuid');
const PlannerAgent = require('../agents/planner');
const ExecutorAgent = require('../agents/executor');
const CriticAgent = require('../agents/critic');
const store = require('../memory/store');

const MAX_RETRIES = 3;

class Orchestrator {
  constructor(mimoClient) {
    this.planner = new PlannerAgent(mimoClient);
    this.executor = new ExecutorAgent(mimoClient);
    this.critic = new CriticAgent(mimoClient);
    this.mimoClient = mimoClient;
  }

  /**
   * Main entry: run a full goal through the agent pipeline.
   * @param {string} goal - High-level user goal
   * @param {Object} [options] - Options
   * @param {Function} [options.onLog] - Log callback (event, data)
   * @returns {Promise<Object>} Final result
   */
  async run(goal, options = {}) {
    const sessionId = uuidv4();
    const log = options.onLog || (() => {});
    const startTime = Date.now();

    store.createSession(sessionId, { goal });

    log('session_start', { sessionId, goal });

    // Step 1: Plan
    log('planning', { goal });
    let planResult;
    try {
      planResult = await this.planner.plan(goal);
    } catch (err) {
      log('planning_error', { error: err.message });
      store.updateSession(sessionId, { status: 'failed', error: err.message });
      return this._buildResponse(sessionId, 'failed', [], startTime, err.message);
    }

    const tasks = planResult.tasks;
    store.updateSession(sessionId, { tasks, planUsage: planResult.usage });
    log('planned', { taskCount: tasks.length, tasks });

    // Step 2: Execute each task
    const stepResults = [];
    const completedOutputs = [];

    const taskList = [...tasks]; // copy to avoid mutation during iteration

    for (const task of taskList) {
      log('task_start', { taskId: task.id, task: task.task, type: task.type });

      const stepResult = {
        taskId: task.id,
        task: task.task,
        type: task.type,
        attempts: [],
        status: 'pending'
      };

      let lastFeedback = null;
      let success = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        log('attempt', { taskId: task.id, attempt });

        // Execute
        let execResult;
        try {
          execResult = await this.executor.execute(task, {
            previousResults: completedOutputs,
            feedback: lastFeedback
          });
        } catch (err) {
          log('execution_error', { taskId: task.id, attempt, error: err.message });
          stepResult.attempts.push({
            attempt,
            error: err.message,
            status: 'error'
          });
          lastFeedback = err.message;
          continue;
        }

        // Evaluate
        let evaluation;
        try {
          evaluation = await this.critic.evaluate(task, execResult);
        } catch (err) {
          // If critic fails, accept the result
          log('critic_error', { taskId: task.id, error: err.message });
          evaluation = { success: true, score: 50, feedback: 'Critic error, auto-passing' };
        }

        stepResult.attempts.push({
          attempt,
          output: execResult.output,
          artifacts: execResult.artifacts,
          evaluation,
          status: evaluation.success ? 'success' : 'retry'
        });

        log('attempt_result', {
          taskId: task.id,
          attempt,
          success: evaluation.success,
          score: evaluation.score
        });

        if (evaluation.success) {
          success = true;
          completedOutputs.push({
            taskId: task.id,
            output: execResult.output,
            artifacts: execResult.artifacts
          });
          break;
        }

        lastFeedback = evaluation.retrySuggestion || evaluation.feedback;
      }

      stepResult.status = success ? 'completed' : 'failed';
      stepResults.push(stepResult);
      store.setResult(task.id, stepResult);
      store.addTaskToSession(sessionId, stepResult);

      log('task_done', { taskId: task.id, status: stepResult.status });
    }

    // Step 3: Summary
    const failedCount = stepResults.filter(s => s.status === 'failed').length;
    const overallStatus = failedCount === 0 ? 'completed' : 
                          failedCount < stepResults.length ? 'partial' : 'failed';

    store.updateSession(sessionId, { status: overallStatus });

    const result = this._buildResponse(sessionId, overallStatus, stepResults, startTime);
    log('session_end', result);

    return result;
  }

  _buildResponse(sessionId, status, steps, startTime, error = null) {
    const elapsed = Date.now() - startTime;
    const summary = {
      sessionId,
      status,
      elapsed: `${(elapsed / 1000).toFixed(1)}s`,
      totalTasks: steps.length,
      completed: steps.filter(s => s.status === 'completed').length,
      failed: steps.filter(s => s.status === 'failed').length,
      steps: steps.map(s => ({
        taskId: s.taskId,
        task: s.task,
        type: s.type,
        status: s.status,
        attempts: s.attempts.length,
        result: s.attempts.length > 0 ? 
          (s.attempts[s.attempts.length - 1].output || s.attempts[s.attempts.length - 1].error || '').substring(0, 500) : 
          'no attempt'
      }))
    };

    if (error) summary.error = error;

    return summary;
  }
}

module.exports = Orchestrator;
