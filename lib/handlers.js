import { readKey, writeKey } from './store.js';
import { verifyToken, verifyPassword, signToken, makeUser } from './auth.js';
import { SEED_INVENTORY, SEED_MENU, generatePlaceholderSales, seedUsers } from './seed-data.js';
import { sendAccountRequestEmail } from './email.js';

// Keys readable via GET (auth:users and auth:requests are intentionally
// never exposed here — only the auth/account-request endpoints touch them,
// server-side, with their own permission checks).
const READABLE = {
  'inventory:items': () => SEED_INVENTORY,
  'menu:items': () => SEED_MENU,
  'sales:records': () => generatePlaceholderSales(),
};

// Which roles may write which key. 'any' = any verified logged-in user.
// Demo (unverified) accounts can never write, regardless of role.
const WRITE_RULES = {
  'sales:records': 'any',
  'inventory:items': 'Admin',
  'menu:items': 'Admin',
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function requireVerifiedAdmin(req) {
  const auth = verifyToken(req.headers.authorization);
  if (!auth) return { error: { status: 401, message: 'Please log in again.' } };
  if (!auth.verified || auth.role !== 'Admin') {
    return { error: { status: 403, message: 'Only an approved Admin account can do this.' } };
  }
  return { auth };
}

export async function handleDataRequest(req, res, redis) {
  const body = req.method === 'POST' ? parseBody(req) : {};
  const key = req.query?.key || body.key;

  if (req.method === 'GET') {
    if (!READABLE[key]) {
      return res.status(403).json({ error: 'That key is not readable.' });
    }
    const value = await readKey(redis, key, READABLE[key]);
    return res.status(200).json({ value });
  }

  if (req.method === 'POST') {
    const requiredRole = WRITE_RULES[key];
    if (!requiredRole) {
      return res.status(403).json({ error: 'That key is not writable.' });
    }
    const auth = verifyToken(req.headers.authorization);
    if (!auth) {
      return res.status(401).json({ error: 'Please log in again.' });
    }
    if (!auth.verified) {
      return res.status(403).json({ error: 'This is a view-only demo account. Request a real account to make changes.' });
    }
    if (requiredRole !== 'any' && auth.role !== requiredRole) {
      return res.status(403).json({ error: `Only ${requiredRole} can edit this.` });
    }
    const { value } = body;
    if (value === undefined) {
      return res.status(400).json({ error: 'Missing value.' });
    }
    await writeKey(redis, key, value);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed.' });
}

export async function handleLoginRequest(req, res, redis) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { username, password } = parseBody(req);
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const users = await readKey(redis, 'auth:users', seedUsers);
  const user = users.find(u => u.username === username);
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = signToken(user);
  return res.status(200).json({
    token,
    user: { username: user.username, role: user.role, name: user.name, verified: !!user.verified },
  });
}

// ------------------------------------------------------------
// Account requests — anyone can submit one; only a verified Admin
// can see the queue or approve/deny.
// ------------------------------------------------------------
export async function handleAccountRequestSubmit(req, res, redis) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, username, password, contact, role } = parseBody(req);
  if (!name || !username || !password || !contact || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (role !== 'Admin' && role !== 'Staff') {
    return res.status(400).json({ error: 'Role must be Admin or Staff.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (/\s/.test(username)) {
    return res.status(400).json({ error: 'Username cannot contain spaces.' });
  }

  const users = await readKey(redis, 'auth:users', seedUsers);
  const requests = await readKey(redis, 'auth:requests', () => []);
  const taken = users.some(u => u.username === username) || requests.some(r => r.username === username);
  if (taken) {
    return res.status(409).json({ error: 'That username is already taken or pending.' });
  }

  const hashed = makeUser(username, password, role, name, false);
  const request = {
    id: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    ...hashed,
    contact,
    requestedAt: new Date().toISOString(),
  };
  await writeKey(redis, 'auth:requests', [...requests, request]);

  // A failed/unconfigured email should never block the request itself —
  // it's still saved and visible in the Account Requests screen either way.
  await sendAccountRequestEmail({ name, username, contact, role });

  return res.status(200).json({ ok: true });
}

export async function handleAccountRequestList(req, res, redis) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const { error } = requireVerifiedAdmin(req);
  if (error) return res.status(error.status).json({ error: error.message });

  const requests = await readKey(redis, 'auth:requests', () => []);
  const safe = requests.map(({ id, name, username, contact, role, requestedAt }) => ({ id, name, username, contact, role, requestedAt }));
  return res.status(200).json({ value: safe });
}

export async function handleAccountRequestReview(req, res, redis) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const { error, auth } = requireVerifiedAdmin(req);
  if (error) return res.status(error.status).json({ error: error.message });

  const { id, action } = parseBody(req);
  if (!id || (action !== 'approve' && action !== 'deny')) {
    return res.status(400).json({ error: 'Missing id or invalid action.' });
  }

  const requests = await readKey(redis, 'auth:requests', () => []);
  const target = requests.find(r => r.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Request not found — it may have already been handled.' });
  }
  const remaining = requests.filter(r => r.id !== id);
  await writeKey(redis, 'auth:requests', remaining);

  if (action === 'approve') {
    const users = await readKey(redis, 'auth:users', seedUsers);
    const { id: _id, contact: _contact, requestedAt: _requestedAt, ...userRecord } = target;
    await writeKey(redis, 'auth:users', [...users, { ...userRecord, verified: true }]);
  }

  return res.status(200).json({ ok: true });
}

