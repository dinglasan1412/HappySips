process.env.AUTH_SECRET = 'test-secret-for-local-verification-only';

import {
  handleDataRequest,
  handleLoginRequest,
  handleAccountRequestSubmit,
  handleAccountRequestList,
  handleAccountRequestReview,
} from '../lib/handlers.js';
import { verifyToken } from '../lib/auth.js';

function createMockRedis() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async set(key, value) { store.set(key, value); return 'OK'; },
  };
}

function createRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.setHeader = () => res;
  res.end = () => res;
  return res;
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

async function login(redis, username, password) {
  return handleLoginRequest({ method: 'POST', body: { username, password } }, createRes(), redis);
}

async function run() {
  const redis = createMockRedis();

  console.log('\n-- Seeding & public reads --');
  let res = await handleDataRequest({ method: 'GET', query: { key: 'inventory:items' } }, createRes(), redis);
  check('GET inventory:items seeds and returns 10 items', res.statusCode === 200 && res.body.value.length === 10);

  res = await handleDataRequest({ method: 'GET', query: { key: 'sales:records' } }, createRes(), redis);
  check('GET sales:records seeds and returns 18 placeholder sales', res.statusCode === 200 && res.body.value.length === 18);

  res = await handleDataRequest({ method: 'GET', query: { key: 'auth:users' } }, createRes(), redis);
  check('GET auth:users is rejected (never publicly readable)', res.statusCode === 403);

  res = await handleDataRequest({ method: 'GET', query: { key: 'auth:requests' } }, createRes(), redis);
  check('GET auth:requests is rejected via the data API', res.statusCode === 403);

  console.log('\n-- Login: seeded accounts --');
  res = await login(redis, 'admin', 'wrongpassword');
  check('Wrong password fails', res.statusCode === 401);

  res = await login(redis, 'nobody', 'admin123');
  check('Unknown username fails', res.statusCode === 401);

  res = await login(redis, 'admin', 'admin123');
  check('Demo admin login succeeds', res.statusCode === 200);
  check('Demo admin token is UNVERIFIED', res.body.user.verified === false);
  const demoAdminToken = res.body.token;

  res = await login(redis, 'staff', 'staff123');
  check('Demo staff login succeeds', res.statusCode === 200);
  check('Demo staff token is UNVERIFIED', res.body.user.verified === false);
  const demoStaffToken = res.body.token;

  res = await login(redis, 'owner', 'byTi5v2qpv');
  check('Bootstrap owner login succeeds', res.statusCode === 200);
  check('Owner token IS verified', res.body.user.verified === true);
  check('Owner role is Admin', res.body.user.role === 'Admin');
  const ownerToken = res.body.token;

  console.log('\n-- Demo (unverified) accounts cannot write, even with the right role --');
  res = await handleDataRequest({ method: 'POST', query: { key: 'sales:records' }, headers: { authorization: `Bearer ${demoAdminToken}` }, body: { value: [{ id: 'x' }] } }, createRes(), redis);
  check('Demo ADMIN cannot write sales', res.statusCode === 403, `got ${res.statusCode}: ${JSON.stringify(res.body)}`);

  res = await handleDataRequest({ method: 'POST', query: { key: 'sales:records' }, headers: { authorization: `Bearer ${demoStaffToken}` }, body: { value: [{ id: 'x' }] } }, createRes(), redis);
  check('Demo STAFF cannot write sales', res.statusCode === 403);

  res = await handleDataRequest({ method: 'POST', query: { key: 'inventory:items' }, headers: { authorization: `Bearer ${demoAdminToken}` }, body: { value: [] } }, createRes(), redis);
  check('Demo ADMIN cannot write inventory', res.statusCode === 403);

  console.log('\n-- Verified owner CAN write --');
  res = await handleDataRequest({ method: 'POST', query: { key: 'sales:records' }, headers: { authorization: `Bearer ${ownerToken}` }, body: { value: [{ id: 'owner-sale' }] } }, createRes(), redis);
  check('Verified owner can write sales', res.statusCode === 200);

  res = await handleDataRequest({ method: 'POST', query: { key: 'inventory:items' }, headers: { authorization: `Bearer ${ownerToken}` }, body: { value: [{ id: 'owner-item' }] } }, createRes(), redis);
  check('Verified owner (Admin) can write inventory', res.statusCode === 200);

  console.log('\n-- Account request: submission --');
  res = await handleAccountRequestSubmit({ method: 'POST', body: { name: 'Bea Santos', username: 'bea', password: 'beapass123', contact: '0917xxxxxxx', role: 'Staff' } }, createRes(), redis);
  check('Valid request submission succeeds', res.statusCode === 200, JSON.stringify(res.body));

  res = await handleAccountRequestSubmit({ method: 'POST', body: { name: 'Someone Else', username: 'bea', password: 'anotherpass', contact: 'x@example.com', role: 'Staff' } }, createRes(), redis);
  check('Duplicate username (already pending) is rejected', res.statusCode === 409);

  res = await handleAccountRequestSubmit({ method: 'POST', body: { name: 'X', username: 'admin', password: 'anotherpass', contact: 'x@example.com', role: 'Admin' } }, createRes(), redis);
  check('Username matching an existing account is rejected', res.statusCode === 409);

  res = await handleAccountRequestSubmit({ method: 'POST', body: { name: 'Y', username: 'short', password: '123', contact: 'x@example.com', role: 'Staff' } }, createRes(), redis);
  check('Too-short password is rejected', res.statusCode === 400);

  res = await handleAccountRequestSubmit({ method: 'POST', body: { name: 'Z', username: 'bad role', password: 'validpass123', contact: 'x@example.com', role: 'Staff' } }, createRes(), redis);
  check('Username with a space is rejected', res.statusCode === 400);

  console.log('\n-- Account request: who can see the queue --');
  res = await handleAccountRequestList({ method: 'GET', headers: {} }, createRes(), redis);
  check('Listing requests with no token fails', res.statusCode === 401);

  res = await handleAccountRequestList({ method: 'GET', headers: { authorization: `Bearer ${demoAdminToken}` } }, createRes(), redis);
  check('Demo (unverified) admin CANNOT see the request queue', res.statusCode === 403, `got ${res.statusCode}`);

  res = await handleAccountRequestList({ method: 'GET', headers: { authorization: `Bearer ${demoStaffToken}` } }, createRes(), redis);
  check('Demo staff cannot see the request queue', res.statusCode === 403);

  res = await handleAccountRequestList({ method: 'GET', headers: { authorization: `Bearer ${ownerToken}` } }, createRes(), redis);
  check('Verified owner CAN see the request queue', res.statusCode === 200);
  check('Queue does not leak password hash/salt', res.body.value[0].hash === undefined && res.body.value[0].salt === undefined);
  const pendingId = res.body.value.find(r => r.username === 'bea')?.id;
  check('Pending Bea request is in the queue', !!pendingId);

  console.log('\n-- Account request: approval grants a real, working login --');
  res = await handleAccountRequestReview({ method: 'POST', headers: { authorization: `Bearer ${demoAdminToken}` }, body: { id: pendingId, action: 'approve' } }, createRes(), redis);
  check('Demo admin cannot approve requests', res.statusCode === 403);

  res = await handleAccountRequestReview({ method: 'POST', headers: { authorization: `Bearer ${ownerToken}` }, body: { id: pendingId, action: 'approve' } }, createRes(), redis);
  check('Verified owner can approve a request', res.statusCode === 200, JSON.stringify(res.body));

  res = await login(redis, 'bea', 'beapass123');
  check('Bea can now log in with her requested credentials', res.statusCode === 200);
  check("Bea's account is verified", res.body.user.verified === true);
  check("Bea's role is Staff, as requested", res.body.user.role === 'Staff');
  const beaToken = res.body.token;

  res = await handleDataRequest({ method: 'POST', query: { key: 'sales:records' }, headers: { authorization: `Bearer ${beaToken}` }, body: { value: [{ id: 'bea-sale' }] } }, createRes(), redis);
  check('Bea (verified Staff) can write sales', res.statusCode === 200);

  res = await handleDataRequest({ method: 'POST', query: { key: 'inventory:items' }, headers: { authorization: `Bearer ${beaToken}` }, body: { value: [] } }, createRes(), redis);
  check('Bea (Staff, not Admin) still cannot write inventory', res.statusCode === 403);

  res = await handleAccountRequestList({ method: 'GET', headers: { authorization: `Bearer ${ownerToken}` } }, createRes(), redis);
  check('Approved request no longer sits in the pending queue', !res.body.value.some(r => r.username === 'bea'));

  console.log('\n-- Account request: denial --');
  res = await handleAccountRequestSubmit({ method: 'POST', body: { name: 'Rejected Rick', username: 'rick', password: 'rickpass123', contact: 'rick@example.com', role: 'Admin' } }, createRes(), redis);
  check('Second request submits fine', res.statusCode === 200);
  res = await handleAccountRequestList({ method: 'GET', headers: { authorization: `Bearer ${ownerToken}` } }, createRes(), redis);
  const rickId = res.body.value.find(r => r.username === 'rick')?.id;

  res = await handleAccountRequestReview({ method: 'POST', headers: { authorization: `Bearer ${ownerToken}` }, body: { id: rickId, action: 'deny' } }, createRes(), redis);
  check('Owner can deny a request', res.statusCode === 200);

  res = await login(redis, 'rick', 'rickpass123');
  check('Denied applicant cannot log in — the account was never created', res.statusCode === 401);

  console.log('\n-- Token tampering (unchanged from before, still must hold) --');
  const [validBody] = ownerToken.split('.');
  const forged = validBody + '.' + 'a'.repeat(43);
  res = await handleDataRequest({ method: 'POST', query: { key: 'sales:records' }, headers: { authorization: `Bearer ${forged}` }, body: { value: [] } }, createRes(), redis);
  check('Tampered token signature is rejected', res.statusCode === 401);

  const fakePayload = Buffer.from(JSON.stringify({ username: 'staff', role: 'Admin', name: 'Staff User', verified: true, exp: Date.now() + 100000 })).toString('base64url');
  res = await handleDataRequest({ method: 'POST', query: { key: 'inventory:items' }, headers: { authorization: `Bearer ${fakePayload}.forgedsignature` }, body: { value: [] } }, createRes(), redis);
  check('Forged verified+Admin payload (wrong signature) is rejected', res.statusCode === 401);

  const expiredPayload = { username: 'owner', role: 'Admin', name: 'Owner', verified: true, exp: Date.now() - 1000 };
  const crypto = await import('crypto');
  const body = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET).update(body).digest('base64url');
  const expiredToken = `${body}.${sig}`;
  check('Expired token (correctly signed) fails verification', verifyToken(`Bearer ${expiredToken}`) === null);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

run();
