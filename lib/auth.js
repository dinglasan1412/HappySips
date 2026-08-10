import crypto from 'crypto';

// Password hashing (scrypt, built into Node — no bcrypt dependency needed).
export function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function makeUser(username, password, role, name, verified = false) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { username, salt, hash: hashPassword(password, salt), role, name, verified };
}

export function verifyPassword(password, user) {
  const candidate = hashPassword(password, user.salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(user.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Signed, stateless session tokens (HMAC-SHA256). No JWT library needed —
// this is just base64url(payload) + "." + HMAC signature of that string.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set.');
  }
  return secret;
}

export function signToken(user) {
  const payload = { username: user.username, role: user.role, name: user.name, verified: !!user.verified, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  let expectedSig;
  try {
    expectedSig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Date.now()) return null;
  return payload; // { username, role, name, exp }
}
