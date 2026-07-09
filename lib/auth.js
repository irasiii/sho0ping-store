// Simple user accounts + sessions.
// Users live in data/users.json; passwords stored as salted SHA-256 hashes.
// A default admin (admin / admin123) is created on first run — change it!
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'users.json');
const sessions = new Map(); // sid -> { username, role }

function hash(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
}

function loadUsers() {
  if (!fs.existsSync(FILE)) return [];
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

function saveUsers(users) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

function ensureDefaultAdmin() {
  const users = loadUsers();
  if (!users.length) {
    addUser('admin', 'admin123', 'admin');
    console.log('Created default admin login: admin / admin123 (please change it in My Store -> Users)');
  }
}

function addUser(username, password, role) {
  const users = loadUsers();
  username = String(username).trim().toLowerCase();
  if (!username || !password) throw new Error('username and password required');
  if (users.find(u => u.username === username)) throw new Error('user already exists');
  const salt = crypto.randomBytes(8).toString('hex');
  users.push({
    username, salt, hash: hash(password, salt),
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  return { username, role: role === 'admin' ? 'admin' : 'user' };
}

function checkLogin(username, password) {
  const u = loadUsers().find(x => x.username === String(username).trim().toLowerCase());
  if (!u || u.hash !== hash(password, u.salt)) return null;
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { username: u.username, role: u.role });
  return { sid, username: u.username, role: u.role };
}

function fromRequest(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return (m && sessions.get(m[1])) || null;
}

function logout(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (m) sessions.delete(m[1]);
}

// Express middleware: only admins pass
function requireAdmin(req, res, next) {
  const user = fromRequest(req);
  if (!user) return res.status(401).json({ error: 'Please log in.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  req.user = user;
  next();
}

function listUsers() {
  return loadUsers().map(u => ({ username: u.username, role: u.role, createdAt: u.createdAt }));
}

module.exports = { ensureDefaultAdmin, addUser, checkLogin, fromRequest, logout, requireAdmin, listUsers };
