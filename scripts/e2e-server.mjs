// Local-only stand-in for `vercel dev` — serves the built dist/ folder and
// wires /api/data + /api/login to the REAL handler logic (lib/handlers.js),
// backed by an in-memory mock Redis since no real Upstash is available here.
// This is NOT part of the shipped project — it only exists to let this
// response verify the app end-to-end before handing it over.
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'e2e-test-secret';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleDataRequest,
  handleLoginRequest,
  handleAccountRequestSubmit,
  handleAccountRequestList,
  handleAccountRequestReview,
} from '../lib/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createMockRedis() {
  const store = new Map();
  return {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async set(key, value) { store.set(key, value); return 'OK'; },
  };
}
const redis = createMockRedis();

const app = express();
app.use(express.json());

app.get('/api/data', (req, res) => handleDataRequest(req, res, redis));
app.post('/api/data', (req, res) => handleDataRequest(req, res, redis));
app.post('/api/login', (req, res) => handleLoginRequest(req, res, redis));
app.get('/api/account-requests', (req, res) => handleAccountRequestList(req, res, redis));
app.post('/api/account-requests', (req, res) => handleAccountRequestSubmit(req, res, redis));
app.post('/api/account-requests-review', (req, res) => handleAccountRequestReview(req, res, redis));

app.use(express.static(path.join(__dirname, '..', 'dist')));

const PORT = 4500;
app.listen(PORT, () => console.log(`e2e server on http://localhost:${PORT}`));
