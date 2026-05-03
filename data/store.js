/**
 * JSON File-Based Data Store
 * Users + session history persistence.
 * Works on Vercel (ephemeral) for the lifetime of a function invocation.
 * For persistent storage on Vercel, swap with Vercel KV / Supabase later.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(filepath) {
  try {
    if (!fs.existsSync(filepath)) return {};
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return {};
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ===== USERS =====

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
  const users = readJSON(USERS_FILE);
  if (users[username]) {
    throw new Error('Username already exists');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await hashPassword(password, salt);
  const token = generateToken();

  users[username] = {
    username,
    passwordHash: hash,
    salt,
    token,
    createdAt: new Date().toISOString()
  };

  writeJSON(USERS_FILE, users);

  return { username, token };
}

async function loginUser(username, password) {
  const users = readJSON(USERS_FILE);
  const user = users[username];

  if (!user) throw new Error('User not found');

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error('Invalid password');

  // Generate new token
  const token = generateToken();
  user.token = token;
  writeJSON(USERS_FILE, users);

  return { username, token };
}

function getUserByToken(token) {
  if (!token) return null;
  const users = readJSON(USERS_FILE);
  for (const user of Object.values(users)) {
    if (user.token === token) return { username: user.username };
  }
  return null;
}

// ===== SESSION HISTORY =====

function saveSession(username, sessionData) {
  const allSessions = readJSON(SESSIONS_FILE);
  if (!allSessions[username]) allSessions[username] = [];

  const session = {
    id: crypto.randomBytes(8).toString('hex'),
    goal: sessionData.goal,
    status: sessionData.status,
    totalTasks: sessionData.totalTasks,
    completed: sessionData.completed,
    failed: sessionData.failed,
    elapsed: sessionData.elapsed,
    steps: sessionData.steps,
    createdAt: new Date().toISOString()
  };

  allSessions[username].unshift(session); // newest first

  // Keep last 50 sessions per user
  if (allSessions[username].length > 50) {
    allSessions[username] = allSessions[username].slice(0, 50);
  }

  writeJSON(SESSIONS_FILE, allSessions);
  return session;
}

function getSessions(username) {
  const allSessions = readJSON(SESSIONS_FILE);
  return allSessions[username] || [];
}

function getSession(username, sessionId) {
  const sessions = getSessions(username);
  return sessions.find(s => s.id === sessionId) || null;
}

function deleteSession(username, sessionId) {
  const allSessions = readJSON(SESSIONS_FILE);
  if (!allSessions[username]) return false;
  const idx = allSessions[username].findIndex(s => s.id === sessionId);
  if (idx === -1) return false;
  allSessions[username].splice(idx, 1);
  writeJSON(SESSIONS_FILE, allSessions);
  return true;
}

module.exports = {
  createUser,
  loginUser,
  getUserByToken,
  saveSession,
  getSessions,
  getSession,
  deleteSession
};
