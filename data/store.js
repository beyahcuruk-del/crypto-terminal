/**
 * Simple In-Memory Auth + History
 * No file I/O. Client-side persistence via localStorage.
 */

const crypto = require('crypto');

// In-memory stores (reset on cold start)
const users = new Map();   // username -> { passwordHash, salt, token }
const history = new Map(); // username -> [sessions]

// ===== AUTH =====

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createUser(username, password) {
  if (users.has(username)) throw new Error('Username already exists');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await hashPassword(password, salt);
  const token = generateToken();
  users.set(username, { passwordHash: hash, salt, token });
  history.set(username, []);
  return { username, token };
}

async function loginUser(username, password) {
  const user = users.get(username);
  if (!user) throw new Error('User not found');
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('Invalid password');
  const token = generateToken();
  user.token = token;
  return { username, token };
}

function getUserByToken(token) {
  if (!token) return null;
  for (const [username, user] of users) {
    if (user.token === token) return { username };
  }
  return null;
}

// ===== HISTORY =====

function saveSession(username, data) {
  if (!history.has(username)) history.set(username, []);
  const sessions = history.get(username);
  const session = {
    id: crypto.randomBytes(8).toString('hex'),
    ...data,
    createdAt: new Date().toISOString()
  };
  sessions.unshift(session);
  if (sessions.length > 50) sessions.length = 50;
  return session;
}

function getSessions(username) {
  return history.get(username) || [];
}

function getSession(username, sessionId) {
  const sessions = getSessions(username);
  return sessions.find(s => s.id === sessionId) || null;
}

function deleteSession(username, sessionId) {
  const sessions = history.get(username);
  if (!sessions) return false;
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return false;
  sessions.splice(idx, 1);
  return true;
}

/**
 * Bulk restore history from client (called on page load)
 */
function restoreHistory(username, sessions) {
  history.set(username, Array.isArray(sessions) ? sessions : []);
}

module.exports = {
  createUser, loginUser, getUserByToken,
  saveSession, getSessions, getSession, deleteSession, restoreHistory
};
