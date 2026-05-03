/**
 * In-Memory Store
 * Simple key-value store for task results and intermediate state.
 * Upgradeable to Redis/DB later.
 */

class Store {
  constructor() {
    this.data = new Map();
    this.sessions = new Map();
  }

  // --- Task Results ---
  setResult(taskId, result) {
    this.data.set(taskId, {
      ...result,
      updatedAt: Date.now()
    });
  }

  getResult(taskId) {
    return this.data.get(taskId) || null;
  }

  getAllResults() {
    const out = {};
    for (const [k, v] of this.data) out[k] = v;
    return out;
  }

  // --- Session State ---
  createSession(sessionId, meta = {}) {
    this.sessions.set(sessionId, {
      id: sessionId,
      meta,
      tasks: [],
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return this.sessions.get(sessionId);
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    Object.assign(session, updates, { updatedAt: Date.now() });
    return session;
  }

  addTaskToSession(sessionId, task) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.tasks.push(task);
    session.updatedAt = Date.now();
  }

  // --- Cleanup ---
  clear() {
    this.data.clear();
    this.sessions.clear();
  }

  stats() {
    return {
      results: this.data.size,
      sessions: this.sessions.size
    };
  }
}

// Singleton
module.exports = new Store();
